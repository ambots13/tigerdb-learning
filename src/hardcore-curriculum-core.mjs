const official = {
  overview: ['TigerData documentation: TimescaleDB overview', 'https://docs.tigerdata.com/use-timescale/latest/', 'Official product and architecture documentation.'],
  hypertables: ['TigerData documentation: hypertables and chunks', 'https://docs.tigerdata.com/use-timescale/latest/hypertables/', 'Official hypertable storage and chunk-management documentation.'],
  query: ['TigerData documentation: querying data', 'https://docs.tigerdata.com/use-timescale/latest/query-data/', 'Official guide to time-series queries and time_bucket.'],
  caggs: ['TigerData documentation: continuous aggregates', 'https://docs.tigerdata.com/use-timescale/latest/continuous-aggregates/', 'Official continuous aggregate behavior and administration.'],
  realtime: ['TigerData documentation: real-time aggregates', 'https://docs.tigerdata.com/use-timescale/latest/continuous-aggregates/real-time-aggregates/', 'Official description of materialized and recent raw-data combination.'],
  columnstore: ['TigerData documentation: Hypercore columnstore', 'https://docs.tigerdata.com/use-timescale/latest/hypercore/', 'Official rowstore/columnstore lifecycle documentation.'],
  jobs: ['TigerData documentation: background jobs', 'https://docs.tigerdata.com/use-timescale/latest/jobs/', 'Official job scheduler API and operational guidance.'],
  retention: ['TigerData documentation: retention policies', 'https://docs.tigerdata.com/use-timescale/latest/data-retention/', 'Official retention and chunk-dropping documentation.'],
  hyperfunctions: ['TigerData Toolkit API', 'https://docs.tigerdata.com/api/latest/hyperfunctions/', 'Official reference for Toolkit aggregate states and accessors.'],
  gapfill: ['TigerData documentation: gapfilling', 'https://docs.tigerdata.com/use-timescale/latest/hyperfunctions/gapfilling-interpolation/', 'Official gapfill, LOCF, and interpolation guidance.'],
  counters: ['TigerData Toolkit: counter aggregates', 'https://docs.tigerdata.com/api/latest/hyperfunctions/counters-and-gauges/counter_agg/', 'Official counter_agg, rollup, delta, and reset semantics.'],
  explain: ['PostgreSQL documentation: EXPLAIN', 'https://www.postgresql.org/docs/current/sql-explain.html', 'Primary PostgreSQL reference for plans and execution measurements.'],
  indexes: ['TigerData documentation: indexing data', 'https://docs.tigerdata.com/use-timescale/latest/schema-management/indexing/', 'Official indexing guidance for hypertables.'],
  skipping: ['TigerData documentation: chunk skipping', 'https://docs.tigerdata.com/use-timescale/latest/hypercore/secondary-indexes/', 'Official chunk-skipping status, correlation requirements, and API.'],
};

const phaseMinutes = [20, 20, 20, 25, 30, 25, 25, 15];
const phaseKinds = [
  ['diagnostics', 'Baseline diagnostics'],
  ['theory', 'Mechanism deep dive'],
  ['guided-analysis', 'Guided catalog and plan analysis'],
  ['controlled-experiment', 'Controlled experiment'],
  ['failure-lab', 'Failure and debugging lab'],
  ['independent', 'Independent investigation'],
  ['scenario', 'Production scenario'],
  ['assessment', 'Closed-book assessment and review'],
];

function authoredNonSql(checks, term, meaning) {
  const normalizedChecks = checks.map(([id, question, options, answer, explanation, retryExplanations]) => ({
    id,
    question,
    options,
    answer,
    explanation,
    retryExplanations: retryExplanations.map((feedback, index) => feedback ?? (index === answer ? explanation : 'Reconsider this choice.')),
  }));
  const workedExplanation = normalizedChecks.map((check) => check.explanation).join(' ');
  return {
    instructions: [
      'Choose an answer for each browser check.',
      'Use the feedback to retry any incorrect choice; no written artifact is required.',
    ],
    checks: normalizedChecks,
    vocabulary: [{ term, simpleMeaning: meaning, technicalMeaning: meaning, example: normalizedChecks[0].explanation }],
    steps: normalizedChecks.map((check, index) => ({
      id: `${check.id}-step`,
      action: `Answer browser check ${index + 1}.`,
      reason: check.question,
      expectedResult: `The accepted decision is option ${check.answer + 1}: ${check.options[check.answer]}`,
      explanation: check.explanation,
      troubleshooting: 'Read the feedback for the selected option, then compare it with the stated mechanism before retrying.',
    })),
    workedAnswer: {
      answer: normalizedChecks.map((check) => check.options[check.answer]).join(' Then: '),
      explanation: workedExplanation,
      acceptableVariations: ['Select every correct browser option; no written artifact is required.'],
      template: 'Choose the option whose mechanism matches the facts in the prompt.',
      example: workedExplanation,
    },
    commonMistakes: [{
      symptom: 'A tempting option describes a familiar action but not the mechanism in the prompt.',
      cause: `The distinction expressed by “${term}” was skipped.`,
      fix: `Use this definition before retrying: ${meaning}`,
    }],
  };
}

