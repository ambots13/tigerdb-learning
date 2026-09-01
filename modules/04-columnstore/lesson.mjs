const ANALYTIC_QUERY = `
SELECT sensor_id,
       avg(temperature) AS avg_temp,
       max(temperature) AS max_temp,
       count(*)         AS samples
FROM readings
WHERE time < now() - INTERVAL '7 days'
GROUP BY sensor_id
ORDER BY sensor_id`;

// Captured in step 1 while the chunks are still row-oriented, then compared
// against the same query in step 5 once they are columnar.
const baseline = { ms: null, bytes: null, columnarChunks: null };

export default {
  title: 'Hypercore: the columnstore',
  duration: '10 min',
  summary: 'Convert older chunks to columnar storage and measure the real size and speed difference.',
  objectives: [
    'Enable the columnstore and choose segmentby / orderby',
    'Convert chunks and read the resulting size statistics',
    'Automate conversion with a columnstore policy',
    'Know what still works after a chunk is columnar',
  ],
  steps: [
    {
      title: 'Measure the rowstore baseline',
      explain:
        'Hypercore is a hybrid engine: recent chunks stay row-oriented for fast inserts and single-row ' +
        'lookups, while older chunks are converted to a compressed columnar format for analytics. Nothing ' +
        'is converted yet, so this is the honest "before" measurement - the size of the table and the cost ' +
        'of one analytic query over the chunks we are about to convert.',
      run: async ({ query, timeQuery, print, table, bytes, ms, c }) => {
        const stats = await query(`
          SELECT
            count(*)                              AS chunks,
            count(*) FILTER (WHERE is_compressed)  AS columnar_chunks,
            hypertable_size('readings')            AS bytes
          FROM timescaledb_information.chunks
          WHERE hypertable_name = 'readings';`);
        const timed = await timeQuery(`${ANALYTIC_QUERY};`);

        baseline.ms = timed.ms;
        baseline.bytes = Number(stats.rows[0].bytes);
        baseline.columnarChunks = Number(stats.rows[0].columnar_chunks);

        print('');
        print(
          table(
            [
              {
                chunks: stats.rows[0].chunks,
                columnar: stats.rows[0].columnar_chunks,
                total_size: bytes(baseline.bytes),
                analytic_query: ms(timed.ms),
              },
            ],
            ['chunks', 'columnar', 'total_size', 'analytic_query'],
          ),
        );
        if (baseline.columnarChunks > 0) {
          print(
            `\n  ${c.yellow('!')} ${c.gray('Some chunks are already columnar from a previous run. Run npm run seed for a clean before/after.')}`,
          );
        }
      },
    },
    {
      title: 'Enable the columnstore',
      explain:
        'Two settings decide how well compression works.\n\n' +
        'segmentby groups rows that share a value into the same compressed batch. Choose the column you ' +
        'filter by most - here sensor_id - because the engine can then skip whole batches.\n\n' +
        'orderby controls the order of rows inside a batch. Time descending keeps similar values adjacent, ' +
        'which is what makes the encoding compact and recent-first scans cheap.',
      sql: `ALTER TABLE readings SET (
  timescaledb.enable_columnstore = true,
  timescaledb.segmentby          = 'sensor_id',
  timescaledb.orderby            = 'time DESC'
);`,
      note:
        'A table created WITH (tsdb.hypertable) turns the columnstore on by default. The seed for this lab ' +
        'deliberately turns it back off so you can watch the change happen here.',
    },
    {
      title: 'Convert the older chunks',
      explain:
        'convert_to_columnstore works on one chunk at a time and is a procedure, so it needs CALL - and CALL ' +
        'does not accept a subquery as an argument. The idiomatic way to convert a set of chunks is a small ' +
        'DO block that loops over the catalog.',
      sql: `DO $$
DECLARE
  chunk regclass;
BEGIN
  FOR chunk IN
    SELECT format('%I.%I', chunk_schema, chunk_name)::regclass
    FROM timescaledb_information.chunks
    WHERE hypertable_name = 'readings'
      AND NOT is_compressed
      AND range_end < now() - INTERVAL '7 days'
  LOOP
    CALL convert_to_columnstore(chunk);
  END LOOP;
END $$;`,
      takeaway:
        'Conversion is per chunk, which is why it never locks the whole table and why recent data can stay ' +
        'in the rowstore while history is compressed.',
    },
    {
      title: 'How much did that save?',
      explain: 'hypertable_columnstore_stats reports before and after byte counts for the converted chunks.',
      run: async ({ query, print, table, bytes, c }) => {
        const { rows } = await query(`
          SELECT
            number_compressed_chunks,
            total_chunks,
            before_compression_total_bytes AS before,
            after_compression_total_bytes  AS after
          FROM hypertable_columnstore_stats('readings');`);
        const stats = rows[0];
        const before = Number(stats.before);
        const after = Number(stats.after);
        const ratio = after > 0 ? before / after : 0;
        print('');
        print(
          table(
            [
              {
                converted: `${stats.number_compressed_chunks} of ${stats.total_chunks} chunks`,
                before: bytes(before),
                after: bytes(after),
              },
            ],
            ['converted', 'before', 'after'],
          ),
        );
        print(
          `\n  ${c.bold(c.green(`${ratio.toFixed(1)}x smaller`))} ` +
            c.gray(`- ${bytes(before - after)} reclaimed on the converted chunks alone`),
        );
      },
      takeaway:
        'Ratios depend heavily on segmentby and on how repetitive your data is. Wide, repetitive telemetry ' +
        'compresses far better than random values.',
    },
    {
      title: 'The same query, now against columnar chunks',
      explain:
        'This is the identical query from step 1 over the identical rows. The only thing that changed is how ' +
        'those rows are stored. A columnar chunk reads only the columns the query mentions and decodes whole ' +
        'batches at a time, instead of walking row by row past columns nobody asked for.',
      run: async ({ query, timeQuery, print, c, ms, bytes, table }) => {
        const timed = await timeQuery(`${ANALYTIC_QUERY};`);
        const stats = await query(`SELECT hypertable_size('readings') AS bytes;`);
        const nowBytes = Number(stats.rows[0].bytes);

        const rows = [
          {
            state: 'rowstore (step 1)',
            analytic_query: baseline.ms === null ? 'not measured' : ms(baseline.ms),
            table_size: baseline.bytes === null ? '-' : bytes(baseline.bytes),
          },
          { state: 'columnar (now)', analytic_query: ms(timed.ms), table_size: bytes(nowBytes) },
        ];
        print('');
        print(table(rows, ['state', 'analytic_query', 'table_size']));

        if (baseline.ms !== null && baseline.columnarChunks === 0) {
          const speedup = baseline.ms / timed.ms;
          const verdict =
            speedup >= 1.1
              ? c.bold(c.green(`${speedup.toFixed(1)}x faster`))
              : c.bold(c.yellow(`${speedup.toFixed(2)}x`));
          print(
            `\n  ${verdict} ${c.gray('on the same rows, while also using')} ` +
              `${c.bold(bytes(baseline.bytes - nowBytes))} ${c.gray('less disk.')}`,
          );
        }
      },
      takeaway:
        'On a small lab dataset the timing win is modest because everything already fits in cache. The size ' +
        'win is immediate and real, and the query win grows sharply once a table no longer fits in memory.',
    },
    {
      title: 'What the engine stored per chunk',
      explain:
        'Each converted chunk keeps its own statistics. This is where you look when one chunk compresses ' +
        'much worse than its neighbours.',
      sql: `SELECT
  chunk_name,
  pg_size_pretty(before_compression_total_bytes) AS before,
  pg_size_pretty(after_compression_total_bytes)  AS after
FROM chunk_columnstore_stats('readings')
ORDER BY chunk_name
LIMIT 5;`,
    },
    {
      title: 'Automate it with a policy',
      explain:
        'In production you do not convert chunks by hand. A columnstore policy converts every chunk once it ' +
        'is older than the given interval. It is a procedure, so it needs CALL.',
      sql: `CALL add_columnstore_policy('readings', after => INTERVAL '7 days', if_not_exists => true);`,
    },
    {
      title: 'The policy is a background job',
      explain:
        'Every policy in TimescaleDB is a scheduled job. Module 05 covers the job system properly.',
      sql: `SELECT job_id, proc_name, schedule_interval, config
FROM timescaledb_information.jobs
WHERE hypertable_name = 'readings';`,
    },
    {
      title: 'Columnar data is still writable',
      explain:
        'This is the part people expect to be broken. You can INSERT into, UPDATE and DELETE from a columnar ' +
        'chunk, and query it with ordinary SQL. Backfilling a late-arriving row does not require you to ' +
        'decompress anything by hand.',
      sql: `INSERT INTO readings (time, sensor_id, temperature, humidity, battery, energy_kwh)
VALUES (now() - INTERVAL '20 days', 1, 17.5, 60, 70, 500)
RETURNING time, sensor_id, temperature;`,
      takeaway:
        'Heavy backfill into columnar chunks is still slower than writing to the rowstore, so size the ' +
        'policy interval to cover your normal late-arrival window.',
    },
    {
      title: 'Tidy the backfilled row',
      sql: `DELETE FROM readings WHERE energy_kwh = 500 AND temperature = 17.5;`,
    },
  ],
  challenge: {
    prompt:
      'Return the compression ratio achieved on readings - before bytes divided by after bytes - as a column named ratio.',
    hint: 'hypertable_columnstore_stats() returns before_compression_total_bytes and after_compression_total_bytes.',
    solution: `SELECT round(before_compression_total_bytes::numeric / after_compression_total_bytes, 2) AS ratio FROM hypertable_columnstore_stats('readings');`,
  },
  next: 'Next: npm run lesson 05  (jobs, policies and retention)',
};
