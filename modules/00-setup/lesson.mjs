export default {
  title: 'Setup & orientation',
  duration: '4 min',
  requiresSeed: false,
  summary: 'Confirm your connection and see why TigerData is "just PostgreSQL".',
  objectives: [
    'Verify TimescaleDB and Toolkit are installed',
    'Confirm ordinary PostgreSQL SQL is unchanged',
    'Find the catalog views you will use in every later module',
  ],
  steps: [
    {
      title: 'What am I connected to?',
      explain:
        'TigerData is PostgreSQL with the TimescaleDB extension, plus the Toolkit extension for analytics. ' +
        'There is no separate server, protocol, or driver: any PostgreSQL client works.',
      sql: `SELECT
  current_setting('server_version') AS postgres,
  extname,
  extversion
FROM pg_extension
WHERE extname IN ('timescaledb', 'timescaledb_toolkit')
ORDER BY extname;`,
      takeaway:
        'Two extensions do all the work. timescaledb adds hypertables, policies and the columnstore; ' +
        'timescaledb_toolkit adds the hyperfunctions you will meet in module 06.',
    },
    {
      title: 'Ordinary SQL still behaves ordinarily',
      explain:
        'Nothing about your existing PostgreSQL knowledge is invalidated. Constraints, transactions, joins, ' +
        'JSON and every data type work exactly as before.',
      sql: `DROP TABLE IF EXISTS hello_tiger;

CREATE TABLE hello_tiger (
  id    SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  tags  JSONB
);

INSERT INTO hello_tiger (label, tags)
VALUES ('a normal postgres table', '{"special": false}');

SELECT id, label, tags ->> 'special' AS special FROM hello_tiger;`,
      takeaway:
        'You opt into time-series behaviour only where you want it. Regular tables stay regular tables, ' +
        'which is why the sensor metadata in this lab is a plain table.',
    },
    {
      title: 'The catalog you will keep coming back to',
      explain:
        'TimescaleDB exposes its state through the timescaledb_information schema. These views answer ' +
        '"what did the database actually do?" - which chunks exist, which policies run, what got compressed.',
      sql: `SELECT table_name AS view_name
FROM information_schema.views
WHERE table_schema = 'timescaledb_information'
ORDER BY table_name;`,
      maxRows: 20,
      takeaway:
        'hypertables, chunks, jobs, continuous_aggregates and compression_settings are the five you will use most.',
    },
    {
      title: 'Check whether the sample data is loaded',
      explain:
        'Every later module uses one shared dataset: an IoT sensor fleet. If this returns 0, exit and run npm run seed.',
      sql: `SELECT count(*) AS hypertables FROM timescaledb_information.hypertables;`,
      note: 'If the count is 0, run  npm run seed  before starting module 01.',
    },
    {
      title: 'Clean up',
      explain: 'Lessons in this lab always tidy up after themselves so you can re-run them safely.',
      sql: `DROP TABLE IF EXISTS hello_tiger;`,
    },
  ],
  challenge: {
    prompt:
      'Write a query returning the installed version of the timescaledb_toolkit extension in a column named version.',
    hint: 'pg_extension has extname and extversion columns.',
    solution: `SELECT extversion AS version FROM pg_extension WHERE extname = 'timescaledb_toolkit';`,
    check: (rows) => rows.length === 1 && typeof rows[0].version === 'string',
  },
  next: 'Next: npm run seed, then npm run lesson 01',
};