const nonSqlAuthoring = {
  '00-activity-03': authoredNonSql([['00-activity-03-check-1', 'Which responsibility belongs to TimescaleDB rather than core PostgreSQL?', ['Transactions', 'Hypertable chunk routing', 'Client connections'], 1, 'PostgreSQL handles connections and transactions; the TimescaleDB extension adds hypertables and chunk routing.', ['Transactions remain a PostgreSQL responsibility.', null, 'The PostgreSQL server accepts ordinary client connections.']]], 'extension', 'Software installed into PostgreSQL that adds database objects and behavior.'),
  '00-activity-07': authoredNonSql([['00-activity-07-check-1', 'pg_extension lists TimescaleDB, but the expected hypertable is absent. What is the safest first check?', ['Reinstall TimescaleDB', 'Confirm the current database and schema', 'Delete and reseed immediately'], 1, 'An extension can be installed while the connection points at the wrong database or schema, so verify context before changing anything.', ['Reinstalling can damage a healthy setup and does not test connection context.', null, 'Reseeding is destructive and should follow read-only context checks.']]], 'connection context', 'The current database, role, and schema search path used by a session.'),
  '00-activity-09': authoredNonSql([['00-activity-09-check-1', 'Which incident handoff is most useful?', ['“Timescale is broken.”', '“Database fleet on PostgreSQL 17 has TimescaleDB 2.x; rerun the attached catalog query.”', '“Try reinstalling everything.”'], 1, 'A useful handoff separates observed versions from recommendations and gives a reproducible query.', ['This is speculation without evidence.', null, 'This proposes a risky action without recording observations.']]], 'handoff', 'A concise transfer of observed facts, reproduction steps, and next actions.'),
  '00-activity-10': authoredNonSql([['00-activity-10-check-1', 'Why can an ordinary PostgreSQL client use a TimescaleDB hypertable?', ['TimescaleDB imitates PostgreSQL over a compatibility layer', 'TimescaleDB is a PostgreSQL extension, so normal SQL and transactions remain PostgreSQL features', 'The client bypasses PostgreSQL catalogs'], 1, 'TimescaleDB extends PostgreSQL; it does not replace the server protocol with a compatibility layer.', ['There is no separate compatibility server in this architecture.', null, 'Clients use PostgreSQL catalogs rather than bypassing them.']]], 'compatibility layer', 'An adapter that imitates another system; TimescaleDB does not need one because it runs inside PostgreSQL.'),
  '00-activity-11': authoredNonSql([['00-activity-11-check-1', 'Where should you verify an installed extension version?', ['pg_extension', 'The table name', 'The client application version'], 0, 'pg_extension records extensions installed in the current database and their versions.', [null, 'Object names do not prove which extension version is installed.', 'The client version is separate from server extensions.']]], 'catalog', 'Database metadata that describes installed objects and their properties.'),
  '01-activity-03': authoredNonSql([
    ['01-activity-03-check-1', 'A chunk covers 10:00 up to, but not including, 11:00. Which timestamp belongs to it?', ['10:00', '11:00', 'Both 10:00 and 11:00'], 0, 'A half-open range includes its start and excludes its end.', [null, '11:00 is the next chunk’s start.', 'Including both ends would make adjacent chunks overlap.']],
    ['01-activity-03-check-2', 'Where does a row timestamped exactly 11:00 go?', ['Only the 10:00–11:00 chunk', 'Only the 11:00–12:00 chunk', 'Both chunks'], 1, 'The shared boundary is excluded from the earlier chunk and included by the following chunk.', ['The earlier range excludes its end.', null, 'Half-open boundaries assign every boundary row exactly once.']],
  ], 'half-open range', 'A range that includes its starting value but excludes its ending value.'),
  '01-activity-09': authoredNonSql([
    ['01-activity-09-check-1', 'Which facts should drive an initial chunk interval?', ['Ingest rate, active index size, memory, and query windows', 'A universal seven-day rule', 'The number of SQL keywords'], 0, 'Chunk sizing is workload-dependent and starts from measured ingest, memory, index, and query-window facts.', [null, 'No single interval fits every workload.', 'SQL syntax does not determine physical chunk size.']],
    ['01-activity-09-check-2', 'What should justify revising that initial interval?', ['One unusually fast query', 'Measured chunk sizes and representative query plans', 'A preference for round numbers'], 1, 'Revise a starting interval from repeated storage and representative-plan evidence.', ['One sample is too noisy and narrow.', null, 'Round numbers are convenient but not performance evidence.']],
  ], 'chunk interval', 'The span of time routed into one hypertable chunk.'),
  '01-activity-10': authoredNonSql([['01-activity-10-check-1', 'Changing a hypertable chunk interval primarily affects which chunks?', ['All existing chunks are rewritten automatically', 'Future chunks; existing chunks keep their current boundaries', 'Only chunks already compressed'], 1, 'A new interval controls future chunk creation and does not automatically rewrite existing chunks.', ['Existing chunks retain their boundaries unless separately migrated.', null, 'The rule is not limited to compressed chunks.']]], 'chunk interval change', 'A new setting used when TimescaleDB creates later chunks.'),
  '01-activity-11': authoredNonSql([
    ['01-activity-11-check-1', 'Adjacent chunks are [00:00, 01:00) and [01:00, 02:00). Which chunk owns 01:00?', ['The first', 'The second', 'Both'], 1, 'The end is excluded from the first range and the same timestamp is included as the second range’s start.', ['The first chunk stops just before 01:00.', null, 'Non-overlap prevents duplicate ownership.']],
    ['01-activity-11-check-2', 'A dashboard usually reads two hours while chunks span one day. What evidence should guide a sizing change?', ['Representative plans plus ingest, memory, and index measurements', 'The dashboard window alone', 'A fixed industry interval'], 0, 'Sizing combines query windows with write rate and physical resource measurements.', [null, 'The query window matters but is not the only constraint.', 'Intervals must be validated for this workload.']],
  ], 'chunk pruning', 'Skipping chunks whose time constraints cannot match a query.'),
  '02-activity-03': authoredNonSql([['02-activity-03-check-1', 'Which statement correctly separates three kinds of order?', ['Storage order, result order, and window order are always identical', 'ORDER BY controls returned rows; a window ORDER BY controls calculations; storage order is not guaranteed', 'Insertion order guarantees query output order'], 1, 'These orderings have different jobs, and only an outer ORDER BY guarantees presentation order.', ['The planner may choose different storage and execution paths.', null, 'SQL results have no guaranteed insertion order without ORDER BY.']]], 'window order', 'The ordering inside OVER(...) that defines how a window function processes rows.'),
  '02-activity-09': authoredNonSql([['02-activity-09-check-1', 'Which key makes retried telemetry inserts idempotent when a sensor has one reading per timestamp?', ['sensor_id alone', '(sensor_id, time)', 'temperature'], 1, 'The pair identifies one sensor event while allowing many times per sensor and many sensors per time.', ['This would allow only one row per sensor.', null, 'Measurements can repeat and are not stable identities.']]], 'idempotent', 'Safe to repeat without creating a second logical event.'),
  '02-activity-10': authoredNonSql([['02-activity-10-check-1', 'An API needs the newest row for one sensor. Which design directly matches that request?', ['Filter by sensor_id, order time descending, limit 1', 'Group every sensor before filtering', 'Return rows without ORDER BY'], 0, 'Filtering first and taking the first descending timestamp expresses the endpoint precisely.', [null, 'Grouping the whole fleet does unnecessary work for a single sensor.', 'Without ordering, “newest” is not guaranteed.']]], 'latest-row query', 'A query that orders a defined group by time descending and selects its first row.'),
  '02-activity-11': authoredNonSql([['02-activity-11-check-1', 'Which query property is required for deterministic “latest per sensor” results when timestamps can tie?', ['A stable tie-breaker after time', 'Reliance on insertion order', 'Removing the sensor partition'], 0, 'A second unique ordering key makes tied timestamps deterministic.', [null, 'Insertion order is not a SQL result guarantee.', 'Removing the partition mixes different sensors.']]], 'tie-breaker', 'An additional ordering value that decides between rows equal on the primary sort key.'),
  '03-activity-03': authoredNonSql([['03-activity-03-check-1', 'A late row changes an already materialized bucket. What sequence restores the aggregate?', ['Invalidate the affected range, then refresh it', 'Drop all raw data, then query the aggregate', 'Enable real-time mode only'], 0, 'The write marks an affected materialized range invalid; refresh recomputes that range from raw data.', [null, 'Deleting the source prevents recomputation.', 'Real-time mode does not replace refresh of old invalidated buckets.']]], 'invalidation', 'A record that a materialized aggregate range may be stale and needs refresh.'),
  '03-activity-06': authoredNonSql([['03-activity-06-check-1', 'What does real-time aggregation add to materialized results?', ['Recent raw rows beyond the materialization boundary', 'Automatic repair of every old bucket', 'A rewrite of the source hypertable'], 0, 'Real-time mode combines materialized history with the newest raw region.', [null, 'Old invalidated materialized ranges still require refresh.', 'The source table is not rewritten.']]], 'real-time aggregate', 'A query mode that combines materialized aggregate data with recent raw data.'),
  '03-activity-07': authoredNonSql([['03-activity-07-check-1', 'The newest aggregate bucket is missing. Which check most directly distinguishes expected lag from failure?', ['Compare the materialization watermark and policy end offset with the bucket time', 'Rename the aggregate', 'Assume raw data is missing'], 0, 'The watermark and policy window show whether that bucket is eligible to have been materialized yet.', [null, 'Renaming does not alter refresh coverage.', 'Raw data must be checked rather than assumed absent.']]], 'watermark', 'The boundary through which a continuous aggregate has materialized data.'),
  '03-activity-09': authoredNonSql([['03-activity-09-check-1', 'Rows can arrive two hours late. Which refresh policy is safest?', ['An end offset and schedule that repeatedly revisit at least the lateness window', 'Refresh only the newest minute once', 'Delete raw rows after one hour'], 0, 'The refresh window must overlap accepted lateness so late rows are recomputed before source retention.', [null, 'A one-time newest-minute refresh misses two-hour-late rows.', 'Deleting source rows before refresh makes repair impossible.']]], 'end offset', 'How far behind now a policy stops its refresh window.'),
  '03-activity-10': authoredNonSql([['03-activity-10-check-1', 'A daily continuous aggregate is built on an hourly one. Which order preserves correctness?', ['Refresh daily first, then hourly', 'Refresh hourly source buckets before dependent daily buckets', 'The order never matters'], 1, 'A dependent daily layer should refresh only after its hourly source range is current.', ['Daily refresh would read stale hourly states.', null, 'Dependencies make refresh order significant.']]], 'hierarchical aggregate', 'An aggregate whose input is another aggregate rather than raw rows.'),
  '03-activity-11': authoredNonSql([['03-activity-11-check-1', 'A late row is visible in raw data but absent from an old aggregate bucket. What is the likely corrective action?', ['Refresh the affected historical range', 'Turn on real-time mode and never refresh', 'Change the row timestamp'], 0, 'Historical invalidations are repaired by refreshing the affected range.', [null, 'Real-time mode focuses on recent raw data and does not guarantee old repair.', 'Changing valid source data hides rather than fixes the lifecycle issue.']]], 'refresh horizon', 'The time range a refresh operation or policy is able to recompute.'),
  '04-activity-03': authoredNonSql([['04-activity-03-check-1', 'Which lifecycle description is accurate?', ['Recent chunks can remain row-oriented, while older chunks convert to columnstore and queries keep one SQL surface', 'Every query must name a storage format', 'Conversion deletes the logical hypertable'], 0, 'Hypercore supports a hot rowstore and colder columnstore lifecycle behind the hypertable.', [null, 'The storage transition remains behind the normal table interface.', 'Conversion changes storage, not the logical table identity.']]], 'hybrid storage', 'Using row-oriented and column-oriented storage for different chunks of one logical table.'),
  '04-activity-08': authoredNonSql([['04-activity-08-check-1', 'A workload commonly filters by tenant and scans time within each tenant. Which starting layout is defensible?', ['segmentby tenant and orderby time', 'segmentby a nearly unique event ID', 'Choose keys without measuring queries'], 0, 'A repeated equality-filtered tenant can form useful segments, while time ordering helps range pruning.', [null, 'Near-unique segment values create tiny groups and metadata overhead.', 'Layout keys should follow measured predicates.']]], 'segmentby', 'A column used to group like values together in Hypercore storage.'),
  '04-activity-09': authoredNonSql([['04-activity-09-check-1', 'Which hot-to-cold policy order protects late writes?', ['Convert only after the accepted late-arrival window, then retain source as required', 'Convert and delete immediately', 'Ignore failed conversion jobs'], 0, 'The conversion age should leave mutable data hot through accepted lateness and be monitored before retention acts.', [null, 'Immediate conversion and deletion can conflict with late writes and repair.', 'Job failures are operational evidence, not noise.']]], 'conversion policy', 'A scheduled rule that moves eligible chunks into columnstore.'),
  '04-activity-10': authoredNonSql([['04-activity-10-check-1', 'Why can the same SELECT span rowstore and columnstore chunks?', ['The hypertable presents one logical SQL relation while the engine chooses storage-specific paths', 'SQL ignores old chunks', 'Both formats are physically identical'], 0, 'Storage layout changes beneath a stable hypertable interface.', [null, 'Time predicates may include both old and new chunks.', 'Rowstore and columnstore have different physical layouts.']]], 'logical relation', 'The table interface queried by SQL independently of its physical storage pieces.'),
  '04-activity-11': authoredNonSql([['04-activity-11-check-1', 'Which key is usually a poor segmentby choice?', ['A repeated tenant used in equality filters', 'A nearly unique event identifier', 'A site shared by many rows'], 1, 'A nearly unique key tends to create one-row groups and excessive metadata.', ['This can be a useful candidate when measured.', null, 'A repeated filtered site may form useful groups.']]], 'segment group', 'Rows sharing segmentby values; one group can span multiple compressed batches.'),
  '05-activity-03': authoredNonSql([['05-activity-03-check-1', 'What does a TimescaleDB retention policy remove?', ['Whole chunks older than its boundary', 'Random old rows inside every chunk', 'Only indexes'], 0, 'Retention uses chunk age and drops eligible chunks as units.', [null, 'Chunk retention is not a row-by-row random delete.', 'Dropping a chunk removes its table data and associated storage.']]], 'retention boundary', 'The age threshold beyond which complete chunks become eligible for removal.'),
  '05-activity-07': authoredNonSql([['05-activity-07-check-1', 'A retention job stopped succeeding. What is the safest first response?', ['Inspect job status and the latest error before changing policy', 'Delete chunks manually immediately', 'Create duplicate policies'], 0, 'Read-only job history and error evidence should lead diagnosis.', [null, 'Manual deletion can worsen the incident before its cause is known.', 'Duplicate policies add contention and do not explain the failure.']]], 'job history', 'Recorded scheduler runs, statuses, and errors used to diagnose automation.'),
  '05-activity-08': authoredNonSql([['05-activity-08-check-1', 'Which policy order preserves aggregates and storage goals?', ['Refresh needed raw ranges, convert eligible chunks, then retain data no longer needed for repair', 'Retain raw data before refresh', 'Run all policies without age separation'], 0, 'Refresh must consume repairable raw data before retention; conversion and retention ages should respect dependencies.', [null, 'Once raw chunks are gone, refresh cannot reconstruct them without another source.', 'Separate horizons prevent lifecycle races.']]], 'policy horizon', 'The age range in which a scheduled policy is allowed to act.'),
  '05-activity-09': authoredNonSql([['05-activity-09-check-1', 'Raw history was accidentally retained away. What fact determines whether exact recovery is possible?', ['Whether another durable source or backup contains the deleted rows', 'Whether the dashboard can hide the gap', 'Whether a new retention policy is added'], 0, 'Deleted source data can be restored exactly only from another authoritative copy.', [null, 'Hiding a gap does not recover facts.', 'A future policy cannot recreate past rows.']]], 'recovery source', 'An authoritative backup, archive, or replay stream from which lost rows can be rebuilt.'),
  '05-activity-10': authoredNonSql([['05-activity-10-check-1', 'Who owns transaction behavior and retry safety inside a custom background job?', ['The custom procedure author', 'The scheduler automatically proves all operations safe', 'The client that reads results'], 0, 'Scheduling invokes the job, but procedure code owns transactions, idempotency, errors, and retry semantics.', [null, 'The scheduler cannot infer application-level correctness.', 'Readers do not control the job’s writes.']]], 'idempotent job', 'A job designed so retrying it does not duplicate or corrupt its intended effect.'),
  '05-activity-11': authoredNonSql([['05-activity-11-check-1', 'Raw data is needed to repair aggregates for 14 days. Which retention rule is valid?', ['Keep raw chunks longer than the full repair and lateness horizon', 'Delete raw chunks after 7 days', 'Retention timing is unrelated to refresh'], 0, 'Raw retention must extend beyond every refresh and accepted-lateness dependency.', [null, 'Seven days would remove source data while repair is still required.', 'Refresh correctness depends directly on source availability.']]], 'repair window', 'The period during which source data must remain available for recomputation.'),
  '06-activity-03': authoredNonSql([['06-activity-03-check-1', 'What is the two-step aggregation flow?', ['Build an aggregate state, optionally roll up states, then apply an accessor', 'Apply an accessor before any state exists', 'Store only one final scalar for every future question'], 0, 'A mergeable state preserves information that rollups and accessors can use later.', [null, 'An accessor reads an existing state.', 'A scalar usually loses information needed for other accessors.']]], 'aggregate state', 'A mergeable summary that stores enough information for later rollups and accessors.'),
  '06-activity-08': authoredNonSql([['06-activity-08-check-1', 'How should daily counter summaries be built from hourly counter states?', ['Roll up the hourly states, then call accessors such as delta', 'Add final hourly deltas without considering resets', 'Discard reset information first'], 0, 'Rolling up counter states preserves reset-aware structure across bucket boundaries.', [null, 'Adding finalized deltas can mishandle cross-hour resets.', 'Reset information is necessary for correct counter change.']]], 'counter reset', 'A drop in a cumulative counter that represents restart or rollover rather than negative usage.'),
  '06-activity-09': authoredNonSql([['06-activity-09-check-1', 'Which dashboard design reports both energy use and data quality?', ['Counter-state delta plus gap or heartbeat evidence', 'Average the cumulative meter values', 'Show only the latest meter reading'], 0, 'Usage needs reset-aware counter change, while quality needs explicit coverage or gap evidence.', [null, 'Averages of cumulative readings do not measure consumption.', 'One reading cannot describe interval usage or missing data.']]], 'data coverage', 'Evidence describing how completely observations represent the requested time window.'),
  '06-activity-10': authoredNonSql([['06-activity-10-check-1', 'Which correction to “stats_agg scans the data only once” is accurate?', ['One state can support many accessors after the rows used to build that state have been scanned', 'No rows are ever scanned', 'Every accessor necessarily rescans the raw table'], 0, 'The saving is reuse of one aggregate state, not a claim that computation reads no input.', [null, 'Building the state requires reading input rows.', 'Accessors can reuse the already-built state.']]], 'accessor', 'A function that extracts a requested result from an aggregate state.'),
  '06-activity-11': authoredNonSql([['06-activity-11-check-1', 'Why store a rollup-capable state instead of only an average?', ['It can preserve components needed to combine buckets and calculate multiple results', 'It guarantees every possible analysis', 'It removes the need to define semantics'], 0, 'Mergeable states retain more composable information than a finalized average.', [null, 'Each state supports a defined set of operations, not every analysis.', 'Semantic choices remain necessary.']]], 'rollup', 'Combining compatible aggregate states into a state for a larger interval.'),
  '07-activity-03': authoredNonSql([['07-activity-03-check-1', 'In EXPLAIN ANALYZE, which values are planner predictions and which are observations?', ['cost and rows estimates are predictions; actual time, rows, and loops are observations', 'All values are exact measurements', 'Actual rows are planner predictions'], 0, 'EXPLAIN labels estimated costs/rows separately from execution measurements.', [null, 'Plain estimates remain predictions even when shown beside measurements.', 'The actual prefix identifies execution observations.']]], 'cardinality estimate', 'The planner’s prediction of how many rows an operation will produce.'),
  '07-activity-07': authoredNonSql([['07-activity-07-check-1', 'A selective query is slow. Which first comparison is most diagnostic?', ['Estimated versus actual rows at the earliest divergent node', 'Add an index without reading the plan', 'Look only at total runtime'], 0, 'The first major estimate error often explains later join or scan choices.', [null, 'An index proposal should follow evidence about the cause.', 'Total time shows a symptom but not where it began.']]], 'estimate error', 'A meaningful difference between planner-predicted rows and rows actually produced.'),
  '07-activity-09': authoredNonSql([['07-activity-09-check-1', 'A query regressed after data volume grew. What comparison supports a causal review?', ['Before/after plans with row estimates, actuals, buffers, and data scale', 'One screenshot of elapsed time', 'A claim that indexes always solve growth'], 0, 'Comparable plans and workload facts reveal which operator or estimate changed.', [null, 'One timing sample is noisy and lacks a causal location.', 'Growth can expose many causes besides a missing index.']]], 'regression', 'A measurable loss of performance or correctness compared with a defined baseline.'),
  '07-activity-10': authoredNonSql([['07-activity-10-check-1', 'When can chunk skipping help?', ['When enabled metadata on a correlated column can rule out whole chunks or batches', 'For every predicate regardless of data distribution', 'Only when no time condition exists'], 0, 'Skipping depends on recorded ranges and useful correlation; it is not a universal secondary index.', [null, 'Uncorrelated values may appear everywhere and prune nothing.', 'It can complement time constraints rather than require their absence.']]], 'chunk skipping', 'Using per-chunk or per-batch metadata to avoid reading units that cannot match a predicate.'),
  '07-activity-11': authoredNonSql([['07-activity-11-check-1', 'What should happen before a physical tuning change?', ['Form a plan-based hypothesis and define success and rollback measures', 'Change several settings at once', 'Trust estimated cost as elapsed milliseconds'], 0, 'A controlled change needs a falsifiable cause, comparable evidence, and rollback.', [null, 'Multiple simultaneous changes hide causality.', 'Planner cost is unitless, not wall-clock time.']]], 'tuning hypothesis', 'A testable explanation connecting a plan symptom to one proposed change.'),
  '08-activity-03': authoredNonSql([['08-activity-03-check-1', 'Which dependency order is safe?', ['Refresh aggregate ranges before raw retention removes their source', 'Retain raw rows first and refresh later', 'Policy order never affects correctness'], 0, 'Downstream summaries must be current before their only repair source is removed.', [null, 'Refresh cannot read deleted raw chunks.', 'Lifecycle policies have explicit data dependencies.']]], 'dependency graph', 'A representation of which data product or policy requires another to happen first.'),
  '08-activity-07': authoredNonSql([['08-activity-07-check-1', 'Retention ran beyond the aggregate refresh horizon. What is the key incident question?', ['Does a backup or durable source still contain the unrefreshed raw range?', 'Can the missing bucket be renamed?', 'Can real-time mode recreate deleted history by itself?'], 0, 'Recovery depends on whether authoritative source data still exists.', [null, 'Renaming does not restore values.', 'Real-time queries cannot read rows that no longer exist.']]], 'refresh gap', 'A source interval deleted before its dependent aggregate was brought current.'),
  '08-activity-08': authoredNonSql([['08-activity-08-check-1', 'Which production design record is decision-ready?', ['It states workload, chosen mechanisms, measured evidence, failure handling, and rollback', 'It lists features without constraints', 'It promises zero failures'], 0, 'A useful record connects evidence to decisions and defines operation under failure.', [null, 'A feature list does not justify the design.', 'Reliable systems plan for failures rather than deny them.']]], 'design record', 'A durable explanation of a decision, its evidence, alternatives, and operational consequences.'),
  '08-activity-09': authoredNonSql([['08-activity-09-check-1', 'Late arrivals increase from two hours to two days. What must be reviewed first?', ['Refresh windows and raw-retention horizons', 'SQL capitalization', 'The dashboard color palette'], 0, 'A larger lateness contract changes how long source data remains repairable and how far policies revisit.', [null, 'Formatting does not affect lifecycle coverage.', 'Presentation does not repair late data.']]], 'lateness contract', 'The maximum delay the system promises to incorporate into correct results.'),
  '08-activity-10': authoredNonSql([['08-activity-10-check-1', 'Which statement is a correctness invariant?', ['Raw data remains available until every dependent refresh can no longer need it', 'Every query is always fast', 'All chunks have the same row count'], 0, 'An invariant is a condition the design must preserve; retention-after-refresh is testable and necessary.', [null, 'Performance needs thresholds, not an absolute promise.', 'Edge chunks and varying ingest make equal counts unnecessary.']]], 'invariant', 'A condition that must remain true for the system to be correct.'),
  '08-activity-11': authoredNonSql([['08-activity-11-check-1', 'Which final approval evidence is strongest?', ['Representative plans, policy horizons, failure recovery, and monitored thresholds', 'A diagram with no measurements', 'A successful happy-path demo only'], 0, 'Production approval needs measured normal behavior plus lifecycle and failure evidence.', [null, 'A diagram explains structure but does not validate operation.', 'A happy path does not test repair or policy races.']]], 'acceptance threshold', 'A measurable limit that determines whether a design or experiment succeeds.'),
};

