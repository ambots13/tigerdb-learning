#!/usr/bin/env node
// Builds the shared dataset used by every module: an IoT sensor fleet.
//
// Rows are generated server-side with generate_series + a seeded random(), so
// the load is fast and reproducible. Deliberate quirks are baked in because
// later modules need them:
//   - sensor 7 goes offline for 6 hours  -> gapfill / locf (module 06)
//   - humidity is occasionally NULL      -> gapfill (module 06)
//   - energy_kwh is a monotonic counter  -> counter_agg (module 06)
import { query, assertConnection, closePool, config, getPool } from './db.mjs';
import { c, bytes } from './render.mjs';

const DAYS = Number(process.env.SEED_DAYS || 30);
const INTERVAL_SECONDS = Number(process.env.SEED_INTERVAL || 60);

const SCHEMA = `
-- Continuous aggregates created by later modules depend on readings, and a
-- hierarchical aggregate depends on another aggregate, so clear them first.
DO $$
DECLARE
  view_ref text;
BEGIN
  FOR view_ref IN
    SELECT format('%I.%I', view_schema, view_name)
    FROM timescaledb_information.continuous_aggregates
  LOOP
    EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %s CASCADE', view_ref);
  END LOOP;
END $$;

DROP TABLE IF EXISTS readings CASCADE;
DROP TABLE IF EXISTS sensors CASCADE;

CREATE TABLE sensors (
  sensor_id     INT PRIMARY KEY,
  name          TEXT NOT NULL,
  site          TEXT NOT NULL,
  model         TEXT NOT NULL,
  installed_at  DATE NOT NULL
);

CREATE TABLE readings (
  time        TIMESTAMPTZ      NOT NULL,
  sensor_id   INT              NOT NULL REFERENCES sensors (sensor_id),
  temperature DOUBLE PRECISION,
  humidity    DOUBLE PRECISION,
  battery     DOUBLE PRECISION,
  energy_kwh  DOUBLE PRECISION
) WITH (
  tsdb.hypertable,
  tsdb.partition_column = 'time',
  tsdb.chunk_interval = '1 day'
);
`;

// Creating a table WITH (tsdb.hypertable) also enables the columnstore and
// installs a default policy that compresses chunks older than a day. Modules
// 01-03 study rowstore behaviour and module 04 enables the columnstore
// deliberately, so the lab starts from a plain rowstore hypertable.
const ROWSTORE_ONLY = `
CALL remove_columnstore_policy('readings', if_exists => true);
ALTER TABLE readings SET (timescaledb.enable_columnstore = false);
`;

const SENSORS = `
INSERT INTO sensors (sensor_id, name, site, model, installed_at)
SELECT
  id,
  'sensor-' || lpad(id::text, 2, '0'),
  (ARRAY['north-plant','south-plant','harbour','warehouse'])[1 + (id - 1) % 4],
  (ARRAY['TS-100','TS-200','TS-200','TS-350'])[1 + (id - 1) % 4],
  CURRENT_DATE - 400 + id * 7
FROM generate_series(1, 12) AS id;
`;

const READINGS = `
INSERT INTO readings (time, sensor_id, temperature, humidity, battery, energy_kwh)
SELECT
  ts,
  s.sensor_id,
  -- daily temperature cycle + per-site offset + noise
  round((18
    + 6 * sin(extract(epoch FROM ts) / 86400.0 * 2 * pi())
    + (s.sensor_id % 4) * 1.5
    + (random() - 0.5) * 1.2)::numeric, 2),
  -- humidity: ~2% of samples are NULL so module 06 has gaps to repair
  CASE WHEN random() < 0.02 THEN NULL
       ELSE round((55 - 8 * sin(extract(epoch FROM ts) / 86400.0 * 2 * pi())
            + (random() - 0.5) * 4)::numeric, 2) END,
  -- battery drains from 100% across the window
  round((100 - 40 * (extract(epoch FROM ts - $1::timestamptz)
        / extract(epoch FROM $2::timestamptz - $1::timestamptz))
        + (random() - 0.5) * 0.4)::numeric, 2),
  -- monotonically increasing energy counter (kWh) for counter_agg
  round((extract(epoch FROM ts - $1::timestamptz) / 3600.0
        * (0.8 + (s.sensor_id % 5) * 0.15))::numeric, 3)
FROM generate_series($1::timestamptz, $2::timestamptz, make_interval(secs => $3::int)) AS ts
CROSS JOIN sensors AS s
WHERE NOT (
  -- sensor 7 is offline for 6 hours, three days before the end of the window
  s.sensor_id = 7
  AND ts >= $2::timestamptz - INTERVAL '3 days'
  AND ts <  $2::timestamptz - INTERVAL '3 days' + INTERVAL '6 hours'
);
`;

const STATS = `
SELECT
  (SELECT count(*) FROM readings)                                   AS rows,
  (SELECT count(*) FROM sensors)                                    AS sensors,
  (SELECT count(*) FROM timescaledb_information.chunks
    WHERE hypertable_name = 'readings')                             AS chunks,
  hypertable_size('readings')                                       AS bytes,
  (SELECT min(time) FROM readings)                                  AS first_reading,
  (SELECT max(time) FROM readings)                                  AS last_reading;
`;

async function main() {
  const version = await assertConnection();
  console.log(
    `\n  ${c.bold('Seeding')} ${c.gray(`${config.host}:${config.port}/${config.database} · TimescaleDB ${version}`)}`,
  );

  const started = Date.now();
  await query(SCHEMA);
  await query(ROWSTORE_ONLY);
  console.log(`  ${c.green('✓')} schema created (sensors + readings hypertable)`);

  await query(SENSORS);
  console.log(`  ${c.green('✓')} 12 sensors`);

  process.stdout.write(`  ${c.gray('…')} generating ${DAYS} days of readings `);
  const end = new Date();
  end.setMinutes(0, 0, 0);
  const start = new Date(end.getTime() - DAYS * 86400 * 1000);
  // setseed only affects its own session, so pin both statements to one client.
  const client = await getPool().connect();
  try {
    await client.query('SELECT setseed(0.42)');
    await client.query(READINGS, [start.toISOString(), end.toISOString(), INTERVAL_SECONDS]);
  } finally {
    client.release();
  }

  await query('ANALYZE readings');

  const { rows } = await query(STATS);
  const stats = rows[0];
  console.log(
    `\r  ${c.green('✓')} ${Number(stats.rows).toLocaleString()} readings across ` +
      `${stats.chunks} chunks (${bytes(stats.bytes)})            `,
  );
  console.log(
    `    ${c.gray(`${new Date(stats.first_reading).toISOString().slice(0, 16)} → ` +
      `${new Date(stats.last_reading).toISOString().slice(0, 16)}`)}`,
  );

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n  Done in ${elapsed}s. Start learning: ${c.bold('npm run lesson 01')}\n`);
}

main()
  .catch((error) => {
    console.error(`\n  ${c.red('Seed failed:')} ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(closePool);
