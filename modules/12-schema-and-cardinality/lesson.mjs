export default {
  title: 'Schema design & cardinality',
  duration: '11 min',
  summary: 'The two modelling choices that decide your compression ratio and query speed: table shape and segmentby.',
  objectives: [
    'Choose segmentby by measuring, not guessing',
    'See what a high-cardinality segmentby does to compression',
    'Compare narrow (long) and wide table shapes',
    'Know where metadata belongs',
  ],
  steps: [
    {
      title: 'segmentby is the highest-leverage decision you make',
      explain:
        'Inside a columnar chunk, rows are grouped into batches by the segmentby column. Two consequences ' +
        'follow from that single fact:\n\n' +
        '- Queries filtering on the segmentby column can skip whole batches.\n' +
        '- Values within a batch are similar, which is what makes the encoding compact.\n\n' +
        'Pick a column with few distinct values that you filter by often. We will now do the opposite on ' +
        'purpose to see what happens.',
      sql: `SELECT 'about to build the same data twice, segmented two different ways' AS plan;`,
    },
    {
      title: 'Build the same data twice',
      explain:
        'Both tables get identical rows: six days of readings with a low-cardinality device_id (20 values) ' +
        'and a high-cardinality req_id (unique per row). The only difference will be which column we ' +
        'segment by.',
      sql: [
        `DROP TABLE IF EXISTS seg_good CASCADE;`,
        `DROP TABLE IF EXISTS seg_bad CASCADE;`,
        `CREATE TABLE seg_good (
  time      TIMESTAMPTZ NOT NULL,
  device_id INT         NOT NULL,
  req_id    TEXT        NOT NULL,
  v         DOUBLE PRECISION
) WITH (tsdb.hypertable, tsdb.partition_column = 'time', tsdb.chunk_interval = '7 days');`,
        `CREATE TABLE seg_bad (
  time      TIMESTAMPTZ NOT NULL,
  device_id INT         NOT NULL,
  req_id    TEXT        NOT NULL,
  v         DOUBLE PRECISION
) WITH (tsdb.hypertable, tsdb.partition_column = 'time', tsdb.chunk_interval = '7 days');`,
        `INSERT INTO seg_good
SELECT ts, i % 20, md5(i::text), 20 + (i % 50)
FROM generate_series(now() - INTERVAL '6 days', now(), INTERVAL '5 seconds')
     WITH ORDINALITY AS g(ts, i);`,
        `INSERT INTO seg_bad SELECT * FROM seg_good;`,
        `SELECT count(*) AS rows_each,
       count(DISTINCT device_id) AS device_values,
       count(DISTINCT req_id)    AS req_values
FROM seg_good;`,
      ],
    },
    {
      title: 'Segment one well and one badly',
      explain:
        'seg_good groups by device_id: 20 batches per chunk, each holding many similar rows. seg_bad ' +
        'groups by req_id, which is unique per row - so every batch holds exactly one row and the ' +
        'columnar format has nothing to compress.',
      sql: [
        `ALTER TABLE seg_good SET (
  timescaledb.enable_columnstore = true,
  timescaledb.segmentby          = 'device_id',
  timescaledb.orderby            = 'time DESC'
);`,
        `ALTER TABLE seg_bad SET (
  timescaledb.enable_columnstore = true,
  timescaledb.segmentby          = 'req_id',
  timescaledb.orderby            = 'time DESC'
);`,
      ],
    },
    {
      title: 'Convert both and compare',
      explain:
        'Watch for the warning TimescaleDB raises while converting seg_bad. The engine detects that the ' +
        'columnar form is larger than the rows it replaced and tells you so.',
      run: async ({ query, print, table, c, bytes }) => {
        await query(`
          DO $$
          DECLARE chunk regclass; tbl text;
          BEGIN
            FOREACH tbl IN ARRAY ARRAY['seg_good', 'seg_bad'] LOOP
              FOR chunk IN
                SELECT format('%I.%I', chunk_schema, chunk_name)::regclass
                FROM timescaledb_information.chunks
                WHERE hypertable_name = tbl AND NOT is_compressed
              LOOP
                CALL convert_to_columnstore(chunk);
              END LOOP;
            END LOOP;
          END $$;`);

        const { rows } = await query(`
          SELECT
            hypertable_size('seg_good') AS good_bytes,
            hypertable_size('seg_bad')  AS bad_bytes;`);
        const good = Number(rows[0].good_bytes);
        const bad = Number(rows[0].bad_bytes);
        print('');
        print(
          table(
            [
              { segmentby: 'device_id  (20 distinct)', size_on_disk: bytes(good) },
              { segmentby: 'req_id  (unique per row)', size_on_disk: bytes(bad) },
            ],
            ['segmentby', 'size_on_disk'],
          ),
        );
        print(
          `\n  ${c.bold(c.red(`${(bad / good).toFixed(1)}x larger`))} ` +
            c.gray('for identical data - purely from the segmentby choice.'),
        );
      },
      takeaway:
        'A high-cardinality segmentby does not just compress badly, it can make the table bigger than it ' +
        'was uncompressed. TimescaleDB warns about ratios below 1.',
    },
    {
      title: 'Check the ratio the engine recorded',
      explain:
        'Rather than relying on the warning scrolling past, read the recorded before and after sizes. A ' +
        'ratio below 1 means compression cost you space.',
      sql: `SELECT 'seg_good' AS table_name,
       pg_size_pretty(before_compression_total_bytes) AS before,
       pg_size_pretty(after_compression_total_bytes)  AS after,
       round(before_compression_total_bytes::numeric
             / nullif(after_compression_total_bytes, 0), 2) AS ratio
FROM hypertable_columnstore_stats('seg_good')
UNION ALL
SELECT 'seg_bad',
       pg_size_pretty(before_compression_total_bytes),
       pg_size_pretty(after_compression_total_bytes),
       round(before_compression_total_bytes::numeric
             / nullif(after_compression_total_bytes, 0), 2)
FROM hypertable_columnstore_stats('seg_bad');`,
      takeaway:
        'Always check this after choosing segmentby on a new table. It is a two-second query that catches ' +
        'an expensive mistake.',
    },
    {
      title: 'How to pick segmentby before you commit',
      explain:
        'Count distinct values against total rows. You want a column where each distinct value covers many ' +
        'rows per chunk - hundreds or thousands, not one. If a column has nearly as many values as rows, ' +
        'it is a filter column, not a segmentby column: give it a bloom sparse index instead (module 09).',
      sql: `SELECT
  'device_id' AS candidate,
  count(DISTINCT device_id)                       AS distinct_values,
  round(count(*)::numeric / count(DISTINCT device_id), 1) AS rows_per_value
FROM seg_good
UNION ALL
SELECT
  'req_id',
  count(DISTINCT req_id),
  round(count(*)::numeric / count(DISTINCT req_id), 1)
FROM seg_good;`,
      takeaway:
        'rows_per_value is the number to look at. High is good. A value of 1 means every batch holds a ' +
        'single row.',
    },
    {
      title: 'Narrow or wide?',
      explain:
        'The other modelling choice is table shape.\n\n' +
        'Narrow (long) stores one row per measurement: (time, device, metric_name, value). It is flexible ' +
        '- new metrics need no migration - but repeats the timestamp and device for every metric, and ' +
        'needs a pivot to compare metrics side by side.\n\n' +
        'Wide stores one row per observation with a column per metric: (time, device, temperature, ' +
        'humidity, battery). It is compact and trivially queryable, but adding a metric is a schema change.',
      sql: `SELECT
  'narrow' AS shape,
  '(time, device, metric, value)' AS columns,
  'flexible; pivot needed; more rows'   AS trade_off
UNION ALL
SELECT 'wide', '(time, device, temp, humidity, ...)', 'compact; simple queries; schema change per metric';`,
      takeaway:
        'The readings table in this lab is wide, which is why every query so far has been a plain SELECT ' +
        'with no pivot. For a fixed, known set of metrics, wide is usually the better default.',
    },
    {
      title: 'Where metadata belongs',
      explain:
        'Do not denormalize slow-changing attributes into every row. Site names, models and owners belong ' +
        'in a small regular table joined at query time - which is exactly how sensors relates to readings ' +
        'here.\n\n' +
        'The exception is a column you filter on constantly and want as segmentby, where storing the id ' +
        'in the hypertable is the point.',
      sql: `SELECT
  pg_size_pretty(pg_total_relation_size('sensors'))  AS metadata_table,
  pg_size_pretty(hypertable_size('readings'))        AS fact_table,
  (SELECT count(*) FROM sensors)                     AS sensor_rows,
  (SELECT count(*) FROM readings)                    AS reading_rows;`,
      note:
        'Twelve metadata rows serve half a million fact rows. Copying site names into every reading would ' +
        'add nothing but bytes.',
    },
    {
      title: 'Clean up',
      sql: [`DROP TABLE IF EXISTS seg_good CASCADE;`, `DROP TABLE IF EXISTS seg_bad CASCADE;`],
    },
  ],
  challenge: {
    prompt:
      'For the readings hypertable, return the average number of rows per distinct sensor_id, in a column ' +
      'named rows_per_value, rounded to one decimal place.',
    hint: 'count(*) divided by count(DISTINCT sensor_id), cast to numeric before rounding.',
    solution: `SELECT round(count(*)::numeric / count(DISTINCT sensor_id), 1) AS rows_per_value FROM readings;`,
  },
  next: 'Next: npm run lesson 13  (the analytics toolkit)',
};
