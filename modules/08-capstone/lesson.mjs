export default {
  title: 'Capstone: a complete pipeline',
  duration: '12 min',
  summary: 'Assemble everything into one production-shaped pipeline: ingest, rollup, compress, retain, query.',
  objectives: [
    'Design a hypertable for a real workload',
    'Layer a continuous aggregate and its refresh policy on top',
    'Add columnstore and retention policies for the full data lifecycle',
    'Answer dashboard questions from the rollup instead of the raw table',
  ],
  steps: [
    {
      title: 'The brief',
      explain:
        'A fleet of delivery vehicles reports speed, fuel level and an odometer reading every 10 seconds. ' +
        'You need: live status per vehicle, an hourly dashboard covering months of history, and a storage ' +
        'plan that keeps costs flat.\n\n' +
        'That maps onto four decisions: chunk interval, rollup definition, when to compress, and when to ' +
        'delete. Everything else follows.',
      sql: `SELECT 'ready' AS status;`,
    },
    {
      title: 'Step 1 - the hypertable',
      explain:
        'A 1 day chunk interval suits a workload that is queried by recent time ranges and compressed after ' +
        'a week. segmentby on vehicle_id is set now so that the columnstore has the right grouping later.',
      sql: [
        `DROP MATERIALIZED VIEW IF EXISTS fleet_hourly CASCADE;`,
        `DROP TABLE IF EXISTS fleet_telemetry CASCADE;`,
        `CREATE TABLE fleet_telemetry (
  time        TIMESTAMPTZ      NOT NULL,
  vehicle_id  INT              NOT NULL,
  speed_kph   DOUBLE PRECISION,
  fuel_pct    DOUBLE PRECISION,
  odometer_km DOUBLE PRECISION
) WITH (
  tsdb.hypertable,
  tsdb.partition_column = 'time',
  tsdb.chunk_interval   = '1 day',
  tsdb.segmentby        = 'vehicle_id',
  tsdb.orderby          = 'time DESC'
);`,
      ],
      note:
        'Because this table is created WITH (tsdb.hypertable), the columnstore is already enabled and a ' +
        'default policy exists - we will replace it with our own in step 5.',
    },
    {
      title: 'Step 2 - ingest',
      explain:
        'Fourteen days of 1-minute telemetry for 8 vehicles, generated server-side. odometer_km increases ' +
        'monotonically so counter_agg can measure distance travelled.',
      sql: [
        `INSERT INTO fleet_telemetry (time, vehicle_id, speed_kph, fuel_pct, odometer_km)
SELECT
  ts,
  v,
  greatest(0, 45 + 35 * sin(extract(epoch FROM ts) / 1800.0 + v)),
  100 - 60 * ((extract(epoch FROM ts)::bigint % 86400) / 86400.0),
  extract(epoch FROM ts - (now() - INTERVAL '14 days')) / 3600.0 * (40 + v)
FROM generate_series(now() - INTERVAL '14 days', now(), INTERVAL '1 minute') AS ts
CROSS JOIN generate_series(1, 8) AS v;`,
        `SELECT
  count(*)                                    AS rows,
  count(DISTINCT vehicle_id)                  AS vehicles,
  pg_size_pretty(hypertable_size('fleet_telemetry')) AS size
FROM fleet_telemetry;`,
      ],
    },
    {
      title: 'Step 3 - the rollup the dashboard will actually query',
      explain:
        'Define the aggregate around the questions being asked: average and peak speed, fuel level at the ' +
        'end of the hour, and distance covered. Storing counter_agg as a value means distance can be ' +
        're-derived later without the raw rows.',
      sql: [
        `CREATE MATERIALIZED VIEW fleet_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  vehicle_id,
  avg(speed_kph)              AS avg_speed,
  max(speed_kph)              AS max_speed,
  last(fuel_pct, time)        AS fuel_at_end,
  counter_agg(time, odometer_km) AS odo,
  count(*)                    AS samples
FROM fleet_telemetry
GROUP BY bucket, vehicle_id
WITH NO DATA;`,
        `CALL refresh_continuous_aggregate('fleet_hourly', NULL, NULL);`,
        `SELECT count(*) AS materialized_buckets FROM fleet_hourly;`,
      ],
    },
    {
      title: 'Step 4 - keep the rollup fresh',
      explain:
        'The refresh policy trails one hour behind real time so it never re-materializes the bucket that is ' +
        'still filling. Real-time aggregation covers that most recent hour for readers.',
      sql: `SELECT add_continuous_aggregate_policy('fleet_hourly',
  start_offset      => INTERVAL '2 days',
  end_offset        => INTERVAL '1 hour',
  schedule_interval => INTERVAL '30 minutes',
  if_not_exists     => true
) AS job_id;`,
    },
    {
      title: 'Step 5 - the storage lifecycle',
      explain:
        'Two policies define the whole lifecycle: rows stay row-oriented for 7 days while they are hot, ' +
        'become columnar afterwards, and are dropped entirely at 90 days. The raw table stays a fixed size ' +
        'forever while the rollup keeps the history that matters.',
      sql: [
        `CALL remove_columnstore_policy('fleet_telemetry', if_exists => true);`,
        `CALL add_columnstore_policy('fleet_telemetry', after => INTERVAL '7 days', if_not_exists => true);`,
        `SELECT add_retention_policy('fleet_telemetry', drop_after => INTERVAL '90 days', if_not_exists => true) AS job_id;`,
        `SELECT job_id, proc_name, schedule_interval, config
FROM timescaledb_information.jobs
WHERE hypertable_name = 'fleet_telemetry'
ORDER BY job_id;`,
      ],
    },
    {
      title: 'Step 6 - compress the history now',
      explain:
        'The policy will do this on its schedule; we force it here so the rest of the module runs against a ' +
        'realistic mix of columnar history and row-oriented recent data.',
      sql: [
        `DO $$
DECLARE
  chunk regclass;
BEGIN
  FOR chunk IN
    SELECT format('%I.%I', chunk_schema, chunk_name)::regclass
    FROM timescaledb_information.chunks
    WHERE hypertable_name = 'fleet_telemetry'
      AND NOT is_compressed
      AND range_end < now() - INTERVAL '7 days'
  LOOP
    CALL convert_to_columnstore(chunk);
  END LOOP;
END $$;`,
        `SELECT
  count(*)                              AS chunks,
  count(*) FILTER (WHERE is_compressed) AS columnar,
  pg_size_pretty(hypertable_size('fleet_telemetry')) AS size
FROM timescaledb_information.chunks
WHERE hypertable_name = 'fleet_telemetry';`,
      ],
    },
    {
      title: 'Dashboard query 1 - live fleet status',
      explain:
        'The "right now" panel reads raw data, because it only needs the last few minutes and the time index ' +
        'makes that nearly free.',
      sql: `SELECT DISTINCT ON (vehicle_id)
  vehicle_id,
  time,
  round(speed_kph::numeric, 1) AS speed_kph,
  round(fuel_pct::numeric, 1)  AS fuel_pct
FROM fleet_telemetry
WHERE time >= now() - INTERVAL '15 minutes'
ORDER BY vehicle_id, time DESC;`,
    },
    {
      title: 'Dashboard query 2 - two weeks of history from the rollup',
      explain:
        'The historical panel never touches the raw table. delta() reads distance straight out of the stored ' +
        'counter_agg, which is why the rollup remains useful even after the raw rows are dropped.',
      sql: `SELECT
  time_bucket('1 day', bucket)            AS day,
  round(avg(avg_speed)::numeric, 1)       AS avg_speed,
  round(max(max_speed)::numeric, 1)       AS peak_speed,
  round(sum(delta(odo))::numeric, 1)      AS km_travelled
FROM fleet_hourly
GROUP BY day
ORDER BY day DESC
LIMIT 7;`,
    },
    {
      title: 'Dashboard query 3 - who needs refuelling?',
      explain:
        'Combining the rollup with a hyperfunction: the lowest end-of-hour fuel level per vehicle in the ' +
        'last day, worst first.',
      sql: `SELECT
  vehicle_id,
  round(min(fuel_at_end)::numeric, 1) AS lowest_fuel_pct,
  round(avg(avg_speed)::numeric, 1)   AS avg_speed
FROM fleet_hourly
WHERE bucket >= now() - INTERVAL '1 day'
GROUP BY vehicle_id
ORDER BY lowest_fuel_pct
LIMIT 5;`,
    },
    {
      title: 'What you built',
      explain:
        'One hypertable, one continuous aggregate, three policies. That is the whole pipeline: ingest stays ' +
        'plain SQL, the dashboard reads pre-computed rollups, storage shrinks automatically after a week, ' +
        'and data expires on schedule without anyone running a cron job.',
      sql: `SELECT
  (SELECT count(*) FROM timescaledb_information.chunks WHERE hypertable_name = 'fleet_telemetry') AS chunks,
  (SELECT count(*) FROM fleet_hourly)                                                             AS rollup_rows,
  (SELECT count(*) FROM timescaledb_information.jobs WHERE hypertable_name = 'fleet_telemetry')   AS policies,
  pg_size_pretty(hypertable_size('fleet_telemetry'))                                              AS raw_size;`,
      takeaway:
        'Keep this table around and explore it, or run npm run seed to reset the lab to a clean state.',
    },
  ],
  challenge: {
    prompt:
      'From fleet_hourly, return the vehicle that travelled the most kilometres in the last 7 days: columns vehicle_id and km, one row.',
    hint: 'delta(odo) gives kilometres per bucket; sum them per vehicle and order descending.',
    solution: `SELECT vehicle_id, sum(delta(odo)) AS km FROM fleet_hourly WHERE bucket >= now() - INTERVAL '7 days' GROUP BY vehicle_id ORDER BY km DESC LIMIT 1;`,
  },
  next: 'Core track complete. The advanced track starts here: npm run lesson 09',
};
