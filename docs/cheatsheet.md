# SQL cheatsheet

Everything the lab uses, on one page. Verified against TimescaleDB 2.29 and Toolkit 1.25.

## Hypertables

```sql
-- Create (modern syntax)
CREATE TABLE readings (
  time      TIMESTAMPTZ NOT NULL,
  sensor_id INT NOT NULL,
  value     DOUBLE PRECISION
) WITH (
  tsdb.hypertable,
  tsdb.partition_column = 'time',
  tsdb.chunk_interval   = '1 day',
  tsdb.segmentby        = 'sensor_id',   -- columnstore grouping
  tsdb.orderby          = 'time DESC'
);

-- Convert an existing table
SELECT create_hypertable('readings', by_range('time'));

-- Inspect
SELECT * FROM timescaledb_information.hypertables;
SELECT * FROM timescaledb_information.chunks WHERE hypertable_name = 'readings';
SELECT * FROM chunks_detailed_size('readings');
SELECT hypertable_size('readings');
SELECT approximate_row_count('readings');

-- Chunk maintenance
SELECT set_chunk_time_interval('readings', INTERVAL '1 day');
SELECT show_chunks('readings', older_than => INTERVAL '30 days');
SELECT drop_chunks('readings', older_than => INTERVAL '30 days');
```

## Querying

```sql
-- Fixed-width buckets
SELECT time_bucket('15 minutes', time) AS bucket, avg(value)
FROM readings GROUP BY bucket;

-- Value at the edge of a bucket
SELECT first(value, time), last(value, time) FROM readings;

-- Latest row per device
SELECT DISTINCT ON (sensor_id) * FROM readings ORDER BY sensor_id, time DESC;
```

## Continuous aggregates

```sql
CREATE MATERIALIZED VIEW readings_hourly
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', time) AS bucket, sensor_id, avg(value) AS avg_value
FROM readings GROUP BY bucket, sensor_id
WITH NO DATA;

CALL refresh_continuous_aggregate('readings_hourly', NULL, NULL);   -- procedure

SELECT add_continuous_aggregate_policy('readings_hourly',
  start_offset      => INTERVAL '3 days',
  end_offset        => INTERVAL '1 hour',
  schedule_interval => INTERVAL '30 minutes');

ALTER MATERIALIZED VIEW readings_hourly SET (timescaledb.materialized_only = true);

SELECT * FROM timescaledb_information.continuous_aggregates;
```

## Columnstore (hypercore)

```sql
ALTER TABLE readings SET (
  timescaledb.enable_columnstore = true,
  timescaledb.segmentby          = 'sensor_id',
  timescaledb.orderby            = 'time DESC'
);

CALL add_columnstore_policy('readings', after => INTERVAL '7 days');   -- procedure
CALL remove_columnstore_policy('readings', if_exists => true);

-- Convert chunks by hand (CALL cannot take a subquery, so loop in a DO block)
DO $$
DECLARE chunk regclass;
BEGIN
  FOR chunk IN
    SELECT format('%I.%I', chunk_schema, chunk_name)::regclass
    FROM timescaledb_information.chunks
    WHERE hypertable_name = 'readings' AND NOT is_compressed
  LOOP
    CALL convert_to_columnstore(chunk);
  END LOOP;
END $$;

SELECT * FROM hypertable_columnstore_stats('readings');
SELECT * FROM chunk_columnstore_stats('readings');
```

## Jobs & policies

```sql
SELECT add_retention_policy('readings', drop_after => INTERVAL '90 days');
SELECT remove_retention_policy('readings');

-- Reorder completed chunks by an index (cheaper, chunk-wise CLUSTER)
SELECT add_reorder_policy('readings', 'readings_sensor_time_idx');
SELECT remove_reorder_policy('readings');

CALL run_job(1001);                       -- run any policy immediately
SELECT alter_job(1001, scheduled => false);
SELECT delete_job(1001);

-- Custom job
CREATE PROCEDURE my_job(job_id INT, config JSONB) LANGUAGE plpgsql AS $$
BEGIN
  -- your work here
END $$;
SELECT add_job('my_job', schedule_interval => INTERVAL '1 hour', config => '{"k": "v"}');

SELECT * FROM timescaledb_information.jobs;
SELECT * FROM timescaledb_information.job_stats;
```

## Hyperfunctions

```sql
-- Gapfilling: locf/interpolate must be the OUTERMOST call in their column
SELECT time_bucket_gapfill('1 hour', time) AS bucket,
       locf(round(avg(value)::numeric, 2))        AS carried_forward,
       interpolate(round(avg(value)::numeric, 2)) AS interpolated
FROM readings
WHERE time >= now() - INTERVAL '1 day' AND time < now()   -- explicit bounds required
GROUP BY bucket;

-- Counters (handles resets, unlike max - min)
SELECT delta(counter_agg(time, odometer)),
       rate(counter_agg(time, odometer)),        -- per second
       num_resets(counter_agg(time, odometer))
FROM readings;

-- Time-weighted average for irregular sampling
SELECT average(time_weight('Linear', time, value)) FROM readings;   -- or 'LOCF'

-- Percentiles and summary statistics
SELECT approx_percentile(0.95, percentile_agg(value)) FROM readings;
SELECT average(stats_agg(value)), stddev(stats_agg(value)), num_vals(stats_agg(value)) FROM readings;
```

## Performance

```sql
-- Index for the pattern you actually filter by (selective column first)
CREATE INDEX ON readings (sensor_id, time DESC);

-- A UNIQUE index must include the partitioning column (uniqueness is per chunk)
CREATE UNIQUE INDEX ON readings (sensor_id, time);

-- SkipScan: DISTINCT straight off the index, needs an index on that column
EXPLAIN (COSTS OFF) SELECT DISTINCT sensor_id FROM readings;   -- Custom Scan (SkipScan)
SET timescaledb.enable_skipscan = off;                          -- to compare

-- Chunk skipping on a non-time column
SET timescaledb.enable_chunk_skipping = on;     -- also set in postgresql.conf
SELECT enable_chunk_skipping('readings', 'sensor_id');

EXPLAIN (ANALYZE, COSTS OFF) SELECT ... ;       -- count the chunk scan nodes
SELECT * FROM pg_stat_user_indexes WHERE relname LIKE 'readings%';
```

## Writing data

```sql
-- Upsert (requires a unique index containing the partitioning column)
INSERT INTO readings (time, sensor_id, temperature)
VALUES (now(), 1, 21.0)
ON CONFLICT (sensor_id, time) DO UPDATE SET temperature = EXCLUDED.temperature;

-- Always give UPDATE/DELETE a time predicate so chunks can be excluded
UPDATE readings SET temperature = temperature + 0.5
WHERE sensor_id = 1 AND time >= now() - INTERVAL '1 hour';

-- For removing whole periods, prefer dropping chunks over DELETE
SELECT drop_chunks('readings', older_than => INTERVAL '90 days');
```

## Function or procedure?

A frequent source of errors. These need `CALL`, not `SELECT`:

| Needs `CALL` | Use `SELECT` |
| --- | --- |
| `refresh_continuous_aggregate` | `add_continuous_aggregate_policy` |
| `add_columnstore_policy` | `add_retention_policy` |
| `remove_columnstore_policy` | `remove_retention_policy` |
| `convert_to_columnstore` | `add_job` / `alter_job` / `delete_job` |
| `run_job` | `show_chunks` / `drop_chunks` |
