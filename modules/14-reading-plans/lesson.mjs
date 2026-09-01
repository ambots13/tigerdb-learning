const HOT = `
SELECT sensor_id, avg(temperature) AS avg_temp
FROM readings
WHERE sensor_id = 5
  AND time >= now() - INTERVAL '3 days'
GROUP BY sensor_id`;

export default {
  title: 'Reading query plans',
  duration: '13 min',
  summary: 'Learn to read EXPLAIN like a report: what the planner guessed, what really happened, and why they differ.',
  objectives: [
    'Tell estimates apart from measurements in a plan',
    'Read a plan tree in execution order',
    'Recognise every common scan and join node, and why one was chosen',
    'Use BUFFERS and row misestimates to find the real problem',
  ],
  steps: [
    {
      title: 'Two different questions',
      explain:
        'EXPLAIN alone asks "what do you intend to do?" - it plans the query but does not run it, so every ' +
        'number is a guess based on statistics.\n\n' +
        'EXPLAIN ANALYZE actually runs the query and reports what happened. The gap between the two is ' +
        'where almost every slow query hides.',
      sql: `EXPLAIN ${HOT};`,
      maxRows: 8,
      note:
        'cost=X..Y is not milliseconds. It is an arbitrary unit where 1.0 is roughly one sequential page ' +
        'read. Only ratios between costs mean anything.',
    },
    {
      title: 'The same plan, with reality attached',
      explain:
        'Now with ANALYZE. Each node gains actual time and actual rows. Note that actual rows is reported ' +
        'per loop, so a node executed 100 times shows the average, not the total.',
      sql: `EXPLAIN (ANALYZE, BUFFERS) ${HOT};`,
      maxRows: 12,
      takeaway:
        'Read a plan from the inside out: the most indented nodes run first and feed their parents. The ' +
        'top line is the last thing to happen, not the first.',
    },
    {
      title: 'The one number that matters most',
      explain:
        'The planner chooses a strategy based on how many rows it expects. If that guess is wrong, the ' +
        'strategy is wrong - a nested loop over 10 rows is excellent, and over 10 million rows it is a ' +
        'catastrophe.\n\n' +
        'So the first thing to check in any plan is estimated versus actual rows, node by node. Here is ' +
        'that comparison, computed for you.',
      run: async ({ explainAnalyze, renderPlan, worstEstimate, print, c }) => {
        const { nodes, executionMs } = await explainAnalyze(HOT);
        print('');
        print(renderPlan(nodes));
        const worst = worstEstimate(nodes);
        print(`\n  ${c.gray(`execution time: ${executionMs?.toFixed(2)} ms`)}`);
        if (worst && worst.ratio >= 3) {
          print(
            `  ${c.yellow('worst estimate:')} ${worst.label} ${c.gray(
              `- expected ${worst.estimated}, got ${worst.actual}`,
            )}`,
          );
        } else {
          print(`  ${c.green('estimates are close to reality across the whole plan')}`);
        }
      },
      takeaway:
        'A ratio near 1 means the planner understood your data. Ratios in the hundreds mean it did not, ' +
        'and no amount of indexing will help until the statistics do.',
    },
    {
      title: 'Now break it on purpose',
      explain:
        'That plan looked healthy. To recognise an unhealthy one you need to see it, so here is the most ' +
        'common cause of bad estimates in PostgreSQL: correlated columns.\n\n' +
        'city and country below are perfectly correlated - every paris row is a france row. The planner ' +
        'does not know that, so it assumes independence and multiplies the two selectivities together, ' +
        'producing an estimate that is far too small.',
      run: async ({ query, explainAnalyze, renderPlan, worstEstimate, print, c }) => {
        const sql = `SELECT count(*) FROM skew WHERE city = 'paris' AND country = 'france'`;

        await query(`DROP TABLE IF EXISTS skew;`);
        await query(`
          CREATE TABLE skew (id int, city text, country text, v double precision);`);
        await query(`
          INSERT INTO skew
          SELECT i,
                 (ARRAY['paris','berlin','madrid','rome'])[1 + (i % 4)],
                 (ARRAY['france','germany','spain','italy'])[1 + (i % 4)],
                 random()
          FROM generate_series(1, 200000) AS i;`);
        await query('ANALYZE skew;');

        const before = await explainAnalyze(sql);
        print(`\n  ${c.bold('Assuming the columns are independent:')}`);
        print(renderPlan(before.nodes, { limit: 6 }));
        const worstBefore = worstEstimate(before.nodes.filter((n) => /Scan/.test(n.label)));
        if (worstBefore) {
          print(
            `\n  ${c.yellow('→')} ${c.gray(
              `the scan expected ${worstBefore.estimated} rows and got ${worstBefore.actual}`,
            )}`,
          );
        }

        // Extended statistics teach the planner that city determines country.
        await query(`
          CREATE STATISTICS IF NOT EXISTS skew_city_country (dependencies, ndistinct)
          ON city, country FROM skew;`);
        await query('ANALYZE skew;');

        const after = await explainAnalyze(sql);
        print(`\n  ${c.bold('After CREATE STATISTICS on (city, country):')}`);
        print(renderPlan(after.nodes, { limit: 6 }));
        const worstAfter = worstEstimate(after.nodes.filter((n) => /Scan/.test(n.label)));
        if (worstAfter) {
          print(
            `\n  ${c.green('→')} ${c.gray(
              `now it expects ${worstAfter.estimated} rows and gets ${worstAfter.actual}`,
            )}`,
          );
        }
        await query('DROP TABLE IF EXISTS skew;');
      },
      takeaway:
        'When a plan is bad and the estimates are bad, fix the estimates first. Extended statistics teach ' +
        'the planner about relationships between columns that it cannot infer on its own.',
      note:
        'The other common causes of bad estimates: stale statistics after a bulk load (run ANALYZE), and ' +
        'expressions the planner cannot see through (index the expression, or raise ' +
        'default_statistics_target for that column).',
    },
    {
      title: 'Where estimates come from - and how to fix them',
      explain:
        'Estimates come from statistics that ANALYZE collects: row counts, most common values, histograms. ' +
        'They go stale after bulk loads, which is why a query can suddenly get slow without any code ' +
        'changing.\n\n' +
        'default_statistics_target controls how much detail is kept. Raising it for a specific column ' +
        'helps when a column has an unusual distribution.',
      sql: `SELECT
  attname                          AS column_name,
  n_distinct,
  correlation,
  most_common_vals IS NOT NULL     AS has_mcv_list
FROM pg_stats
WHERE tablename LIKE '_hyper%'
  AND attname IN ('sensor_id', 'temperature', 'time')
LIMIT 6;`,
      note:
        'correlation near 1 means the column is stored in sorted order - that is why BRIN works on time ' +
        'columns, and why the planner trusts index scans on them.',
    },
    {
      title: 'Why did it pick that scan?',
      explain:
        'The planner is a cost model, not a rulebook. The most direct way to understand a choice is to ' +
        'forbid it and see what the alternative costs. enable_seqscan = off does not truly disable ' +
        'sequential scans; it makes them absurdly expensive, so the planner avoids them if it can.\n\n' +
        'This is a learning and diagnosis tool, not something to leave on in production.',
      run: async ({ withClient, print, table, c, ms }) => {
        const sql = `SELECT count(*) FROM readings WHERE sensor_id = 5`;
        const results = [];
        await withClient(async (client) => {
          for (const [name, setup] of [
            ['planner default', 'RESET ALL'],
            ['seqscan disabled', 'SET enable_seqscan = off'],
            ['indexscan disabled', 'SET enable_indexscan = off; SET enable_indexonlyscan = off'],
          ]) {
            await client.query('RESET ALL');
            await client.query(setup);
            const plan = await client.query(`EXPLAIN (ANALYZE, COSTS, FORMAT JSON) ${sql}`);
            const doc = plan.rows[0]['QUERY PLAN'][0];
            // Find the first real scan node in the tree.
            let node = doc.Plan;
            const stack = [doc.Plan];
            while (stack.length) {
              const current = stack.pop();
              if (/Scan/.test(current['Node Type'])) {
                node = current;
                break;
              }
              for (const child of current.Plans ?? []) stack.push(child);
            }
            results.push({
              setting: name,
              chosen_scan: node['Custom Plan Provider']
                ? `Custom (${node['Custom Plan Provider']})`
                : node['Node Type'],
              est_cost: Math.round(doc.Plan['Total Cost']),
              actual: ms(doc['Execution Time']),
            });
          }
          await client.query('RESET ALL');
        });
        print('');
        print(table(results, ['setting', 'chosen_scan', 'est_cost', 'actual']));
        print(
          `\n  ${c.gray('The planner picks the lowest estimated cost. Forcing an alternative shows you what it was comparing against.')}`,
        );
      },
    },
    {
      title: 'The scan nodes, and what each one means',
      explain:
        'Five you will see constantly:\n\n' +
        '- Seq Scan - read every row. Correct when you need most of the table.\n' +
        '- Index Scan - walk the index, then fetch each matching row from the table.\n' +
        '- Index Only Scan - the index held every column needed, so the table was never touched.\n' +
        '- Bitmap Heap Scan - collect matching row locations first, sort them, then read the table in ' +
        'physical order. Chosen for medium-sized result sets where random fetches would be too scattered.\n' +
        '- Custom Scan - a TimescaleDB node; see the next step.\n\n' +
        'The query below is deliberately shaped to produce a bitmap scan.',
      sql: `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT count(*) FROM readings
WHERE battery < 65
  AND time >= now() - INTERVAL '10 days';`,
      maxRows: 12,
      note:
        '"Rows Removed by Filter" is important: it counts rows that were read and then thrown away. A big ' +
        'number there means the index got you to the neighbourhood but not to the door.',
    },
    {
      title: 'The TimescaleDB nodes',
      explain:
        'On a hypertable you will also meet:\n\n' +
        '- Custom Scan (ChunkAppend) - chunk-aware append; the planner can exclude chunks and even order ' +
        'them so LIMIT stops early.\n' +
        '- Custom Scan (ColumnarScan) - reading a columnar chunk, with "Vectorized Filter" applied to ' +
        'batches rather than rows.\n' +
        '- Custom Scan (VectorAgg) - aggregation executed over compressed batches directly.\n' +
        '- Custom Scan (SkipScan) - jumping between distinct values using an index (module 07).\n\n' +
        'Counting the scan nodes tells you how many chunks were opened. Fewer is better.',
      sql: `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT avg(temperature) FROM readings
WHERE time >= now() - INTERVAL '2 hours';`,
      maxRows: 10,
      takeaway:
        'One chunk in the plan for a two-hour query means chunk exclusion worked. If you see every chunk ' +
        'listed, your time predicate is not doing its job.',
    },
    {
      title: 'Joins: three strategies',
      explain:
        '- Nested Loop - for each row on the outer side, look up matches on the inner side. Unbeatable ' +
        'when the outer side is tiny; disastrous when the estimate said tiny and reality is not.\n' +
        '- Hash Join - build a hash table from the smaller side, stream the larger side past it. The ' +
        'default for large equality joins.\n' +
        '- Merge Join - both sides sorted, walked together. Good when the inputs are already ordered.\n\n' +
        'Watch which one is chosen when a 12-row metadata table meets half a million readings.',
      sql: `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT s.site, avg(r.temperature)
FROM readings r
JOIN sensors s USING (sensor_id)
WHERE r.time >= now() - INTERVAL '1 day'
GROUP BY s.site;`,
      maxRows: 12,
      note:
        'If you ever see a Nested Loop whose inner side runs millions of loops, that is the bug. It almost ' +
        'always traces back to a row estimate that was far too low.',
    },
    {
      title: 'BUFFERS: the most underused option',
      explain:
        'Timings vary with cache state, which makes them a shaky basis for comparison. Buffer counts do ' +
        'not: "shared hit" means the page was already in memory, "shared read" means it came from disk.\n\n' +
        'Comparing two queries by buffers tells you which does less work, independent of how warm the ' +
        'cache happened to be.',
      run: async ({ explainAnalyze, print, table, c }) => {
        const rows = [];
        for (const [name, sql] of [
          ['with time filter', `SELECT avg(temperature) FROM readings WHERE time >= now() - INTERVAL '2 hours'`],
          ['no time filter', `SELECT avg(temperature) FROM readings`],
        ]) {
          const { nodes, executionMs } = await explainAnalyze(sql);
          const hit = nodes.reduce((sum, n) => sum + (n.hit || 0), 0);
          const read = nodes.reduce((sum, n) => sum + (n.read || 0), 0);
          rows.push({
            query: name,
            pages_from_cache: hit,
            pages_from_disk: read,
            ms: executionMs?.toFixed(1),
          });
        }
        print('');
        print(table(rows, ['query', 'pages_from_cache', 'pages_from_disk', 'ms']));
        print(
          `\n  ${c.gray('Each page is 8 kB. The filtered query touches a tiny fraction of the pages - that ratio is the real measure of the optimisation.')}`,
        );
      },
      takeaway:
        'When someone says a query is slow, ask for EXPLAIN (ANALYZE, BUFFERS). Timings start arguments; ' +
        'buffer counts end them.',
    },
    {
      title: 'A tool you can keep',
      explain:
        'EXPLAIN output is text, which makes it awkward to query. This small helper returns the plan as ' +
        'JSON so you can pull single facts out of it with ordinary SQL - handy for scripts, tests and ' +
        'the challenge below.',
      sql: [
        `CREATE OR REPLACE FUNCTION explain_json(q text)
RETURNS jsonb
LANGUAGE plpgsql AS
$$
DECLARE
  result jsonb;
BEGIN
  EXECUTE 'EXPLAIN (FORMAT JSON) ' || q INTO result;
  RETURN result;
END;
$$;`,
        `SELECT
  explain_json('SELECT * FROM readings WHERE sensor_id = 5') -> 0 -> 'Plan' ->> 'Node Type'
    AS top_node,
  (explain_json('SELECT * FROM readings WHERE sensor_id = 5') -> 0 -> 'Plan' ->> 'Plan Rows')::bigint
    AS estimated_rows;`,
      ],
      note:
        'The function is left installed after this module - it is a genuinely useful thing to have around. ' +
        'Drop it with DROP FUNCTION explain_json(text);',
    },
    {
      title: 'A checklist for a slow query',
      explain:
        'In order:\n' +
        '1. EXPLAIN (ANALYZE, BUFFERS) - never guess.\n' +
        '2. Compare estimated and actual rows at every node. Fix statistics before touching indexes.\n' +
        '3. Find the node with the largest actual time, and read inwards from it.\n' +
        '4. Look for "Rows Removed by Filter" - work done and thrown away.\n' +
        '5. Count the chunks in the plan; add a time predicate if there are too many.\n' +
        '6. Check for Nested Loops with high loop counts.\n' +
        '7. Only then consider adding an index - and re-measure with buffers, not wall clock.',
      sql: `SELECT
  'EXPLAIN (ANALYZE, BUFFERS)' AS always_start_here,
  'estimated vs actual rows'   AS then_check_this,
  'buffers, not milliseconds'  AS compare_with_this;`,
      takeaway:
        'Reading plans is the skill that makes every other module in this lab actionable: it is how you ' +
        'prove a change helped instead of hoping it did.',
    },
  ],
  challenge: {
    prompt:
      'Using the explain_json helper from this module, return the top-level plan node type for the query ' +
      "SELECT * FROM readings, in a column named node_type.",
    hint: "explain_json(q) -> 0 -> 'Plan' ->> 'Node Type'",
    solution: `SELECT explain_json('SELECT * FROM readings') -> 0 -> 'Plan' ->> 'Node Type' AS node_type;`,
  },
  next: 'That is the full lab. Run npm run lessons to revisit any module.',
};
