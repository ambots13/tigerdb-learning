// Turns EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) into something a human can scan:
// one line per plan node, with the planner's estimate next to reality.
import { query } from './db.mjs';
import { c } from './render.mjs';

function label(node) {
  const parts = [node['Node Type']];
  if (node['Custom Plan Provider']) parts[0] = `Custom Scan (${node['Custom Plan Provider']})`;
  if (node['Join Type'] && node['Node Type'] !== 'Nested Loop') parts.push(`(${node['Join Type']})`);
  const relation = node['Relation Name'];
  if (relation) {
    // Chunk names are long and noisy; shorten them to the trailing identifier.
    const short = relation.replace(/^_hyper_\d+_(\d+)_chunk$/, 'chunk $1');
    parts.push(`on ${short}`);
  }
  if (node['Index Name']) {
    parts.push(`using ${node['Index Name'].replace(/^_hyper_\d+_\d+_chunk_/, '')}`);
  }
  return parts.join(' ');
}

/** Depth-first flatten of the plan tree. */
export function flattenPlan(node, depth = 0, out = []) {
  const loops = node['Actual Loops'] ?? 1;
  const actual = node['Actual Rows'] === undefined ? null : Math.round(node['Actual Rows'] * loops);
  const estimated = node['Plan Rows'] === undefined ? null : node['Plan Rows'];

  out.push({
    depth,
    label: label(node),
    estimated,
    actual,
    ms: node['Actual Total Time'] ?? null,
    hit: node['Shared Hit Blocks'] ?? 0,
    read: node['Shared Read Blocks'] ?? 0,
    totalCost: node['Total Cost'] ?? null,
  });

  for (const child of node.Plans ?? []) flattenPlan(child, depth + 1, out);
  return out;
}

/** How far off was the estimate? 1 means perfect. */
export function misestimation(row) {
  if (row.estimated === null || row.actual === null) return null;
  const hi = Math.max(row.estimated, row.actual);
  const lo = Math.max(Math.min(row.estimated, row.actual), 1);
  return hi / lo;
}

export async function explainAnalyze(sql, { buffers = true } = {}) {
  const options = ['ANALYZE', 'COSTS', buffers ? 'BUFFERS' : null, 'FORMAT JSON']
    .filter(Boolean)
    .join(', ');
  const result = await query(`EXPLAIN (${options}) ${sql}`);
  const raw = result.rows[0]['QUERY PLAN'];
  const doc = Array.isArray(raw) ? raw[0] : raw;
  return { nodes: flattenPlan(doc.Plan), executionMs: doc['Execution Time'] ?? null };
}

/**
 * Render the flattened plan. Rows whose estimate is badly wrong are highlighted,
 * because that is the single most useful signal in a plan.
 */
export function renderPlan(nodes, { limit = 14, warnAt = 10 } = {}) {
  const shown = nodes.slice(0, limit);
  const width = Math.max(...shown.map((n) => n.depth * 2 + n.label.length), 20);

  const lines = [
    '  ' +
      c.bold('node'.padEnd(width)) +
      c.bold('  est'.padStart(9)) +
      c.bold('  actual'.padStart(10)) +
      c.bold('  off by'.padStart(9)),
    '  ' + c.gray('─'.repeat(width + 28)),
  ];

  for (const node of shown) {
    const indent = ' '.repeat(node.depth * 2);
    const ratio = misestimation(node);
    const ratioText =
      ratio === null ? '-' : ratio < 2 ? `${ratio.toFixed(1)}x` : `${Math.round(ratio)}x`;
    const colour = ratio !== null && ratio >= warnAt ? c.red : ratio !== null && ratio >= 3 ? c.yellow : c.gray;
    lines.push(
      '  ' +
        (indent + node.label).padEnd(width) +
        String(node.estimated ?? '-').padStart(9) +
        String(node.actual ?? '-').padStart(10) +
        colour(ratioText.padStart(9)),
    );
  }
  if (nodes.length > limit) lines.push('  ' + c.gray(`… ${nodes.length - limit} more node(s)`));
  return lines.join('\n');
}

/** The worst estimate in the plan - usually where a slow query goes wrong. */
export function worstEstimate(nodes) {
  let worst = null;
  for (const node of nodes) {
    const ratio = misestimation(node);
    if (ratio !== null && (worst === null || ratio > worst.ratio)) worst = { ...node, ratio };
  }
  return worst;
}
