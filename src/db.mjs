// Database access: config from env/.env, a shared pool, and timed queries.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Tiny .env loader so the lab has no dotenv dependency.
function loadEnvFile() {
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, '');
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}
loadEnvFile();

export const config = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5433),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'tigerlab',
  database: process.env.PGDATABASE || 'tigerlab',
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
};

let pool;
export function getPool() {
  if (!pool) {
    pool = new pg.Pool({ ...config, max: 4, idleTimeoutMillis: 5000 });
    pool.on('error', () => {}); // never crash the lesson on an idle client drop
  }
  return pool;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

/** Run SQL and return { rows, fields, ms, command, rowCount }. */
export async function query(sql, params = []) {
  const started = process.hrtime.bigint();
  const result = await getPool().query(sql, params);
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  const last = Array.isArray(result) ? result[result.length - 1] : result;
  return {
    ms,
    rows: last?.rows ?? [],
    fields: (last?.fields ?? []).map((f) => f.name),
    command: last?.command ?? '',
    rowCount: last?.rowCount ?? 0,
  };
}

/** Run several statements on one pooled connection, e.g. to use SET safely. */
export async function withClient(fn) {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/** Best-of-N timing, used so speed comparisons aren't dominated by cold cache. */
export async function timeQuery(sql, runs = 3) {
  let best = Infinity;
  let result;
  for (let i = 0; i < runs; i += 1) {
    result = await query(sql);
    best = Math.min(best, result.ms);
  }
  return { ...result, ms: best };
}

export async function assertConnection() {
  try {
    const { rows } = await query(
      "SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'",
    );
    if (!rows.length) {
      throw new Error(
        'Connected, but the timescaledb extension is missing. Try: npm run db:reset',
      );
    }
    return rows[0].extversion;
  } catch (error) {
    if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(error.code)) {
      throw new Error(
        `Cannot reach PostgreSQL at ${config.host}:${config.port}.\n` +
          'Start it with:  npm run db:up',
      );
    }
    throw error;
  }
}

export { root };
