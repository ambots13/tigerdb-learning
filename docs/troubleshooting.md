# Troubleshooting

Real errors hit while building this lab against TimescaleDB 2.29, and what they mean.

## Lab setup

### `Cannot reach PostgreSQL at localhost:5433`

The container is not running. `npm run db:up`. If it still fails, `docker ps -a` and check whether a
container named `tigerdb-lab` exited; `npm run db:logs` shows why.

### `Sample data not found. Run npm run seed first.`

Modules 01–08 need the shared dataset. Module 00 works without it.

### `Port 4000 is already in use`

The playground is probably already running — open http://localhost:4000. Otherwise run it elsewhere:

```bash
PORT=4001 npm run play
```

To find and stop the process holding the port:

```bash
ss -ltnp | grep :4000     # shows the pid
kill <pid>
```

### Port 5433 already in use

Set a different port in `.env` (`PGPORT=5434`) — `scripts/db.sh` reads it and publishes accordingly.

### `docker compose` is not available

Not needed. `scripts/db.sh` uses plain `docker run`. The included `compose.yml` is optional.

## SQL errors

### `... is a procedure` / `To call a procedure, use CALL`

Several TimescaleDB APIs are procedures, not functions:

```sql
SELECT add_columnstore_policy('readings', after => INTERVAL '7 days');  -- wrong
CALL   add_columnstore_policy('readings', after => INTERVAL '7 days');  -- right
```

See the table at the end of the [cheatsheet](cheatsheet.md) for which is which.

### `cannot use subquery in CALL argument`

`CALL` will not accept a subquery. To convert a set of chunks, loop in a `DO` block:

```sql
DO $$
DECLARE chunk regclass;
BEGIN
  FOR chunk IN SELECT format('%I.%I', chunk_schema, chunk_name)::regclass
               FROM timescaledb_information.chunks
               WHERE hypertable_name = 'readings' AND NOT is_compressed
  LOOP
    CALL convert_to_columnstore(chunk);
  END LOOP;
END $$;
```

### `refresh_continuous_aggregate() cannot run inside a transaction block`

It commits in batches, so it cannot be part of a multi-statement string (which the driver wraps in an
implicit transaction). Send it as its own statement. In this lab that is why a lesson step can hold an
array of statements — each one is sent separately.

### `locf must be toplevel function call`

`locf` and `interpolate` must be the outermost expression in their output column. Move any rounding
or casting inside:

```sql
round(locf(avg(value))::numeric, 2)          -- wrong
locf(round(avg(value)::numeric, 2))          -- right
```

### `chunk skipping functionality disabled`

`enable_chunk_skipping()` requires the GUC to be on first:

```sql
SET timescaledb.enable_chunk_skipping = on;
SELECT enable_chunk_skipping('readings', 'sensor_id');
```

A session `SET` only affects your connection. For background workers, set it in `postgresql.conf` and
restart.

### `tuple decompression limit exceeded by operation`

An `UPDATE` or `DELETE` matched rows in columnar chunks and had to decompress more tuples than
`timescaledb.max_tuples_decompressed_per_dml_transaction` allows.

Almost always the cause is a missing time predicate, which forces the statement to visit every chunk:

```sql
DELETE FROM readings WHERE sensor_id = 99;                      -- visits every chunk
DELETE FROM readings WHERE sensor_id = 99
  AND time >= now() - INTERVAL '2 days';                        -- visits one or two
```

To remove whole time ranges, use `drop_chunks()` instead of `DELETE` — it never decompresses anything.

### `cannot drop view readings_hourly because other objects depend on it`

A hierarchical continuous aggregate is built on another one. Drop the dependent view first, or drop
each with `CASCADE`. `npm run seed` handles this automatically.

### Multi-statement query returns only the last result

That is how the PostgreSQL simple query protocol works with the `pg` driver, and why the runner sends
lesson statements one at a time.

## Surprising behaviour

### My hypertable was already compressed and I never asked

Creating a table `WITH (tsdb.hypertable)` enables the columnstore **and** installs a default policy
that converts chunks older than a day. Check with:

```sql
SELECT job_id, proc_name, config FROM timescaledb_information.jobs
WHERE hypertable_name = 'readings';
```

The lab's seed deliberately removes this so module 04 can demonstrate a real before/after.

### `approximate_row_count` disagrees with `count(*)`

It reads planner statistics, so it is stale until `ANALYZE` runs, and it does not account for rows in
columnar chunks it has no statistics for. It is for dashboards, not for reconciliation.

### A policy exists but nothing happens

Policies run on a schedule. Check `timescaledb_information.job_stats` for `last_run_status` and
`total_failures`, and force a run with `CALL run_job(<job_id>);`.

### Compression ratio is lower than expected

`segmentby` should be the column you filter by, and it should have relatively few distinct values.
Random, high-cardinality floats compress poorly no matter what. This lab sees roughly 2.7x on
deliberately noisy synthetic data; repetitive production telemetry does far better.

## Resetting

```bash
npm run seed        # rebuild the dataset, drops lab objects
npm run db:reset    # destroy the container entirely and start over
npm run verify      # confirm all 9 modules still run end to end
```