function activity(lesson, index, type, claim, title, purpose, instructions, evidence, sourceIndexes, extras = {}) {
  const id = `${lesson}-activity-${String(index + 1).padStart(2, '0')}`;
  return {
    id,
    type,
    claim,
    title,
    purpose,
    instructions,
    evidence,
    sourceIds: sourceIndexes.map((number) => `${lesson}-source-${number + 1}`),
    ...extras,
    ...(nonSqlAuthoring[id] ?? {}),
  };
}

function buildModule(lesson, spec) {
  const sources = spec.sources.map((key, index) => {
    const [title, url, note] = official[key];
    return { id: `${lesson}-source-${index + 1}`, title, url, note };
  });
  let activityIndex = 0;
  const phases = phaseKinds.map(([kind, fallbackTitle], phaseIndex) => ({
    id: `${lesson}-phase-${phaseIndex + 1}`,
    title: spec.phaseTitles?.[phaseIndex] ?? fallbackTitle,
    minutes: phaseMinutes[phaseIndex],
    overview: spec.overviews[phaseIndex],
    activities: spec.activities[phaseIndex].map((entry) =>
      activity(lesson, activityIndex++, entry[0], entry[1], entry[2], entry[3], entry[4], entry[5], entry[6], entry[7])),
  }));
  return {
    estimatedMinutes: phaseMinutes.reduce((sum, minutes) => sum + minutes, 0),
    title: spec.title,
    summary: spec.summary,
    outcomes: spec.outcomes,
    phases,
    sources,
  };
}

