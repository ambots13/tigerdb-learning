# TigerData Learning Lab

A runnable course for developers learning **TigerData** — PostgreSQL with the TimescaleDB and Toolkit
extensions. Every concept from the [Build docs](https://www.tigerdata.com/docs/build) is taught three
ways: a short explanation, SQL you actually execute, and measurements printed from your own database.

Nothing is faked. The compression ratios, query timings and speedups you see are computed live.

## Requirements

Docker, and Node.js 20+. That is all — there is no `psql` or PostgreSQL install needed on your machine.

## Start in 60 seconds

```bash
npm install
npm run db:up     # starts TimescaleDB in Docker on port 5433
npm run seed      # generates ~518k rows of IoT sensor data (~10s)
npm run lesson 01 # begin
```

`npm run lessons` lists every module.

## How a lesson works

Each step shows an explanation, then the SQL, then waits:

```
  [Enter] run  ·  [s] skip  ·  [q] quit
```

Press Enter and the statement runs against your database and prints the real result. Quit any time —
the runner tells you how to resume (`npm run lesson 04 -- --from 6`). Every module ends with a
challenge you answer by typing SQL, which is checked against the actual result.

Lessons are idempotent: re-run any module as many times as you like.

## The modules

| # | Module | Time | What you learn |
| --- | --- | --- | --- |
| 00 | Setup & orientation | 4 min | Verify the extensions; confirm it really is just PostgreSQL |
| 01 | Hypertables & chunks | 8 min | Create a hypertable, watch chunks appear, read chunk exclusion in EXPLAIN |
| 02 | Write & query | 9 min | Bulk loading, update/upsert/delete, `time_bucket()`, `first()`/`last()`, joins |
| 03 | Continuous aggregates | 10 min | Incremental rollups, refresh policies, real-time aggregation, hierarchies |
| 04 | Hypercore columnstore | 10 min | `segmentby`/`orderby`, chunk conversion, measured size and speed gains |
| 05 | Jobs, policies & retention | 9 min | The job scheduler, all four built-in policies, `drop_chunks`, custom background jobs |
| 06 | Hyperfunctions | 11 min | Gapfilling, `counter_agg`, `time_weight`, approximate percentiles |
| 07 | Performance optimization | 10 min | Indexing, SkipScan, constraints, chunk sizing, chunk skipping |
| 08 | Capstone | 12 min | One complete pipeline: ingest → rollup → compress → retain → dashboard |
| 09 | The index toolbox | 12 min | Partial, expression, covering, BRIN, GIN, hash, and columnstore sparse indexes |
| 10 | Roaring bitmaps | 12 min | Exact distinct, retention and churn from compressed id sets |
| 11 | Continuous aggregates in production | 11 min | The backfill trap, refresh watermarks, policy offsets |
| 12 | Schema design & cardinality | 11 min | Choosing `segmentby`, narrow vs wide, where metadata belongs |
| 13 | The analytics toolkit | 11 min | `lttb` downsampling, `state_agg`, `heartbeat_agg`, OHLC, `integral` |
| 14 | Reading query plans | 13 min | `EXPLAIN` end to end: estimates vs reality, scan and join nodes, `BUFFERS` |

Full text for each module also lives in `modules/<name>/README.md` — see [docs/modules.md](docs/modules.md).

## Browser playground

```bash
npm run play    # http://localhost:4000
```

Lesson text on the left, a SQL editor and result grid on the right. The **Explain** button wraps your
query in `EXPLAIN (ANALYZE, BUFFERS)` and renders the plan. Load any lesson step into the
editor with one click, then change it and see what happens. This is the fastest way to experiment
beyond the scripted steps.

If port 4000 is taken, use `PORT=4001 npm run play`.

## The sample dataset

`npm run seed` builds an IoT sensor fleet used by every module, so you learn one schema instead of nine:

- **`sensors`** — an ordinary PostgreSQL table: 12 devices across 4 sites.
- **`readings`** — a hypertable: 30 days of 1-minute samples (~518k rows, 1-day chunks).

Three quirks are deliberate, because later modules need them:

- sensor 7 is offline for 6 hours → gapfilling in module 06
- ~2% of humidity values are NULL → gapfilling in module 06
- `energy_kwh` is a monotonic counter → `counter_agg` in module 06

The seed also removes the columnstore policy that `WITH (tsdb.hypertable)` creates by default, so that
module 04 can show a genuine before/after.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run db:up` | Start TimescaleDB in Docker |
| `npm run db:down` | Stop it, keeping data |
| `npm run db:reset` | Destroy the container and start clean |
| `npm run db:psql` | Open `psql` inside the container |
| `npm run seed` | Rebuild the sample dataset |
| `npm run lessons` | List modules |
| `npm run lesson <id>` | Run a module (`-- --auto` for no pauses, `-- --from N` to resume) |
| `npm run play` | Browser playground |
| `npm run verify` | Run every step of every module and check it works (`-- --fresh` re-seeds first) |
| `npm run docs` | Regenerate module READMEs from the lesson files |

## Connecting your own tools

The database is a normal PostgreSQL server:

```
postgres://postgres:tigerlab@localhost:5433/tigerlab
```

To run the lessons against a Tiger Cloud service instead, copy `.env.example` to `.env` and point the
`PG*` variables at it.

## How this repo is put together

```
modules/<nn>-<slug>/lesson.mjs   the single source of truth: prose + SQL + challenge
modules/<nn>-<slug>/README.md    generated from lesson.mjs by `npm run docs`
src/runner.mjs                   lesson engine (stepping, timing, grading)
src/seed.mjs                     deterministic dataset generator
src/verify.mjs                   runs every module as an acceptance test
src/web/                         browser playground (express + vanilla JS)
scripts/db.sh                    Docker harness: up | down | reset | psql | logs
```

A module's prose, SQL and expected results live in one file, and the markdown is generated from it.
That is deliberate: the documentation cannot drift away from the code that actually executes.

## Reference

- [Coverage map](docs/coverage.md) — every Build docs page mapped to a module, including what is
  deliberately out of scope and why
- [SQL cheatsheet](docs/cheatsheet.md) — every function used in the lab, on one page
- [Troubleshooting](docs/troubleshooting.md) — gotchas found while building this, with fixes
