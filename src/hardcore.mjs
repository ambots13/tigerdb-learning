import { advancedDeepDives } from './hardcore-curriculum-advanced.mjs';
import { coreDeepDives } from './hardcore-curriculum-core.mjs';
import { normalizeDeepDive } from './hardcore-schema.mjs';

const checkpoint = (question, options, answer, explanation) => ({
  question,
  options,
  answer,
  explanation,
});

const drill = (title, prompt, starterSql, hint, solution, success) => ({
  title,
  prompt,
  starterSql,
  hint,
  solution,
  success,
});

export const hardcoreByLesson = {
  '00': {
    duration: '12 min',
    mentalModel:
      'TimescaleDB is an extension inside PostgreSQL, not a parallel database hidden behind a compatibility layer. PostgreSQL owns connections, types, transactions, and catalogs; extension objects add time-aware storage and analytics while exposing their state through SQL-visible views.',
    prerequisites: ['Connect with a PostgreSQL client', 'Understand tables, rows, and extensions'],
    pitfalls: [
      'Confusing the PostgreSQL server version with the TimescaleDB extension version',
      'Assuming every table automatically becomes a hypertable',
      'Treating information-schema views as configuration rather than observations',
    ],
    checkpoints: [
      checkpoint(
        'Where is the installed TimescaleDB version recorded?',
        ['pg_extension.extversion', 'server_version_num', 'timescaledb_information.hypertables'],
        0,
        'Extensions carry their own versions in pg_extension; the PostgreSQL server version is independent.',
      ),
      checkpoint(
        'What makes a normal PostgreSQL table time-series aware?',
        ['Using TIMESTAMPTZ', 'Explicitly creating it as a hypertable', 'Installing any client driver'],
        1,
        'A timestamp column alone has no special storage behavior; hypertable creation opts the table in.',
      ),
      checkpoint(
        'Why inspect timescaledb_information?',
        ['To observe extension-managed objects', 'To bypass SQL permissions', 'To replace pg_catalog'],
        0,
        'The views expose chunks, policies, jobs, and aggregates without requiring private catalog knowledge.',
      ),
    ],
    drills: [
      drill(
        'Inventory the extensions',
        'Return the installed TimescaleDB family extensions and versions in deterministic order.',
        "SELECT extname, extversion FROM pg_extension\nWHERE extname LIKE 'timescaledb%';",
        'Sort by the extension name.',
        "SELECT extname, extversion\nFROM pg_extension\nWHERE extname LIKE 'timescaledb%'\nORDER BY extname;",
        'Verify that timescaledb is listed and, when installed, timescaledb_toolkit is listed separately.',
      ),
      drill(
        'Find the fleet objects',
        'Use catalogs to classify sensors and readings as ordinary tables or hypertables.',
        "SELECT table_name FROM timescaledb_information.hypertables;",
        'Compare pg_class relations with the hypertables view.',
        "SELECT c.relname,\n       CASE WHEN h.hypertable_name IS NULL THEN 'ordinary' ELSE 'hypertable' END AS kind\nFROM pg_class c\nJOIN pg_namespace n ON n.oid = c.relnamespace\nLEFT JOIN timescaledb_information.hypertables h\n  ON h.hypertable_schema = n.nspname AND h.hypertable_name = c.relname\nWHERE n.nspname = 'public' AND c.relname IN ('sensors', 'readings')\nORDER BY c.relname;",
        'Verify readings is a hypertable and sensors is ordinary.',
      ),
    ],
  },
  '01': {
    duration: '18 min',
    mentalModel:
      'A hypertable is one logical PostgreSQL table whose rows are routed into physical chunks covering half-open time ranges. Time predicates let the planner exclude unrelated chunks before execution, so partitioning pays off only when queries expose useful bounds on the partition column.',
    prerequisites: ['Know range predicates and TIMESTAMPTZ', 'Know the purpose of EXPLAIN'],
    pitfalls: [
      'Expecting rows on a range boundary to belong to both chunks',
      'Choosing tiny intervals that create excessive chunk overhead',
      'Hiding the time column in an expression that prevents chunk exclusion',
    ],
    checkpoints: [
      checkpoint('Who creates chunks?', ['The client', 'TimescaleDB during writes', 'A nightly VACUUM'], 1, 'Inserts are routed automatically, and a missing destination chunk is created on demand.'),
      checkpoint('A chunk range [start, end) includes which boundary?', ['Both', 'Start only', 'End only'], 1, 'Half-open ranges include start and exclude end, preventing overlap between adjacent chunks.'),
      checkpoint('What most directly enables chunk exclusion?', ['A time predicate', 'SELECT DISTINCT', 'A foreign key'], 0, 'A bound on the partitioning time column lets the planner reject chunks by their constraints.'),
    ],
    drills: [
      drill(
        'Map chunk coverage',
        'Report each readings chunk and its duration in hours.',
        "SELECT chunk_name, range_start, range_end\nFROM timescaledb_information.chunks\nWHERE hypertable_name = 'readings';",
        'Subtract the range endpoints and extract epoch seconds.',
        "SELECT chunk_name,\n       extract(epoch FROM range_end - range_start) / 3600 AS width_hours\nFROM timescaledb_information.chunks\nWHERE hypertable_name = 'readings'\nORDER BY range_start;",
        'Verify normal chunks span about 24 hours because the seed uses a one-day interval.',
      ),
      drill(
        'Expose pruning',
        'Explain a sensor average over the most recent two hours with execution enabled.',
        "SELECT avg(temperature) FROM readings;",
        'Add a lower bound directly on time and use EXPLAIN ANALYZE.',
        "EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)\nSELECT avg(temperature)\nFROM readings\nWHERE time >= now() - INTERVAL '2 hours';",
        'Verify the plan touches only the newest relevant chunk or chunks, not the full month.',
      ),
    ],
  },
  '02': {
    duration: '20 min',
    mentalModel:
      'Write paths remain PostgreSQL write paths, while time_bucket turns an event stream into aligned windows. first and last select values by an explicit ordering key, and relational metadata remains normalized outside the event hypertable so it can be joined at query time.',
    prerequisites: ['Write INSERT and GROUP BY queries', 'Understand joins and unique indexes'],
    pitfalls: [
      'Using min(value) when the value at the earliest time is required',
      'Assuming last() is a substitute for an indexed latest-row query',
      'Creating an upsert key that omits the hypertable partition column',
    ],
    checkpoints: [
      checkpoint('What does time_bucket control?', ['Retention', 'Aggregation alignment and width', 'Chunk compression'], 1, 'time_bucket maps timestamps to stable interval boundaries used by GROUP BY.'),
      checkpoint('What does first(temperature, time) return?', ['Minimum temperature', 'Temperature at earliest time', 'First physical row'], 1, 'The second argument orders values, so the result is the value associated with the earliest timestamp.'),
      checkpoint('Why include time in a hypertable unique index?', ['Uniqueness must be enforceable per partition', 'It improves JSON parsing', 'It enables foreign keys'], 0, 'A partitioned table cannot globally enforce a key that omits its partition dimension.'),
    ],
    drills: [
      drill(
        'Hourly fleet shape',
        'Compute count, first temperature, and last temperature for sensor 1 in each of the last six hours.',
        "SELECT time, temperature FROM readings WHERE sensor_id = 1;",
        'Group on time_bucket and order first/last by time.',
        "SELECT time_bucket('1 hour', time) AS bucket,\n       count(*) AS samples,\n       first(temperature, time) AS opening_temp,\n       last(temperature, time) AS closing_temp\nFROM readings\nWHERE sensor_id = 1 AND time >= now() - INTERVAL '6 hours'\nGROUP BY bucket\nORDER BY bucket;",
        'Verify at most six hourly rows, each with sample counts and time-edge values.',
      ),
      drill(
        'Latest row with metadata',
        'Return the latest reading for each sensor together with its name and site.',
        'SELECT * FROM readings JOIN sensors USING (sensor_id);',
        'Use DISTINCT ON with matching ORDER BY.',
        "SELECT DISTINCT ON (r.sensor_id)\n       r.sensor_id, s.name, s.site, r.time, r.temperature\nFROM readings r\nJOIN sensors s USING (sensor_id)\nORDER BY r.sensor_id, r.time DESC;",
        'Verify exactly one newest row for each of the 12 sensors.',
      ),
    ],
  },
  '03': {
    duration: '24 min',
    mentalModel:
      'A continuous aggregate stores bucketed states and refreshes only invalidated ranges instead of replaying all raw history. Its watermark separates materialized history from the optional real-time tail; hierarchical rollups are safe only when the stored state can be combined without losing weighting information.',
    prerequisites: ['Use time_bucket and GROUP BY', 'Understand materialized views'],
    pitfalls: [
      'Creating a large aggregate without WITH NO DATA',
      'Averaging averages when bucket sample counts differ',
      'Assuming real-time mode repairs old backfilled buckets',
    ],
    checkpoints: [
      checkpoint('Why use WITH NO DATA?', ['To defer and control initial materialization', 'To disable indexes', 'To make the view temporary'], 0, 'Deferring population avoids an uncontrolled full-history refresh during DDL.'),
      checkpoint('What does end_offset protect?', ['Old chunks', 'The still-changing newest buckets', 'The sensors table'], 1, 'Leaving a recent gap avoids repeatedly materializing buckets that are still receiving data.'),
      checkpoint('How should unequal hourly averages roll up?', ['Average them directly', 'Carry sum and count', 'Take max'], 1, 'Sum and count preserve weights; dividing their rollups produces the correct overall mean.'),
    ],
    drills: [
      drill(
        'Estimate rollup reduction',
        'Compare raw rows with the number of sensor-hour groups over the same seven-day range.',
        'SELECT count(*) FROM readings;',
        'Count a grouped subquery rather than creating a view.',
        "SELECT\n  (SELECT count(*) FROM readings WHERE time >= now() - INTERVAL '7 days') AS raw_rows,\n  (SELECT count(*) FROM (\n     SELECT time_bucket('1 hour', time), sensor_id\n     FROM readings WHERE time >= now() - INTERVAL '7 days'\n     GROUP BY 1, 2\n   ) g) AS hourly_rows;",
        'Verify hourly_rows is dramatically smaller than raw_rows.',
      ),
      drill(
        'Build a composable state',
        'Produce daily weighted temperature from hourly sums and counts without creating database objects.',
        "SELECT time_bucket('1 hour', time) AS hour, avg(temperature) FROM readings GROUP BY 1;",
        'Create hourly sum/count in a CTE, then roll both into days.',
        "WITH hourly AS (\n  SELECT time_bucket('1 hour', time) AS hour, sensor_id,\n         sum(temperature) AS temp_sum, count(temperature) AS temp_count\n  FROM readings\n  WHERE time >= now() - INTERVAL '7 days'\n  GROUP BY 1, 2\n)\nSELECT time_bucket('1 day', hour) AS day, sensor_id,\n       sum(temp_sum) / NULLIF(sum(temp_count), 0) AS weighted_avg\nFROM hourly\nGROUP BY 1, 2\nORDER BY 1, 2;",
        'Verify one row per day and sensor with a weighted average.',
      ),
    ],
  },
  '04': {
    duration: '20 min',
    mentalModel:
      'Hypercore changes old chunks from row-oriented storage to columnar batches while preserving one logical hypertable. segmentby is a physical clustering decision for equality filters, orderby controls batch ordering and min/max skipping, and policies move chunks through this lifecycle automatically.',
    prerequisites: ['Understand chunks', 'Recognize rowstore versus columnstore workloads'],
    pitfalls: [
      'Using a nearly unique segmentby key that creates tiny batches',
      'Expecting compression ratios before any chunks are converted',
      'Choosing an orderby unrelated to range filters',
    ],
    checkpoints: [
      checkpoint('What is a strong segmentby candidate here?', ['temperature', 'sensor_id', 'energy_kwh'], 1, 'sensor_id repeats heavily and is a common equality filter, so it forms useful batches.'),
      checkpoint('Why order by time?', ['To accelerate time-range batch skipping', 'To add a primary key', 'To change timestamp values'], 0, 'Ordered batches carry useful bounds that allow irrelevant ranges to be skipped.'),
      checkpoint('What does conversion change for clients?', ['The table name', 'The SQL interface', 'Neither'], 2, 'Columnar chunks remain behind the same hypertable and standard SQL interface.'),
    ],
    drills: [
      drill(
        'Read the lifecycle',
        'List readings chunks from oldest to newest and show which are columnar.',
        "SELECT * FROM timescaledb_information.chunks WHERE hypertable_name = 'readings';",
        'The catalog exposes is_compressed for compatibility naming.',
        "SELECT chunk_name, range_start, range_end, is_compressed AS is_columnar\nFROM timescaledb_information.chunks\nWHERE hypertable_name = 'readings'\nORDER BY range_start;",
        'Verify the output clearly distinguishes converted and rowstore chunks.',
      ),
      drill(
        'Measure storage',
        'Return the before/after byte totals and compression ratio for readings.',
        "SELECT * FROM hypertable_columnstore_stats('readings');",
        'Guard division by zero when no chunk has converted yet.',
        "SELECT before_compression_total_bytes,\n       after_compression_total_bytes,\n       round(before_compression_total_bytes::numeric /\n             NULLIF(after_compression_total_bytes, 0), 2) AS ratio\nFROM hypertable_columnstore_stats('readings');",
        'After module conversion, verify after bytes are lower and ratio exceeds 1; before conversion ratio may be null.',
      ),
    ],
  },
  '05': {
    duration: '22 min',
    mentalModel:
      'Policies are parameterized background jobs, and the jobs catalog is the operational control plane for refresh, columnstore, retention, reorder, and custom automation. Retention drops whole chunks rather than deleting rows, making time-aligned expiration cheap but irreversible for those ranges.',
    prerequisites: ['Understand chunk ranges', 'Know PostgreSQL procedures and CALL'],
    pitfalls: [
      'Treating a scheduled policy as proof that it ran successfully',
      'Setting retention shorter than required raw-data history',
      'Forgetting to remove custom jobs created during experiments',
    ],
    checkpoints: [
      checkpoint('Why is retention fast?', ['It truncates columns', 'It drops complete old chunks', 'It runs DELETE per row'], 1, 'Chunk removal discards physical partitions and avoids row-by-row deletion overhead.'),
      checkpoint('Where do policy failures appear?', ['Job stats/history', 'Only client logs', 'pg_extension'], 0, 'The informational job views expose schedules and recent execution outcomes.'),
      checkpoint('What invokes a custom job body?', ['Its registered background schedule', 'A trigger on every insert', 'ANALYZE'], 0, 'add_job registers a procedure for the background scheduler, with explicit manual runs also possible.'),
    ],
    drills: [
      drill(
        'Audit automation',
        'List jobs attached to readings with schedules and procedure names.',
        'SELECT * FROM timescaledb_information.jobs;',
        'Filter by hypertable_name and select operational columns.',
        "SELECT job_id, proc_schema, proc_name, schedule_interval, scheduled\nFROM timescaledb_information.jobs\nWHERE hypertable_name = 'readings'\nORDER BY job_id;",
        'Verify every installed readings policy is visible as a scheduled job.',
      ),
      drill(
        'Check job health',
        'Join readings jobs to their latest aggregate execution statistics.',
        'SELECT * FROM timescaledb_information.job_stats;',
        'Join job_id from jobs to job_stats.',
        "SELECT j.job_id, j.proc_name, s.last_run_status, s.last_successful_finish,\n       s.total_runs, s.total_failures\nFROM timescaledb_information.jobs j\nLEFT JOIN timescaledb_information.job_stats s USING (job_id)\nWHERE j.hypertable_name = 'readings'\nORDER BY j.job_id;",
        'Verify each job has an understandable status; newly created jobs may have no completed run yet.',
      ),
    ],
  },
  '06': {
    duration: '26 min',
    mentalModel:
      'Toolkit aggregates build rich intermediate states rather than prematurely collapsing data to scalars. Gap filling makes absence explicit, counter and time-weight states encode domain semantics, and percentile or statistics sketches can be stored and rolled up without revisiting raw samples.',
    prerequisites: ['Use aggregate functions and GROUP BY', 'Understand missing values and sampling frequency'],
    pitfalls: [
      'Using interpolation for discrete device states',
      'Computing max minus min across a counter reset',
      'Using plain avg on irregularly sampled measurements',
    ],
    checkpoints: [
      checkpoint('What does gapfill create?', ['Measured values', 'Missing bucket rows', 'New raw readings'], 1, 'It creates result rows for absent buckets; a filling policy decides how their values are represented.'),
      checkpoint('Why use counter_agg?', ['It detects resets', 'It sorts strings', 'It compresses chunks'], 0, 'The aggregate state accounts for counter resets when deriving delta and rate.'),
      checkpoint('When is LOCF appropriate?', ['A step-like state', 'Every physical signal', 'A unique identifier'], 0, 'Last observation carried forward models a value that remains in force until changed.'),
    ],
    drills: [
      drill(
        'Make the outage visible',
        'Show hourly buckets and LOCF temperature for sensor 7 around its seeded outage.',
        "SELECT time_bucket('1 hour', time), avg(temperature) FROM readings WHERE sensor_id = 7 GROUP BY 1;",
        'Use the explicit four-day range required by time_bucket_gapfill.',
        "SELECT time_bucket_gapfill('1 hour', time) AS bucket,\n       count(*) AS samples,\n       locf(round(avg(temperature)::numeric, 2)) AS held_temp\nFROM readings\nWHERE sensor_id = 7\n  AND time >= now() - INTERVAL '4 days'\n  AND time < now() - INTERVAL '2 days'\nGROUP BY bucket\nORDER BY bucket;",
        'Verify a six-hour run of zero-sample buckets appears while held_temp carries the previous value.',
      ),
      drill(
        'Measure a counter',
        'Compute each sensor energy delta, hourly rate, and reset count for the last day.',
        "SELECT sensor_id, counter_agg(time, energy_kwh) FROM readings GROUP BY sensor_id;",
        'rate is per second, so scale by 3600.',
        "SELECT sensor_id,\n       round(delta(counter_agg(time, energy_kwh))::numeric, 3) AS kwh,\n       round((rate(counter_agg(time, energy_kwh)) * 3600)::numeric, 3) AS kwh_per_hour,\n       num_resets(counter_agg(time, energy_kwh)) AS resets\nFROM readings\nWHERE time >= now() - INTERVAL '24 hours'\nGROUP BY sensor_id\nORDER BY sensor_id;",
        'Verify 12 rows, nonnegative deltas, and normally zero resets in the seeded data.',
      ),
    ],
  },
  '07': {
    duration: '24 min',
    mentalModel:
      'Performance work is evidence-driven: start with the access pattern, inspect the actual plan, then change the smallest relevant physical design. Chunk interval bounds partition overhead, indexes serve selective predicates within chunks, and chunk skipping adds metadata for non-time columns correlated with chunk ranges.',
    prerequisites: ['Read basic EXPLAIN output', 'Understand B-tree indexes and selectivity'],
    pitfalls: [
      'Adding indexes without measuring the target query',
      'Changing chunk interval and expecting existing chunks to be rewritten',
      'Using exact count on huge history when an estimate is sufficient',
    ],
    checkpoints: [
      checkpoint('What does changing chunk interval affect?', ['Future chunks', 'All existing chunks immediately', 'Only continuous aggregates'], 0, 'The new interval governs chunks created afterward; existing physical ranges stay intact.'),
      checkpoint('What should lead index design?', ['Actual filter and order patterns', 'Column declaration order', 'Table name length'], 0, 'Indexes earn their write and storage cost only when they match real access paths.'),
      checkpoint('What does EXPLAIN ANALYZE add?', ['Execution measurements', 'A new index', 'Permanent statistics'], 0, 'ANALYZE executes the query and reports actual rows, loops, and timing.'),
    ],
    drills: [
      drill(
        'Inspect the hot path',
        'Explain the latest 20 readings for sensor 4 over the last day.',
        'SELECT * FROM readings WHERE sensor_id = 4;',
        'Use both predicates and order by time descending.',
        "EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)\nSELECT time, temperature, humidity\nFROM readings\nWHERE sensor_id = 4 AND time >= now() - INTERVAL '1 day'\nORDER BY time DESC\nLIMIT 20;",
        'Verify chunk exclusion limits history and inspect whether the scan can provide the requested order.',
      ),
      drill(
        'Quantify chunk sizing',
        'Summarize average and maximum physical chunk size for readings.',
        "SELECT * FROM chunks_detailed_size('readings');",
        'Aggregate total_bytes returned per chunk.',
        "SELECT count(*) AS chunks,\n       pg_size_pretty(avg(total_bytes)::bigint) AS avg_chunk,\n       pg_size_pretty(max(total_bytes)) AS largest_chunk\nFROM chunks_detailed_size('readings');",
        'Verify a plausible one-day chunk count and identify whether one chunk is disproportionately large.',
      ),
    ],
  },
  '08': {
    duration: '30 min',
    mentalModel:
      'A production time-series pipeline is a lifecycle, not a table: ingest lands in writable rowstore chunks, rollups answer repeated dashboard queries, aging chunks become columnar, and retention removes data after its value expires. Each policy window must fit the others so raw data is never deleted before required rollups are materialized.',
    prerequisites: ['Complete hypertables, aggregates, columnstore, and policies', 'Translate dashboard needs into retention windows'],
    pitfalls: [
      'Pointing dashboards at raw history after building a rollup',
      'Retaining raw data for less time than aggregate refresh lateness',
      'Using a segment key unrelated to dashboard filters',
    ],
    checkpoints: [
      checkpoint('What should a historical dashboard usually query?', ['The hourly rollup', 'Every raw row', 'pg_class'], 0, 'A purpose-built rollup reads far fewer rows while preserving dashboard-level resolution.'),
      checkpoint('Which policy should win the race?', ['Retention before refresh', 'Refresh before retention', 'Neither matters'], 1, 'Late data must be incorporated into retained rollups before its raw chunks disappear.'),
      checkpoint('Where do fresh unmaterialized values come from?', ['The real-time raw tail', 'Old columnar batches only', 'The sensors table'], 0, 'Real-time continuous aggregates combine stored history with raw rows newer than the watermark.'),
    ],
    drills: [
      drill(
        'Design the dashboard result',
        'Return one hourly fleet row per site for the last day using seeded tables.',
        'SELECT time, site, temperature FROM readings JOIN sensors USING (sensor_id);',
        'Bucket readings, join metadata, and group by bucket and site.',
        "SELECT time_bucket('1 hour', r.time) AS bucket, s.site,\n       round(avg(r.temperature)::numeric, 2) AS avg_temp,\n       min(r.battery) AS min_battery,\n       count(*) AS samples\nFROM readings r\nJOIN sensors s USING (sensor_id)\nWHERE r.time >= now() - INTERVAL '24 hours'\nGROUP BY bucket, s.site\nORDER BY bucket, s.site;",
        'Verify four site rows per populated hour with temperature, battery, and sample totals.',
      ),
      drill(
        'Audit lifecycle boundaries',
        'Report the raw history bounds and current chunk states before choosing policies.',
        'SELECT min(time), max(time) FROM readings;',
        'Combine scalar history bounds with catalog counts.',
        "SELECT min(time) AS first_reading, max(time) AS last_reading,\n       (SELECT count(*) FROM timescaledb_information.chunks\n        WHERE hypertable_name = 'readings') AS chunks,\n       (SELECT count(*) FROM timescaledb_information.chunks\n        WHERE hypertable_name = 'readings' AND is_compressed) AS columnar_chunks\nFROM readings;",
        'Verify roughly 30 days of history and reconcile total versus columnar chunk counts.',
      ),
    ],
  },
  '09': {
    duration: '25 min',
    mentalModel:
      'An index is a materialized answer to a family of access paths: partial indexes narrow the population, expression indexes store a transformation, covering indexes avoid heap visits, and GIN indexes invert composite values. BRIN summarizes naturally ordered ranges cheaply, while columnstore sparse indexes skip batches rather than locating individual tuples.',
    prerequisites: ['Understand B-tree indexes', 'Read scan nodes in EXPLAIN'],
    pitfalls: [
      'Using BRIN for random equality lookups',
      'Expecting an expression index to match a differently written expression',
      'Adding INCLUDE columns without accounting for index size and write cost',
    ],
    checkpoints: [
      checkpoint('Which index is naturally tiny for ordered time data?', ['BRIN', 'GIN', 'Hash'], 0, 'BRIN stores summaries per block range and excels when physical order correlates with time.'),
      checkpoint('What does a partial index omit?', ['Rows outside its predicate', 'All key values', 'Planner statistics'], 0, 'Only predicate-matching rows receive entries, reducing size for focused queries.'),
      checkpoint('What is a columnstore bloom filter best at?', ['Skipping batches on equality', 'Ordering final output', 'Enforcing foreign keys'], 0, 'Bloom metadata can prove that a batch cannot contain an equality value and skip it cheaply.'),
    ],
    drills: [
      drill(
        'Inventory per-table indexes',
        'List every index defined on readings and its complete definition.',
        "SELECT indexname FROM pg_indexes WHERE tablename = 'readings';",
        'Include schemaname and indexdef for interpretation.',
        "SELECT schemaname, indexname, indexdef\nFROM pg_indexes\nWHERE tablename = 'readings'\nORDER BY indexname;",
        'Verify the seeded hypertable has its time-oriented index and note any indexes added by completed lessons.',
      ),
      drill(
        'Match a covering access pattern',
        'Explain a narrow latest-reading query without modifying schema.',
        'SELECT * FROM readings WHERE sensor_id = 3;',
        'Project only needed values, add time bounds, ordering, and a limit.',
        "EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)\nSELECT time, temperature, battery\nFROM readings\nWHERE sensor_id = 3 AND time >= now() - INTERVAL '12 hours'\nORDER BY time DESC\nLIMIT 10;",
        'Verify the plan prunes old chunks; after the lesson index exists, compare heap fetch and sort behavior.',
      ),
    ],
  },
  '10': {
    duration: '26 min',
    mentalModel:
      'A roaring bitmap is a compact, exact set of nonnegative integer IDs with fast union, intersection, and difference. Unlike count(distinct), the set itself is composable, so per-bucket bitmap states can roll up to arbitrary ranges and answer retention or churn without raw events.',
    prerequisites: ['Understand set union and intersection', 'Know why distinct counts are not additive'],
    pitfalls: [
      'Summing per-bucket distinct counts and double-counting repeat members',
      'Using bitmap IDs for arbitrary strings without a stable integer mapping',
      'Confusing an exact bitmap with an approximate cardinality sketch',
    ],
    checkpoints: [
      checkpoint('How do hourly exact sets roll up?', ['rb_or_agg', 'sum(rb_cardinality)', 'avg'], 0, 'Union merges members and removes cross-bucket duplicates before cardinality is read.'),
      checkpoint('What computes churned members?', ['Previous minus current', 'Current union previous', 'Current plus previous'], 0, 'Set difference identifies IDs present in the previous period but absent now.'),
      checkpoint('What information does a bitmap retain?', ['Membership', 'Event order', 'Floating-point measures'], 0, 'A bitmap represents membership; event timing and measures must be stored separately.'),
    ],
    drills: [
      drill(
        'Exact active sensor set',
        'Build a bitmap of sensors active in the last 24 hours and return its cardinality and members.',
        "SELECT rb_build_agg(sensor_id) FROM readings WHERE time >= now() - INTERVAL '24 hours';",
        'Use rb_cardinality and rb_to_array accessors.',
        "WITH active AS (\n  SELECT rb_build_agg(sensor_id) AS ids\n  FROM readings\n  WHERE time >= now() - INTERVAL '24 hours'\n)\nSELECT rb_cardinality(ids) AS active_count, rb_to_array(ids) AS sensor_ids\nFROM active;",
        'Verify all normally active sensor IDs appear exactly once.',
      ),
      drill(
        'Compare adjacent-day sets',
        'Compute returning and lost sensors between the prior day and the latest day.',
        'SELECT rb_build_agg(sensor_id) FROM readings;',
        'Build two bitmap scalars and use rb_and plus rb_andnot.',
        "WITH sets AS (\n  SELECT\n    rb_build_agg(sensor_id) FILTER (WHERE time >= now() - INTERVAL '1 day') AS current_ids,\n    rb_build_agg(sensor_id) FILTER (WHERE time >= now() - INTERVAL '2 days' AND time < now() - INTERVAL '1 day') AS previous_ids\n  FROM readings\n)\nSELECT rb_cardinality(rb_and(current_ids, previous_ids)) AS returning,\n       rb_cardinality(rb_andnot(previous_ids, current_ids)) AS lost\nFROM sets;",
        'Verify returning is the shared population and lost is normally zero for the seeded fleet.',
      ),
    ],
  },
  '11': {
    duration: '24 min',
    mentalModel:
      'A continuous aggregate is stored history plus an optional live tail separated by a watermark. Writes behind that watermark create invalidations but are not included by real-time aggregation, so refresh policy start offsets must cover measured arrival lateness or targeted refreshes must repair known ranges.',
    prerequisites: ['Understand continuous aggregate refresh windows', 'Know what backfill and late arrival mean'],
    pitfalls: [
      'Assuming real-time mode sees rows older than the watermark',
      'Refreshing all history to repair one narrow backfill',
      'Choosing start_offset from intuition instead of lateness data',
    ],
    checkpoints: [
      checkpoint('What does real-time mode cover?', ['Rows newer than the watermark', 'Every historical invalidation', 'Only compressed chunks'], 0, 'The live branch reads the raw tail after the materialized boundary, not old backfills.'),
      checkpoint('How should a narrow old backfill be repaired?', ['Targeted refresh', 'Drop the aggregate', 'VACUUM sensors'], 0, 'Refreshing the affected bucket range is precise and avoids recomputing unrelated history.'),
      checkpoint('What should determine start_offset?', ['Observed maximum useful lateness', 'Bucket label text', 'Number of sensors'], 0, 'The refresh window must reach far enough back to capture accepted late arrivals.'),
    ],
    drills: [
      drill(
        'Measure observed span',
        'For each sensor, report its earliest and latest seeded event and observed span.',
        'SELECT sensor_id, min(time), max(time) FROM readings GROUP BY sensor_id;',
        'Subtract timestamps to make coverage differences obvious.',
        "SELECT sensor_id, min(time) AS first_event, max(time) AS last_event,\n       max(time) - min(time) AS observed_span\nFROM readings\nGROUP BY sensor_id\nORDER BY sensor_id;",
        'Verify all sensors span about 30 days despite sensor 7 having an internal outage.',
      ),
      drill(
        'Locate aggregate watermarks',
        'List existing continuous aggregates and their materialized watermarks without changing them.',
        'SELECT * FROM timescaledb_information.continuous_aggregates;',
        'The public view does not expose the materialization ID, so use the same diagnostic catalog as the lesson.',
        "SELECT user_view_schema AS view_schema, user_view_name AS view_name,\n       _timescaledb_functions.to_timestamp(\n         _timescaledb_functions.cagg_watermark(mat_hypertable_id)\n       ) AS watermark\nFROM _timescaledb_catalog.continuous_agg\nORDER BY user_view_schema, user_view_name;",
        'Verify each aggregate created by earlier lessons has a watermark; no rows is valid before any aggregate exists.',
      ),
    ],
  },
  '12': {
    duration: '24 min',
    mentalModel:
      'Schema shape and segment cardinality determine how much work survives into every future query. A useful segmentby key repeats enough to form large columnar batches and matches equality filters; stable descriptive metadata belongs in a normalized dimension table rather than being repeated in every measurement.',
    prerequisites: ['Understand normalization and cardinality', 'Know columnstore segmentby behavior'],
    pitfalls: [
      'Segmenting by a timestamp or nearly unique event ID',
      'Assuming the highest-cardinality key is always most selective and therefore best',
      'Repeating mutable metadata in every time-series row',
    ],
    checkpoints: [
      checkpoint('Why is sensor_id a useful segment key?', ['It repeats and is commonly filtered', 'It is floating point', 'It is the time dimension'], 0, 'Its moderate cardinality forms substantial batches while supporting a frequent equality predicate.'),
      checkpoint('Where should site and model live?', ['The sensors dimension table', 'Every reading row', 'A chunk name'], 0, 'Stable attributes belong once in relational metadata and can be joined when needed.'),
      checkpoint('What does excessive segment cardinality cause?', ['Many tiny batches', 'Larger time buckets', 'More accurate averages'], 0, 'Too many groups fragment compression batches and erase columnar efficiency.'),
    ],
    drills: [
      drill(
        'Profile candidate cardinality',
        'Compare distinct counts for candidate grouping columns against total readings.',
        'SELECT count(*) FROM readings;',
        'Compute ratios using NULLIF and numeric casts.',
        "SELECT count(*) AS rows,\n       count(DISTINCT sensor_id) AS sensors,\n       count(DISTINCT time) AS timestamps,\n       round(count(DISTINCT sensor_id)::numeric / NULLIF(count(*), 0), 6) AS sensor_ratio,\n       round(count(DISTINCT time)::numeric / NULLIF(count(*), 0), 6) AS time_ratio\nFROM readings;",
        'Verify sensor_id repeats heavily while time has far higher cardinality.',
      ),
      drill(
        'Test metadata fanout',
        'Report reading volume by stable site and model without denormalizing readings.',
        'SELECT * FROM readings JOIN sensors USING (sensor_id);',
        'Join once and group on dimension attributes.',
        "SELECT s.site, s.model, count(*) AS readings,\n       count(DISTINCT r.sensor_id) AS sensors\nFROM readings r\nJOIN sensors s USING (sensor_id)\nGROUP BY s.site, s.model\nORDER BY s.site, s.model;",
        'Verify metadata grouping works through the small sensors dimension with no repeated site column in readings.',
      ),
    ],
  },
  '13': {
    duration: '28 min',
    mentalModel:
      'Toolkit states preserve domain structure: LTTB preserves chart shape, state aggregates preserve transitions and durations, heartbeat aggregates model expected liveness, and candlesticks preserve open-high-low-close. These states are composable across buckets, making them suitable for continuous aggregates instead of one-off scalar calculations.',
    prerequisites: ['Understand aggregate states from module 06', 'Know time-series downsampling and state transitions'],
    pitfalls: [
      'Treating downsampling as simple averaging',
      'Using a heartbeat interval that does not match expected reporting cadence',
      'Computing an integral without choosing Linear versus LOCF semantics',
    ],
    checkpoints: [
      checkpoint('What does LTTB try to preserve?', ['Visual shape and extremes', 'Every source point', 'Only the mean'], 0, 'Largest Triangle Three Buckets selects representative points with high visual contribution.'),
      checkpoint('What does heartbeat_agg require?', ['An expected heartbeat interval', 'A bitmap extension', 'A primary key'], 0, 'The expected cadence defines when silence becomes downtime.'),
      checkpoint('What does candlestick_agg retain?', ['OHLC structure', 'Only average', 'Device metadata'], 0, 'Its state exposes opening, high, low, and closing values and can be rolled up.'),
    ],
    drills: [
      drill(
        'Downsample without flattening',
        'Downsample sensor 2 temperature over the last day to 25 points and inspect their range.',
        "SELECT lttb(time, temperature, 25) FROM readings WHERE sensor_id = 2;",
        'Unnest the aggregate result and use the point fields.',
        "WITH points AS (\n  SELECT unnest(lttb(time, temperature, 25)) AS p\n  FROM readings\n  WHERE sensor_id = 2 AND time >= now() - INTERVAL '24 hours'\n)\nSELECT count(*) AS points, min((p).value) AS low, max((p).value) AS high\nFROM points;",
        'Verify exactly 25 points and a range that still reflects the daily temperature swing.',
      ),
      drill(
        'Integrate thermal exposure',
        'Compute degree-hours for each sensor over the last day using linear interpolation.',
        'SELECT sensor_id, time_weight(\'Linear\', time, temperature) FROM readings GROUP BY sensor_id;',
        'Pass the time-weight state to integral with hour units.',
        "SELECT sensor_id,\n       round(integral(time_weight('Linear', time, temperature), 'hour')::numeric, 1) AS degree_hours\nFROM readings\nWHERE time >= now() - INTERVAL '24 hours'\nGROUP BY sensor_id\nORDER BY sensor_id;",
        'Verify 12 positive exposure totals whose scale is roughly average temperature times 24 hours.',
      ),
    ],
  },
  '14': {
    duration: '28 min',
    mentalModel:
      'A plan is a tree of iterators: execution starts at the deepest children, and each parent consumes their rows. Estimates explain why the planner chose a path, actual rows and loops reveal what happened, and buffer counts separate CPU work from physical or cached data access.',
    prerequisites: ['Know basic SELECT and joins', 'Have used EXPLAIN ANALYZE'],
    pitfalls: [
      'Reading plan text from top to bottom as execution order',
      'Comparing actual rows without multiplying by loops',
      'Blaming a scan type before checking estimate errors and buffers',
    ],
    checkpoints: [
      checkpoint('What is absent from plain EXPLAIN?', ['Actual execution measurements', 'Planner estimates', 'Node costs'], 0, 'Plain EXPLAIN plans but does not run the statement, so there are no actual rows or timings.'),
      checkpoint('Where does execution begin?', ['Deepest child nodes', 'The top output node', 'Alphabetically by node name'], 0, 'Leaf scans produce rows that flow upward through joins, sorts, and aggregates.'),
      checkpoint('What often repairs a large row-estimate error?', ['ANALYZE or better statistics', 'More output columns', 'Renaming the table'], 0, 'Fresh and sufficiently detailed statistics give the planner a better model of value distributions.'),
    ],
    drills: [
      drill(
        'Read estimates against reality',
        'Explain and execute a selective sensor/time query with buffers.',
        'SELECT count(*) FROM readings WHERE sensor_id = 7;',
        'Request ANALYZE, BUFFERS, and VERBOSE false for a focused plan.',
        "EXPLAIN (ANALYZE, BUFFERS, COSTS ON, VERBOSE OFF)\nSELECT count(*)\nFROM readings\nWHERE sensor_id = 7 AND time >= now() - INTERVAL '6 hours';",
        'Compare estimated and actual rows at the scan nodes, then account for loops and buffer hits.',
      ),
      drill(
        'Interpret a join tree',
        'Explain a site-level aggregate joining readings to the small sensor dimension.',
        'SELECT site, avg(temperature) FROM readings JOIN sensors USING (sensor_id) GROUP BY site;',
        'Constrain time so chunk exclusion is visible and include buffers.',
        "EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)\nSELECT s.site, avg(r.temperature)\nFROM readings r\nJOIN sensors s USING (sensor_id)\nWHERE r.time >= now() - INTERVAL '1 day'\nGROUP BY s.site\nORDER BY s.site;",
        'Verify leaf scans feed a join and then an aggregate; note the chosen join strategy and pruned chunks.',
      ),
    ],
  },
};

for (const [lessonId, deepDive] of Object.entries({
  ...coreDeepDives,
  ...advancedDeepDives,
})) {
  if (!hardcoreByLesson[lessonId]) {
    throw new Error(`Deep curriculum references unknown lesson ${lessonId}`);
  }
  hardcoreByLesson[lessonId].duration = `${deepDive.estimatedMinutes / 60} hours`;
  hardcoreByLesson[lessonId].deepDive = normalizeDeepDive(deepDive);
}

export function getHardcoreLesson(lessonId) {
  return hardcoreByLesson[lessonId] ?? null;
}
