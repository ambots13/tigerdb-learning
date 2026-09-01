// Terminal rendering: colors, boxes, SQL highlighting, result tables.
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const code = (open, close) => (text) => (useColor ? `\u001b[${open}m${text}\u001b[${close}m` : text);

export const c = {
  bold: code(1, 22),
  dim: code(2, 22),
  italic: code(3, 23),
  red: code(31, 39),
  green: code(32, 39),
  yellow: code(33, 39),
  blue: code(34, 39),
  magenta: code(35, 39),
  cyan: code(36, 39),
  gray: code(90, 39),
  bgBlue: code(44, 49),
};

const WIDTH = Math.min(process.stdout.columns || 80, 100);

export function rule(char = '─') {
  return c.gray(char.repeat(WIDTH));
}

export function heading(text) {
  return `\n${c.bold(c.cyan(text))}\n${rule()}`;
}

/** Wrap prose to the terminal width, preserving intentional line breaks. */
export function wrap(text, indent = '') {
  const limit = WIDTH - indent.length;
  return text
    .split('\n')
    .map((paragraph) => {
      if (!paragraph.trim()) return '';
      const words = paragraph.trim().split(/\s+/);
      const lines = [];
      let line = '';
      for (const word of words) {
        if (line && (line + ' ' + word).length > limit) {
          lines.push(line);
          line = word;
        } else {
          line = line ? `${line} ${word}` : word;
        }
      }
      if (line) lines.push(line);
      return lines.map((l) => indent + l).join('\n');
    })
    .join('\n');
}

const KEYWORDS =
  /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|INSERT INTO|VALUES|CREATE|TABLE|MATERIALIZED VIEW|INDEX|ALTER|DROP|SET|WITH|AS|AND|OR|NOT|NULL|JOIN|ON|BETWEEN|DESC|ASC|CASE|WHEN|THEN|ELSE|END|EXPLAIN|ANALYZE|CALL|BEGIN|COMMIT|DISTINCT|INTERVAL|NOW|COUNT|AVG|MIN|MAX|SUM|INTO|USING|IF|EXISTS|REFRESH|ADD|RETURNING|UPDATE|DELETE)\b/gi;

export function sqlBlock(sql) {
  const body = sql
    .trim()
    .split('\n')
    .map((line) => {
      const commented = line.replace(/(--.*)$/, (m) => c.gray(m));
      return '  ' + commented.replace(KEYWORDS, (m) => c.magenta(m));
    })
    .join('\n');
  return `${c.gray('  ┌─ SQL ' + '─'.repeat(Math.max(0, WIDTH - 9)))}\n${body}\n${c.gray('  └' + '─'.repeat(Math.max(0, WIDTH - 3)))}`;
}

export function formatValue(value) {
  if (value === null || value === undefined) return c.gray('NULL');
  if (value instanceof Date) return value.toISOString().replace('T', ' ').replace('.000Z', '');
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const visibleLength = (text) => text.replace(/\u001b\[\d+m/g, '').length;

/** Render rows as an aligned ASCII table. */
export function table(rows, fields, maxRows = 10) {
  if (!rows.length) return c.gray('  (no rows)');
  const columns = fields?.length ? fields : Object.keys(rows[0]);
  const shown = rows.slice(0, maxRows);
  const cells = shown.map((row) => columns.map((col) => formatValue(row[col])));
  const widths = columns.map((col, i) =>
    Math.min(30, Math.max(visibleLength(col), ...cells.map((row) => visibleLength(row[i])))),
  );

  const pad = (text, width) => text + ' '.repeat(Math.max(0, width - visibleLength(text)));
  const clip = (text, width) =>
    visibleLength(text) > width ? text.slice(0, width - 1) + '…' : pad(text, width);

  const header = '  ' + columns.map((col, i) => c.bold(pad(col, widths[i]))).join(c.gray(' │ '));
  const divider = '  ' + widths.map((w) => c.gray('─'.repeat(w))).join(c.gray('─┼─'));
  const body = cells
    .map((row) => '  ' + row.map((cell, i) => clip(cell, widths[i])).join(c.gray(' │ ')))
    .join('\n');

  let output = `${header}\n${divider}\n${body}`;
  if (rows.length > maxRows) {
    output += `\n  ${c.gray(`… ${rows.length - maxRows} more row(s)`)}`;
  }
  return output;
}

export function bytes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let size = n;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size < 10 && unit > 0 ? size.toFixed(1) : Math.round(size)} ${units[unit]}`;
}

export function ms(value) {
  return value < 1 ? `${value.toFixed(2)} ms` : `${value.toFixed(1)} ms`;
}

export function callout(label, text, color = c.yellow) {
  return `\n  ${color(c.bold(label))} ${wrap(text, '  ').trimStart()}`;
}
