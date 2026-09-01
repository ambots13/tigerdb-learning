#!/usr/bin/env node
// Local SQL playground: lesson text on the left, editor and results on the right.
// Read-only-ish by design for learning, but it runs whatever you type - this is
// a local lab database, not a production console.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, withClient, assertConnection, config } from '../db.mjs';
import { loadAllLessons } from '../lessons.mjs';
import { c } from '../render.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 4000);
const MAX_ROWS = Number(process.env.PLAYGROUND_MAX_ROWS || 200);
const STATEMENT_TIMEOUT_MS = Number(process.env.PLAYGROUND_TIMEOUT_MS || 30000);

app.use(express.json());
app.use(express.static(path.join(here, 'public')));

app.get('/api/lessons', async (_req, res) => {
  const lessons = await loadAllLessons();
  res.json(
    lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      summary: lesson.summary,
      duration: lesson.duration ?? '',
      objectives: lesson.objectives ?? [],
      steps: lesson.steps.map((step) => ({
        title: step.title,
        explain: step.explain ?? '',
        note: step.note ?? '',
        takeaway: step.takeaway ?? '',
        sql: step.sql ? (Array.isArray(step.sql) ? step.sql.join('\n\n') : step.sql) : '',
      })),
      challenge: lesson.challenge
        ? { prompt: lesson.challenge.prompt, hint: lesson.challenge.hint ?? '' }
        : null,
    })),
  );
});

app.post('/api/query', async (req, res) => {
  const sql = String(req.body?.sql ?? '').trim();
  if (!sql) return res.status(400).json({ error: 'No SQL provided.' });
  try {
    const started = Date.now();
    // A runaway query would otherwise hold a pooled connection forever and
    // eventually stall the whole playground.
    const result = await withClient(async (client) => {
      try {
        await client.query(`SET statement_timeout = '${STATEMENT_TIMEOUT_MS}ms'`);
        return await client.query(sql);
      } finally {
        await client.query('RESET statement_timeout').catch(() => {});
      }
    });
    const last = Array.isArray(result) ? result[result.length - 1] : result;
    const rows = last?.rows ?? [];
    const fields = (last?.fields ?? []).map((f) => f.name);
    res.json({
      ms: Date.now() - started,
      command: last?.command ?? '',
      fields,
      rows: rows.slice(0, MAX_ROWS).map((row) => {
        const out = {};
        for (const key of Object.keys(row)) {
          const value = row[key];
          out[key] =
            value === null || value === undefined
              ? null
              : value instanceof Date
                ? value.toISOString()
                : typeof value === 'object'
                  ? JSON.stringify(value)
                  : value;
        }
        return out;
      }),
      truncated: rows.length > MAX_ROWS,
      rowCount: rows.length,
    });
  } catch (error) {
    const timedOut = error.code === '57014';
    res.status(400).json({
      error: timedOut
        ? `Query cancelled after ${STATEMENT_TIMEOUT_MS / 1000}s. Add a time filter or a LIMIT, or raise PLAYGROUND_TIMEOUT_MS.`
        : error.message,
      position: error.position ?? null,
    });
  }
});

app.get('/api/schema', async (_req, res) => {
  try {
    const hypertables = await query(
      `SELECT hypertable_name AS name,
              (SELECT count(*) FROM timescaledb_information.chunks ch
                WHERE ch.hypertable_name = h.hypertable_name) AS chunks
       FROM timescaledb_information.hypertables h ORDER BY 1;`,
    );
    const caggs = await query(
      `SELECT view_name AS name FROM timescaledb_information.continuous_aggregates ORDER BY 1;`,
    );
    const tables = await query(
      `SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;`,
    );
    res.json({
      hypertables: hypertables.rows,
      continuousAggregates: caggs.rows,
      tables: tables.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function start() {
  const version = await assertConnection();
  const server = app.listen(PORT, () => {
    console.log(
      `\n  ${c.bold(c.cyan('TigerData playground'))} ${c.gray(`· TimescaleDB ${version} · ${config.host}:${config.port}/${config.database}`)}`,
    );
    console.log(`  ${c.bold(`http://localhost:${PORT}`)}\n`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `\n  ${c.red(`Port ${PORT} is already in use.`)}\n` +
          `  ${c.gray('Either the playground is already running - try')} http://localhost:${PORT}\n` +
          `  ${c.gray('or start it on another port:')} PORT=${PORT + 1} npm run play\n`,
      );
    } else if (error.code === 'EACCES') {
      console.error(`\n  ${c.red(`Not allowed to bind port ${PORT}.`)} ${c.gray('Try a port above 1024.')}\n`);
    } else {
      console.error(`\n  ${c.red('Playground failed:')} ${error.message}\n`);
    }
    process.exit(1);
  });
}

start().catch((error) => {
  console.error(`\n  ${c.red('Could not start playground:')} ${error.message}\n`);
  process.exitCode = 1;
});
