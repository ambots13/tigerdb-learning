export default {
  title: 'The index toolbox',
  duration: '12 min',
  summary: 'Every index type you can put on a hypertable, what each one costs, and when it wins.',
  objectives: [
    'Use partial, expression and covering indexes on a hypertable',
    'Compare BRIN against B-tree on time-ordered data',
    'Index JSONB with GIN',
    'Configure the columnstore sparse indexes that TimescaleDB maintains for you',
  ],
  steps: [
    {
      title: 'Indexes on a hypertable are per chunk',
      explain:
        'One CREATE INDEX on a hypertable creates a physical index on every chunk, and on every future ' +
        'chunk. That is what keeps each index small and lets the planner ignore whole chunks without ' +
        'consulting one giant shared index.\n\n' +
        'It also means index storage multiplies by the number of chunks, so an unused index is expensive.',
      sql: `SELECT
  regexp_replace(indexrelname, '^_hyper_\\d+_\\d+_chunk_', '') AS index_name,
  count(*)                                                    AS physical_copies,
  pg_size_pretty(sum(pg_relation_size(indexrelid)))           AS total_size
FROM pg_stat_user_indexes
WHERE indexrelname ~ 'readings'
GROUP BY 1
ORDER BY sum(pg_relation_size(indexrelid)) DESC;`,
      takeaway:
        'The default time index alone already exists once per chunk. Add further indexes deliberately.',
    },
    {
      title: 'Partial index: index only the rows you search for',
      explain:
        'A partial index carries a WHERE clause and only stores matching rows. Alerting queries are the ' +
        'classic case: you only ever look for the unhealthy minority, so indexing the healthy majority is ' +
        'wasted space and write cost.',
      sql: [
        `CREATE INDEX IF NOT EXISTS readings_low_battery_idx
  ON readings (time DESC)
  WHERE battery < 70;`,
        `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT sensor_id, time, battery
FROM readings
WHERE battery < 70
  AND time >= now() - INTERVAL '2 days'
ORDER BY time DESC
LIMIT 10;`,
      ],
      maxRows: 10,
      takeaway:
        'The planner only uses a partial index when the query predicate implies the index predicate. ' +
        'Searching battery < 90 would not use an index built for battery < 70.',
    },
    {
      title: 'Expression index: index the computed value',
      explain:
        'If you filter or group by an expression, index the expression itself. Without it the database has ' +
        'to compute that expression for every candidate row before it can compare anything.',
      sql: [
        `CREATE INDEX IF NOT EXISTS readings_tempint_idx
  ON readings ((temperature::int));`,
        `EXPLAIN (COSTS OFF, SUMMARY OFF)
SELECT count(*) FROM readings
WHERE temperature::int = 20
  AND time >= now() - INTERVAL '1 day';`,
      ],
      maxRows: 8,
      note:
        'The expression in the query must match the indexed expression exactly - temperature::int and ' +
        'round(temperature) are different indexes as far as the planner is concerned.',
    },
    {
      title: 'Covering index: answer from the index alone',
      explain:
        'INCLUDE adds payload columns to a B-tree without making them part of the key. If every column a ' +
        'query needs is present, PostgreSQL can use an Index Only Scan and never touch the table.\n\n' +
        'Look for "Index Only Scan" and "Heap Fetches" in the plan.',
      sql: [
        `CREATE INDEX IF NOT EXISTS readings_cover_idx
  ON readings (sensor_id, time DESC) INCLUDE (temperature);`,
        `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT sensor_id, time, temperature
FROM readings
WHERE sensor_id = 3
  AND time >= now() - INTERVAL '6 hours'
ORDER BY time DESC;`,
      ],
      maxRows: 8,
      takeaway:
        'Covering indexes trade disk for reads. They pay off on narrow, very hot queries - not as a ' +
        'default habit.',
    },
    {
      title: 'BRIN: a tiny index for naturally ordered data',
      explain:
        'A BRIN index stores only the minimum and maximum value per block range, so it is orders of ' +
        'magnitude smaller than a B-tree. It works when the column correlates with physical order, which ' +
        'is exactly what a time column in an append-only table does.\n\n' +
        'Compare the two sizes below.',
      sql: [
        `CREATE INDEX IF NOT EXISTS readings_brin_idx
  ON readings USING brin (time);`,
        `SELECT
  regexp_replace(indexrelname, '^_hyper_\\d+_\\d+_chunk_', '') AS index_name,
  pg_size_pretty(sum(pg_relation_size(indexrelid)))           AS total_size
FROM pg_stat_user_indexes
WHERE indexrelname ~ 'readings_brin_idx|readings_time_idx'
GROUP BY 1
ORDER BY 1;`,
      ],
      takeaway:
        'BRIN is a small fraction of the equivalent B-tree. The trade is precision: BRIN narrows the search ' +
        'to block ranges, and the rows inside them still have to be rechecked.',
    },
    {
      title: 'GIN: indexing inside JSONB',
      explain:
        'Semi-structured payloads need GIN, which indexes the contents of a value rather than the value ' +
        'itself. It powers the containment operator @> and makes tag or attribute lookups viable.',
      sql: [
        `DROP TABLE IF EXISTS events_json CASCADE;`,
        `CREATE TABLE events_json (
  time    TIMESTAMPTZ NOT NULL,
  payload JSONB
) WITH (tsdb.hypertable, tsdb.partition_column = 'time');`,
        `INSERT INTO events_json
SELECT now() - make_interval(mins => i),
       jsonb_build_object('level', i % 5, 'tag', 't' || (i % 9), 'host', 'h' || (i % 30))
FROM generate_series(1, 20000) AS i;`,
        `CREATE INDEX events_json_gin_idx ON events_json USING gin (payload);`,
        `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM events_json WHERE payload @> '{"tag": "t3"}';`,
      ],
      maxRows: 8,
      note:
        'Use jsonb_path_ops - CREATE INDEX ... USING gin (payload jsonb_path_ops) - for a smaller, faster ' +
        'index when you only ever use the @> operator.',
    },
    {
      title: 'Hash: equality and nothing else',
      explain:
        'A hash index supports = only: no ranges, no ordering, no sorting. It can be smaller than a B-tree ' +
        'for wide keys, but a B-tree serves equality too, so hash is rarely the right answer.',
      sql: `CREATE INDEX IF NOT EXISTS events_json_hash_idx
  ON events_json USING hash ((payload ->> 'host'));`,
      note:
        'Included for completeness. Reach for a B-tree first: one structure handles equality, ranges and ' +
        'ORDER BY.',
    },
    {
      title: 'Sparse indexes: the ones you configure, not create',
      explain:
        'Columnar chunks work differently. Rows live inside compressed batches, so a row-oriented index ' +
        'would be useless. Instead TimescaleDB keeps small per-batch summaries called sparse indexes and ' +
        'uses them to discard entire batches before decompressing anything.\n\n' +
        'Two kinds exist: minmax records the range of a column per batch, and bloom stores a bloom filter ' +
        'for equality lookups on high-cardinality columns. You declare them as a table option rather than ' +
        'with CREATE INDEX.',
      sql: [
        `DROP TABLE IF EXISTS spans CASCADE;`,
        `CREATE TABLE spans (
  time       TIMESTAMPTZ NOT NULL,
  tenant_id  INT         NOT NULL,
  trace_id   TEXT        NOT NULL,
  latency_ms DOUBLE PRECISION
) WITH (tsdb.hypertable, tsdb.partition_column = 'time', tsdb.chunk_interval = '1 day');`,
        `INSERT INTO spans
SELECT ts, 1 + (i % 4), md5(i::text), 10 + (i % 500)
FROM generate_series(now() - INTERVAL '4 days', now(), INTERVAL '2 seconds')
     WITH ORDINALITY AS g(ts, i);`,
        `ALTER TABLE spans SET (
  timescaledb.enable_columnstore = true,
  timescaledb.segmentby          = 'tenant_id',
  timescaledb.orderby            = 'time DESC',
  timescaledb.sparse_index       = 'bloom(trace_id), minmax(latency_ms)'
);`,
        `DO $$
DECLARE chunk regclass;
BEGIN
  FOR chunk IN
    SELECT format('%I.%I', chunk_schema, chunk_name)::regclass
    FROM timescaledb_information.chunks
    WHERE hypertable_name = 'spans' AND NOT is_compressed
  LOOP
    CALL convert_to_columnstore(chunk);
  END LOOP;
END $$;`,
      ],
      note:
        'A segmentby column cannot have a sparse index: rows are already grouped by it, so there is ' +
        'nothing left to summarise.',
    },
    {
      title: 'Watch the bloom filter skip batches',
      explain:
        'Now find a single trace among hundreds of thousands of rows. In the plan, the filter ' +
        'bloom1_contains_any_hashes runs against compressed batches - the rows it removes at that level ' +
        'are entire batches thrown away without ever being decompressed.',
      run: async ({ withClient, query, print, table, c, ms }) => {
        const target = (await query(`SELECT md5('12345') AS t`)).rows[0].t;
        const sql = `SELECT count(*) FROM spans WHERE trace_id = '${target}'`;

        const measure = async (client, enabled) => {
          await client.query(`SET timescaledb.enable_sparse_index_bloom = ${enabled ? 'on' : 'off'}`);
          const plan = await client.query(`EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF) ${sql}`);
          let best = Infinity;
          for (let i = 0; i < 3; i += 1) {
            const started = process.hrtime.bigint();
            await client.query(sql);
            best = Math.min(best, Number(process.hrtime.bigint() - started) / 1e6);
          }
          return { lines: plan.rows.map((r) => r['QUERY PLAN']), ms: best };
        };

        await withClient(async (client) => {
          const on = await measure(client, true);
          const off = await measure(client, false);
          await client.query('RESET timescaledb.enable_sparse_index_bloom');

          const bloomLine = on.lines.find((l) => l.includes('bloom1_contains_any_hashes'));
          if (bloomLine) {
            print(`\n  ${c.bold('The sparse index at work:')}`);
            print('  ' + c.gray(bloomLine.trim().slice(0, 120)));
          }
          print('');
          print(
            table(
              [
                { bloom_sparse_index: 'on', best_of_3: ms(on.ms) },
                { bloom_sparse_index: 'off', best_of_3: ms(off.ms) },
              ],
              ['bloom_sparse_index', 'best_of_3'],
            ),
          );
          if (on.ms > 0 && off.ms / on.ms >= 1.1) {
            print(
              `\n  ${c.bold(c.green(`${(off.ms / on.ms).toFixed(1)}x faster`))} ` +
                c.gray('on a needle-in-a-haystack lookup over columnar data.'),
            );
          } else {
            print(
              `\n  ${c.gray('Both are quick at this data size - the plan above is the point: whole batches are never decompressed.')}`,
            );
          }
        });
      },
      takeaway:
        'Sparse indexes are maintained for you and cost almost nothing to store. They are the columnstore ' +
        'answer to "I need to find one specific value".',
    },
    {
      title: 'Choosing an index',
      explain:
        'A rough decision order:\n' +
        '- Range or equality on rowstore data → B-tree, most selective column first\n' +
        '- Only ever a small subset of rows → partial index\n' +
        '- Filtering on a computed value → expression index\n' +
        '- One very hot, narrow query → covering index with INCLUDE\n' +
        '- Huge, append-only, time-correlated → BRIN\n' +
        '- Inside JSONB or arrays → GIN\n' +
        '- Equality on columnar data → bloom sparse index\n' +
        '- Ranges on columnar data → minmax sparse index\n\n' +
        'Then confirm with pg_stat_user_indexes and delete whatever nothing uses.',
      sql: `SELECT
  regexp_replace(indexrelname, '^_hyper_\\d+_\\d+_chunk_', '') AS index_name,
  sum(idx_scan)                                     AS scans,
  pg_size_pretty(sum(pg_relation_size(indexrelid))) AS size
FROM pg_stat_user_indexes
WHERE indexrelname ~ 'readings'
GROUP BY 1
ORDER BY sum(idx_scan) DESC;`,
      takeaway:
        'An index with zero scans after a representative workload is pure cost: it slows every write and ' +
        'occupies space on every chunk.',
    },
    {
      title: 'Clean up',
      explain: 'Remove what this module created so the lab returns to its seeded state.',
      sql: [
        `DROP INDEX IF EXISTS readings_low_battery_idx;`,
        `DROP INDEX IF EXISTS readings_tempint_idx;`,
        `DROP INDEX IF EXISTS readings_cover_idx;`,
        `DROP INDEX IF EXISTS readings_brin_idx;`,
        `DROP TABLE IF EXISTS events_json CASCADE;`,
        `DROP TABLE IF EXISTS spans CASCADE;`,
      ],
    },
  ],
  challenge: {
    prompt:
      'Return the total on-disk size in bytes of every physical copy of the default time index on readings ' +
      '(its name ends in readings_time_idx), in a column named bytes.',
    hint: 'pg_stat_user_indexes has indexrelid and indexrelname; sum pg_relation_size(indexrelid).',
    solution: `SELECT sum(pg_relation_size(indexrelid))::bigint AS bytes FROM pg_stat_user_indexes WHERE indexrelname LIKE '%readings_time_idx';`,
  },
  next: 'Next: npm run lesson 10  (roaring bitmaps)',
};
