const activity = (id, type, claim, title, purpose, instructions, evidence, sourceIds, extras = {}) => ({
  id,
  type,
  claim,
  title,
  purpose,
  instructions,
  evidence,
  sourceIds,
  ...extras,
});

const phase = (id, title, minutes, overview, activities) => ({
  id,
  title,
  minutes,
  overview,
  activities,
});

const standardMinutes = [15, 25, 20, 25, 20, 20, 25, 15, 15];

export const advancedDeepDives = {
  '09': {
    estimatedMinutes: 180,
    title: 'Index engineering on hypertables and Hypercore',
    summary:
      'Diagnose access paths, test PostgreSQL index families, and distinguish rowstore indexes from Hypercore batch metadata without changing the seeded database.',
    outcomes: [
      'Select B-tree, partial, expression, covering, BRIN, or GIN designs from query shape and measured plans.',
      'Explain why an Index Only Scan may still perform heap fetches through the visibility map.',
      'State exactly which operators jsonb_path_ops supports and omits.',
      'Distinguish segment groups, compressed batches, and automatic firstlast metadata.',
      'Write a production index experiment with explicit success and rollback criteria.',
    ],
    sources: [
      {
        id: '09-src-pg-index-only',
        title: 'PostgreSQL: Index-Only Scans and Covering Indexes',
        url: 'https://www.postgresql.org/docs/current/indexes-index-only-scans.html',
        note: 'Primary PostgreSQL documentation for INCLUDE, visibility-map checks, and heap fetches.',
      },
      {
        id: '09-src-pg-json',
        title: 'PostgreSQL: jsonb Indexing',
        url: 'https://www.postgresql.org/docs/current/datatype-json.html#JSON-INDEXING',
        note: 'Primary PostgreSQL documentation for GIN operator classes and supported operators.',
      },
      {
        id: '09-src-pg-indexes',
        title: 'PostgreSQL: Index Types',
        url: 'https://www.postgresql.org/docs/current/indexes-types.html',
        note: 'Primary PostgreSQL documentation for B-tree, hash, GiST, SP-GiST, GIN, and BRIN behavior.',
      },
      {
        id: '09-src-hypercore',
        title: 'Tiger Data: Hypercore indexing',
        url: 'https://docs.tigerdata.com/use-timescale/latest/hypercore/secondary-indexes/',
        note: 'Official Tiger Data documentation for sparse metadata and columnar batch pruning.',
      },
    ],
    phases: [
      phase('09-p1', 'Diagnostic: infer the current physical design', standardMinutes[0],
        'Start from catalogs and workload shape rather than proposing another index from intuition.', [
          activity('09-a01', 'diagnostic', 'measured', 'Inventory logical and physical indexes',
            'Establish what is already maintained per chunk and how much space it occupies.', [
              'Run the catalog query and group physical chunk indexes by their normalized suffix.',
              'Mark indexes with zero scans as investigation candidates, not automatic drop candidates.',
            ], ['A table listing copies, scans, and bytes for each readings index.'],
            ['09-src-pg-indexes'], {
              sql: `SELECT regexp_replace(indexrelname, '^_hyper_[0-9]+_[0-9]+_chunk_', '') AS index_name,
       count(*) AS physical_copies,
       sum(idx_scan) AS scans,
       sum(pg_relation_size(indexrelid))::bigint AS bytes
FROM pg_stat_user_indexes
WHERE relname LIKE '_hyper_%_chunk'
  AND indexrelname LIKE '%readings%'
GROUP BY 1
ORDER BY bytes DESC, index_name;`,
            }),
        ]),
      phase('09-p2', 'Deep theory: access paths and visibility', standardMinutes[1],
        'Connect predicates, ordering, selectivity, physical correlation, and MVCC visibility to scan choice.', [
          activity('09-a02', 'theory', 'documented', 'Why covering is not heap-free by definition',
            'Build the correct mental model for index-only execution under MVCC.', [
              'Trace how an index supplies values while the visibility map supplies an all-visible answer.',
              'Explain why recently modified heap pages can force Heap Fetches even under an Index Only Scan.',
            ], ['A written chain: covering keys -> visibility-map bit -> optional heap visit.'],
            ['09-src-pg-index-only']),
        ]),
      phase('09-p3', 'Guided analysis: map queries to indexes', standardMinutes[2],
        'Read seeded query patterns and identify the access-path property each one requires.', [
          activity('09-a03', 'guided-analysis', 'recommendation', 'Classify five index jobs',
            'Separate filtering, ordering, payload coverage, physical locality, and JSON containment.', [
              'For each job, name a candidate index family and the predicate or ordering it serves.',
              'Reject redundant candidates when an existing B-tree can satisfy the same requirement.',
            ], ['A five-row decision table with query shape, candidate, cost, and rejection reason.'],
            ['09-src-pg-indexes', '09-src-pg-json']),
        ]),
      phase('09-p4', 'Controlled experiments: plans and statistics', standardMinutes[3],
        'Use read-only plans to compare narrow time windows with broad scans and inspect visibility statistics.', [
          activity('09-a04', 'experiment', 'measured', 'Compare narrow and broad access',
            'Observe chunk exclusion and scan selection without forcing planner settings.', [
              'Run both EXPLAIN statements under the same session and record chunk/scan nodes.',
              'Compare estimated rows; do not claim a speedup from a single elapsed-time sample.',
            ], ['Two plans annotated with scan type, estimated rows, and chunks reached.'],
            ['09-src-pg-indexes'], {
              sql: `EXPLAIN (COSTS ON, SUMMARY OFF)
SELECT sensor_id, time, temperature
FROM readings
WHERE sensor_id = 3 AND time >= now() - INTERVAL '6 hours'
ORDER BY time DESC;

EXPLAIN (COSTS ON, SUMMARY OFF)
SELECT sensor_id, time, temperature
FROM readings
WHERE sensor_id = 3
ORDER BY time DESC;`,
            }),
          activity('09-a05', 'experiment', 'measured', 'Measure the precondition for index-only scans',
            'Inspect all-visible coverage rather than assuming INCLUDE eliminates heap access.', [
              'Query visibility counters for seeded relations and compute an all-visible percentage.',
              'Relate low coverage to potential heap checks while noting that a plan is still required.',
            ], ['A percentage plus a cautious prediction about Heap Fetches.'],
            ['09-src-pg-index-only'], {
              sql: `SELECT c.relname, c.relpages AS estimated_heap_pages,
       c.relallvisible AS estimated_all_visible_pages,
       round(100.0 * c.relallvisible / NULLIF(c.relpages, 0), 1) AS pct_all_visible
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'readings';`,
            }),
        ]),
      phase('09-p5', 'Failure/debug lab: operator-class mismatch', standardMinutes[4],
        'Debug a design that assumes every JSONB operator is supported by jsonb_path_ops.', [
          activity('09-a06', 'failure-lab', 'documented', 'Containment works; key existence does not',
            'Prevent a smaller GIN index from silently becoming the wrong index.', [
              'Classify @>, @?, and @@ as supported by jsonb_path_ops.',
              'Classify ?, ?|, and ?& as unsupported and propose default jsonb_ops when those queries matter.',
            ], ['An operator matrix with no claim that jsonb_path_ops supports key-existence operators.'],
            ['09-src-pg-json']),
        ]),
      phase('09-p6', 'Independent exercise: design from evidence', standardMinutes[5],
        'Produce a candidate design using only seeded schema and catalog evidence.', [
          activity('09-a07', 'exercise', 'measured', 'Find the hottest sensor predicates',
            'Quantify distribution before choosing key order or a partial predicate.', [
              'Complete the starter query to report row count and time span per sensor.',
              'Use the result to propose one index and state which query would verify it.',
            ], ['Runnable SQL and a falsifiable index hypothesis.'],
            ['09-src-pg-indexes'], {
              starterSql: `SELECT sensor_id, /* count and time bounds */ FROM readings GROUP BY sensor_id;`,
              hint: 'Use count(*), min(time), and max(time), then order by sensor_id.',
              solution: `SELECT sensor_id, count(*) AS rows, min(time) AS first_seen, max(time) AS last_seen
FROM readings
GROUP BY sensor_id
ORDER BY sensor_id;`,
            }),
        ]),
      phase('09-p7', 'Production scenario: Hypercore search', standardMinutes[6],
        'Design for tenant equality, trace lookup, and time range while keeping storage concepts precise.', [
          activity('09-a08', 'scenario', 'recommendation', 'Segment, order, then prune batches',
            'Choose complementary mechanisms for a multi-tenant trace workload.', [
              'Use tenant_id as a candidate segmentby only after measuring repetition and tenant filters.',
              'Describe bloom(trace_id), minmax(latency), and automatic firstlast on orderby as per-batch metadata.',
              'State that a segment group can span multiple compressed batches; never use the terms interchangeably.',
            ], ['A design separating segment groups, batches, and sparse metadata roles.'],
            ['09-src-hypercore']),
        ]),
      phase('09-p8', 'Closed-book assessment', standardMinutes[7],
        'Demonstrate recall without documentation or runnable hints.', [
          activity('09-a09', 'assessment', 'documented', 'Index correctness checkpoint',
            'Test exact operator support and index-only nuance.', [
              'Answer why an Index Only Scan can report nonzero Heap Fetches.',
              'List the three jsonb_path_ops operator families and the three omitted key-existence operators.',
              'Explain why firstlast metadata is not a user-created roaring bitmap.',
            ], ['Three correct answers using the terms visibility map, @>/@?/@@, and automatic metadata.'],
            ['09-src-pg-index-only', '09-src-pg-json', '09-src-hypercore']),
        ]),
      phase('09-p9', 'Review and transfer', standardMinutes[8],
        'Turn observations into a safe production experiment.', [
          activity('09-a10', 'review', 'recommendation', 'Write the index change contract',
            'Ensure index work has workload, measurement, and rollback boundaries.', [
              'Specify representative queries, plan evidence, write/storage budget, and observation window.',
              'Define rollback triggers and account for statistics resets and rare jobs before removing an index.',
            ], ['A one-page experiment contract with measurable acceptance thresholds.'],
            ['09-src-pg-indexes', '09-src-hypercore']),
        ]),
    ],
  },

  '10': {
    estimatedMinutes: 180,
    title: 'Exact set analytics with pg_roaringbitmap',
    summary:
      'Model exact integer sets, reason about compression, and design lifecycle-safe bitmap rollups while keeping extension provenance explicit.',
    outcomes: [
      'Distinguish exact bitmap set algebra from approximate distinct sketches.',
      'Use union, intersection, difference, and cardinality to express retention questions.',
      'Evaluate density, integer-domain, and lifecycle constraints before adopting bitmaps.',
      'Identify pg_roaringbitmap as a third-party extension, not TimescaleDB Toolkit.',
    ],
    sources: [
      {
        id: '10-src-repo',
        title: 'pg_roaringbitmap upstream repository',
        url: 'https://github.com/ChenHuajun/pg_roaringbitmap',
        note: 'Third-party upstream project; it is not part of TimescaleDB Toolkit.',
      },
      {
        id: '10-src-pgxn',
        title: 'PGXN roaringbitmap distribution',
        url: 'https://pgxn.org/dist/pg_roaringbitmap/',
        note: 'Third-party PGXN distribution and API reference; not a Tiger Data or Toolkit component.',
      },
      {
        id: '10-src-pg-extensions',
        title: 'PostgreSQL: Packaging Related Objects into an Extension',
        url: 'https://www.postgresql.org/docs/current/extend-extensions.html',
        note: 'Primary PostgreSQL documentation for extension installation and lifecycle.',
      },
    ],
    phases: [
      phase('10-p1', 'Diagnostic: availability and provenance', standardMinutes[0],
        'Verify what the server exposes before writing any bitmap expression.', [
          activity('10-a01', 'diagnostic', 'measured', 'Check installed versus available',
            'Separate deployment availability from installation and provenance.', [
              'Query installed and available extension catalogs without installing anything.',
              'Record explicitly that roaringbitmap is third-party and is not TimescaleDB Toolkit.',
            ], ['A result distinguishing installed_version from default_version.'],
            ['10-src-repo', '10-src-pg-extensions'], {
              sql: `SELECT a.name, a.default_version, e.extversion AS installed_version,
       'third-party; not TimescaleDB Toolkit' AS provenance
FROM pg_available_extensions a
LEFT JOIN pg_extension e ON e.extname = a.name
WHERE a.name = 'roaringbitmap';`,
            }),
        ]),
      phase('10-p2', 'Deep theory: containers and exact algebra', standardMinutes[1],
        'Understand why sorted 32-bit integer sets can switch representations with density.', [
          activity('10-a02', 'theory', 'documented', 'Compression depends on distribution',
            'Avoid universal compression-ratio claims.', [
              'Explain how dense runs and clustered values can compress well while sparse scattered IDs may not.',
              'Contrast exact membership with approximate cardinality sketches that cannot enumerate members.',
            ], ['A comparison covering exactness, membership, mergeability, and distribution sensitivity.'],
            ['10-src-repo', '10-src-pgxn']),
        ]),
      phase('10-p3', 'Guided analysis: retention as set algebra', standardMinutes[2],
        'Translate business language into exact set operators before touching SQL.', [
          activity('10-a03', 'guided-analysis', 'documented', 'Derive the cohort equations',
            'Make retention and churn definitions auditable.', [
              'Define returning as previous AND current and churned as previous AND NOT current.',
              'Define new as current AND NOT previous and reconcile all partitions against union cardinality.',
            ], ['Four equations and one cardinality reconciliation identity.'],
            ['10-src-pgxn']),
        ]),
      phase('10-p4', 'Controlled experiments: density and baseline', standardMinutes[3],
        'Use seeded integer sensor IDs to establish correct answers and inspect extension APIs safely.', [
          activity('10-a04', 'experiment', 'measured', 'Establish the SQL baseline',
            'Create a ground truth for exact distinct sensor membership over aligned daily buckets.', [
              'Compute daily arrays of distinct sensor_id values from readings.',
              'Compare adjacent days manually and retain the output as the bitmap implementation oracle.',
            ], ['Ordered daily integer arrays and their cardinalities.'],
            ['10-src-pg-extensions'], {
              sql: `SELECT date_trunc('day', time) AS day,
       array_agg(DISTINCT sensor_id ORDER BY sensor_id) AS sensor_ids,
       count(DISTINCT sensor_id) AS cardinality
FROM readings
WHERE time >= now() - INTERVAL '4 days'
GROUP BY 1
ORDER BY 1;`,
            }),
          activity('10-a05', 'experiment', 'measured', 'Inspect the installed bitmap API',
            'Avoid assuming function names or signatures across extension versions.', [
              'List roaringbitmap-owned functions from PostgreSQL catalogs.',
              'Match aggregate, scalar set operation, conversion, and cardinality functions to upstream docs.',
            ], ['A version-specific API inventory from the current server.'],
            ['10-src-repo', '10-src-pg-extensions'], {
              sql: `SELECT p.oid::regprocedure AS signature
FROM pg_proc p
JOIN pg_depend d ON d.objid = p.oid AND d.classid = 'pg_proc'::regclass
JOIN pg_extension e ON e.oid = d.refobjid
WHERE e.extname = 'roaringbitmap'
ORDER BY p.oid::regprocedure::text;`,
            }),
        ]),
      phase('10-p5', 'Failure/debug lab: lifecycle mismatch', standardMinutes[4],
        'Diagnose a rollup that becomes irreparable after raw rows expire.', [
          activity('10-a06', 'failure-lab', 'recommendation', 'Retention crossed the refresh horizon',
            'Prevent silent holes when bitmap states outlive their source rows.', [
              'Draw raw-retention, invalidation, refresh-policy, and bitmap-rollup windows on one timeline.',
              'Show why deleting raw rows before all affected bitmap buckets are refreshed makes later repair impossible.',
              'Require extension availability and upgrade testing in backup/restore and failover runbooks.',
            ], ['A lifecycle diagram with a safe ordering and one recovery limitation.'],
            ['10-src-pg-extensions', '10-src-repo']),
        ]),
      phase('10-p6', 'Independent exercise: exact daily overlap', standardMinutes[5],
        'Solve the set problem first with standard PostgreSQL as a correctness oracle.', [
          activity('10-a07', 'exercise', 'measured', 'Count adjacent-day returning sensors',
            'Produce a result that a bitmap implementation must exactly match.', [
              'Complete the query by joining adjacent UTC days and counting intersecting sensor IDs.',
              'Explain why summing daily distinct counts cannot produce range-wide distinct membership.',
            ], ['A returning count per adjacent day pair and a short non-additivity proof.'],
            ['10-src-pgxn'], {
              starterSql: `WITH daily AS (SELECT date_trunc('day', time) AS day, /* set */ FROM readings GROUP BY 1)
SELECT /* adjacent overlap */ FROM daily;`,
              hint: 'Use arrays only as an oracle: expand both with unnest and intersect them.',
              solution: `WITH daily AS (
  SELECT date_trunc('day', time) AS day,
         array_agg(DISTINCT sensor_id) AS ids
  FROM readings
  WHERE time >= now() - INTERVAL '4 days'
  GROUP BY 1
), pairs AS (
  SELECT day, ids, lag(ids) OVER (ORDER BY day) AS prev_ids FROM daily
)
SELECT day,
       (SELECT count(*) FROM (
          SELECT unnest(ids) INTERSECT SELECT unnest(prev_ids)
        ) x) AS returning
FROM pairs
WHERE prev_ids IS NOT NULL
ORDER BY day;`,
            }),
        ]),
      phase('10-p7', 'Production scenario: audience rollups', standardMinutes[6],
        'Design an exact audience system without hiding operational constraints.', [
          activity('10-a08', 'scenario', 'recommendation', 'Choose bitmap granularity and ownership',
            'Balance query flexibility, storage, refresh cost, and data deletion obligations.', [
              'Choose an aligned bucket size from the smallest supported query window and measured event volume.',
              'Define integer ID assignment, deletion semantics, rebuild source, and maximum supported union range.',
              'Benchmark dense and sparse real cohorts rather than extrapolating from consecutive integers.',
            ], ['A design covering bucket grain, ID domain, erasure, rebuild, and benchmark cases.'],
            ['10-src-repo', '10-src-pgxn', '10-src-pg-extensions']),
        ]),
      phase('10-p8', 'Closed-book assessment', standardMinutes[7],
        'Test exactness, provenance, and lifecycle understanding.', [
          activity('10-a09', 'assessment', 'documented', 'Bitmap readiness exam',
            'Verify the learner can reject unsafe or inaccurate claims.', [
              'Answer whether roaring membership is approximate and whether random UUIDs are a direct input.',
              'Name the extension provenance and explain why Toolkit documentation is not its API authority.',
              'State the raw-retention precondition for repairable bitmap aggregates.',
            ], ['Answers include exact, integer mapping, third-party, and refresh-before-delete.'],
            ['10-src-repo', '10-src-pgxn', '10-src-pg-extensions']),
        ]),
      phase('10-p9', 'Review and transfer', standardMinutes[8],
        'Package the method into a reusable adoption checklist.', [
          activity('10-a10', 'review', 'recommendation', 'Approve or reject the extension',
            'Make adoption an evidence-based operational decision.', [
              'Score availability, upgrade path, replica support, backup restore, observed density, and query savings.',
              'Reject adoption if exact member sets are unnecessary or lifecycle ownership is undefined.',
            ], ['A signed decision record with explicit reject conditions.'],
            ['10-src-repo', '10-src-pg-extensions']),
        ]),
    ],
  },

  '11': {
    estimatedMinutes: 180,
    title: 'Continuous aggregate invalidations and late data',
    summary:
      'Reason precisely about materialized buckets, invalidation ranges, refresh windows, watermarks, and late-arrival service levels.',
    outcomes: [
      'Explain why real-time aggregation does not repair historical data behind the watermark.',
      'Align manual refresh bounds to complete aggregate buckets.',
      'Choose policy offsets from measured lateness rather than a fixed rule of thumb.',
      'Diagnose invalidation coverage without assuming every broad refresh recomputes every bucket.',
    ],
    sources: [
      {
        id: '11-src-refresh',
        title: 'Tiger Data: Refresh continuous aggregates',
        url: 'https://docs.tigerdata.com/use-timescale/latest/continuous-aggregates/refresh-policies/',
        note: 'Official guidance for refresh policies, offsets, and refresh windows.',
      },
      {
        id: '11-src-api-refresh',
        title: 'Tiger Data API: refresh_continuous_aggregate',
        url: 'https://docs.tigerdata.com/api/latest/continuous-aggregates/refresh_continuous_aggregate/',
        note: 'Official API semantics, including complete buckets contained in the refresh window.',
      },
      {
        id: '11-src-realtime',
        title: 'Tiger Data: Real-time aggregates',
        url: 'https://docs.tigerdata.com/use-timescale/latest/continuous-aggregates/real-time-aggregates/',
        note: 'Official description of combining materialized history with recent raw data.',
      },
    ],
    phases: [
      phase('11-p1', 'Diagnostic: map aggregate state', standardMinutes[0],
        'Inventory aggregates and policies before reasoning about freshness.', [
          activity('11-a01', 'diagnostic', 'measured', 'Read the supported information views',
            'Establish bucket width, materialized-only mode, and attached jobs.', [
              'Query continuous aggregate definitions and job schedules without using private catalogs.',
              'Identify which facts are supported API and which would require version-specific internals.',
            ], ['An aggregate/job inventory or an explicit empty-state result.'],
            ['11-src-refresh'], {
              sql: `SELECT view_schema, view_name, materialized_only, compression_enabled,
       materialization_hypertable_schema, materialization_hypertable_name
FROM timescaledb_information.continuous_aggregates
ORDER BY view_schema, view_name;

SELECT job_id, proc_name, schedule_interval, config
FROM timescaledb_information.jobs
WHERE proc_name LIKE '%continuous_aggregate%'
ORDER BY job_id;`,
            }),
        ]),
      phase('11-p2', 'Deep theory: three moving boundaries', standardMinutes[1],
        'Separate event time, invalidated materialized ranges, and refresh coverage.', [
          activity('11-a02', 'theory', 'documented', 'Watermark is not a lateness guarantee',
            'Prevent confusion between live-tail freshness and historical correction.', [
              'Draw materialized history, watermark, and real-time raw tail on an event-time axis.',
              'Place a late row behind the watermark and explain why the real-time union does not reread it.',
              'Explain that invalidation records changes while a refresh window determines eligible complete buckets.',
            ], ['A diagram correctly placing the late row behind the watermark.'],
            ['11-src-realtime', '11-src-api-refresh']),
        ]),
      phase('11-p3', 'Guided analysis: align windows to buckets', standardMinutes[2],
        'Calculate the exact buckets eligible for a requested refresh.', [
          activity('11-a03', 'guided-analysis', 'documented', 'Contain complete buckets',
            'Avoid partial-boundary refresh assumptions.', [
              'For a one-hour bucket, map an unaligned [10:17, 12:42) request to complete contained buckets.',
              'Explain why the correct operational response is to deliberately align or pad bounds.',
            ], ['A half-open interval diagram showing only complete eligible buckets.'],
            ['11-src-api-refresh']),
        ]),
      phase('11-p4', 'Controlled experiments: lateness and boundaries', standardMinutes[3],
        'Use seeded data to measure coverage and generate aligned candidate windows without writes.', [
          activity('11-a04', 'experiment', 'measured', 'Measure seeded time coverage',
            'Ground refresh reasoning in actual min/max event times and chunk bounds.', [
              'Compare reading bounds with chunk bounds for the newest five chunks.',
              'Identify partial edge chunks and avoid equating chunk boundaries with aggregate buckets.',
            ], ['A table annotating full and partial data coverage.'],
            ['11-src-refresh'], {
              sql: `SELECT c.range_start, c.range_end,
       min(r.time) AS first_row, max(r.time) AS last_row, count(r.*) AS rows
FROM timescaledb_information.chunks c
LEFT JOIN readings r
  ON r.time >= c.range_start AND r.time < c.range_end
WHERE c.hypertable_name = 'readings'
GROUP BY c.range_start, c.range_end
ORDER BY c.range_start DESC
LIMIT 5;`,
            }),
          activity('11-a05', 'experiment', 'measured', 'Compute aligned repair bounds',
            'Turn a detected late-event range into safe one-hour refresh arguments.', [
              'Bucket the minimum and maximum event times to one-hour boundaries.',
              'Advance the upper bound by one bucket so the final affected bucket is completely contained.',
            ], ['Start and exclusive end timestamps suitable for a described manual refresh.'],
            ['11-src-api-refresh'], {
              sql: `WITH affected AS (
  SELECT min(time) AS min_time, max(time) AS max_time
  FROM readings
  WHERE sensor_id = 7
    AND time >= now() - INTERVAL '4 days'
    AND time < now() - INTERVAL '2 days'
)
SELECT time_bucket('1 hour', min_time) AS refresh_start,
       time_bucket('1 hour', max_time) + INTERVAL '1 hour' AS refresh_end
FROM affected;`,
            }),
        ]),
      phase('11-p5', 'Failure/debug lab: stale history', standardMinutes[4],
        'Diagnose a dashboard mismatch after a three-day-late shipment.', [
          activity('11-a06', 'failure-lab', 'recommendation', 'Real-time mode did not fix it',
            'Choose the repair that actually covers historical invalidations.', [
              'Verify raw and aggregate predicates use identical half-open bounds and bucket timezone semantics.',
              'Locate the affected buckets relative to the watermark and policy start_offset.',
              'Describe a targeted aligned refresh; do not emit executable CALL or DDL in this curriculum.',
            ], ['A diagnosis naming historical invalidation coverage, not real-time aggregation, as the issue.'],
            ['11-src-realtime', '11-src-api-refresh']),
        ]),
      phase('11-p6', 'Independent exercise: lateness service level', standardMinutes[5],
        'Derive a policy input from a measurable proxy while acknowledging its limitations.', [
          activity('11-a07', 'exercise', 'measured', 'Quantify fleet recency',
            'Practice percentile reasoning before production adds ingested_at.', [
              'Complete the query to compute each sensor latest event and its age.',
              'Explain why true lateness requires both event time and ingestion time.',
            ], ['Per-sensor age values and a statement that they are not true arrival latency.'],
            ['11-src-refresh'], {
              starterSql: `SELECT sensor_id, /* latest event and age */ FROM readings GROUP BY sensor_id;`,
              hint: 'Use max(time) and now() - max(time).',
              solution: `SELECT sensor_id, max(time) AS latest_event, now() - max(time) AS age
FROM readings
GROUP BY sensor_id
ORDER BY age DESC, sensor_id;`,
            }),
        ]),
      phase('11-p7', 'Production scenario: two repair lanes', standardMinutes[6],
        'Design normal refresh and exceptional backfill handling as separate controls.', [
          activity('11-a08', 'scenario', 'recommendation', 'Policy lane plus targeted repair lane',
            'Balance routine cost with correctness for rare old arrivals.', [
              'Set routine start_offset from a measured lateness percentile plus an explicit safety margin.',
              'Route older arrivals to a targeted, bucket-aligned refresh workflow with idempotency and audit logging.',
              'Ensure retention never removes raw data before its final correction opportunity.',
            ], ['A runbook with normal, exceptional, and irrecoverable-age paths.'],
            ['11-src-refresh', '11-src-api-refresh']),
        ]),
      phase('11-p8', 'Closed-book assessment', standardMinutes[7],
        'Test boundary and invalidation reasoning.', [
          activity('11-a09', 'assessment', 'documented', 'Refresh semantics exam',
            'Verify the learner can reason without slogans.', [
              'Explain why a broad requested range need not imply every bucket is recomputed.',
              'Explain why unaligned bounds can exclude partial edge buckets.',
              'Explain why end_offset need not universally equal one whole bucket.',
            ], ['Answers mention invalidations, complete contained buckets, and workload-specific offsets.'],
            ['11-src-refresh', '11-src-api-refresh']),
        ]),
      phase('11-p9', 'Review and transfer', standardMinutes[8],
        'Create observability requirements for aggregate correctness.', [
          activity('11-a10', 'review', 'recommendation', 'Define freshness SLO evidence',
            'Move from configuration to monitored guarantees.', [
              'Specify raw-versus-rollup reconciliation samples, job failure alerts, and late-arrival percentiles.',
              'Document bucket timezone/alignment and maximum repairable event age.',
            ], ['An SLO sheet containing measures, thresholds, owners, and repair action.'],
            ['11-src-refresh', '11-src-realtime']),
        ]),
    ],
  },

  '12': {
    estimatedMinutes: 180,
    title: 'Schema shape, cardinality, and columnar grouping',
    summary:
      'Choose wide or narrow facts, dimension placement, segmentby, and orderby from measured workload and compression behavior.',
    outcomes: [
      'Distinguish a logical segment group from the physical compressed batches it may span.',
      'Quantify candidate cardinality and skew per chunk.',
      'Evaluate wide, narrow, and selectively denormalized schemas against query and history needs.',
      'Design a reversible segmentby experiment instead of applying a universal threshold.',
    ],
    sources: [
      {
        id: '12-src-hypercore',
        title: 'Tiger Data: Hypercore',
        url: 'https://docs.tigerdata.com/use-timescale/latest/hypercore/',
        note: 'Official overview of rowstore/columnstore operation and time-series storage.',
      },
      {
        id: '12-src-columnstore',
        title: 'Tiger Data: About the columnstore',
        url: 'https://docs.tigerdata.com/use-timescale/latest/hypercore/',
        note: 'Official columnstore documentation for segmentby and orderby concepts.',
      },
      {
        id: '12-src-schema',
        title: 'Tiger Data: Schema management',
        url: 'https://docs.tigerdata.com/use-timescale/latest/schema-management/',
        note: 'Official guidance for time-series schema design and relational modeling.',
      },
    ],
    phases: [
      phase('12-p1', 'Diagnostic: profile the seeded facts', standardMinutes[0],
        'Measure row counts, cardinality, skew, nullability, and time span before redesign.', [
          activity('12-a01', 'diagnostic', 'measured', 'Build the schema profile',
            'Expose the facts that constrain shape and grouping decisions.', [
              'Compute per-sensor row counts and compare maximum to minimum for skew.',
              'Record null rates and distinct counts for candidate dimensions.',
            ], ['A compact profile with rows/value, skew, and null fractions.'],
            ['12-src-schema'], {
              sql: `SELECT count(*) AS rows,
       count(DISTINCT sensor_id) AS sensors,
       round(count(*)::numeric / count(DISTINCT sensor_id), 1) AS rows_per_sensor,
       round(100.0 * count(*) FILTER (WHERE humidity IS NULL) / count(*), 2) AS humidity_null_pct,
       min(time) AS first_time, max(time) AS last_time
FROM readings;`,
            }),
        ]),
      phase('12-p2', 'Deep theory: groups are not batches', standardMinutes[1],
        'Use precise physical vocabulary for Hypercore design.', [
          activity('12-a02', 'theory', 'documented', 'Segment grouping and batch formation',
            'Prevent faulty estimates based on treating two layers as identical.', [
              'Define segmentby as logical grouping by equal key values inside a chunk.',
              'Explain that one segment group can span multiple compressed batches, each carrying metadata.',
              'Explain orderby locality within groups and why high cardinality can create tiny groups.',
            ], ['A diagram with chunk -> segment groups -> one or more batches.'],
            ['12-src-columnstore']),
        ]),
      phase('12-p3', 'Guided analysis: wide, narrow, or dimensioned', standardMinutes[2],
        'Evaluate schema shapes against the seeded sensor workload.', [
          activity('12-a03', 'guided-analysis', 'recommendation', 'Choose shape by question',
            'Avoid treating wide or narrow as a universal best practice.', [
              'Compare row amplification, type safety, pivot cost, and metric evolution for wide and narrow facts.',
              'Compare normalized sensor metadata with denormalized historical snapshots when attributes can change.',
            ], ['A decision matrix tied to three concrete query patterns.'],
            ['12-src-schema']),
        ]),
      phase('12-p4', 'Controlled experiments: cardinality and skew', standardMinutes[3],
        'Generate read-only evidence for potential segment keys.', [
          activity('12-a04', 'experiment', 'measured', 'Measure candidates per chunk',
            'Avoid global cardinality hiding chunk-local behavior.', [
              'Calculate distinct sensor IDs and rows per value for each chunk.',
              'Compare chunks and flag incomplete edge chunks separately.',
            ], ['A chunk-level distribution table.'],
            ['12-src-columnstore'], {
              sql: `SELECT c.range_start, c.range_end,
       count(r.*) AS rows,
       count(DISTINCT r.sensor_id) AS distinct_sensors,
       round(count(r.*)::numeric / NULLIF(count(DISTINCT r.sensor_id), 0), 1) AS rows_per_value
FROM timescaledb_information.chunks c
LEFT JOIN readings r ON r.time >= c.range_start AND r.time < c.range_end
WHERE c.hypertable_name = 'readings'
GROUP BY c.range_start, c.range_end
ORDER BY c.range_start DESC
LIMIT 8;`,
            }),
          activity('12-a05', 'experiment', 'measured', 'Measure dimension fanout',
            'Understand join selectivity and repeated metadata storage avoided by normalization.', [
              'Join readings to sensors and count rows by site and model.',
              'Identify whether site or model is selective enough for dominant equality filters.',
            ], ['Site/model counts and percentages, not just distinct totals.'],
            ['12-src-schema'], {
              sql: `SELECT s.site, s.model, count(*) AS readings,
       round(100.0 * count(*) / sum(count(*)) OVER (), 2) AS pct
FROM readings r
JOIN sensors s USING (sensor_id)
GROUP BY s.site, s.model
ORDER BY readings DESC, s.site, s.model;`,
            }),
        ]),
      phase('12-p5', 'Failure/debug lab: unique segment key', standardMinutes[4],
        'Explain why segmenting by a request ID can enlarge columnar storage.', [
          activity('12-a06', 'failure-lab', 'documented', 'One-row segment groups',
            'Diagnose metadata overhead and lost compression opportunity.', [
              'Trace how a nearly unique key fragments equal-value groups before batching.',
              'Distinguish the segment-group problem from any fixed batch-size claim.',
              'Propose bloom sparse metadata for supported equality lookup workloads, subject to measurement.',
            ], ['A causal explanation ending in a reversible alternative experiment.'],
            ['12-src-columnstore']),
        ]),
      phase('12-p6', 'Independent exercise: dimension history', standardMinutes[5],
        'Detect where current metadata may not represent historical truth.', [
          activity('12-a07', 'exercise', 'measured', 'Audit installed-at consistency',
            'Use the seeded schema to practice temporal dimension reasoning.', [
              'Complete a query finding readings earlier than their sensor installation date.',
              'Explain how a mutable site attribute would require effective dating or fact-level snapshotting.',
            ], ['An anomaly count per sensor and a history-preservation recommendation.'],
            ['12-src-schema'], {
              starterSql: `SELECT s.sensor_id, /* anomaly count */ FROM sensors s JOIN readings r USING (sensor_id) GROUP BY 1;`,
              hint: 'Use FILTER where r.time::date < s.installed_at.',
              solution: `SELECT s.sensor_id,
       count(*) FILTER (WHERE r.time::date < s.installed_at) AS pre_install_readings
FROM sensors s
JOIN readings r USING (sensor_id)
GROUP BY s.sensor_id
ORDER BY s.sensor_id;`,
            }),
        ]),
      phase('12-p7', 'Production scenario: multi-tenant telemetry', standardMinutes[6],
        'Design for tenant isolation, device queries, metric evolution, and historical metadata.', [
          activity('12-a08', 'scenario', 'recommendation', 'Choose a schema with migration room',
            'Make workload tradeoffs explicit before conversion.', [
              'Keep stable frequently queried measures wide and place genuinely dynamic attributes in a controlled extension model.',
              'Evaluate tenant_id versus device_id as segmentby using per-chunk repetition, skew, and equality-filter frequency.',
              'Define orderby from range and latest-row queries, then validate compression and plans on a representative copy.',
            ], ['A proposed schema plus rejected alternative and migration/rollback plan.'],
            ['12-src-hypercore', '12-src-columnstore', '12-src-schema']),
        ]),
      phase('12-p8', 'Closed-book assessment', standardMinutes[7],
        'Test physical and relational modeling concepts.', [
          activity('12-a09', 'assessment', 'documented', 'Schema design exam',
            'Verify precise reasoning about cardinality and history.', [
              'Explain segment groups versus batches in one paragraph.',
              'Name two cases favoring wide shape and two favoring narrow shape.',
              'Explain why a near-unique equality key is usually a poor segmentby candidate.',
            ], ['Answers mention multiple batches per group, row amplification, and metadata overhead.'],
            ['12-src-columnstore', '12-src-schema']),
        ]),
      phase('12-p9', 'Review and transfer', standardMinutes[8],
        'Turn schema design into an iterative measurement loop.', [
          activity('12-a10', 'review', 'recommendation', 'Write the conversion scorecard',
            'Prevent compression ratio from becoming the only success measure.', [
              'Include storage ratio, ingest cost, key query plans, batch pruning, and operational conversion time.',
              'Set thresholds and a rollback route before changing production chunks.',
            ], ['A scorecard balancing storage, latency, writes, and operability.'],
            ['12-src-hypercore', '12-src-columnstore']),
        ]),
    ],
  },

  '13': {
    estimatedMinutes: 180,
    title: 'Two-step analytics and approximation boundaries',
    summary:
      'Use Toolkit states for downsampling, state duration, heartbeat coverage, candlesticks, and time-weighted integration with explicit semantic boundaries.',
    outcomes: [
      'Explain accessor, aggregate-state, and rollup layers in two-step aggregation.',
      'Treat LTTB resolution as approximate rather than an exact output-count guarantee.',
      'Define state_agg interval-edge semantics and heartbeat_agg liveness assumptions.',
      'Validate hyperfunction answers against small plain-SQL or visual oracles.',
    ],
    sources: [
      {
        id: '13-src-toolkit',
        title: 'Tiger Data Toolkit hyperfunctions API',
        url: 'https://docs.tigerdata.com/api/latest/hyperfunctions/',
        note: 'Official API index for Toolkit hyperfunctions and stabilization status.',
      },
      {
        id: '13-src-lttb',
        title: 'Tiger Data API: lttb',
        url: 'https://www.tigerdata.com/docs/reference/toolkit/downsampling/lttb',
        note: 'Official LTTB signature, timevector output, and resolution semantics.',
      },
      {
        id: '13-src-state',
        title: 'Tiger Data API: state_agg',
        url: 'https://docs.tigerdata.com/api/latest/hyperfunctions/state-tracking/state_agg/',
        note: 'Official state timeline aggregate and accessor semantics.',
      },
      {
        id: '13-src-heartbeat',
        title: 'Tiger Data API: heartbeat_agg',
        url: 'https://docs.tigerdata.com/api/latest/hyperfunctions/state-tracking/heartbeat_agg/',
        note: 'Official heartbeat window, liveness interval, uptime, and downtime semantics.',
      },
    ],
    phases: [
      phase('13-p1', 'Diagnostic: extensions and data fitness', standardMinutes[0],
        'Verify Toolkit presence and sampling properties before choosing a hyperfunction.', [
          activity('13-a01', 'diagnostic', 'measured', 'Check Toolkit and cadence',
            'Separate function availability from whether the data supports its assumptions.', [
              'Read installed Toolkit version and sensor cadence statistics.',
              'Flag null values and the seeded sensor 7 outage as distinct semantic cases.',
            ], ['Version, median/maximum observed gap proxy, and null count.'],
            ['13-src-toolkit'], {
              sql: `SELECT extname, extversion
FROM pg_extension
WHERE extname = 'timescaledb_toolkit';

WITH gaps AS (
  SELECT sensor_id, time - lag(time) OVER (PARTITION BY sensor_id ORDER BY time) AS gap
  FROM readings
  WHERE time >= now() - INTERVAL '5 days'
)
SELECT sensor_id, max(gap) AS max_gap
FROM gaps
GROUP BY sensor_id
ORDER BY max_gap DESC, sensor_id;`,
            }),
        ]),
      phase('13-p2', 'Deep theory: states and accessors', standardMinutes[1],
        'Understand why storing a mergeable summary preserves more choices than storing one final scalar.', [
          activity('13-a02', 'theory', 'documented', 'Aggregate, roll up, access',
            'Recognize which Toolkit objects support hierarchical analysis.', [
              'Separate the state-building aggregate from accessors such as duration_in or uptime.',
              'Verify a rollup function exists for a state before promising hierarchical aggregation.',
              'Keep LTTB separate: it returns a downsampled timevector and is not the same state-rollup pattern.',
            ], ['A component diagram and a per-function rollup support table.'],
            ['13-src-toolkit', '13-src-lttb', '13-src-state', '13-src-heartbeat']),
        ]),
      phase('13-p3', 'Guided analysis: semantic contracts', standardMinutes[2],
        'Define what a row means before computing duration or liveness.', [
          activity('13-a03', 'guided-analysis', 'recommendation', 'Event state versus heartbeat',
            'Prevent plausible but incorrect uptime reports.', [
              'For state_agg, define whether each event changes state and how observation-window edges are treated.',
              'For heartbeat_agg, define aggregate start, duration, and tolerated liveness interval.',
              'Explain that a missing heartbeat means inferred downtime only under that contract.',
            ], ['Two explicit semantic contracts with edge behavior.'],
            ['13-src-state', '13-src-heartbeat']),
        ]),
      phase('13-p4', 'Controlled experiments: approximation and outages', standardMinutes[3],
        'Measure LTTB output and the seeded outage instead of asserting invariants.', [
          activity('13-a04', 'experiment', 'measured', 'Test multiple LTTB resolutions',
            'Observe that resolution is a target and quality parameter, not an exact row-count promise.', [
              'Run resolutions 25, 50, and 100 over the same sensor/window.',
              'Record output counts and sampled versus raw extrema without requiring equality.',
            ], ['A table of requested resolution, returned points, and extrema error.'],
            ['13-src-lttb'], {
              sql: `WITH requested(resolution) AS (VALUES (25), (50), (100))
SELECT resolution,
       (SELECT count(*) FROM unnest((
          SELECT lttb(time, temperature, resolution)
          FROM readings
          WHERE sensor_id = 1 AND time >= now() - INTERVAL '2 days'
       ))) AS returned_points
FROM requested
ORDER BY resolution;`,
            }),
          activity('13-a05', 'experiment', 'measured', 'Locate the raw outage oracle',
            'Validate heartbeat results against observed inter-arrival gaps.', [
              'Use lag to find sensor 7 gaps larger than five minutes.',
              'Distinguish the six-hour middle gap from observation-window edge treatment.',
            ], ['A raw gap list suitable for checking dead_ranges.'],
            ['13-src-heartbeat'], {
              sql: `WITH ordered AS (
  SELECT time, lag(time) OVER (ORDER BY time) AS previous_time
  FROM readings
  WHERE sensor_id = 7 AND time >= now() - INTERVAL '5 days'
)
SELECT previous_time, time, time - previous_time AS observed_gap
FROM ordered
WHERE time - previous_time > INTERVAL '5 minutes'
ORDER BY previous_time;`,
            }),
        ]),
      phase('13-p5', 'Failure/debug lab: false precision', standardMinutes[4],
        'Debug reports that confuse sampled shape, state duration, and heartbeat coverage.', [
          activity('13-a06', 'failure-lab', 'documented', 'Three semantic overclaims',
            'Replace technically invalid guarantees with testable statements.', [
              'Reject the claim that LTTB always returns exactly resolution points or preserves every extreme.',
              'Reject state duration calculations that omit observation-window edge assumptions.',
              'Reject uptime claims whose heartbeat liveness interval was chosen without service semantics.',
            ], ['Corrected language and one validation method for each overclaim.'],
            ['13-src-lttb', '13-src-state', '13-src-heartbeat']),
        ]),
      phase('13-p6', 'Independent exercise: state transition oracle', standardMinutes[5],
        'Build a plain-SQL transition list before trusting an aggregate state.', [
          activity('13-a07', 'exercise', 'measured', 'Find battery state changes',
            'Validate the input event sequence for state_agg.', [
              'Complete the query to classify battery as ok or low and retain only changes.',
              'Explain how the first and last observations affect a requested three-day duration.',
            ], ['An ordered transition list and an edge-semantics note.'],
            ['13-src-state'], {
              starterSql: `WITH states AS (SELECT time, /* state and previous state */ FROM readings WHERE sensor_id = 4)
SELECT * FROM states WHERE /* changed */;`,
              hint: 'Compute state in one CTE, then lag(state) in a second CTE.',
              solution: `WITH classified AS (
  SELECT time, CASE WHEN battery > 75 THEN 'ok' ELSE 'low' END AS state
  FROM readings
  WHERE sensor_id = 4 AND time >= now() - INTERVAL '3 days'
), transitions AS (
  SELECT time, state, lag(state) OVER (ORDER BY time) AS previous_state
  FROM classified
)
SELECT time, state, previous_state
FROM transitions
WHERE previous_state IS DISTINCT FROM state
ORDER BY time;`,
            }),
        ]),
      phase('13-p7', 'Production scenario: telemetry dashboard', standardMinutes[6],
        'Combine chart, incident, duration, and energy requirements without conflating semantics.', [
          activity('13-a08', 'scenario', 'recommendation', 'Choose one state per question',
            'Design auditable derived metrics for different consumers.', [
              'Use LTTB for display and retain raw extrema alerts separately.',
              'Use state_agg for explicit state-change duration and heartbeat_agg for inferred communications coverage.',
              'Use time_weight/integral only after selecting interpolation semantics appropriate to the signal.',
            ], ['A metric contract naming source rows, state, accessor, edge rules, and validation oracle.'],
            ['13-src-toolkit', '13-src-lttb', '13-src-state', '13-src-heartbeat']),
        ]),
      phase('13-p8', 'Closed-book assessment', standardMinutes[7],
        'Test approximation and state semantics.', [
          activity('13-a09', 'assessment', 'documented', 'Hyperfunction semantics exam',
            'Verify the learner knows what each result can and cannot claim.', [
              'Contrast LTTB resolution with an exact LIMIT.',
              'Contrast state_agg state changes with heartbeat_agg inferred liveness.',
              'Explain why storing a supported aggregate state can preserve later accessor choices.',
            ], ['Answers include approximate resolution, explicit state, inferred coverage, and rollup verification.'],
            ['13-src-toolkit', '13-src-lttb', '13-src-state', '13-src-heartbeat']),
        ]),
      phase('13-p9', 'Review and transfer', standardMinutes[8],
        'Create a repeatable verification protocol for analytics states.', [
          activity('13-a10', 'review', 'recommendation', 'Validate before materializing',
            'Keep incorrect semantics out of long-lived aggregates.', [
              'Test a tiny hand-checkable interval, nulls, duplicate timestamps, long gaps, and boundary events.',
              'Record extension version and API stability, then compare state accessors with raw SQL oracles.',
            ], ['A versioned test matrix covering normal and adversarial inputs.'],
            ['13-src-toolkit']),
        ]),
    ],
  },

  '14': {
    estimatedMinutes: 180,
    title: 'Forensic query-plan reading',
    summary:
      'Read plans inside out, quantify estimation error, interpret inclusive timing, and compare I/O only with cache conditions disclosed.',
    outcomes: [
      'Distinguish estimated costs from actual execution measurements.',
      'Interpret actual rows and inclusive node times together with loops.',
      'Use BUFFERS without treating hit/read values as cache-independent.',
      'Diagnose statistics, filtering, chunk exclusion, and join strategy before prescribing indexes.',
    ],
    sources: [
      {
        id: '14-src-explain',
        title: 'PostgreSQL: Using EXPLAIN',
        url: 'https://www.postgresql.org/docs/current/using-explain.html',
        note: 'Primary PostgreSQL guide to plan trees, estimates, actuals, loops, and scan choices.',
      },
      {
        id: '14-src-sql-explain',
        title: 'PostgreSQL SQL command: EXPLAIN',
        url: 'https://www.postgresql.org/docs/current/sql-explain.html',
        note: 'Primary option reference for ANALYZE, BUFFERS, TIMING, WAL, SETTINGS, and formats.',
      },
      {
        id: '14-src-stats',
        title: 'PostgreSQL: Planner statistics',
        url: 'https://www.postgresql.org/docs/current/planner-stats.html',
        note: 'Primary documentation for single-column and extended statistics.',
      },
      {
        id: '14-src-timescale-explain',
        title: 'Tiger Data: Analyze your hypertable',
        url: 'https://docs.tigerdata.com/use-timescale/latest/query-data/',
        note: 'Official Tiger Data guidance for EXPLAIN on hypertables and chunk-aware plans.',
      },
    ],
    phases: [
      phase('14-p1', 'Diagnostic: capture a reproducible plan', standardMinutes[0],
        'Record server, relation, and statistics context before interpreting one plan.', [
          activity('14-a01', 'diagnostic', 'measured', 'Baseline the planner context',
            'Make plan evidence reproducible enough to compare.', [
              'Capture PostgreSQL/TimescaleDB versions, relation estimates, and last analyze times.',
              'State the time window and session settings; avoid changing planner switches.',
            ], ['A context record attached to the plan.'],
            ['14-src-stats', '14-src-timescale-explain'], {
              sql: `SELECT current_setting('server_version') AS postgres_version,
       (SELECT extversion FROM pg_extension WHERE extname = 'timescaledb') AS timescaledb_version;

SELECT relname, n_live_tup, last_analyze, last_autoanalyze
FROM pg_stat_user_tables
WHERE relname = 'readings';`,
            }),
        ]),
      phase('14-p2', 'Deep theory: tree accounting', standardMinutes[1],
        'Understand plan execution order, per-loop rows, and inclusive timing.', [
          activity('14-a02', 'theory', 'documented', 'Inclusive time is not self time',
            'Prevent double-counting and false hotspot attribution.', [
              'Read from the most indented child toward the root while recognizing pipelines and loops.',
              'Multiply actual rows by loops when total row production is needed.',
              'Treat a parent actual time as inclusive of child work; do not sum node times as independent costs.',
            ], ['An annotated plan with total row production and no summed inclusive times.'],
            ['14-src-explain', '14-src-sql-explain']),
        ]),
      phase('14-p3', 'Guided analysis: estimates before indexes', standardMinutes[2],
        'Use cardinality errors to decide whether statistics are the first intervention.', [
          activity('14-a03', 'guided-analysis', 'recommendation', 'Find the first bad estimate',
            'Trace where planner understanding diverges from execution.', [
              'Compare estimated and actual rows at each executed node, accounting for loops and LIMIT short-circuiting.',
              'Investigate stale statistics, skew, correlation, or opaque expressions before adding an index.',
            ], ['A first-divergence diagnosis with a statistics-oriented next test.'],
            ['14-src-explain', '14-src-stats']),
        ]),
      phase('14-p4', 'Controlled experiments: pruning and cache', standardMinutes[3],
        'Run safe read-only plans while disclosing cache dependence.', [
          activity('14-a04', 'experiment', 'measured', 'Measure chunk exclusion',
            'Compare a bounded and unbounded aggregate with actual work.', [
              'Run both plans with BUFFERS and TIMING OFF to reduce timing overhead.',
              'Count child scans, actual rows, rows removed, and logical buffers rather than relying on elapsed time alone.',
            ], ['Two plans with a work-accounting table.'],
            ['14-src-sql-explain', '14-src-timescale-explain'], {
              sql: `EXPLAIN (ANALYZE, BUFFERS, COSTS ON, TIMING OFF, SUMMARY ON)
SELECT avg(temperature) FROM readings
WHERE time >= now() - INTERVAL '2 hours';

EXPLAIN (ANALYZE, BUFFERS, COSTS ON, TIMING OFF, SUMMARY ON)
SELECT avg(temperature) FROM readings;`,
            }),
          activity('14-a05', 'experiment', 'measured', 'Repeat and disclose cache state',
            'Show why BUFFERS output and timings depend on prior access.', [
              'Run the same read-only plan at least three times in sequence without claiming the first is a controlled cold cache.',
              'Record shared hit/read, temp, and execution time for each run and disclose intervening workload.',
            ], ['A run table demonstrating that hit/read split can change with cache state.'],
            ['14-src-sql-explain']),
        ]),
      phase('14-p5', 'Failure/debug lab: misleading plan math', standardMinutes[4],
        'Correct common analytical errors in a nested-loop report.', [
          activity('14-a06', 'failure-lab', 'documented', 'Rows, loops, buffers, and time',
            'Stop per-loop and inclusive values from producing false conclusions.', [
              'Correct a report that reads actual rows as a node total when loops is greater than one.',
              'Correct a report that adds parent and child actual times even though parent timing includes child work.',
              'Correct a report that calls shared read physical disk I/O without acknowledging OS cache and instrumentation scope.',
            ], ['A revised report with defensible row and time accounting.'],
            ['14-src-explain', '14-src-sql-explain']),
        ]),
      phase('14-p6', 'Independent exercise: estimate ratios', standardMinutes[5],
        'Practice extracting estimates and actuals from JSON plans.', [
          activity('14-a07', 'exercise', 'measured', 'Compute plan-node error',
            'Make estimation quality quantitative and loop-aware.', [
              'Run the supplied read-only JSON EXPLAIN and inspect Plan Rows, Actual Rows, and Actual Loops.',
              'Compute total actual rows and an estimate ratio while explaining LIMIT caveats.',
            ], ['A numeric ratio and a caveat if execution short-circuited.'],
            ['14-src-sql-explain'], {
              starterSql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT /* bounded readings query */;`,
              hint: 'Use a direct SELECT plan; JSON is returned to the client and needs no helper function.',
              solution: `EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, FORMAT JSON)
SELECT sensor_id, time, temperature
FROM readings
WHERE sensor_id = 5
  AND time >= now() - INTERVAL '1 day'
ORDER BY time DESC
LIMIT 100;`,
            }),
        ]),
      phase('14-p7', 'Production scenario: regression triage', standardMinutes[6],
        'Diagnose a query that slowed after a bulk load without immediately forcing a plan.', [
          activity('14-a08', 'scenario', 'recommendation', 'Triage in causal order',
            'Separate changed data, stale estimates, changed cache, and changed plan.', [
              'Capture old/new SQL, parameters, settings, schema, versions, plan JSON, and data volume.',
              'Check estimate divergence and last ANALYZE before testing index or extended-statistics hypotheses.',
              'Compare repeated buffers and timing under documented cache/workload conditions, then define rollback.',
            ], ['A triage record that identifies evidence for the first causal divergence.'],
            ['14-src-stats', '14-src-explain', '14-src-sql-explain']),
        ]),
      phase('14-p8', 'Closed-book assessment', standardMinutes[7],
        'Test plan accounting and cache interpretation.', [
          activity('14-a09', 'assessment', 'documented', 'Plan forensics exam',
            'Verify the learner can reject misleading claims.', [
              'Explain cost versus actual milliseconds and per-loop rows versus total rows.',
              'Explain inclusive parent timing and why node times cannot simply be summed.',
              'Explain shared hit/read and why BUFFERS comparisons must disclose cache conditions.',
            ], ['Answers include dimensionless cost, rows times loops, inclusive time, and cache dependence.'],
            ['14-src-explain', '14-src-sql-explain']),
        ]),
      phase('14-p9', 'Review and transfer', standardMinutes[8],
        'Adopt a repeatable plan-review protocol.', [
          activity('14-a10', 'review', 'recommendation', 'Write the evidence ladder',
            'Ensure future tuning starts with the most diagnostic facts.', [
              'Order checks as context, estimates, actual rows/loops, filters, chunks, joins, memory/temp, buffers, and timing.',
              'Require before/after plans and a workload-safe rollback for every physical-design change.',
            ], ['A reusable checklist that does not prescribe indexes before diagnosis.'],
            ['14-src-explain', '14-src-stats', '14-src-timescale-explain']),
        ]),
    ],
  },
};
