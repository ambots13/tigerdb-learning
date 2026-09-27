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

function activity(lesson, index, type, claim, title, purpose, instructions, evidence, sourceIndexes, extras = {}) {
  return {
    id: `${lesson}-activity-${String(index + 1).padStart(2, '0')}`,
    type,
    claim,
    title,
    purpose,
    instructions,
    evidence,
    sourceIds: sourceIndexes.map((number) => `${lesson}-source-${number + 1}`),
    ...extras,
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
      [['theory', 'documented', 'Draw the ownership boundary', 'Explain why ordinary PostgreSQL clients work.', ['List connection, transaction, type, and catalog responsibilities.', 'Mark hypertables and policy scheduling as extension features.'], ['A two-column responsibility map with no compatibility-layer claim.'], [0]]],
      [['guided-analysis', 'measured', 'Classify both relations', 'Prove object kind from two catalog families.', ['Join pg_class and pg_namespace for public sensors and readings.', 'Left join the hypertables information view and label each result.'], ['readings is cataloged as a hypertable while sensors is not.'], [1], { sql: "SELECT c.relname, h.hypertable_name IS NOT NULL AS is_hypertable FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN timescaledb_information.hypertables h ON h.hypertable_schema=n.nspname AND h.hypertable_name=c.relname WHERE n.nspname='public' AND c.relname IN ('sensors','readings') ORDER BY 1;" }]],
      [
        ['controlled-experiment', 'measured', 'Check catalog repeatability', 'Distinguish persistent metadata from session context.', ['Run the extension inventory twice.', 'Compare it with current_timestamp and explain which output can change.'], ['A written comparison based on two executions.'], [0], { sql: "SELECT current_timestamp, current_database(), extname, extversion FROM pg_extension WHERE extname LIKE 'timescaledb%' ORDER BY extname;" }],
        ['controlled-experiment', 'measured', 'Inspect chunk visibility', 'Connect one logical table to its physical partitions.', ['Count information-view chunk rows for readings.', 'Group them by primary space and record the covered time span.'], ['Chunk count and earliest/latest bounds.'], [1], { sql: "SELECT primary_dimension, count(*) AS chunks, min(range_start), max(range_end) FROM timescaledb_information.chunks WHERE hypertable_name='readings' GROUP BY primary_dimension;" }],
      ],
      [['failure-lab', 'recommendation', 'Triage an empty hypertable view', 'Avoid reinstalling an extension when context is wrong.', ['Assume pg_extension lists TimescaleDB but the expected object is absent.', 'Order checks for database, schema, relation spelling, permissions, and seed completion.'], ['A diagnostic decision tree whose first action is read-only.'], [0, 1]]],
      [['independent', 'measured', 'Inventory fleet dimensions', 'Establish cardinalities used later in the course.', ['Count distinct sensor, site, and model values through a join.', 'Compare distinct sensor IDs in readings with rows in sensors.'], ['A cardinality table and any missing-key discrepancy.'], [0], { sql: 'SELECT count(DISTINCT r.sensor_id) AS observed_sensors, count(DISTINCT s.site) AS sites, count(DISTINCT s.model) AS models, count(*) AS readings FROM readings r JOIN sensors s USING (sensor_id);' }]],
      [
        ['scenario', 'recommendation', 'Write an incident handoff', 'Communicate connection facts without speculation.', ['Summarize server and extension versions separately.', 'Cite the exact catalog query another engineer can rerun.'], ['A five-line handoff separating observations and recommendations.'], [0]],
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
      [['theory', 'documented', 'Prove half-open boundaries', 'Explain how adjacent chunks avoid overlap.', ['Write the membership inequalities for [start,end).', 'Explain where a row exactly equal to range_end routes.'], ['A boundary proof assigning the row only to the following range.'], [0]]],
      [['guided-analysis', 'measured', 'Read the two-hour plan', 'Identify excluded history from the executed plan.', ['Run EXPLAIN ANALYZE with buffers on a direct time bound.', 'Count named chunk scans and compare with the chunk census.'], ['Plan annotations showing limited chunk access.'], [1], { sql: "EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT avg(temperature) FROM readings WHERE time>=now()-INTERVAL '2 hours';" }]],
      [
        ['controlled-experiment', 'measured', 'Compare narrow and wide windows', 'Measure the effect of selectivity on chunk access.', ['Explain the same aggregate for two hours.', 'Repeat for twenty days and compare scans, buffers, and execution time.'], ['A two-row measurement table, not a universal speed claim.'], [1], { sql: "EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT avg(temperature) FROM readings WHERE time>=now()-INTERVAL '20 days';" }],
        ['controlled-experiment', 'measured', 'Check boundary population', 'Validate interval membership with data.', ['Choose one internal range_start from the chunk view.', 'Count rows exactly at that timestamp and within the following minute.'], ['Counts tied to a named chunk boundary.'], [0], { sql: "WITH b AS (SELECT range_start AS t FROM timescaledb_information.chunks WHERE hypertable_name='readings' ORDER BY range_start OFFSET 1 LIMIT 1) SELECT count(*) FILTER (WHERE r.time=b.t) AS at_boundary, count(*) AS first_minute FROM b JOIN readings r ON r.time>=b.t AND r.time<b.t+INTERVAL '1 minute' GROUP BY b.t;" }],
      ],
      [['failure-lab', 'measured', 'Expose a wrapped time predicate', 'Debug loss of effective pruning.', ['Compare the direct time bound with a date expression over time.', 'Use plans to report chunk scans rather than guessing from elapsed time.'], ['Side-by-side plans and the observed scan difference.'], [1], { sql: "EXPLAIN (ANALYZE, COSTS OFF) SELECT count(*) FROM readings WHERE date(time)=CURRENT_DATE;" }]],
      [['independent', 'recommendation', 'Build a sizing worksheet', 'Reject one-size-fits-all chunk intervals.', ['Estimate bytes and rows per current chunk from detailed sizes and counts.', 'Recommend an interval only after stating ingest rate, active-index memory, query windows, retention, and operational overhead assumptions.'], ['A workload-dependent recommendation with assumptions and rollback trigger.'], [0], { sql: "SELECT count(*) AS chunks, pg_size_pretty(avg(total_bytes)::bigint) AS avg_bytes, pg_size_pretty(max(total_bytes)) AS max_bytes FROM chunks_detailed_size('readings');" }]],
      [
        ['scenario', 'recommendation', 'Size a bursty telemetry fleet', 'Balance pruning against chunk-management overhead.', ['Assume weekday ingest is four times weekend ingest and most reads cover six hours.', 'Propose a starting interval and measurements that would justify changing it.'], ['A decision that explicitly avoids presenting a fixed percentage or duration as universal.'], [0]],
        ['scenario', 'documented', 'Explain interval changes', 'Set correct migration expectations.', ['State whether changing the interval rewrites existing chunks.', 'Describe how future chunk creation reflects the new setting.'], ['A concise operational explanation.'], [0]],
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
        ['scenario', 'documented', 'Design a daily-on-hourly hierarchy', 'Preserve composability.', ['Use compatible fixed-width buckets.', 'Explain why the lower aggregate must expose mergeable states when rolling up counter analytics.'], ['A hierarchy diagram and compatibility checklist.'], [0]],
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
        ['scenario', 'documented', 'Explain unchanged SQL surface', 'Clarify storage transparency and limits.', ['Describe how SELECT targets the same hypertable.', 'Separate SQL compatibility from measured performance and mutation constraints.'], ['An operator-facing explanation with clear claim categories.'], [0]],
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
      [['theory', 'documented', 'Explain chunk retention', 'Avoid row-delete mental models.', ['Describe eligibility using complete chunk time ranges.', 'Contrast dropping a chunk with DELETE and explain boundary consequences.'], ['A precise physical-operation comparison.'], [1]]],
      [['guided-analysis', 'measured', 'Map configurations to data', 'Translate JSON policy config into real ranges.', ['Read each readings job config.', 'Compare configured offsets with chunk range_end values.'], ['A per-job eligibility interpretation.'], [0, 1], { sql: "SELECT j.job_id,j.proc_name,j.config,c.chunk_name,c.range_end FROM timescaledb_information.jobs j CROSS JOIN timescaledb_information.chunks c WHERE j.hypertable_name='readings' AND c.hypertable_name='readings' ORDER BY j.job_id,c.range_end;" }]],
      [
        ['controlled-experiment', 'measured', 'Estimate retention candidates', 'Forecast impact without dropping data.', ['Choose a hypothetical seven-day cutoff.', 'Count and total bytes only for chunks wholly older than it.'], ['Candidate count and bytes with no destructive SQL.'], [1], { sql: "WITH old AS (SELECT chunk_schema,chunk_name FROM timescaledb_information.chunks WHERE hypertable_name='readings' AND range_end<now()-INTERVAL '7 days') SELECT count(*) AS candidate_chunks FROM old;" }],
        ['controlled-experiment', 'measured', 'Measure schedule drift', 'Separate configured cadence from actual completion.', ['Compare last run start and success timestamps.', 'Calculate age since last success for every readings job.'], ['Observed lag values and a stated alert threshold recommendation.'], [0], { sql: "SELECT j.job_id,j.schedule_interval,s.last_run_started_at,s.last_successful_finish,now()-s.last_successful_finish AS success_age FROM timescaledb_information.jobs j LEFT JOIN timescaledb_information.job_stats s USING(job_id) WHERE j.hypertable_name='readings';" }],
      ],
      [['failure-lab', 'recommendation', 'Triage a retention job that stopped', 'Restore progress without blindly recreating jobs.', ['Check scheduled state, last status, failure count, config, and data eligibility.', 'Propose remediation only after identifying the first failed invariant.'], ['An ordered runbook with evidence attached to each branch.'], [0, 1]]],
      [['independent', 'recommendation', 'Sequence refresh, columnstore, and retention', 'Prevent raw deletion before required rollups exist.', ['Draw each policy window on one time axis.', 'Require refresh coverage and lateness margin before the retention boundary.'], ['A policy timeline with named safety gap.'], [0, 1, 2]]],
      [
        ['scenario', 'recommendation', 'Respond to accidental history loss', 'Use observable facts during a retention incident.', ['Identify which chunks and aggregates still cover the lost period.', 'Separate recovery possibilities from prevention changes.'], ['An incident plan that does not imply dropped chunks are recoverable by SQL alone.'], [1, 2]],
        ['scenario', 'documented', 'Explain custom job ownership', 'Set correct expectations for procedures.', ['Describe registration, schedule, config, and job stats.', 'List idempotency and observability requirements as recommendations.'], ['A documented/recommended split.'], [0]],
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
      [['independent', 'documented', 'Design counter-state rollup', 'Preserve reset semantics across hierarchy levels.', ['Define hourly counter_agg states conceptually.', 'Use rollup on those counter states for daily accessors; never sum independent deltas as a substitute for merging state.'], ['A valid rollup(counter-state) pipeline and boundary rationale.'], [2]]],
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
        ['scenario', 'documented', 'Explain chunk-skipping limits', 'Set realistic expectations.', ['State preview status and the need for correlation with chunk ranges.', 'Contrast skipping metadata with a B-tree lookup and time-dimension pruning.'], ['A three-way comparison without claiming universal acceleration.'], [2]],
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
      [['theory', 'documented', 'Draw the dependency graph', 'Prevent unsafe policy ordering.', ['Connect raw hypertable, materialization, dashboard, conversion, and retention.', 'Mark late-arrival and refresh boundaries on the same axis.'], ['A graph showing raw retention after required refresh coverage.'], [0, 1, 2, 4]]],
      [['guided-analysis', 'measured', 'Reconcile policies with ranges', 'Find contradictions in current state.', ['Read every job configuration and schedule.', 'Compare offsets with raw min/max and chunk range ends.'], ['A policy/range matrix with factual conflicts highlighted.'], [3, 4], { sql: "SELECT job_id,proc_name,schedule_interval,config FROM timescaledb_information.jobs ORDER BY job_id;" }]],
      [
        ['controlled-experiment', 'measured', 'Compare dashboard access paths', 'Validate whether a rollup earns its complexity.', ['Explain a thirty-day raw hourly aggregation.', 'If an equivalent continuous aggregate exists, explain its SELECT and compare correctness, rows, buffers, and time.'], ['Environment-specific results and equivalence checks.'], [1], { sql: "EXPLAIN (ANALYZE,BUFFERS,COSTS OFF) SELECT time_bucket('1 hour',time),sensor_id,avg(temperature) FROM readings WHERE time>=now()-INTERVAL '30 days' GROUP BY 1,2;" }],
        ['controlled-experiment', 'measured', 'Check live-status path', 'Keep current-state queries out of historical rollups.', ['Explain the latest row for sensor 8.', 'Contrast its access needs with the historical dashboard.'], ['Two query-path responsibilities and one measured plan.'], [0], { sql: "EXPLAIN (ANALYZE,BUFFERS,COSTS OFF) SELECT time,temperature,battery FROM readings WHERE sensor_id=8 ORDER BY time DESC LIMIT 1;" }],
      ],
      [['failure-lab', 'recommendation', 'Tabletop: retention outran refresh', 'Practice detection and containment.', ['Assume raw chunks were dropped before late data was materialized.', 'Identify observable loss, stop further damage conceptually, and redesign window ordering without executing policy DDL.'], ['An incident timeline, evidence queries, and preventive invariants.'], [1, 3, 4]]],
      [['independent', 'recommendation', 'Write a production design record', 'Make every choice testable.', ['Specify chunk interval, indexes, aggregate buckets, refresh offsets, conversion age, retention age, and dashboard sources.', 'For each choice list workload assumption, metric, acceptance threshold, and rollback trigger.'], ['A complete design with workload-dependent sizing rather than magic constants.'], [0, 1, 2, 3, 4]]],
      [
        ['scenario', 'recommendation', 'Architecture review under new constraints', 'Adapt rather than defend stale assumptions.', ['Add a requirement for four-hour late arrivals and ninety-day dashboards.', 'Revise policy windows and explain cost, freshness, and storage effects.'], ['A revised time axis and explicit tradeoffs.'], [1, 2, 3, 4]],
        ['scenario', 'documented', 'State the correctness invariants', 'Give operators crisp checks.', ['Define invariants for real-time defaults, watermark interpretation, rollup state composition, and policy order.', 'Include chunk-skipping preview/correlation and workload-dependent sizing as conditional choices, not invariants.'], ['A fact/recommendation checklist incorporating all critical corrections.'], [0, 1, 2, 3, 4]],
      ],
      [['assessment', 'documented', 'Closed-book capstone defense', 'Demonstrate integrated mastery.', ['Present the lifecycle and failure modes without notes.', 'Review against official sources; correct claims about real-time defaults, watermarks, rollup(counter states), chunk skipping, stats scans, and sizing.'], ['A corrected final design and a signed evidence checklist.'], [0, 1, 2, 3, 4]]],
    ],
  },
};

export const coreDeepDives = Object.fromEntries(
  Object.entries(specs).map(([lesson, spec]) => [lesson, buildModule(lesson, spec)]),
);