const specs = {
  '00': {
    title: 'Setup and orientation: prove the system you are using',
    summary: 'Establish a catalog-backed model of PostgreSQL, TimescaleDB, Toolkit, schemas, and the seeded fleet before changing anything.',
    outcomes: ['Separate server and extension versions', 'Classify ordinary tables and hypertables from catalogs', 'Audit extension-visible objects without private catalogs', 'Produce a reproducible environment report'],
    sources: ['overview', 'hypertables', 'explain'],
    phaseTitles: ['Connection forensics', 'Extension architecture', 'Catalog triangulation', 'Read-only invariants', 'Diagnose the wrong database', 'Fleet inventory', 'Incident handoff', 'Oral defense'],
    overviews: [
      'Record what server, database, role, and extensions the current connection actually exposes.',
      'Trace which responsibilities remain PostgreSQL responsibilities and which are supplied by extensions.',
      'Reconcile pg_catalog with timescaledb_information rather than trusting object names.',
      'Test stable catalog questions twice and identify session-dependent values.',
      'Debug an apparently missing hypertable without changing schemas or search paths.',
      'Build a compact, evidence-backed inventory of the seeded fleet.',
      'Prepare the facts an on-call engineer needs when a client reports that TimescaleDB is absent.',
      'Recall the architecture without notes, then correct omissions against catalog evidence.',
    ],
    activities: [
      [
        ['diagnostic', 'measured', 'Fingerprint the connection', 'Prevent work against the wrong service.', ['Run the query unchanged in the course connection.', 'Save the returned database, user, server version, and extension versions.'], ['A single result set identifying both PostgreSQL and installed extensions.'], [0], { sql: "SELECT current_database(), current_user, current_setting('server_version'), extname, extversion FROM pg_extension WHERE extname LIKE 'timescaledb%' ORDER BY extname;" }],
        ['diagnostic', 'measured', 'Count seeded facts', 'Confirm the course state before drawing conclusions.', ['Count sensors and readings independently.', 'Record the minimum and maximum reading timestamps.'], ['Counts plus a bounded data window.'], [0], { sql: 'SELECT (SELECT count(*) FROM sensors) AS sensors, count(*) AS readings, min(time), max(time) FROM readings;' }],
      ],
      [['theory', 'documented', 'Separate PostgreSQL and TimescaleDB responsibilities', 'Explain why ordinary PostgreSQL clients work.', ['List connection, transaction, type, and catalog responsibilities.', 'Mark hypertables and policy scheduling as extension features.'], ['A two-column responsibility map with no compatibility-layer claim.'], [0]]],
      [['guided-analysis', 'measured', 'Classify both relations', 'Prove object kind from two catalog families.', ['Join pg_class and pg_namespace for public sensors and readings.', 'Left join the hypertables information view and label each result.'], ['readings is cataloged as a hypertable while sensors is not.'], [1], { sql: "SELECT c.relname, h.hypertable_name IS NOT NULL AS is_hypertable FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN timescaledb_information.hypertables h ON h.hypertable_schema=n.nspname AND h.hypertable_name=c.relname WHERE n.nspname='public' AND c.relname IN ('sensors','readings') ORDER BY 1;" }]],
      [
        ['controlled-experiment', 'measured', 'Check catalog repeatability', 'Distinguish persistent metadata from session context.', ['Run the extension inventory twice.', 'Compare it with current_timestamp and explain which output can change.'], ['A written comparison based on two executions.'], [0], { sql: "SELECT current_timestamp, current_database(), extname, extversion FROM pg_extension WHERE extname LIKE 'timescaledb%' ORDER BY extname;" }],
        ['controlled-experiment', 'measured', 'Inspect chunk visibility', 'Connect one logical table to its physical partitions.', ['Count information-view chunk rows for readings.', 'Group them by primary space and record the covered time span.'], ['Chunk count and earliest/latest bounds.'], [1], { sql: "SELECT primary_dimension, count(*) AS chunks, min(range_start), max(range_end) FROM timescaledb_information.chunks WHERE hypertable_name='readings' GROUP BY primary_dimension;" }],
      ],
      [['failure-lab', 'recommendation', 'Triage an empty hypertable view', 'Avoid reinstalling an extension when context is wrong.', ['Assume pg_extension lists TimescaleDB but the expected object is absent.', 'Order checks for database, schema, relation spelling, permissions, and seed completion.'], ['A diagnostic decision tree whose first action is read-only.'], [0, 1]]],
      [['independent', 'measured', 'Inventory fleet dimensions', 'Establish cardinalities used later in the course.', ['Count distinct sensor, site, and model values through a join.', 'Compare distinct sensor IDs in readings with rows in sensors.'], ['A cardinality table and any missing-key discrepancy.'], [0], { sql: 'SELECT count(DISTINCT r.sensor_id) AS observed_sensors, count(DISTINCT s.site) AS sites, count(DISTINCT s.model) AS models, count(*) AS readings FROM readings r JOIN sensors s USING (sensor_id);' }]],
      [
        ['scenario', 'recommendation', 'Choose an incident handoff', 'Communicate connection facts without speculation.', ['Summarize server and extension versions separately.', 'Cite the exact catalog query another engineer can rerun.'], ['A five-line handoff separating observations and recommendations.'], [0]],
        ['scenario', 'documented', 'Reject the compatibility-layer myth', 'Defend the extension architecture precisely.', ['Explain what remains standard PostgreSQL.', 'Name two SQL-visible TimescaleDB information views.'], ['A technically accurate rebuttal grounded in official documentation.'], [0, 1]],
      ],
      [['assessment', 'documented', 'Closed-book setup defense', 'Verify durable understanding.', ['Without notes, answer where extension versions live and how a hypertable is identified.', 'Reopen the evidence and annotate every incorrect or unsupported answer.'], ['Initial answers plus a corrected answer key.'], [0, 1]]],
    ],
  },
  '01': {
    title: 'Hypertables and chunks: routing, ranges, and pruning',
    summary: 'Investigate the logical-table/physical-chunk model, boundary semantics, pruning, and workload-dependent chunk sizing.',
    outcomes: ['Read chunk ranges as half-open intervals', 'Demonstrate time-based chunk exclusion', 'Explain why interval sizing is workload-dependent', 'Diagnose predicates that inhibit pruning'],
    sources: ['hypertables', 'explain', 'query'],
    phaseTitles: ['Chunk census', 'Routing and constraints', 'Read a pruned plan', 'Predicate A/B test', 'Hidden-time failure', 'Sizing worksheet', 'Telemetry latency review', 'Chunk model exam'],
    overviews: [
      'Measure current chunk count, widths, and partial edge chunks.',
      'Model insertion routing and non-overlapping half-open ranges.',
      'Connect a bounded predicate to the physical scans in an actual plan.',
      'Hold result semantics constant while changing predicate form.',
      'Find why an apparently bounded query still touches excess chunks.',
      'Derive an interval from the actual ingest rate, index footprint, memory, and query windows.',
      'Choose a defensible interval for a production fleet with late data and dashboard reads.',
      'Solve boundary, routing, and sizing questions without notes.',
    ],
    activities: [
      [
        ['diagnostic', 'measured', 'Measure chunk geometry', 'Ground the lesson in current physical ranges.', ['List every readings range in order.', 'Calculate each width in hours and flag edge widths.'], ['Ordered ranges and calculated widths.'], [0], { sql: "SELECT chunk_name, range_start, range_end, extract(epoch FROM range_end-range_start)/3600 AS hours FROM timescaledb_information.chunks WHERE hypertable_name='readings' ORDER BY range_start;" }],
        ['diagnostic', 'measured', 'Locate the newest row', 'Relate a timestamp to one chunk range.', ['Select the maximum reading time.', 'Find the one half-open chunk range containing it.'], ['Exactly one matching chunk for the maximum timestamp.'], [0], { sql: "WITH x AS (SELECT max(time) AS t FROM readings) SELECT x.t,c.chunk_name,c.range_start,c.range_end FROM x JOIN timescaledb_information.chunks c ON c.hypertable_name='readings' AND x.t>=c.range_start AND x.t<c.range_end;" }],
      ],
      [['theory', 'documented', 'Place a row on a chunk boundary', 'Explain how adjacent chunks avoid overlap.', ['Choose which timestamps a half-open chunk includes.', 'Choose the one chunk that owns a row on a shared boundary.'], ['Two correct boundary decisions with explanatory feedback.'], [0]]],
      [['guided-analysis', 'measured', 'Read the two-hour plan', 'Identify excluded history from the executed plan.', ['Run EXPLAIN ANALYZE with buffers on a direct time bound.', 'Count named chunk scans and compare with the chunk census.'], ['Plan annotations showing limited chunk access.'], [1], { sql: "EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT avg(temperature) FROM readings WHERE time>=now()-INTERVAL '2 hours';" }]],
      [
        ['controlled-experiment', 'measured', 'Compare narrow and wide windows', 'Measure the effect of selectivity on chunk access.', ['Explain the same aggregate for two hours.', 'Repeat for twenty days and compare scans, buffers, and execution time.'], ['A two-row measurement table, not a universal speed claim.'], [1], { sql: "EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT avg(temperature) FROM readings WHERE time>=now()-INTERVAL '20 days';" }],
        ['controlled-experiment', 'measured', 'Check boundary population', 'Validate interval membership with data.', ['Choose one internal range_start from the chunk view.', 'Count rows exactly at that timestamp and within the following minute.'], ['Counts tied to a named chunk boundary.'], [0], { sql: "WITH b AS (SELECT range_start AS t FROM timescaledb_information.chunks WHERE hypertable_name='readings' ORDER BY range_start OFFSET 1 LIMIT 1) SELECT count(*) FILTER (WHERE r.time=b.t) AS at_boundary, count(*) AS first_minute FROM b JOIN readings r ON r.time>=b.t AND r.time<b.t+INTERVAL '1 minute' GROUP BY b.t;" }],
      ],
      [['failure-lab', 'measured', 'Expose a wrapped time predicate', 'Debug loss of effective pruning.', ['Compare the direct time bound with a date expression over time.', 'Use plans to report chunk scans rather than guessing from elapsed time.'], ['Side-by-side plans and the observed scan difference.'], [1], { sql: "EXPLAIN (ANALYZE, COSTS OFF) SELECT count(*) FROM readings WHERE date(time)=CURRENT_DATE;" }]],
      [['independent', 'recommendation', 'Build a sizing worksheet', 'Reject one-size-fits-all chunk intervals.', ['Estimate bytes and rows per current chunk from detailed sizes and counts.', 'Recommend an interval only after stating ingest rate, active-index memory, query windows, retention, and operational overhead assumptions.'], ['A workload-dependent recommendation with assumptions and rollback trigger.'], [0], { sql: "SELECT count(*) AS chunks, pg_size_pretty(avg(total_bytes)::bigint) AS avg_bytes, pg_size_pretty(max(total_bytes)) AS max_bytes FROM chunks_detailed_size('readings');" }]],
      [
        ['scenario', 'recommendation', 'Size a bursty telemetry fleet', 'Balance pruning against chunk-management overhead.', ['Assume weekday ingest is four times weekend ingest and most reads cover six hours.', 'Propose a starting interval and measurements that would justify changing it.'], ['A decision that explicitly avoids presenting a fixed percentage or duration as universal.'], [0]],
        ['scenario', 'documented', 'Predict interval-change behavior', 'Set correct migration expectations.', ['State whether changing the interval rewrites existing chunks.', 'Describe how future chunk creation reflects the new setting.'], ['A concise operational explanation.'], [0]],
      ],
      [['assessment', 'documented', 'Closed-book chunk defense', 'Test routing and pruning knowledge.', ['Sketch three adjacent half-open ranges and place boundary rows.', 'Review against official docs and correct the sizing answer if it lacks workload evidence.'], ['A corrected sketch and four-factor sizing rubric.'], [0, 1]]],
    ],
  },
  '02': {
    title: 'Write and query: temporal semantics under load',
    summary: 'Practice bulk ingest, bucket alignment, ordered aggregates, latest-row access, metadata joins, and safe key design.',
    outcomes: ['Differentiate min from first and last', 'Explain time_bucket alignment', 'Choose latest-row query forms deliberately', 'Respect partition columns in uniqueness design'],
    sources: ['query', 'hypertables', 'indexes'],
    overviews: ['Profile cadence and nulls.', 'Model bucket and ordering semantics.', 'Analyze fleet rollups.', 'Compare temporal query forms.', 'Debug misleading aggregates.', 'Solve metadata questions.', 'Review an ingest design.', 'Defend query choices.'],
    activities: [
      [
        ['diagnostic', 'measured', 'Measure ingest cadence', 'Verify assumptions before selecting buckets.', ['Compute count and average inter-reading spacing for sensor 1.', 'Record null humidity frequency separately.'], ['Observed cadence and null rate.'], [0], { sql: "WITH x AS (SELECT time,lag(time) OVER (ORDER BY time) p,humidity FROM readings WHERE sensor_id=1) SELECT count(*),avg(time-p),count(*) FILTER (WHERE humidity IS NULL) FROM x;" }],
        ['diagnostic', 'measured', 'Inspect metadata cardinality', 'Understand join dimensions.', ['Group sensors by site and model.', 'Check that every reading sensor key resolves.'], ['Dimension counts and orphan count.'], [0], { sql: 'SELECT site,model,count(*) FROM sensors GROUP BY site,model ORDER BY site,model;' }],
      ],
      [['theory', 'documented', 'Separate value orderings', 'Prevent min/first confusion.', ['Define min(temperature), first(temperature,time), and earliest physical timestamp.', 'Give a case where all three imply different questions.'], ['Three precise definitions.'], [0]]],
      [['guided-analysis', 'measured', 'Build hourly edge summaries', 'Apply ordered aggregates correctly.', ['Bucket sensor 1 over six hours.', 'Return sample count, opening, closing, minimum, and maximum temperature.'], ['Ordered hourly results exposing semantic differences.'], [0], { sql: "SELECT time_bucket('1 hour',time) bucket,count(*),first(temperature,time),last(temperature,time),min(temperature),max(temperature) FROM readings WHERE sensor_id=1 AND time>=now()-INTERVAL '6 hours' GROUP BY 1 ORDER BY 1;" }]],
      [
        ['controlled-experiment', 'measured', 'Shift bucket origin', 'Observe alignment rather than assume clock boundaries.', ['Run default fifteen-minute buckets.', 'Repeat with a five-minute origin and compare labels and membership.'], ['Two result excerpts showing shifted boundaries.'], [0], { sql: "SELECT time_bucket('15 minutes',time,TIMESTAMPTZ '2000-01-01 00:05+00') bucket,count(*) FROM readings WHERE sensor_id=1 AND time>=now()-INTERVAL '1 hour' GROUP BY 1 ORDER BY 1;" }],
        ['controlled-experiment', 'measured', 'Compare latest-row plans', 'Evaluate access paths for one sensor and all sensors.', ['Explain ORDER BY time DESC LIMIT 1 for sensor 4.', 'Explain DISTINCT ON for every sensor and compare work performed.'], ['Annotated plans tied to different result shapes.'], [2], { sql: "EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT time,temperature FROM readings WHERE sensor_id=4 ORDER BY time DESC LIMIT 1;" }],
      ],
      [['failure-lab', 'measured', 'Catch min masquerading as first', 'Demonstrate a plausible but wrong temporal answer.', ['For each recent hour compute min and first.', 'Find buckets where values differ and explain the business error.'], ['At least one differing bucket or a documented no-difference observation.'], [0], { sql: "SELECT time_bucket('1 hour',time) bucket,min(temperature),first(temperature,time) FROM readings WHERE sensor_id=2 AND time>=now()-INTERVAL '1 day' GROUP BY 1 HAVING min(temperature)<>first(temperature,time) ORDER BY 1;" }]],
      [['independent', 'measured', 'Answer a site-level question', 'Combine relational dimensions with temporal facts.', ['Return the latest timestamp and six-hour average by site.', 'Verify counts are plausible from sensors per site and cadence.'], ['One row per site with a reasoned count check.'], [0], { sql: "SELECT s.site,max(r.time),avg(r.temperature),count(*) FROM readings r JOIN sensors s USING(sensor_id) WHERE r.time>=now()-INTERVAL '6 hours' GROUP BY s.site ORDER BY s.site;" }]],
      [
        ['scenario', 'recommendation', 'Review an idempotent ingest key', 'Avoid unenforceable global uniqueness.', ['Evaluate a proposed unique key on external_event_id alone.', 'Recommend a key that includes the hypertable partition dimension or describe an external deduplication strategy.'], ['A design review distinguishing documented constraint rules from recommendation.'], [1]],
        ['scenario', 'recommendation', 'Choose a latest-status API query', 'Match query shape to endpoint scope.', ['Separate single-sensor and fleet-wide endpoints.', 'Recommend query and index shapes for each, pending EXPLAIN validation.'], ['Two endpoint-specific designs.'], [2]],
      ],
      [['assessment', 'documented', 'Closed-book temporal SQL', 'Verify semantics survive without hints.', ['Write an hourly opening/closing query from memory.', 'Compare it with the reference concepts and explain every correction.'], ['Runnable corrected SELECT and semantic explanation.'], [0]]],
    ],
  },
  '03': {
    title: 'Continuous aggregates: materialization, invalidation, and freshness',
    summary: 'Analyze materialized windows, refresh policy geometry, real-time behavior, watermarks, and safe hierarchical rollups.',
    outcomes: ['Explain invalidation and refresh windows', 'Inspect a continuous aggregate watermark safely', 'State that real-time aggregation is disabled by default in current releases', 'Design compatible hierarchical aggregates'],
    sources: ['caggs', 'realtime', 'jobs'],
    overviews: ['Inventory aggregate state.', 'Trace materialization mechanics.', 'Read definitions and jobs.', 'Measure raw versus rollup.', 'Debug stale recent data.', 'Analyze the watermark.', 'Set an operations policy.', 'Defend freshness semantics.'],
    activities: [
      [
        ['diagnostic', 'measured', 'Inventory continuous aggregates', 'Avoid assumptions about prior course state.', ['List views, materialized_only, and materialization hypertables.', 'Join jobs separately by hypertable identity.'], ['A current-state inventory that may legitimately be empty.'], [0, 2], { sql: 'SELECT view_schema,view_name,materialized_only,materialization_hypertable_name FROM timescaledb_information.continuous_aggregates ORDER BY 1,2;' }],
        ['diagnostic', 'measured', 'Locate raw freshness', 'Establish the newest source timestamp.', ['Read max(time) from readings.', 'Record current_timestamp and calculate lag.'], ['A measured source freshness lag.'], [0], { sql: 'SELECT current_timestamp,max(time),current_timestamp-max(time) AS ingest_lag FROM readings;' }],
      ],
      [['theory', 'documented', 'Trace invalidation to materialization', 'Understand incremental work.', ['Describe how changes mark affected ranges.', 'Distinguish a refresh window from the query window.'], ['A sequence diagram with raw, invalidation, and materialization stages.'], [0]]],
      [['guided-analysis', 'measured', 'Read aggregate definitions', 'Recover bucket width and grouping keys from SQL.', ['Query the information view definition field.', 'Annotate bucket expression, source relation, and aggregates.'], ['Annotated definitions or an explicit empty-state result.'], [0], { sql: 'SELECT view_name,view_definition FROM timescaledb_information.continuous_aggregates ORDER BY view_name;' }]],
      [
        ['controlled-experiment', 'measured', 'Compare equivalent rollups', 'Measure benefit locally without universal claims.', ['Run EXPLAIN ANALYZE on a raw hourly aggregation.', 'If readings_hourly exists, explain its equivalent SELECT and compare rows, buffers, and time.'], ['Environment-specific measurements with query equivalence checked.'], [0], { sql: "EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT time_bucket('1 hour',time),sensor_id,avg(temperature) FROM readings WHERE time>=now()-INTERVAL '7 days' GROUP BY 1,2;" }],
        ['controlled-experiment', 'documented', 'Toggle reasoning exercise', 'Understand materialized_only without unsafe DDL.', ['Predict results when recent raw data lies beyond the materialized region.', 'Contrast materialized_only true with real-time combination.'], ['A truth table for materialized and unmaterialized ranges.'], [1]],
      ],
      [['failure-lab', 'documented', 'Debug a missing newest bucket', 'Correct the common assumption about defaults.', ['Begin with the fact that real-time aggregation is disabled by default in current TimescaleDB releases.', 'Check materialized_only, refresh end_offset, schedule, job status, and source max time in that order.'], ['A diagnosis that does not claim real-time is enabled by default.'], [0, 1, 2]]],
      [['independent', 'measured', 'Reason from the watermark', 'Use the materialization frontier without treating it as wall-clock freshness.', ['For each existing aggregate, compare its reported state and newest visible bucket.', 'Explain why a watermark in the future can happen after an overly broad manual refresh and suppress real-time raw inclusion.'], ['A per-view freshness explanation distinguishing measurement and documented behavior.'], [0, 1], { sql: 'SELECT view_name,materialized_only FROM timescaledb_information.continuous_aggregates ORDER BY view_name;' }]],
      [
        ['scenario', 'recommendation', 'Policy for two-hour late arrivals', 'Align policy windows with data behavior.', ['Choose start_offset, end_offset, and schedule for a one-hour bucket with arrivals up to two hours late.', 'State the freshness/cost tradeoff and how you will monitor failures.'], ['A policy proposal with explicit assumptions.'], [0, 2]],
        ['scenario', 'documented', 'Choose a daily-on-hourly hierarchy', 'Preserve composability.', ['Use compatible fixed-width buckets.', 'Explain why the lower aggregate must expose mergeable states when rolling up counter analytics.'], ['A hierarchy diagram and compatibility checklist.'], [0]],
      ],
      [['assessment', 'documented', 'Closed-book freshness incident', 'Test the complete mental model.', ['Diagnose a dashboard missing the current hour without notes.', 'Review the answer for default real-time behavior, watermark meaning, policy offsets, and job health.'], ['A corrected ordered runbook.'], [0, 1, 2]]],
    ],
  },
  '04': {
    title: 'Hypercore columnstore: layout decisions backed by measurements',
    summary: 'Examine rowstore and columnstore roles, segment/order keys, conversion state, and workload-specific performance.',
    outcomes: ['Explain hybrid storage lifecycle', 'Choose segmentby and orderby from query patterns', 'Measure storage and query effects honestly', 'Diagnose partially converted data'],
    sources: ['columnstore', 'indexes', 'explain'],
    overviews: ['Establish storage state.', 'Model columnar layout.', 'Inspect conversion metadata.', 'Measure a cold analytic query.', 'Debug a mixed-state result.', 'Choose layout keys.', 'Plan lifecycle operations.', 'Defend tradeoffs.'],
    activities: [
      [
        ['diagnostic', 'measured', 'Count row and columnar chunks', 'Capture the state before analysis.', ['Query chunks for is_compressed.', 'Separate current and historical ranges.'], ['Counts and time ranges by storage state.'], [0], { sql: "SELECT is_compressed,count(*),min(range_start),max(range_end) FROM timescaledb_information.chunks WHERE hypertable_name='readings' GROUP BY is_compressed;" }],
        ['diagnostic', 'measured', 'Capture detailed bytes', 'Create a local storage baseline.', ['Run chunks_detailed_size for readings.', 'Aggregate table, index, and total bytes.'], ['Byte totals labeled as measurements.'], [0], { sql: "SELECT pg_size_pretty(sum(table_bytes)::bigint),pg_size_pretty(sum(index_bytes)::bigint),pg_size_pretty(sum(total_bytes)::bigint) FROM chunks_detailed_size('readings');" }],
      ],
      [['theory', 'documented', 'Map hybrid data flow', 'Explain why recent and old chunks differ.', ['Trace writes into rowstore chunks.', 'Trace policy-driven conversion and analytical scans over columnar chunks.'], ['A lifecycle diagram separating documented behavior from local performance.'], [0]]],
      [['guided-analysis', 'measured', 'Recover layout settings', 'Verify segment and order configuration.', ['Inspect the hypertable columnstore settings view.', 'Relate segmentby to sensor filtering and orderby to time-range access.'], ['Observed settings plus query-pattern interpretation.'], [0], { sql: "SELECT hypertable,segmentby,orderby,index FROM timescaledb_information.hypertable_columnstore_settings WHERE hypertable='readings'::regclass;" }]],
      [
        ['controlled-experiment', 'measured', 'Profile a cold aggregate', 'Measure this dataset rather than promise a speedup.', ['Explain analyze a sensor-grouped query older than seven days.', 'Record buffers, execution time, selected columns, and current storage mix.'], ['A reproducible plan and environment notes.'], [2], { sql: "EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT sensor_id,avg(temperature),max(temperature),count(*) FROM readings WHERE time<now()-INTERVAL '7 days' GROUP BY sensor_id ORDER BY sensor_id;" }],
        ['controlled-experiment', 'measured', 'Contrast narrow lookup and scan', 'Expose workload-dependent tradeoffs.', ['Explain a latest-row lookup for one sensor.', 'Compare it with the historical aggregate without generalizing from one run.'], ['Two plans and a bounded conclusion.'], [1, 2], { sql: "EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT time,temperature FROM readings WHERE sensor_id=3 ORDER BY time DESC LIMIT 1;" }],
      ],
      [['failure-lab', 'measured', 'Diagnose partial conversion', 'Explain inconsistent performance across time windows.', ['Group chunk states by date range.', 'Check columnstore policy job status and identify lagging eligible chunks.'], ['A state timeline and first failing operational check.'], [0], { sql: "SELECT j.job_id,j.proc_name,s.last_run_status,s.total_failures FROM timescaledb_information.jobs j LEFT JOIN timescaledb_information.job_stats s USING(job_id) WHERE j.hypertable_name='readings' ORDER BY j.job_id;" }]],
      [['independent', 'recommendation', 'Select layout keys from evidence', 'Avoid cargo-cult segmentby choices.', ['List the dominant GROUP BY, equality filters, and time ordering.', 'Recommend segmentby/orderby and describe the competing access pattern it may hurt.'], ['A workload-derived key decision with a validation query.'], [0, 1]]],
      [
        ['scenario', 'recommendation', 'Plan hot-to-cold conversion', 'Keep mutable data writable while aging history efficiently.', ['Assume updates can arrive for forty-eight hours.', 'Choose a conversion age and monitoring signals, explicitly labeling it a recommendation.'], ['An age backed by lateness assumptions, not a universal rule.'], [0]],
        ['scenario', 'documented', 'Identify unchanged SQL behavior', 'Clarify storage transparency and limits.', ['Describe how SELECT targets the same hypertable.', 'Separate SQL compatibility from measured performance and mutation constraints.'], ['An operator-facing explanation with clear claim categories.'], [0]],
      ],
      [['assessment', 'documented', 'Closed-book columnstore review', 'Verify layout reasoning.', ['Choose keys for two contrasting query patterns without notes.', 'Review against official guidance and correct unsupported performance promises.'], ['Corrected choices and measurement plan.'], [0, 1]]],
    ],
  },
  '05': {
    title: 'Jobs, policies, and retention: operate the scheduler',
    summary: 'Audit jobs, interpret run state, reason about retention boundaries, and design observable policy timelines.',
    outcomes: ['Join job definitions to execution statistics', 'Explain chunk-based retention', 'Order policies safely', 'Write a failure-first operational runbook'],
    sources: ['jobs', 'retention', 'caggs'],
    overviews: ['Audit scheduled work.', 'Understand scheduler contracts.', 'Correlate jobs and history.', 'Measure policy eligibility.', 'Debug a stalled policy.', 'Design a safe timeline.', 'Handle a retention incident.', 'Test operational recall.'],
    activities: [
      [
        ['diagnostic', 'measured', 'Enumerate readings jobs', 'Know what automation exists now.', ['Select job identity, procedure, schedule, and configuration.', 'Order by job_id and flag unscheduled entries.'], ['A complete readings job table.'], [0], { sql: "SELECT job_id,proc_schema,proc_name,schedule_interval,scheduled,config FROM timescaledb_information.jobs WHERE hypertable_name='readings' ORDER BY job_id;" }],
        ['diagnostic', 'measured', 'Summarize scheduler health', 'Prioritize failed or never-run work.', ['Left join job_stats to jobs.', 'Classify failed, successful, and no-history states.'], ['A health classification retaining no-history jobs.'], [0], { sql: "SELECT j.job_id,j.proc_name,s.last_run_status,s.last_successful_finish,s.total_runs,s.total_failures FROM timescaledb_information.jobs j LEFT JOIN timescaledb_information.job_stats s USING(job_id) WHERE j.hypertable_name='readings' ORDER BY j.job_id;" }],
      ],
      [['theory', 'documented', 'Compare chunk retention with row deletion', 'Avoid row-delete mental models.', ['Describe eligibility using complete chunk time ranges.', 'Contrast dropping a chunk with DELETE and explain boundary consequences.'], ['A precise physical-operation comparison.'], [1]]],
      [['guided-analysis', 'measured', 'Map configurations to data', 'Translate JSON policy config into real ranges.', ['Read each readings job config.', 'Compare configured offsets with chunk range_end values.'], ['A per-job eligibility interpretation.'], [0, 1], { sql: "SELECT j.job_id,j.proc_name,j.config,c.chunk_name,c.range_end FROM timescaledb_information.jobs j CROSS JOIN timescaledb_information.chunks c WHERE j.hypertable_name='readings' AND c.hypertable_name='readings' ORDER BY j.job_id,c.range_end;" }]],
      [
        ['controlled-experiment', 'measured', 'Estimate retention candidates', 'Forecast impact without dropping data.', ['Choose a hypothetical seven-day cutoff.', 'Count and total bytes only for chunks wholly older than it.'], ['Candidate count and bytes with no destructive SQL.'], [1], { sql: "WITH old AS (SELECT chunk_schema,chunk_name FROM timescaledb_information.chunks WHERE hypertable_name='readings' AND range_end<now()-INTERVAL '7 days') SELECT count(*) AS candidate_chunks FROM old;" }],
        ['controlled-experiment', 'measured', 'Measure schedule drift', 'Separate configured cadence from actual completion.', ['Compare last run start and success timestamps.', 'Calculate age since last success for every readings job.'], ['Observed lag values and a stated alert threshold recommendation.'], [0], { sql: "SELECT j.job_id,j.schedule_interval,s.last_run_started_at,s.last_successful_finish,now()-s.last_successful_finish AS success_age FROM timescaledb_information.jobs j LEFT JOIN timescaledb_information.job_stats s USING(job_id) WHERE j.hypertable_name='readings';" }],
      ],
      [['failure-lab', 'recommendation', 'Triage a retention job that stopped', 'Restore progress without blindly recreating jobs.', ['Check scheduled state, last status, failure count, config, and data eligibility.', 'Propose remediation only after identifying the first failed invariant.'], ['An ordered runbook with evidence attached to each branch.'], [0, 1]]],
      [['independent', 'recommendation', 'Sequence refresh, columnstore, and retention', 'Prevent raw deletion before required rollups exist.', ['Draw each policy window on one time axis.', 'Require refresh coverage and lateness margin before the retention boundary.'], ['A policy timeline with named safety gap.'], [0, 1, 2]]],
      [
        ['scenario', 'recommendation', 'Respond to accidental history loss', 'Use observable facts during a retention incident.', ['Identify which chunks and aggregates still cover the lost period.', 'Separate recovery possibilities from prevention changes.'], ['An incident plan that does not imply dropped chunks are recoverable by SQL alone.'], [1, 2]],
        ['scenario', 'documented', 'Identify custom job ownership', 'Set correct expectations for procedures.', ['Describe registration, schedule, config, and job stats.', 'List idempotency and observability requirements as recommendations.'], ['A documented/recommended split.'], [0]],
      ],
      [['assessment', 'documented', 'Closed-book policy timeline', 'Validate lifecycle reasoning.', ['Place refresh, conversion, and retention on a blank axis.', 'Compare against documentation and correct any unsafe overlap.'], ['A corrected timeline and failure checks.'], [0, 1, 2]]],
    ],
  },
  '06': {
    title: 'Hyperfunctions: states, gaps, counters, and statistical rollups',
    summary: 'Use two-step aggregates deliberately, including gap semantics, reset-aware counters, rollup of counter states, and scan-aware statistics.',
    outcomes: ['Choose LOCF or interpolation from domain semantics', 'Use counter_agg and rollup(counter states) correctly', 'Explain two-step aggregate state reuse', 'Avoid claiming stats_agg inherently reduces the initial scan'],
    sources: ['hyperfunctions', 'gapfill', 'counters'],
    overviews: ['Profile gaps and counters.', 'Study state/accessor architecture.', 'Analyze the seeded outage.', 'Compare fill strategies.', 'Debug naive counter math.', 'Compose rollups.', 'Design an energy dashboard.', 'Defend statistical claims.'],
    activities: [
      [
        ['diagnostic', 'measured', 'Locate sensor 7 outage buckets', 'Observe missingness before filling it.', ['Bucket the four-day window hourly.', 'Record absent buckets and null humidity independently.'], ['A gap map separating missing rows from null values.'], [1], { sql: "SELECT time_bucket('1 hour',time) bucket,count(*) samples,count(*) FILTER(WHERE humidity IS NULL) null_humidity FROM readings WHERE sensor_id=7 AND time>=now()-INTERVAL '4 days' AND time<now()-INTERVAL '2 days' GROUP BY 1 ORDER BY 1;" }],
        ['diagnostic', 'measured', 'Check counter monotonicity', 'Verify seeded energy assumptions.', ['Use lag per sensor over the last day.', 'Count negative steps and record observed range.'], ['Reset count proxy and counter bounds per sensor.'], [2], { sql: "WITH x AS (SELECT sensor_id,time,energy_kwh,lag(energy_kwh) OVER(PARTITION BY sensor_id ORDER BY time) p FROM readings WHERE time>=now()-INTERVAL '1 day') SELECT sensor_id,count(*) FILTER(WHERE energy_kwh<p) negative_steps,min(energy_kwh),max(energy_kwh) FROM x GROUP BY sensor_id ORDER BY sensor_id;" }],
      ],
      [['theory', 'documented', 'Trace two-step aggregation', 'Understand why states can be reused and rolled up.', ['Separate aggregate state construction from accessor evaluation.', 'Explain retention benefits only when states have actually been persisted.'], ['A state/accessor diagram with no claim that raw scanning disappears initially.'], [0]]],
      [['guided-analysis', 'measured', 'Expose and fill the outage', 'Compare absence with an explicit modeled result.', ['Run time_bucket_gapfill over explicit bounds.', 'Return samples plus LOCF average and mark zero-sample buckets.'], ['Six-hour zero-sample region with held values where defined.'], [1], { sql: "SELECT time_bucket_gapfill('1 hour',time) bucket,count(*) samples,locf(avg(temperature)) held_temp FROM readings WHERE sensor_id=7 AND time>=now()-INTERVAL '4 days' AND time<now()-INTERVAL '2 days' GROUP BY 1 ORDER BY 1;" }]],
      [
        ['controlled-experiment', 'measured', 'LOCF versus interpolation', 'Reveal modeling assumptions in filled values.', ['Compute both fills over the outage.', 'Compare values inside the gap and state which physical process each assumes.'], ['A bucket comparison and domain-based choice.'], [1], { sql: "SELECT time_bucket_gapfill('1 hour',time) bucket,locf(avg(temperature)) held,interpolate(avg(temperature)) linear FROM readings WHERE sensor_id=7 AND time>=now()-INTERVAL '4 days' AND time<now()-INTERVAL '2 days' GROUP BY 1 ORDER BY 1;" }],
        ['controlled-experiment', 'measured', 'Plain average versus time-weighted state', 'Measure sampling sensitivity.', ['Calculate ordinary average temperature for one sensor.', 'Calculate a time_weight state and its average accessor over identical bounds.'], ['Both results and a conclusion limited to observed cadence.'], [0], { sql: "SELECT avg(temperature) ordinary,average(time_weight('Linear',time,temperature)) weighted FROM readings WHERE sensor_id=1 AND time>=now()-INTERVAL '1 day';" }],
      ],
      [['failure-lab', 'measured', 'Break max-minus-min counter math', 'Show why reset-aware state matters.', ['Compute naive range and counter_agg delta for the same window.', 'Explain how a hypothetical reset would invalidate the naive expression even if seeded resets are zero.'], ['Measured comparison plus reset failure explanation.'], [2], { sql: "SELECT sensor_id,max(energy_kwh)-min(energy_kwh) naive,delta(counter_agg(time,energy_kwh)) robust,num_resets(counter_agg(time,energy_kwh)) resets FROM readings WHERE time>=now()-INTERVAL '1 day' GROUP BY sensor_id ORDER BY sensor_id;" }]],
      [['independent', 'documented', 'Choose a counter-state rollup', 'Preserve reset semantics across hierarchy levels.', ['Define hourly counter_agg states conceptually.', 'Use rollup on those counter states for daily accessors; never sum independent deltas as a substitute for merging state.'], ['A valid rollup(counter-state) pipeline and boundary rationale.'], [2]]],
      [
        ['scenario', 'recommendation', 'Specify an energy and quality dashboard', 'Choose hyperfunctions by signal semantics.', ['Map energy_kwh to reset-aware counters, temperature to time weighting where cadence is irregular, and availability to explicit gap rows.', 'Label every fill method as a modeling recommendation rather than measured fact.'], ['A metric contract with assumptions.'], [0, 1, 2]],
        ['scenario', 'documented', 'Correct the stats_agg scan claim', 'Prevent a misleading performance promise.', ['State that building stats_agg from raw rows still requires scanning those input rows.', 'Explain that benefit comes from reusable compact state, multiple accessors, rollup, or persisted aggregates, subject to measurement.'], ['A corrected claim that explicitly distinguishes documented mechanics from measured speed.'], [0]],
      ],
      [['assessment', 'documented', 'Closed-book hyperfunction defense', 'Test state composition and gap semantics.', ['Answer when to use LOCF, interpolation, counter_agg, rollup, and stats_agg.', 'Correct answers against the official APIs, especially counter-state rollup and initial-scan cost.'], ['A corrected decision table.'], [0, 1, 2]]],
    ],
  },
  '07': {
    title: 'Performance optimization: plans, indexes, chunks, and skipping',
    summary: 'Run controlled plan experiments and treat chunk size and chunk skipping as workload- and correlation-dependent decisions.',
    outcomes: ['Read actual plan evidence', 'Match indexes to access patterns', 'Size chunks from workload measurements', 'Describe chunk skipping as technology preview and correlation-dependent'],
    sources: ['explain', 'indexes', 'skipping'],
    overviews: ['Capture the hot-path plan.', 'Study planner evidence.', 'Inspect indexes and chunks.', 'Compare bounded workloads.', 'Debug a slow selective query.', 'Evaluate chunk skipping.', 'Review a production regression.', 'Defend optimization claims.'],
    activities: [
      [
        ['diagnostic', 'measured', 'Capture latest-reading plan', 'Establish the target path before proposing changes.', ['Explain analyze the latest twenty readings for sensor 4.', 'Record chunks, scan methods, buffers, rows removed, and execution time.'], ['An annotated baseline plan.'], [0], { sql: "EXPLAIN (ANALYZE,BUFFERS,COSTS OFF) SELECT time,temperature,humidity FROM readings WHERE sensor_id=4 AND time>=now()-INTERVAL '1 day' ORDER BY time DESC LIMIT 20;" }],
        ['diagnostic', 'measured', 'Inventory indexes', 'Avoid recommending an index that already exists.', ['List public indexes on readings.', 'Map key order and predicates to current workload.'], ['Index inventory with supported query shapes.'], [1], { sql: "SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='readings' ORDER BY indexname;" }],
      ],
      [['theory', 'documented', 'Separate estimates from actuals', 'Read EXPLAIN ANALYZE responsibly.', ['Define cost, estimated rows, actual rows, loops, buffers, and timing.', 'Explain why one warm-cache run is not a benchmark.'], ['A plan-reading checklist.'], [0]]],
      [['guided-analysis', 'measured', 'Correlate chunks and plan scans', 'Connect pruning to physical ranges.', ['List chunk bounds covering the last day.', 'Match those names to scans in the hot-path plan.'], ['A range-to-plan mapping.'], [0], { sql: "SELECT chunk_name,range_start,range_end FROM timescaledb_information.chunks WHERE hypertable_name='readings' AND range_end>=now()-INTERVAL '1 day' ORDER BY range_start;" }]],
      [
        ['controlled-experiment', 'measured', 'Vary sensor and time selectivity', 'Identify which predicate drives work.', ['Explain four combinations of one/all sensors and one/twenty days.', 'Compare buffers, rows, and chunks while keeping selected columns fixed.'], ['A four-case measurement matrix.'], [0, 1], { sql: "EXPLAIN (ANALYZE,BUFFERS,COSTS OFF) SELECT avg(temperature) FROM readings WHERE sensor_id=5 AND time>=now()-INTERVAL '20 days';" }],
        ['controlled-experiment', 'measured', 'Measure chunk footprint distribution', 'Supply evidence for interval discussion.', ['Aggregate detailed chunk sizes.', 'Calculate min, average, max, and count rather than only total size.'], ['A distribution summary tied to current seed scale.'], [1], { sql: "SELECT count(*),pg_size_pretty(min(total_bytes)),pg_size_pretty(avg(total_bytes)::bigint),pg_size_pretty(max(total_bytes)) FROM chunks_detailed_size('readings');" }],
      ],
      [['failure-lab', 'measured', 'Diagnose a slow selective query', 'Resist adding indexes before locating wasted work.', ['Check time predicate visibility, chunk count, index inventory, estimates versus actuals, and sort spills.', 'Choose one candidate fix and define before/after metrics without executing DDL.'], ['Root-cause evidence and a controlled validation plan.'], [0, 1]]],
      [['independent', 'recommendation', 'Evaluate chunk skipping candidacy', 'Apply feature constraints before enabling anything.', ['Verify from official docs that chunk skipping is technology preview.', 'Measure correlation of a candidate non-time column with time/chunk ranges; recommend it only when range metadata can exclude chunks.'], ['A correlation-backed go/no-go decision with preview risk noted.'], [2], { sql: "SELECT corr(extract(epoch FROM time),energy_kwh) AS time_energy_correlation,corr(extract(epoch FROM time),sensor_id) AS time_sensor_correlation FROM readings;" }]],
      [
        ['scenario', 'recommendation', 'Review a scaling regression', 'Make sizing and index choices from workload facts.', ['Assume ingest grew tenfold and dashboards changed from one day to ninety days.', 'Recommend measurements for chunk interval, rollups, and indexes; avoid fixed universal sizing ratios.'], ['A prioritized experiment plan with rollback criteria.'], [0, 1]],
        ['scenario', 'documented', 'Identify chunk-skipping limits', 'Set realistic expectations.', ['State preview status and the need for correlation with chunk ranges.', 'Contrast skipping metadata with a B-tree lookup and time-dimension pruning.'], ['A three-way comparison without claiming universal acceleration.'], [2]],
      ],
      [['assessment', 'documented', 'Closed-book optimization review', 'Verify evidence-first reasoning.', ['Given a plan, list five measurements needed before a change.', 'Review for preview status, correlation, workload-dependent sizing, and cache caveats.'], ['A corrected optimization checklist.'], [0, 1, 2]]],
    ],
  },
  '08': {
    title: 'Capstone: design and defend a complete telemetry lifecycle',
    summary: 'Integrate ingest, query paths, rollups, columnstore, jobs, retention, observability, and failure recovery into one production design.',
    outcomes: ['Translate service objectives into policy windows', 'Protect rollups from premature retention', 'Choose workload-specific storage settings', 'Defend the design with measurable acceptance criteria'],
    sources: ['hypertables', 'caggs', 'columnstore', 'jobs', 'retention'],
    overviews: ['Read the fleet baseline.', 'Construct the lifecycle model.', 'Audit the current building blocks.', 'Validate dashboard paths.', 'Run a policy failure tabletop.', 'Produce an independent design.', 'Defend it in production review.', 'Complete the final exam.'],
    activities: [
      [
        ['diagnostic', 'measured', 'Baseline fleet volume and lateness clues', 'Anchor capacity assumptions in seeded evidence.', ['Compute readings per sensor per day.', 'Record chunk bytes and current source freshness separately.'], ['A baseline table labeled as seed-scale measurements.'], [0], { sql: "SELECT sensor_id,date_trunc('day',time) AS bucket_day,count(*) FROM readings GROUP BY sensor_id,date_trunc('day',time) ORDER BY bucket_day DESC,sensor_id LIMIT 36;" }],
        ['diagnostic', 'measured', 'Audit lifecycle objects', 'Know which capstone components already exist.', ['List continuous aggregates and readings jobs.', 'List chunk storage states and ranges.'], ['A three-layer inventory with missing components called out.'], [1, 2, 3], { sql: "SELECT proc_name,count(*) FROM timescaledb_information.jobs GROUP BY proc_name ORDER BY proc_name;" }],
      ],
      [['theory', 'documented', 'Order capstone dependencies', 'Prevent unsafe policy ordering.', ['Connect raw hypertable, materialization, dashboard, conversion, and retention.', 'Mark late-arrival and refresh boundaries on the same axis.'], ['A graph showing raw retention after required refresh coverage.'], [0, 1, 2, 4]]],
      [['guided-analysis', 'measured', 'Reconcile policies with ranges', 'Find contradictions in current state.', ['Read every job configuration and schedule.', 'Compare offsets with raw min/max and chunk range ends.'], ['A policy/range matrix with factual conflicts highlighted.'], [3, 4], { sql: "SELECT job_id,proc_name,schedule_interval,config FROM timescaledb_information.jobs ORDER BY job_id;" }]],
      [
        ['controlled-experiment', 'measured', 'Compare dashboard access paths', 'Validate whether a rollup earns its complexity.', ['Explain a thirty-day raw hourly aggregation.', 'If an equivalent continuous aggregate exists, explain its SELECT and compare correctness, rows, buffers, and time.'], ['Environment-specific results and equivalence checks.'], [1], { sql: "EXPLAIN (ANALYZE,BUFFERS,COSTS OFF) SELECT time_bucket('1 hour',time),sensor_id,avg(temperature) FROM readings WHERE time>=now()-INTERVAL '30 days' GROUP BY 1,2;" }],
        ['controlled-experiment', 'measured', 'Check live-status path', 'Keep current-state queries out of historical rollups.', ['Explain the latest row for sensor 8.', 'Contrast its access needs with the historical dashboard.'], ['Two query-path responsibilities and one measured plan.'], [0], { sql: "EXPLAIN (ANALYZE,BUFFERS,COSTS OFF) SELECT time,temperature,battery FROM readings WHERE sensor_id=8 ORDER BY time DESC LIMIT 1;" }],
      ],
      [['failure-lab', 'recommendation', 'Tabletop: retention outran refresh', 'Practice detection and containment.', ['Assume raw chunks were dropped before late data was materialized.', 'Identify observable loss, stop further damage conceptually, and redesign window ordering without executing policy DDL.'], ['An incident timeline, evidence queries, and preventive invariants.'], [1, 3, 4]]],
      [['independent', 'recommendation', 'Choose production design evidence', 'Make every choice testable.', ['Specify chunk interval, indexes, aggregate buckets, refresh offsets, conversion age, retention age, and dashboard sources.', 'For each choice list workload assumption, metric, acceptance threshold, and rollback trigger.'], ['A complete design with workload-dependent sizing rather than magic constants.'], [0, 1, 2, 3, 4]]],
      [
        ['scenario', 'recommendation', 'Architecture review under new constraints', 'Adapt rather than defend stale assumptions.', ['Add a requirement for four-hour late arrivals and ninety-day dashboards.', 'Revise policy windows and explain cost, freshness, and storage effects.'], ['A revised time axis and explicit tradeoffs.'], [1, 2, 3, 4]],
        ['scenario', 'documented', 'Identify correctness invariants', 'Give operators crisp checks.', ['Define invariants for real-time defaults, watermark interpretation, rollup state composition, and policy order.', 'Include chunk-skipping preview/correlation and workload-dependent sizing as conditional choices, not invariants.'], ['A fact/recommendation checklist incorporating all critical corrections.'], [0, 1, 2, 3, 4]],
      ],
      [['assessment', 'documented', 'Closed-book capstone defense', 'Demonstrate integrated mastery.', ['Present the lifecycle and failure modes without notes.', 'Review against official sources; correct claims about real-time defaults, watermarks, rollup(counter states), chunk skipping, stats scans, and sizing.'], ['A corrected final design and a signed evidence checklist.'], [0, 1, 2, 3, 4]]],
    ],
  },
};

export const coreDeepDives = Object.fromEntries(
  Object.entries(specs).map(([lesson, spec]) => [lesson, buildModule(lesson, spec)]),
);
