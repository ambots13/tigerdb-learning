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

const bitmapVocabulary = [
  {
    term: 'set',
    simpleMeaning: 'A collection in which each member appears once.',
    technicalMeaning: 'An unordered collection of distinct values.',
    example: '{1, 2} combined with {2, 3} contains the members {1, 2, 3}.',
  },
  {
    term: 'cardinality',
    simpleMeaning: 'The number of members in a set.',
    technicalMeaning: 'The count of distinct elements in a set or bitmap.',
    example: 'The cardinality of {1, 2, 3} is 3.',
  },
];

const microstep = (action, reason, expectedResult, explanation, troubleshooting) => ({
  action,
  reason,
  expectedResult,
  explanation,
  troubleshooting,
});

const bitmapGuidance = ({
  predictionQuestion,
  predictionChoices,
  steps,
  hints,
  answer,
  explanation,
  template,
  example,
  vocabulary = [],
  prerequisites = ['Complete standard module 10', 'Know SELECT, WHERE, GROUP BY, and common table expressions'],
  commonMistakes,
}) => ({
  prerequisites,
  vocabulary: [...bitmapVocabulary, ...vocabulary],
  beforeYouRun: {
    predictionQuestion,
    predictionChoices,
    explanation: 'Commit to an answer before revealing the result; correcting a prediction is stronger practice than only reading.',
  },
  steps,
  hints: hints.map((text, index) => ({ level: index + 1, text })),
  workedAnswer: {
    answer,
    explanation,
    acceptableVariations: ['Equivalent SQL or wording is acceptable when it proves the same claim.'],
    template,
    example,
  },
  commonMistakes: commonMistakes ?? [{
    symptom: 'You can repeat the answer but cannot explain why it is true.',
    cause: 'The reference answer was read before making and testing a prediction.',
    fix: 'Hide the answer, work through the smallest concrete set example, then explain the result in your own words.',
  }],
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
              ...bitmapGuidance({
                predictionQuestion: 'If roaringbitmap is available but not installed, which version column should be empty?',
                predictionChoices: ['default_version', 'installed_version', 'Both columns'],
                steps: [
                  microstep(
                    'Run the catalog query before installing anything.',
                    'This separates server availability from installation in the current database.',
                    'One row appears; default_version has a value and installed_version may be empty.',
                    'pg_available_extensions describes installable packages; pg_extension contains installed extensions.',
                    'If no row appears, the server image does not provide roaringbitmap. Stop rather than trying bitmap functions.',
                  ),
                  microstep(
                    'Write one sentence naming who provides the extension.',
                    'Operational ownership matters for upgrades, support, and hosted-service availability.',
                    'Your sentence says pg_roaringbitmap is third-party and not TimescaleDB Toolkit.',
                    'The provenance column is a reminder, not proof; verify it against the linked upstream project.',
                    'If the providers are unclear, compare the upstream repository with the installed timescaledb_toolkit extension name.',
                  ),
                ],
                hints: [
                  'Compare what pg_available_extensions and pg_extension are designed to report.',
                  'The LEFT JOIN keeps an available extension even when no installed row exists.',
                  'Look for the column sourced from e.extversion.',
                  'installed_version is empty when available but not installed; pg_roaringbitmap is third-party.',
                ],
                answer: 'default_version proves the package is available; installed_version proves it is installed in this database. pg_roaringbitmap is a third-party extension, not TimescaleDB Toolkit.',
                explanation: 'Availability is a server-level packaging fact, while installation is database-specific.',
                template: '[name] is available at [default_version] and installed at [installed_version or not installed]. Its provider is [provider].',
                example: 'roaringbitmap is available at 1.2 and installed at 1.2. It is provided by the third-party pg_roaringbitmap project.',
                vocabulary: [{
                  term: 'extension',
                  simpleMeaning: 'An add-on that gives PostgreSQL more features.',
                  technicalMeaning: 'A versioned package of database objects managed with CREATE EXTENSION.',
                  example: 'CREATE EXTENSION roaringbitmap installs bitmap types and functions in one database.',
                }],
              }),
            }),
        ]),
      phase('10-p2', 'Deep theory: containers and exact algebra', standardMinutes[1],
        'Understand why sorted 32-bit integer sets can switch representations with density.', [
          activity('10-a02', 'theory', 'documented', 'Compression depends on distribution',
            'Avoid universal compression-ratio claims.', [
              'Explain how dense runs and clustered values can compress well while sparse scattered IDs may not.',
              'Contrast exact membership with approximate cardinality sketches that cannot enumerate members.',
            ], ['A comparison covering exactness, membership, mergeability, and distribution sensitivity.'],
            ['10-src-repo', '10-src-pgxn'], {
              ...bitmapGuidance({
                predictionQuestion: 'Which input should usually compress better: 1,000 consecutive integers or 1,000 random integers spread across a huge range?',
                predictionChoices: ['Consecutive integers', 'Random scattered integers', 'They must be identical'],
                steps: [
                  microstep(
                    'Draw two ten-value examples: one consecutive and one widely scattered.',
                    'A visible example makes “density” concrete before introducing storage internals.',
                    'You have two sets with the same cardinality but different spacing.',
                    'Equal cardinality does not imply equal encoded size.',
                    'If the examples still look alike, use {1..10} and {1, 1001, 2001, ...}.',
                  ),
                  microstep(
                    'Complete a four-column comparison: exactness, membership lookup, mergeability, and distribution sensitivity.',
                    'This prevents confusing a bitmap with an approximate distinct-count sketch.',
                    'The bitmap is exact and enumerable; a cardinality sketch estimates a count and does not retain enumerable membership.',
                    'Both forms can merge, but they preserve different information.',
                    'If “exact” and “approximate” feel abstract, ask whether the structure can return the actual member IDs.',
                  ),
                ],
                hints: [
                  'Start with spacing, not the number of values.',
                  'Ask whether each structure can answer “is ID 42 present?” exactly.',
                  'A bitmap retains members; a sketch is designed primarily to estimate how many distinct values occurred.',
                  'Dense or clustered integers often compress better; roaring bitmaps remain exact, while cardinality sketches trade exact membership for compact estimates.',
                ],
                answer: 'Consecutive or clustered integers usually compress better than equally numerous scattered integers. Roaring bitmaps preserve exact membership and support exact set operations; cardinality sketches merge compact states to estimate counts but cannot enumerate exact members.',
                explanation: 'The comparison separates storage behavior from accuracy and query capability.',
                template: 'For [distribution], I expect [better/worse] compression because [spacing reason]. A bitmap is [exactness/membership]; a sketch is [exactness/membership].',
                example: 'For 1..1000, I expect better compression because the IDs form a dense run. A bitmap is exact and enumerable; a HyperLogLog-style sketch estimates only cardinality.',
              }),
            }),
        ]),
      phase('10-p3', 'Guided analysis: retention as set algebra', standardMinutes[2],
        'Translate business language into exact set operators before touching SQL.', [
          activity('10-a03', 'guided-analysis', 'documented', 'Derive the cohort equations',
            'Make retention and churn definitions auditable.', [
              'Define returning as previous AND current and churned as previous AND NOT current.',
              'Define new as current AND NOT previous and reconcile all partitions against union cardinality.',
            ], ['Four equations and one cardinality reconciliation identity.'],
            ['10-src-pgxn'], {
              ...bitmapGuidance({
                predictionQuestion: 'If previous is {1, 2, 3} and current is {2, 3, 4}, how many users are returning?',
                predictionChoices: ['2', '3', '4'],
                steps: [
                  microstep(
                    'Compute returning, churned, and new members for the two sample sets by hand.',
                    'Small sets expose the direction of each difference operation.',
                    'returning={2,3}, churned={1}, and new={4}.',
                    'Previous minus current is churn; current minus previous is new.',
                    'If the two differences are reversed, say each phrase aloud as “in the first set but not the second.”',
                  ),
                  microstep(
                    'Check two identities: previous=returning+churned and current=returning+new.',
                    'The identities catch swapped operands and double-counting.',
                    'Both sides equal 3 for the sample.',
                    'The partitions are disjoint, so their cardinalities can be added.',
                    'If an identity fails, list the members of each partition and look for a duplicate or missing ID.',
                  ),
                ],
                hints: [
                  'Returning means present on both days.',
                  'AND is intersection; ANDNOT keeps only members from its left operand.',
                  'Use P∩C, P\\C, and C\\P.',
                  'returning=P∩C; churned=P\\C; new=C\\P; |P∪C|=|returning|+|churned|+|new|.',
                ],
                answer: 'For previous P and current C: returning=P AND C, churned=P ANDNOT C, new=C ANDNOT P. Also |P|=|returning|+|churned|, |C|=|returning|+|new|, and |P OR C| is the sum of all three disjoint groups.',
                explanation: 'Writing the set equations before SQL makes operand direction reviewable.',
                template: 'returning=[equation], churned=[equation], new=[equation]. I checked them with [identity].',
                example: 'For P={1,2,3}, C={2,3,4}: returning={2,3}, churned={1}, new={4}; the union cardinality is 2+1+1=4.',
              }),
            }),
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
              ...bitmapGuidance({
                predictionQuestion: 'For the seeded fleet, how many sensor IDs should a complete day normally contain?',
                predictionChoices: ['12', 'One per reading', 'It cannot be checked'],
                steps: [
                  microstep(
                    'Run the array baseline and identify any partial boundary days.',
                    'The first and last UTC days may cover only part of a day even though their member sets are still complete.',
                    'Each returned row has day, an ordered sensor_ids array, and cardinality 12.',
                    'DISTINCT removes repeated readings; ORDER BY inside array_agg makes visual comparison reliable.',
                    'If readings is missing, run npm run seed. If cardinality differs, inspect the actual array instead of assuming the bitmap is wrong.',
                  ),
                  microstep(
                    'Save two adjacent arrays as the correctness oracle for later set operations.',
                    'An implementation should be checked against a simpler representation.',
                    'The two arrays visibly contain the same 12 seeded sensor IDs.',
                    'The oracle establishes exact members, not merely an expected count.',
                    'If arrays are truncated in the UI, run a narrower two-day query or inspect one day at a time.',
                  ),
                ],
                hints: [
                  'The sensors table describes the fleet size.',
                  'Count distinct IDs, not reading rows.',
                  'array_agg(DISTINCT ... ORDER BY ...) gives a readable exact set.',
                  'A normally seeded day contains the ordered IDs 1 through 12 and cardinality 12.',
                ],
                answer: 'The baseline should show one row per UTC day, with sensor_ids {1,...,12} and cardinality 12 for the seeded fleet. Save adjacent rows as the oracle; later bitmap results must match both their count and members.',
                explanation: 'A standard PostgreSQL array is slower and larger here, but it is transparent enough to validate the unfamiliar bitmap representation.',
                template: 'For [day], the oracle members are [array] with cardinality [count]. The adjacent day [matches/differs] by [members].',
                example: 'For 2026-10-29 UTC, the oracle members are {1,...,12}, cardinality 12; the adjacent day has the same members.',
              }),
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
              ...bitmapGuidance({
                predictionQuestion: 'Why inspect function signatures instead of copying names from an article?',
                predictionChoices: ['Installed versions can expose different APIs', 'Function names never change', 'Catalogs only show table names'],
                steps: [
                  microstep(
                    'Run the catalog query and find signatures beginning with rb_build, rb_or, rb_and, and rb_cardinality.',
                    'The installed catalog is the authority for what this database can execute.',
                    'The output lists version-specific function names with argument types.',
                    'regprocedure includes argument types, which distinguishes overloaded functions.',
                    'If no rows appear, confirm roaringbitmap is installed in this database using pg_extension.',
                  ),
                  microstep(
                    'Classify the signatures as builders, aggregate builders, set operators, converters, or counters.',
                    'Classification turns a long catalog list into a usable API map.',
                    'You have at least one signature in each category that the installed version supports.',
                    'Do not infer a missing function from a similarly named function in another extension.',
                    'If a category is unclear, inspect only signatures beginning with rb_ and compare them with the upstream API reference.',
                  ),
                ],
                hints: [
                  'pg_proc stores functions; pg_depend connects extension-owned objects to pg_extension.',
                  'regprocedure prints the function name and its argument types.',
                  'Look for _agg suffixes for aggregates and rb_to_array for conversion.',
                  'Record the installed signatures rather than assuming the course examples apply to every version.',
                ],
                answer: 'Use the extension-owned pg_proc rows as the version-specific inventory. Group rb_build/rb_build_agg as builders, rb_or/rb_and/rb_andnot as set operators, rb_to_array as conversion, and rb_cardinality as counting when those signatures are present.',
                explanation: 'This method remains valid even if a future extension version changes or overloads its API.',
                template: '[category]: [installed signatures]. I verified version [extversion] rather than assuming [external example].',
                example: 'Set operators: rb_and(roaringbitmap,roaringbitmap), rb_or(...), and rb_andnot(...), verified on installed extension 1.2.',
                vocabulary: [{
                  term: 'function signature',
                  simpleMeaning: 'A function name plus the kinds of inputs it accepts.',
                  technicalMeaning: 'The identity of an overloaded PostgreSQL routine, including its argument types.',
                  example: 'rb_and(roaringbitmap,roaringbitmap)',
                }],
              }),
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
            ['10-src-pg-extensions', '10-src-repo'], {
              diagram: {
                title: 'Safe refresh and retention order',
                description: 'Raw rows remain available until accepted late data has arrived and the final aggregate refresh is verified.',
                source: `flowchart LR
  OPEN["Bucket open"] --> LATE["Accept on-time and late events"]
  LATE --> CLOSE["Lateness window closes"]
  CLOSE --> REFRESH["Final bitmap refresh"]
  REFRESH --> VERIFY{"Refresh verified?"}
  VERIFY -->|No| REPAIR["Repair while raw rows still exist"]
  REPAIR --> REFRESH
  VERIFY -->|Yes| DELETE["Raw retention may delete rows"]
  DELETE --> LIMIT["Later repair needs another durable source"]
  classDef safe fill:#173b2a,stroke:#3fb950,color:#e6edf3
  classDef warning fill:#3d2020,stroke:#f85149,color:#e6edf3
  class REFRESH,VERIFY safe
  class DELETE,LIMIT warning`,
              },
              ...bitmapGuidance({
                predictionQuestion: 'Can a deleted raw event be reconstructed from a bitmap that only retained its user ID?',
                predictionChoices: ['No', 'Yes, including its timestamp', 'Always after VACUUM'],
                steps: [
                  microstep(
                    'Draw one left-to-right timeline with raw retention, the last refresh, and bitmap history.',
                    'A shared time axis makes unsafe ordering visible.',
                    'The final refresh of a bucket appears before raw rows for that bucket are deleted.',
                    'A bitmap preserves membership, not every source event or timestamp.',
                    'If the ordering is ambiguous, mark one bucket and label its last possible late arrival, final refresh, and deletion.',
                  ),
                  microstep(
                    'Describe a late correction that arrives after its raw bucket was deleted.',
                    'A failure case tests whether the design is actually repairable.',
                    'Your explanation says the aggregate cannot be rebuilt exactly without another durable source.',
                    'Invalidation can signal that a bucket changed, but it cannot recreate deleted input rows.',
                    'If recovery still sounds possible, name the exact system that retains the missing source events.',
                  ),
                  microstep(
                    'Add extension restore and upgrade checks to the operating sequence.',
                    'Stored roaringbitmap values require the extension on restored or promoted servers.',
                    'The runbook checks extension availability/version before restore, replica promotion, and upgrade.',
                    'Data durability includes the ability to decode and query extension-defined values.',
                    'If the check is vague, write the exact pg_available_extensions and pg_extension queries from activity 1.',
                  ),
                ],
                hints: [
                  'Start with one aggregate bucket, not the entire retention policy.',
                  'Ask what information remains after raw rows are dropped.',
                  'Safe order: accept late data, perform the final refresh, verify it, then delete raw rows.',
                  'After deletion, repair requires another durable raw source; the bitmap cannot reconstruct event timestamps or omitted members.',
                ],
                answer: 'For each bucket, keep raw rows through the accepted lateness window, run and verify a final refresh, then allow retention to delete them. If a correction arrives after deletion, the bitmap cannot be repaired unless another durable event source can replay the bucket. Restore and failover procedures must verify the same extension is available.',
                explanation: 'The answer names both safe ordering and the hard recovery limit.',
                template: '[bucket] remains raw until [condition]. Then [refresh/verification] happens before [deletion]. After deletion, recovery is limited to [source].',
                example: 'A Monday bucket remains raw through the seven-day lateness SLA; its final refresh is verified before deletion. Later repair requires replay from archived events.',
                vocabulary: [{
                  term: 'refresh horizon',
                  simpleMeaning: 'How far back the rollup is still allowed to recompute.',
                  technicalMeaning: 'The time range covered by manual or policy-driven aggregate refreshes.',
                  example: 'A seven-day refresh horizon cannot repair an eight-day-old bucket automatically.',
                }],
              }),
            }),
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
              ...bitmapGuidance({
                predictionQuestion: 'If both adjacent seeded days contain sensors 1 through 12, what returning count should the query produce?',
                predictionChoices: ['12', '24', '0'],
                steps: [
                  microstep(
                    'Complete daily so it returns one distinct sensor array per UTC day.',
                    'The array is a readable correctness oracle before bitmap optimization.',
                    'daily has one row per day and one ids array.',
                    'DISTINCT prevents repeated readings from duplicating members.',
                    'If there are many duplicates, check that DISTINCT is inside array_agg rather than applied to complete rows.',
                  ),
                  microstep(
                    'Pair each day with the preceding array using lag, then intersect the two unnested arrays.',
                    'This directly expresses adjacent-day returning membership with standard PostgreSQL.',
                    'Each non-first day returns a count matching the number of shared IDs.',
                    'INTERSECT removes duplicates and keeps values present in both inputs.',
                    'If the first row causes a NULL issue, filter rows where prev_ids IS NOT NULL.',
                  ),
                  microstep(
                    'Explain with {1,2} and {2,3} why adding daily distinct counts is wrong.',
                    'A tiny counterexample is a proof of non-additivity.',
                    'You state that 2+2=4 double-counts member 2 while the union contains 3 members.',
                    'Daily counts discard the identity needed to detect overlap.',
                    'If the explanation uses only the seeded result, replace it with the explicit two-set counterexample.',
                  ),
                ],
                hints: [
                  'Build array_agg(DISTINCT sensor_id) in daily.',
                  'lag(ids) OVER (ORDER BY day) supplies the previous day.',
                  'SELECT unnest(ids) INTERSECT SELECT unnest(prev_ids) returns shared IDs.',
                  'Count the INTERSECT rows; then filter out the first day, which has no predecessor.',
                ],
                answer: `WITH daily AS (
  SELECT date_trunc('day', time) AS day, array_agg(DISTINCT sensor_id) AS ids
  FROM readings
  WHERE time >= now() - INTERVAL '4 days'
  GROUP BY 1
), pairs AS (
  SELECT day, ids, lag(ids) OVER (ORDER BY day) AS prev_ids FROM daily
)
SELECT day, (SELECT count(*) FROM (
  SELECT unnest(ids) INTERSECT SELECT unnest(prev_ids)
) shared) AS returning
FROM pairs
WHERE prev_ids IS NOT NULL
ORDER BY day;`,
                explanation: 'The query is intentionally standard PostgreSQL so it can validate a later bitmap implementation.',
                template: 'My oracle returns [count] for [day pair]. Summing daily counts fails because [explicit overlapping-set example].',
                example: 'The seeded adjacent days return 12. For {1,2} and {2,3}, adding 2+2 gives 4 but the union has only 3 members.',
              }),
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
            ['10-src-repo', '10-src-pgxn', '10-src-pg-extensions'], {
              ...bitmapGuidance({
                predictionQuestion: 'What should determine the smallest bitmap bucket: convenience or the smallest supported query window?',
                predictionChoices: ['The smallest supported query window', 'A universal one-day rule', 'The extension version number'],
                steps: [
                  microstep(
                    'Write the smallest supported time window and choose an aligned bucket no larger than it.',
                    'A rollup cannot answer arbitrary sub-bucket membership questions it never stored.',
                    'The bucket choice is tied to a stated query requirement.',
                    'Smaller buckets improve time precision but create more states to store and union.',
                    'If no smallest window is known, stop and obtain the product requirement instead of guessing a bucket.',
                  ),
                  microstep(
                    'Document ID mapping, erasure behavior, rebuild source, and maximum union range.',
                    'These ownership decisions determine whether exact membership remains correct and operable.',
                    'Each of the four items has an owner and a testable rule.',
                    'A stable integer mapping must not silently reuse an ID for a different person.',
                    'If deletion is described only as dropping raw rows, also state how the member is removed from existing bitmap history.',
                  ),
                  microstep(
                    'Benchmark one dense and one sparse cohort from representative data.',
                    'The consecutive-integer demo cannot predict production compression.',
                    'The record includes input cardinality, ID span, array bytes, bitmap bytes, and union latency for both cases.',
                    'Density is approximately cardinality divided by the represented ID span.',
                    'If real data is unavailable, label synthetic results as provisional and do not make a production approval.',
                  ),
                ],
                hints: [
                  'Start from the narrowest time question users are allowed to ask.',
                  'List who owns stable integer assignment and whether IDs can ever be reused.',
                  'Define how historical bitmaps change when a person invokes erasure.',
                  'Approve only after representative dense and sparse measurements plus a tested rebuild path.',
                ],
                answer: 'Choose an aligned bucket at or below the smallest supported query window, then cap the maximum union range from measured latency. Use a stable non-reused integer mapping, define historical erasure, retain a durable rebuild source, and benchmark dense and sparse real cohorts before approval.',
                explanation: 'A technically valid bitmap is not yet a production-safe audience system.',
                template: 'Bucket=[grain] because minimum query=[window]. IDs=[mapping/owner]. Erasure=[procedure]. Rebuild=[source]. Max range=[limit/evidence].',
                example: 'Use hourly buckets for one-hour-or-larger queries, immutable surrogate integer IDs, a queued aggregate rebuild for erasure, archived events for replay, and a 90-day union cap justified by benchmarks.',
                vocabulary: [{
                  term: 'bucket grain',
                  simpleMeaning: 'The amount of time represented by one rollup row.',
                  technicalMeaning: 'The aligned interval used to group source events into aggregate states.',
                  example: 'One-hour grain creates one bitmap per hour.',
                }],
              }),
            }),
        ]),
      phase('10-p8', 'Closed-book assessment', standardMinutes[7],
        'Test exactness, provenance, and lifecycle understanding.', [
          activity('10-a09', 'assessment', 'documented', 'Bitmap readiness exam',
            'Verify the learner can reject unsafe or inaccurate claims.', [
              'Answer whether roaring membership is approximate and whether random UUIDs are a direct input.',
              'Name the extension provenance and explain why Toolkit documentation is not its API authority.',
              'State the raw-retention precondition for repairable bitmap aggregates.',
            ], ['Answers include exact, integer mapping, third-party, and refresh-before-delete.'],
            ['10-src-repo', '10-src-pgxn', '10-src-pg-extensions'], {
              ...bitmapGuidance({
                predictionQuestion: 'Which statement is true?',
                predictionChoices: ['A roaring bitmap stores exact integer membership', 'It directly stores random UUIDs', 'It belongs to TimescaleDB Toolkit'],
                steps: [
                  microstep(
                    'Answer the exactness and input-domain questions without opening the lesson.',
                    'Closed-book retrieval reveals what can actually be recalled.',
                    'You state exact membership and the need for a stable integer mapping for non-integer identities.',
                    'A bitmap can return its members; an approximate sketch cannot.',
                    'If unsure, rebuild the {1,2}/{2,3} example before viewing the answer.',
                  ),
                  microstep(
                    'Name the provider and the authoritative API sources.',
                    'Using the wrong project documentation leads to invalid function assumptions.',
                    'You identify pg_roaringbitmap as third-party and use its upstream or PGXN docs plus installed catalogs.',
                    'TimescaleDB Toolkit documentation does not define this extension API.',
                    'If the answer says “Timescale,” revisit the installed extension names in pg_extension.',
                  ),
                  microstep(
                    'State the refresh-before-delete rule in one sentence.',
                    'The lifecycle rule is the minimum safe operational takeaway.',
                    'Your sentence places a verified final refresh before raw retention deletes a bucket.',
                    'After source deletion, exact repair needs another durable source.',
                    'If the sentence omits late arrivals, add the accepted lateness window explicitly.',
                  ),
                ],
                hints: [
                  'Ask whether rb_to_array can enumerate the result.',
                  'UUIDs need a stable, collision-free integer surrogate; do not hash and hope.',
                  'The extension installed is named roaringbitmap, not timescaledb_toolkit.',
                  'Exact; stable integer mapping; third-party pg_roaringbitmap; final refresh and verification before source deletion.',
                ],
                answer: 'Roaring membership is exact. Random UUIDs are not direct bitmap members and require a stable, collision-free integer mapping. pg_roaringbitmap is third-party, so its upstream/PGXN docs and installed catalogs define the API. Raw rows must survive accepted lateness and a verified final refresh; later repair requires another durable source.',
                explanation: 'These four facts are the minimum readiness gate for safe use.',
                template: 'Exactness=[]. Input mapping=[]. Provider/API authority=[]. Retention precondition=[].',
                example: 'Exactness=exact membership. Input mapping=immutable surrogate integer. Provider=third-party pg_roaringbitmap. Retention=refresh and verify before deleting raw rows.',
                prerequisites: ['Complete activities 1 through 8', 'Attempt this activity without opening their worked answers'],
              }),
            }),
        ]),
      phase('10-p9', 'Review and transfer', standardMinutes[8],
        'Package the method into a reusable adoption checklist.', [
          activity('10-a10', 'review', 'recommendation', 'Approve or reject the extension',
            'Make adoption an evidence-based operational decision.', [
              'Score availability, upgrade path, replica support, backup restore, observed density, and query savings.',
              'Reject adoption if exact member sets are unnecessary or lifecycle ownership is undefined.',
            ], ['A signed decision record with explicit reject conditions.'],
            ['10-src-repo', '10-src-pg-extensions'], {
              ...bitmapGuidance({
                predictionQuestion: 'Should you adopt roaringbitmap when the product only needs an approximate distinct count?',
                predictionChoices: ['Usually no', 'Always yes', 'Only because the lab image includes it'],
                steps: [
                  microstep(
                    'Score availability, upgrade/replica support, backup restore, observed density, and measured query savings.',
                    'Adoption should depend on evidence across operations and workload fit.',
                    'Each category has evidence, an owner, and pass/fail status.',
                    'Extension availability in a development image does not prove availability in production or replicas.',
                    'If a score has no evidence, mark it unknown rather than passing it.',
                  ),
                  microstep(
                    'Write explicit rejection conditions before making the decision.',
                    'Precommitted reject rules reduce pressure to justify an attractive benchmark.',
                    'The record rejects when exact membership is unnecessary, integer mapping is unsafe, lifecycle ownership is missing, or operational support is unproven.',
                    'A simpler count-distinct sketch or standard table may be the better design.',
                    'If every result leads to approval, the criteria are not decision criteria; add measurable failure thresholds.',
                  ),
                ],
                hints: [
                  'Separate “can run” from “should adopt.”',
                  'Require restore and replica evidence, not only a successful CREATE EXTENSION.',
                  'Compare against the simplest design that meets the accuracy requirement.',
                  'Reject when exact member sets are unnecessary or mapping, erasure, rebuild, and refresh-before-delete ownership are undefined.',
                ],
                answer: 'Approve only when production and replica availability, upgrades, restore, representative compression, and query savings all pass documented tests, and when stable mapping plus erasure/rebuild ownership exist. Reject when approximate counts are sufficient or any lifecycle responsibility is undefined.',
                explanation: 'The decision balances query value against a third-party extension and retained-membership lifecycle.',
                template: 'Decision=[approve/reject]. Evidence=[availability, upgrade, replica, restore, density, savings]. Owners=[mapping, erasure, rebuild]. Reject triggers=[].',
                example: 'Reject: the workload needs only approximate counts, the hosted service does not offer the extension, and no owner exists for historical erasure.',
                prerequisites: ['Complete activities 1 through 9', 'Have representative deployment and workload evidence, or label the decision provisional'],
              }),
            }),
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
