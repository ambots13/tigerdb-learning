# Coverage map

Every page under [tigerdata.com/docs/build](https://www.tigerdata.com/docs/build), and where this lab
covers it. Anything deliberately excluded says why.

Regenerate your bearings with `npm run lessons`.

## Quickstarts

| Docs page | Covered in |
| --- | --- |
| Your first hypertable | 01, steps 1–3 |
| Basic compression with hypercore | 04, steps 1–6 |

## Write and query data

| Docs page | Covered in |
| --- | --- |
| Write data — insert | 02, steps 2–3 (single row, bulk `INSERT ... SELECT`, `COPY` noted) |
| Write data — update / delete | 02, step 5 |
| Write data — upsert | 02, step 6 (including the unique-index rule) |
| Query data — `SELECT`, time buckets | 02, steps 7–8 |
| Query data — SkipScan | 07, step 5 |
| Query data — advanced analytics | 06, all steps |
| Run queries from Tiger Console | Out of scope — Tiger Cloud UI. `npm run play` is the local equivalent. |

## Automation

| Docs page | Covered in |
| --- | --- |
| About automation (jobs overview) | 05, steps 1–2 |
| Continuous aggregate refresh policies | 03, step 5 |
| Columnstore policies | 04, step 7 |
| Retention policies | 05, steps 4–6 |
| Reorder policies | 05, step 7 |
| Create and manage custom jobs | 05, steps 8–9 |
| Custom retention / downsample job examples | 05, steps 8–9 teach the mechanism; the specific examples are variations on it |

## Continuous aggregates

| Docs page | Covered in |
| --- | --- |
| Create a continuous aggregate | 03, steps 2–3 |
| Refresh policies | 03, step 5 |
| Real-time aggregation | 03, steps 6–7 |
| Hierarchical continuous aggregates | 03, step 8 |
| Continuous aggregates on columnar data | 04 + 03 combined; the capstone (08) does both together |

## Columnar storage (hypercore)

| Docs page | Covered in |
| --- | --- |
| Set up hypercore | 04, step 2 |
| Convert chunks to the columnstore | 04, step 3 |
| Columnstore policies | 04, step 7 |
| Modify data in the columnstore | 04, step 9 |
| Compression statistics | 04, steps 4 and 6 |

## Performance optimization

| Docs page | Covered in |
| --- | --- |
| Accelerate queries using indexes | 07, steps 1–4 |
| Ensure data integrity with constraints | 07, step 6 |
| Alter and update table schemas | 07, step 6 |
| Enforce constraints with unique indexes | 02, step 6 (the rule) and 07, step 6 (the reason) |
| Improve query and upsert performance (secondary indexes) | 07, steps 3–5 |
| Improve hypertable performance (chunk interval, chunk skipping) | 07, steps 7–9 |
| Handle semi-structured data with JSON | 00, step 2 shows `JSONB`; it behaves identically on a hypertable |
| Improve storage performance using tablespaces | Out of scope — deployment/ops concern, not TimescaleDB-specific |
| Automate tasks with triggers | Out of scope — standard PostgreSQL triggers, unchanged on hypertables |
| Query external data sources with FDW | Out of scope — standard PostgreSQL FDW |

## Storage tiering

| Docs page | Covered in |
| --- | --- |
| Manage storage / tiered storage | **Out of scope — Tiger Cloud only.** Object-storage tiering is not available in self-hosted TimescaleDB, so it cannot be demonstrated in this Docker-based lab. Module 05 covers the self-hosted equivalent of the data lifecycle: retention policies and `drop_chunks`. |

## Tutorials and troubleshooting

| Docs page | Covered in |
| --- | --- |
| Examples (IoT, finance, transport, hybrid search) | The lab uses one continuous IoT dataset instead of many one-off tutorials; module 08 is the end-to-end project |
| Tips and tricks / troubleshooting | [troubleshooting.md](troubleshooting.md), written from errors actually hit while building this lab |
| Tiger CLI and MCP | Out of scope — tooling around the database rather than the database itself |

## Known limits of this lab

- Runs against **self-hosted TimescaleDB in Docker**, so Tiger Cloud features (tiering, Console, MCP,
  read replicas, forking) are out of reach by design. Point `.env` at a Tiger Cloud service and the
  lessons still run.
- Timing comparisons use a ~518k row dataset that fits in cache, so speedups are conservative. The
  numbers are real but smaller than production results on larger data.
