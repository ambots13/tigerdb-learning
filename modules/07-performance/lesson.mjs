const HOT_QUERY = `
SELECT sensor_id, avg(temperature) AS avg_temp
FROM readings
WHERE sensor_id = 5
  AND time >= now() - INTERVAL '3 days'
GROUP BY sensor_id`;

const timings = { before: null };

export default {
  title: 'Performance optimization',
  duration: '10 min',
  summary: 'Index for your real access pattern, size chunks sensibly, and read plans with confidence.',
  objectives: [
    'Read an EXPLAIN plan on a hypertable',
    'Add an index that matches how you actually filter',
    'Choose a chunk interval and change it safely',
    'Use chunk skipping and approximate counts',
  ],
  steps: [
    {
      title: 'What indexes exist by default?',
      explain:
        'Creating a hypertable gives you one index automatically: the partitioning column, descending. That ' +
        'covers "recent data first" queries perfectly and nothing else.',
      sql: `SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'readings';`,
    },
    {
      title: 'A query the default index does not serve',
      explain:
        'Filtering by device is the most common real-world pattern, and the time index alone cannot satisfy ' +
        'it. Time partitioning narrows the search to a few chunks, then every row in those chunks is checked ' +
        'against sensor_id. Watch for "Filter" and the number of rows removed by it.',
      run: async ({ query, timeQuery, print, c, ms }) => {
        const timed = await timeQuery(`${HOT_QUERY};`);
        timings.before = timed.ms;
        const plan = await query(
          `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF) ${HOT_QUERY};`,
        );
        print('');
        for (const row of plan.rows.slice(0, 10)) print('  ' + c.gray(row['QUERY PLAN']));
        print(`\n  ${c.bold('Best of 3:')} ${ms(timed.ms)}`);
      },
    },
    {
      title: 'Add an index that matches the access pattern',
      explain:
        'The column order matters. sensor_id first narrows to one device, then time DESC gives the range ' +
        'scan inside it. The reverse order would leave the database scanning every device in the range.\n\n' +
        'On a hypertable, CREATE INDEX creates the index on every chunk, including future ones.',
      sql: `CREATE INDEX IF NOT EXISTS readings_sensor_time_idx
  ON readings (sensor_id, time DESC);`,
    },
    {
      title: 'Measure the difference',
      explain: 'The same query again, unchanged. Only the available index changed.',
      run: async ({ query, timeQuery, print, c, ms, table }) => {
        const timed = await timeQuery(`${HOT_QUERY};`);
        const plan = await query(
          `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF) ${HOT_QUERY};`,
        );
        print('');
        for (const row of plan.rows.slice(0, 8)) print('  ' + c.gray(row['QUERY PLAN']));
        print('');
        print(
          table(
            [
              { index: 'time only (default)', best_of_3: ms(timings.before ?? 0) },
              { index: '(sensor_id, time DESC)', best_of_3: ms(timed.ms) },
            ],
            ['index', 'best_of_3'],
          ),
        );
        if (timings.before) {
          const speedup = timings.before / timed.ms;
          print(
            `\n  ${c.bold(c.green(`${speedup.toFixed(1)}x faster`))} ` +
              c.gray('- and the gap widens as the table grows.'),
          );
        }
      },
      takeaway:
        'Indexes are not free: they cost write throughput and disk. Add them for the filters you really run, ' +
        'and check pg_stat_user_indexes later to find ones nobody uses.',
    },
    {
      title: 'Chunk interval: the one sizing decision',
      explain:
        'The rule of thumb is that the chunks being actively written should fit comfortably in memory - ' +
        'roughly 25% of RAM for the most recent chunk across all hypertables. Too wide and inserts thrash ' +
        'the cache; too narrow and you drown in thousands of tiny chunks and planning overhead.',
      sql: `SELECT
  h.hypertable_name,
  d.column_name AS partition_column,
  d.time_interval AS chunk_interval,
  (SELECT count(*) FROM timescaledb_information.chunks c
    WHERE c.hypertable_name = h.hypertable_name) AS chunks
FROM timescaledb_information.hypertables h
JOIN timescaledb_information.dimensions d
  ON d.hypertable_name = h.hypertable_name
WHERE d.dimension_number = 1;`,
    },
    {
      title: 'Changing the interval',
      explain:
        'set_chunk_time_interval only affects chunks created from now on. Existing chunks keep their range, ' +
        'which is safe but means the change is gradual.',
      sql: [
        `SELECT set_chunk_time_interval('readings', INTERVAL '2 days');`,
        `SELECT set_chunk_time_interval('readings', INTERVAL '1 day');`,
      ],
      note: 'Changed and immediately changed back, so the rest of the lab keeps its 1 day chunks.',
    },
    {
      title: 'Chunk skipping on a non-time column',
      explain:
        'Chunk exclusion normally works on time. Enabling chunk skipping makes TimescaleDB track the min and ' +
        'max of another column per chunk, so a filter on that column can rule out whole chunks too. It is ' +
        'most effective when the column is loosely correlated with time, such as an ever-increasing id.',
      sql: `SET timescaledb.enable_chunk_skipping = on;
SELECT enable_chunk_skipping('readings', 'sensor_id', if_not_exists => true);`,
      note:
        'The setting is a GUC. Set it in postgresql.conf (and restart) so background workers and other ' +
        'sessions see it too - a session-level SET only affects your own connection.',
    },
    {
      title: 'Counting rows without counting rows',
      explain:
        'count(*) reads every row. approximate_row_count uses planner statistics instead and answers ' +
        'instantly, which is what you want for a "roughly how much data is here?" panel.',
      run: async ({ timeQuery, print, table, c, ms }) => {
        const exact = await timeQuery(`SELECT count(*) AS n FROM readings;`, 1);
        const approx = await timeQuery(`SELECT approximate_row_count('readings') AS n;`, 1);
        print('');
        print(
          table(
            [
              { method: 'count(*)', rows: exact.rows[0].n, took: ms(exact.ms) },
              { method: 'approximate_row_count()', rows: approx.rows[0].n, took: ms(approx.ms) },
            ],
            ['method', 'rows', 'took'],
          ),
        );
        print(
          `\n  ${c.gray('The estimate is only as fresh as the last ANALYZE, and ignores rows in columnar chunks it has no stats for.')}`,
        );
      },
    },
    {
      title: 'A short checklist',
      explain:
        'In order of impact:\n' +
        '1. Filter on the partitioning column so chunks can be excluded.\n' +
        '2. Index the columns you filter by, with the selective column first.\n' +
        '3. Move repeated rollups into continuous aggregates.\n' +
        '4. Convert historical chunks to the columnstore.\n' +
        '5. Only then start tuning chunk intervals and planner settings.',
      sql: `SELECT
  relname AS index_name,
  idx_scan AS times_used
FROM pg_stat_user_indexes
WHERE relname LIKE 'readings%'
ORDER BY idx_scan DESC
LIMIT 5;`,
      takeaway:
        'pg_stat_user_indexes tells you which indexes earn their keep. An index with zero scans after a ' +
        'representative workload is pure overhead.',
    },
  ],
  challenge: {
    prompt:
      'Return the name of the index you created in this module, from pg_indexes, in a column named indexname.',
    hint: "pg_indexes has tablename and indexname columns; the index is called readings_sensor_time_idx.",
    solution: `SELECT indexname FROM pg_indexes WHERE tablename = 'readings' AND indexname = 'readings_sensor_time_idx';`,
    check: (rows) => rows.length === 1 && rows[0].indexname === 'readings_sensor_time_idx',
  },
  next: 'Next: npm run lesson 08  (capstone)',
};
