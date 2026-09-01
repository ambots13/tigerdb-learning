export default {
  title: 'Continuous aggregates in production',
  duration: '11 min',
  summary: 'The backfill trap: why a rollup can silently disagree with your raw data, and how to fix it.',
  objectives: [
    'Understand that a continuous aggregate is stored data, not a view',
    'Reproduce a stale aggregate caused by backfilled rows',
    'Read the refresh watermark and know what real-time aggregation does not cover',
    'Choose refresh policy offsets that match your late-arrival window',
  ],
  steps: [
    {
      title: 'Set up a rollup you can break',
      explain:
        'Five days of one-minute readings and an hourly rollup, fully materialized. Everything agrees at ' +
        'this point - which is what makes the next steps interesting.',
      sql: [
        `DROP MATERIALIZED VIEW IF EXISTS backfill_hourly CASCADE;`,
        `DROP TABLE IF EXISTS backfill_demo CASCADE;`,
        `CREATE TABLE backfill_demo (
  time TIMESTAMPTZ NOT NULL,
  v    DOUBLE PRECISION
) WITH (tsdb.hypertable, tsdb.partition_column = 'time', tsdb.chunk_interval = '1 day');`,
        `INSERT INTO backfill_demo
SELECT ts, 1
FROM generate_series(now() - INTERVAL '5 days', now(), INTERVAL '1 minute') AS ts;`,
        `CREATE MATERIALIZED VIEW backfill_hourly
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', time) AS bucket, count(*) AS n
FROM backfill_demo
GROUP BY bucket
WITH NO DATA;`,
        `CALL refresh_continuous_aggregate('backfill_hourly', NULL, NULL);`,
      ],
    },
    {
      title: 'Everything agrees - for now',
      explain:
        'The rollup total and the raw count match, because the refresh has covered every bucket that exists.',
      sql: `SELECT
  (SELECT count(*) FROM backfill_demo)   AS raw_rows,
  (SELECT sum(n)   FROM backfill_hourly) AS rollup_total;`,
    },
    {
      title: 'Backfill 500 rows into last week',
      explain:
        'A late shipment of data arrives: a device that was offline, a delayed batch job, a corrected ' +
        'export. The rows land three days ago, inside a range the rollup has already materialized.',
      sql: [
        `INSERT INTO backfill_demo
SELECT now() - INTERVAL '3 days' + make_interval(secs => i), 1
FROM generate_series(1, 500) AS i;`,
        `SELECT
  (SELECT count(*) FROM backfill_demo)   AS raw_rows,
  (SELECT sum(n)   FROM backfill_hourly) AS rollup_total;`,
      ],
      takeaway:
        'The two numbers now disagree by exactly 500. A continuous aggregate is stored data: inserting ' +
        'into the raw table does not retroactively change what was already materialized.',
      note:
        'This is the most common surprise with continuous aggregates. Nothing errors and nothing warns - ' +
        'the dashboard is simply wrong until a refresh covers that range.',
    },
    {
      title: 'Real-time aggregation does not save you here',
      explain:
        'Real-time aggregation (module 03) unions the materialized buckets with a live query over raw ' +
        'data, but only for data newer than the refresh watermark. Backfilled rows are older than the ' +
        'watermark, so they are assumed already materialized and are never re-read.',
      sql: [
        `ALTER MATERIALIZED VIEW backfill_hourly SET (timescaledb.materialized_only = false);`,
        `SELECT
  (SELECT count(*) FROM backfill_demo)   AS raw_rows,
  (SELECT sum(n)   FROM backfill_hourly) AS rollup_with_realtime_on;`,
      ],
      takeaway:
        'Still wrong. Real-time aggregation solves freshness at the head of the table, not correctness ' +
        'behind the watermark.',
    },
    {
      title: 'Where the watermark actually is',
      explain:
        'The watermark is the boundary the refresh has reached. Everything before it is served from stored ' +
        'buckets; everything after it can be filled in live.',
      sql: `SELECT
  user_view_name AS cagg,
  _timescaledb_functions.to_timestamp(
    _timescaledb_functions.cagg_watermark(mat_hypertable_id)
  ) AS watermark
FROM _timescaledb_catalog.continuous_agg
WHERE user_view_name = 'backfill_hourly';`,
      note:
        'This reads an internal catalog. Useful for diagnosis, but do not build an application on it - ' +
        'internal schemas can change between versions.',
    },
    {
      title: 'Fix it with a targeted refresh',
      explain:
        'Refresh only the window the late data landed in. This is cheap and precise; refreshing everything ' +
        'would re-materialize five days to correct one hour.',
      sql: [
        `CALL refresh_continuous_aggregate('backfill_hourly', now() - INTERVAL '4 days', now() - INTERVAL '2 days');`,
        `SELECT
  (SELECT count(*) FROM backfill_demo)   AS raw_rows,
  (SELECT sum(n)   FROM backfill_hourly) AS rollup_total;`,
      ],
      takeaway:
        'They agree again. Whatever writes late data should also refresh the affected window - or a policy ' +
        'must be wide enough to catch it.',
    },
    {
      title: 'Make the policy cover your late-arrival window',
      explain:
        'start_offset is how far back each scheduled refresh reaches. It must be at least as long as your ' +
        'worst realistic late arrival, or the policy will keep skipping past the damage.\n\n' +
        'The cost is real: a wider window re-materializes more buckets on every run, so pick it from ' +
        'measured behaviour rather than optimism.',
      sql: `SELECT add_continuous_aggregate_policy('backfill_hourly',
  start_offset      => INTERVAL '7 days',
  end_offset        => INTERVAL '1 hour',
  schedule_interval => INTERVAL '30 minutes',
  if_not_exists     => true
) AS job_id;`,
      takeaway:
        'Rule of thumb: start_offset larger than your late-arrival window, and end_offset at least one ' +
        'bucket so you never materialize a bucket that is still filling.',
    },
    {
      title: 'Measure lateness instead of guessing it',
      explain:
        'The right start_offset is a measurement, not an opinion. If your ingest records both event time ' +
        'and arrival time, the gap between them is the answer. Here we approximate by asking how far ' +
        'behind now() the newest row in each chunk is.',
      sql: `SELECT
  chunk_name,
  max_time,
  now() - max_time AS behind_now
FROM (
  SELECT
    c.chunk_name,
    c.range_start,
    (SELECT max(time) FROM backfill_demo b
      WHERE b.time >= c.range_start AND b.time < c.range_end) AS max_time
  FROM timescaledb_information.chunks c
  WHERE c.hypertable_name = 'backfill_demo'
) AS s
ORDER BY range_start DESC
LIMIT 5;`,
      note:
        'In production, store an ingested_at column next to your event time. Lateness then becomes a ' +
        'number you can chart and alert on.',
    },
    {
      title: 'Clean up',
      sql: [
        `DROP MATERIALIZED VIEW IF EXISTS backfill_hourly CASCADE;`,
        `DROP TABLE IF EXISTS backfill_demo CASCADE;`,
      ],
    },
  ],
  challenge: {
    prompt:
      'If data can arrive up to 2 days late, how many chunks of readings could still be affected? Return the ' +
      'count of chunks whose range_end is newer than 2 days ago, in a column named affected_chunks.',
    hint: 'timescaledb_information.chunks, filtered on hypertable_name and range_end.',
    solution: `SELECT count(*) AS affected_chunks FROM timescaledb_information.chunks WHERE hypertable_name = 'readings' AND range_end > now() - INTERVAL '2 days';`,
  },
  next: 'Next: npm run lesson 12  (schema design and cardinality)',
};
