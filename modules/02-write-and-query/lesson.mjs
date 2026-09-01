export default {
  title: 'Write & query time-series data',
  duration: '9 min',
  summary: 'Bulk-load rows, bucket them into intervals, and join a hypertable with ordinary metadata.',
  objectives: [
    'Load many rows efficiently with INSERT ... SELECT',
    'Aggregate by interval with time_bucket()',
    'Use first(), last() and time-ordered queries',
    'Join a hypertable to a regular relational table',
  ],
  steps: [
    {
      title: 'The dataset you are working with',
      explain:
        'Two tables: sensors is an ordinary PostgreSQL table of metadata, and readings is the hypertable of ' +
        'measurements. This split is the normal pattern - keep slow-changing metadata relational, and put the ' +
        'high-volume time-stamped facts in the hypertable.',
      sql: `SELECT
  (SELECT count(*) FROM sensors)  AS sensors,
  (SELECT count(*) FROM readings) AS readings,
  (SELECT min(time) FROM readings) AS first_reading,
  (SELECT max(time) FROM readings) AS last_reading;`,
    },
    {
      title: 'Writing rows is just INSERT',
      explain:
        'There is no special ingest API. A single-row INSERT is routed to the correct chunk automatically.',
      sql: `INSERT INTO readings (time, sensor_id, temperature, humidity, battery, energy_kwh)
VALUES (now(), 1, 21.7, 47.2, 88.0, 999.0)
RETURNING time, sensor_id, temperature;`,
      takeaway:
        'Routing happens on write, so there is no partition maintenance job for you to run and no chance of ' +
        'inserting into the "wrong" partition.',
    },
    {
      title: 'Bulk loading: let the server generate the rows',
      explain:
        'Row-at-a-time inserts are dominated by round trips. The three fast options are COPY, multi-row ' +
        'INSERT, and - when the data is derived - INSERT ... SELECT, which never leaves the server. Here we ' +
        'generate a full day of one-minute readings for a new sensor in a single statement.',
      sql: `INSERT INTO sensors (sensor_id, name, site, model, installed_at)
VALUES (99, 'sensor-99', 'lab', 'TS-350', CURRENT_DATE)
ON CONFLICT (sensor_id) DO NOTHING;

DELETE FROM readings WHERE sensor_id = 99;

INSERT INTO readings (time, sensor_id, temperature, humidity, battery, energy_kwh)
SELECT
  ts,
  99,
  20 + 5 * sin(extract(epoch FROM ts) / 3600.0),
  50,
  100,
  extract(epoch FROM ts - (now() - INTERVAL '1 day')) / 3600.0
FROM generate_series(now() - INTERVAL '1 day', now(), INTERVAL '1 minute') AS ts;`,
      note:
        'For loading a file from a client, COPY is the fastest path: COPY readings FROM STDIN WITH (FORMAT csv).',
    },
    {
      title: 'How many rows did that add?',
      sql: `SELECT count(*) AS rows_for_sensor_99 FROM readings WHERE sensor_id = 99;`,
    },
    {
      title: 'Updating and deleting rows',
      explain:
        'UPDATE and DELETE work exactly as in PostgreSQL, and are routed to the right chunks by the same ' +
        'time predicate that speeds up SELECT. Time-series workloads rarely need them row by row, but ' +
        'corrections and backfills do happen.',
      sql: [
        `UPDATE readings
SET temperature = temperature + 0.5
WHERE sensor_id = 99
  AND time >= now() - INTERVAL '10 minutes';`,
        `DELETE FROM readings
WHERE sensor_id = 99
  AND time < now() - INTERVAL '23 hours';`,
      ],
      note:
        'Always include a time filter. Without one, an UPDATE or DELETE has to visit every chunk. For ' +
        'removing whole periods, drop_chunks() in module 05 is far cheaper than DELETE, because it never ' +
        'leaves dead rows behind for VACUUM to reclaim.',
    },
    {
      title: 'Upserts need a unique index that includes the time column',
      explain:
        'ON CONFLICT needs a unique constraint, and on a hypertable a unique index must contain the ' +
        'partitioning column. That is not an arbitrary rule: uniqueness is enforced per chunk, so without ' +
        'the partitioning column the database cannot know which chunk to check.\n\n' +
        'The first statement below deliberately fails so you can recognise the error.',
      expectError: true,
      sql: [
        `DROP TABLE IF EXISTS upsert_demo CASCADE;`,
        `CREATE TABLE upsert_demo (
  time       TIMESTAMPTZ NOT NULL,
  sensor_id  INT         NOT NULL,
  reading    DOUBLE PRECISION
) WITH (tsdb.hypertable, tsdb.partition_column = 'time');`,
        `CREATE UNIQUE INDEX upsert_demo_bad ON upsert_demo (sensor_id);`,
        `CREATE UNIQUE INDEX upsert_demo_ok ON upsert_demo (sensor_id, time);`,
        `INSERT INTO upsert_demo (time, sensor_id, reading)
VALUES ('2026-01-01 00:00+00', 1, 10.0)
ON CONFLICT (sensor_id, time) DO UPDATE SET reading = EXCLUDED.reading
RETURNING sensor_id, reading;`,
        `INSERT INTO upsert_demo (time, sensor_id, reading)
VALUES ('2026-01-01 00:00+00', 1, 99.9)
ON CONFLICT (sensor_id, time) DO UPDATE SET reading = EXCLUDED.reading
RETURNING sensor_id, reading;`,
        `DROP TABLE upsert_demo CASCADE;`,
      ],
      takeaway:
        'The same row was inserted then updated in place - the second statement returns 99.9. Use ' +
        'ON CONFLICT DO NOTHING instead when replaying a feed where duplicates should simply be ignored.',
    },
    {
      title: 'time_bucket(): the workhorse',
      explain:
        'time_bucket() rounds each timestamp down to a fixed-width interval, so GROUP BY turns raw samples ' +
        'into a regular series. It is date_trunc() with arbitrary widths: 5 minutes, 90 seconds, 6 hours.',
      sql: `SELECT
  time_bucket('1 hour', time) AS hour,
  round(avg(temperature)::numeric, 2) AS avg_temp,
  round(max(temperature)::numeric, 2) AS max_temp,
  count(*)                            AS samples
FROM readings
WHERE sensor_id = 1
  AND time >= now() - INTERVAL '6 hours'
GROUP BY hour
ORDER BY hour;`,
      takeaway:
        'Bucket width is an argument, not a schema decision. The same raw table serves 1-minute and 1-day ' +
        'rollups without any change.',
    },
    {
      title: 'Change the width, change the resolution',
      explain: 'The identical query at 15-minute resolution. Only the first argument changed.',
      sql: `SELECT
  time_bucket('15 minutes', time) AS bucket,
  round(avg(temperature)::numeric, 2) AS avg_temp,
  count(*)                            AS samples
FROM readings
WHERE sensor_id = 1
  AND time >= now() - INTERVAL '2 hours'
GROUP BY bucket
ORDER BY bucket;`,
    },
    {
      title: 'first() and last(): value at the edge of a bucket',
      explain:
        'PostgreSQL has no built-in "value of column A at the max of column B". first() and last() do exactly ' +
        'that, and are far cheaper than a self-join or a window function over the whole bucket.',
      sql: `SELECT
  time_bucket('1 hour', time)            AS hour,
  first(temperature, time)               AS opening_temp,
  last(temperature, time)                AS closing_temp,
  round((last(temperature, time) - first(temperature, time))::numeric, 2) AS change
FROM readings
WHERE sensor_id = 1
  AND time >= now() - INTERVAL '5 hours'
GROUP BY hour
ORDER BY hour;`,
      takeaway:
        'first()/last() are the open/close of a candlestick, the final battery level of an hour, the last ' +
        'known state of a device.',
    },
    {
      title: 'Join the hypertable to plain metadata',
      explain:
        'A hypertable joins like any other table, including foreign keys. Aggregate the facts first, then ' +
        'join the small metadata table - that keeps the join input tiny.',
      sql: `SELECT
  s.site,
  count(DISTINCT s.sensor_id)           AS sensors,
  round(avg(r.temperature)::numeric, 2) AS avg_temp,
  round(min(r.battery)::numeric, 1)     AS lowest_battery
FROM readings AS r
JOIN sensors  AS s USING (sensor_id)
WHERE r.time >= now() - INTERVAL '24 hours'
GROUP BY s.site
ORDER BY s.site;`,
    },
    {
      title: 'Latest reading per device',
      explain:
        'A very common time-series question. DISTINCT ON is the idiomatic PostgreSQL answer, and it works ' +
        'well here because the default time-descending index makes the ordering cheap.',
      sql: `SELECT DISTINCT ON (sensor_id)
  sensor_id,
  time,
  round(temperature::numeric, 2) AS temperature,
  round(battery::numeric, 1)     AS battery
FROM readings
WHERE time >= now() - INTERVAL '1 hour'
ORDER BY sensor_id, time DESC;`,
      maxRows: 13,
    },
    {
      title: 'Clean up the extra sensor',
      explain: 'Remove the data added in this module so the shared dataset stays as the seed created it.',
      sql: `DELETE FROM readings WHERE sensor_id = 99 OR energy_kwh = 999.0;
DELETE FROM sensors WHERE sensor_id = 99;`,
    },
  ],
  challenge: {
    prompt:
      'Return the average temperature per site for the last 24 hours, as columns site and avg_temp, ordered by site.',
    hint: 'Join readings to sensors, filter on time, and GROUP BY site.',
    solution: `SELECT s.site, avg(r.temperature) AS avg_temp FROM readings r JOIN sensors s USING (sensor_id) WHERE r.time >= now() - INTERVAL '24 hours' GROUP BY s.site ORDER BY s.site;`,
  },
  next: 'Next: npm run lesson 03  (continuous aggregates)',
};
