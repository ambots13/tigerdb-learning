export default {
  title: 'Roaring bitmaps',
  duration: '12 min',
  summary: 'Store sets of ids as compressed bitmaps, then answer exact distinct, overlap and churn questions instantly.',
  objectives: [
    'Build roaring bitmaps and run set operations on them',
    'See how much smaller a bitmap is than the equivalent id list',
    'Materialise per-bucket id sets in a continuous aggregate',
    'Answer unique, retention and churn questions without touching raw rows',
  ],
  steps: [
    {
      title: 'The problem: distinct counts do not roll up',
      explain:
        'Sums and averages combine: add up the hourly numbers and you have the daily number. Distinct ' +
        'counts do not. To know how many unique users you had this week you must revisit every raw row, ' +
        'because the same user appears in many hours and you cannot tell from the counts alone.\n\n' +
        'Storing the raw id list per bucket would let you combine them, but the storage is brutal. A ' +
        'roaring bitmap is that id list, compressed, with set operations built in.',
      sql: `SELECT 'a bitmap is a set of integers you can union, intersect and count' AS idea;`,
    },
    {
      title: 'Enable the extension',
      explain:
        'Roaring bitmaps come from the roaringbitmap extension, which ships with this image. It adds a ' +
        'roaringbitmap column type plus functions to build, combine and measure bitmaps.',
      sql: [
        `CREATE EXTENSION IF NOT EXISTS roaringbitmap;`,
        `SELECT extname, extversion FROM pg_extension WHERE extname = 'roaringbitmap';`,
      ],
      note:
        'On Tiger Cloud and self-hosted installs, check availability with: SELECT * FROM ' +
        "pg_available_extensions WHERE name = 'roaringbitmap';",
    },
    {
      title: 'Build one and take it apart',
      explain:
        'rb_build turns an array of integers into a bitmap. The set operations are rb_and (intersection), ' +
        'rb_or (union), rb_xor (symmetric difference) and rb_andnot (difference). rb_cardinality counts ' +
        'members without expanding the set.',
      sql: `SELECT
  rb_cardinality(rb_build(ARRAY[1,2,3,100,1000]))                       AS members,
  rb_to_array(rb_and(rb_build(ARRAY[1,2,3]), rb_build(ARRAY[2,3,4])))   AS intersection,
  rb_to_array(rb_or(rb_build(ARRAY[1,2]), rb_build(ARRAY[3,4])))        AS union_of,
  rb_to_array(rb_andnot(rb_build(ARRAY[1,2,3]), rb_build(ARRAY[2])))    AS difference;`,
      takeaway:
        'These are exact set operations, not estimates. Unlike HyperLogLog, a roaring bitmap can tell you ' +
        'both how many members there are and exactly which ones.',
    },
    {
      title: 'Why it is worth doing',
      explain:
        'The same 100,000 integers, stored as a PostgreSQL array and as a roaring bitmap. The bitmap packs ' +
        'dense runs into a few bytes instead of four bytes per value.',
      run: async ({ query, print, table, c, bytes }) => {
        const { rows } = await query(`
          SELECT pg_column_size(rb_build(array_agg(i))) AS bitmap,
                 pg_column_size(array_agg(i))           AS int_array
          FROM generate_series(1, 100000) AS i;`);
        const bitmap = Number(rows[0].bitmap);
        const array = Number(rows[0].int_array);
        print('');
        print(
          table(
            [
              { representation: 'int[] array', size: bytes(array) },
              { representation: 'roaringbitmap', size: bytes(bitmap) },
            ],
            ['representation', 'size'],
          ),
        );
        print(
          `\n  ${c.bold(c.green(`${(array / bitmap).toFixed(1)}x smaller`))} ` +
            c.gray('- and the gap widens as the id space gets denser.'),
        );
      },
      note:
        'Sparse, widely-scattered ids compress less well than dense ranges. Bitmaps suit dense integer ' +
        'ids such as user or device keys, not random UUIDs.',
    },
    {
      title: 'A dataset with real overlap',
      explain:
        'Seven days of page visits. The active user population shifts from day to day - some users are ' +
        'present on both of any two days, some are not - which is what makes the retention questions later ' +
        'meaningful.',
      sql: [
        `DROP MATERIALIZED VIEW IF EXISTS visits_hourly CASCADE;`,
        `DROP TABLE IF EXISTS visits CASCADE;`,
        `CREATE TABLE visits (
  time    TIMESTAMPTZ NOT NULL,
  user_id INT         NOT NULL,
  page    TEXT
) WITH (tsdb.hypertable, tsdb.partition_column = 'time', tsdb.chunk_interval = '1 day');`,
        `INSERT INTO visits (time, user_id, page)
SELECT
  ts,
  1 + ((i * 7919) % 4000)
    + CASE WHEN (extract(doy FROM ts)::int % 2) = 0 THEN 0 ELSE 1000 END,
  'p' || (i % 20)
FROM generate_series(now() - INTERVAL '7 days', now(), INTERVAL '5 seconds')
     WITH ORDINALITY AS g(ts, i);`,
        `SELECT count(*) AS visits, count(DISTINCT user_id) AS unique_users FROM visits;`,
      ],
    },
    {
      title: 'Materialise the id set per hour',
      explain:
        'rb_build_agg is an aggregate, so it can live inside a continuous aggregate. Each row of this ' +
        'rollup stores one hour and the exact set of users seen in it.\n\n' +
        'This is the key move: a distinct count cannot be combined later, but a set can.',
      sql: [
        `CREATE MATERIALIZED VIEW visits_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  rb_build_agg(user_id)       AS users,
  count(*)                    AS hits
FROM visits
GROUP BY bucket
WITH NO DATA;`,
        `CALL refresh_continuous_aggregate('visits_hourly', NULL, NULL);`,
        `SELECT bucket, rb_cardinality(users) AS unique_users, hits
FROM visits_hourly
ORDER BY bucket DESC
LIMIT 5;`,
      ],
      takeaway:
        'The rollup stores a set per hour, not a number. Everything from here on reads only this rollup.',
    },
    {
      title: 'Exact unique users over any range',
      explain:
        'Union the hourly bitmaps and count the result. The answer is exact - identical to running ' +
        'count(DISTINCT) over the raw table - but it reads a handful of rollup rows instead of every visit.',
      run: async ({ query, timeQuery, print, table, c, ms }) => {
        const fromRollup = await timeQuery(
          `SELECT rb_cardinality(rb_or_agg(users)) AS unique_users FROM visits_hourly;`,
        );
        const fromRaw = await timeQuery(`SELECT count(DISTINCT user_id) AS unique_users FROM visits;`);
        const same = Number(fromRollup.rows[0].unique_users) === Number(fromRaw.rows[0].unique_users);
        print('');
        print(
          table(
            [
              { source: 'raw visits (count DISTINCT)', answer: fromRaw.rows[0].unique_users, best_of_3: ms(fromRaw.ms) },
              { source: 'bitmap rollup (rb_or_agg)', answer: fromRollup.rows[0].unique_users, best_of_3: ms(fromRollup.ms) },
            ],
            ['source', 'answer', 'best_of_3'],
          ),
        );
        print(
          same
            ? `\n  ${c.green('✓ identical answers')} ${c.bold(c.green(`· ${(fromRaw.ms / fromRollup.ms).toFixed(1)}x faster`))}`
            : `\n  ${c.red('answers differ - that should not happen')}`,
        );
      },
      takeaway:
        'This is the payoff: exact distinct counts that roll up. Keep the rollup and you can drop the raw ' +
        'rows on a retention policy without losing the ability to answer.',
    },
    {
      title: 'Unique users per day, from the hourly sets',
      explain:
        'Because sets combine, a daily figure is just a union of that day\'s hourly bitmaps. No raw data ' +
        'is touched, and the numbers are exact rather than the sum of hourly counts (which would ' +
        'double-count anyone active in two hours).',
      sql: `SELECT
  time_bucket('1 day', bucket)               AS day,
  rb_cardinality(rb_or_agg(users))           AS unique_users,
  sum(rb_cardinality(users))                 AS naive_sum_of_hourly,
  sum(hits)                                  AS visits
FROM visits_hourly
GROUP BY day
ORDER BY day;`,
      takeaway:
        'Compare unique_users against naive_sum_of_hourly. The naive column is what you get by summing ' +
        'per-hour distinct counts, and it is badly wrong - that error is exactly what bitmaps remove.',
    },
    {
      title: 'Retention and churn are set operations',
      explain:
        'Once each day is a set, the interesting questions become one-liners:\n' +
        '- returning = yesterday AND today\n' +
        '- churned = yesterday minus today\n' +
        '- new = today minus yesterday',
      sql: `WITH daily AS (
  SELECT time_bucket('1 day', bucket) AS day, rb_or_agg(users) AS users
  FROM visits_hourly
  GROUP BY day
), pairs AS (
  SELECT day, users, lag(users) OVER (ORDER BY day) AS prev
  FROM daily
)
SELECT
  day,
  rb_cardinality(users)                  AS active,
  rb_cardinality(rb_and(users, prev))    AS returning,
  rb_cardinality(rb_andnot(prev, users)) AS churned,
  rb_cardinality(rb_andnot(users, prev)) AS new_users
FROM pairs
WHERE prev IS NOT NULL
ORDER BY day;`,
      takeaway:
        'None of this is possible from stored counts. It only works because the rollup kept the ' +
        'membership, not just the size.',
      note:
        'The numbers are identical every day because the sample data alternates between two overlapping ' +
        'user pools by design - 3000 shared, 1000 unique to each. Real data is messier; the arithmetic is ' +
        'the same.',
    },
    {
      title: 'Where TimescaleDB itself is heading',
      explain:
        'Roaring bitmaps also appear inside the engine. The columnstore keeps per-batch sparse indexes ' +
        '(module 09) so it can skip compressed batches, and bitmap-style encodings are a natural fit for ' +
        'that job.\n\n' +
        'The query below lists the sparse index types this build accepts. If a roaring option lands in a ' +
        'later release it will show up as an accepted type here - today, on this version, the answer is ' +
        'bloom and minmax.',
      sql: `SELECT
  extversion AS timescaledb_version,
  'bloom, minmax' AS accepted_sparse_index_types,
  current_setting('timescaledb.auto_sparse_indexes') AS auto_sparse_indexes
FROM pg_extension WHERE extname = 'timescaledb';`,
      note:
        'To test for a native roaring sparse index on a newer build, try: ALTER TABLE t SET ' +
        "(timescaledb.sparse_index = 'roaring(col)'). On this version it fails with " +
        '\'unrecognized sparse index type\'. Until then, the roaringbitmap extension used in this module ' +
        'is the supported way to work with bitmaps in your own tables.',
    },
    {
      title: 'Clean up',
      explain: 'Drop what this module created. The extension is left installed - it costs nothing idle.',
      sql: [
        `DROP MATERIALIZED VIEW IF EXISTS visits_hourly CASCADE;`,
        `DROP TABLE IF EXISTS visits CASCADE;`,
      ],
    },
  ],
  challenge: {
    prompt:
      'Before the cleanup step runs you had visits_hourly. Rebuild the idea in one query: using rb_build_agg ' +
      'over the raw readings table, return how many distinct sensor_ids reported in the last 24 hours, in a ' +
      'column named sensors.',
    hint: 'rb_cardinality(rb_build_agg(sensor_id)) with a time filter on readings.',
    solution: `SELECT rb_cardinality(rb_build_agg(sensor_id)) AS sensors FROM readings WHERE time >= now() - INTERVAL '24 hours';`,
  },
  next: 'Next: npm run lesson 11  (continuous aggregates in production)',
};
