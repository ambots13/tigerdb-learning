const $ = (selector) => document.querySelector(selector);
const editor = $('#sql');
const resultEl = $('#result');
let lessons = [];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function runSql(sql) {
  resultEl.innerHTML = '';
  resultEl.append(el('p', 'meta', 'Running...'));
  try {
    const response = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });
    const data = await response.json();
    resultEl.innerHTML = '';

    if (!response.ok) {
      resultEl.append(el('div', 'error', data.error || 'Query failed.'));
      return;
    }

    const meta = el('p', 'meta');
    meta.append(el('span', 'ok', '✓ '));
    meta.append(
      document.createTextNode(
        `${data.rowCount} row(s) · ${data.ms} ms${data.command ? ` · ${data.command}` : ''}${
          data.truncated ? ' · showing first 200' : ''
        }`,
      ),
    );
    resultEl.append(meta);

    if (!data.rows.length) {
      resultEl.append(el('p', 'placeholder', 'Statement completed with no rows returned.'));
      return;
    }

    const columns = data.fields.length ? data.fields : Object.keys(data.rows[0]);

    // Query plans are text art: a table cell would destroy the indentation.
    if (columns.length === 1 && columns[0] === 'QUERY PLAN') {
      const pre = el('pre', 'sql plan');
      pre.textContent = data.rows.map((row) => row['QUERY PLAN']).join('\n');
      resultEl.append(pre);
      return;
    }

    const table = el('table');
    const thead = el('thead');
    const headRow = el('tr');
    for (const column of columns) headRow.append(el('th', null, column));
    thead.append(headRow);
    table.append(thead);

    const tbody = el('tbody');
    for (const row of data.rows) {
      const tr = el('tr');
      for (const column of columns) {
        const value = row[column];
        const td = el('td', value === null ? 'null' : null, value === null ? 'NULL' : String(value));
        tr.append(td);
      }
      tbody.append(tr);
    }
    table.append(tbody);
    resultEl.append(table);
  } catch (error) {
    resultEl.innerHTML = '';
    resultEl.append(el('div', 'error', error.message));
  }
}

function renderLesson(lesson) {
  const container = $('#lesson');
  container.innerHTML = '';
  container.append(el('h2', null, `${lesson.id} · ${lesson.title}`));
  container.append(el('p', 'summary', lesson.summary));

  if (lesson.objectives.length) {
    const list = el('ul', 'objectives');
    for (const objective of lesson.objectives) list.append(el('li', null, objective));
    container.append(list);
  }

  lesson.steps.forEach((step, index) => {
    const wrapper = el('div', 'step');
    wrapper.append(el('h3', null, `${index + 1}. ${step.title}`));
    if (step.explain) wrapper.append(el('p', null, step.explain));
    if (step.sql) {
      wrapper.append(el('pre', 'sql', step.sql));
      const button = el('button', 'ghost', 'Load into editor');
      button.addEventListener('click', () => {
        editor.value = step.sql;
        editor.focus();
        runSql(step.sql);
      });
      wrapper.append(button);
    }
    if (step.takeaway) wrapper.append(el('div', 'aside-take', `Takeaway: ${step.takeaway}`));
    if (step.note) wrapper.append(el('div', 'aside-note', `Note: ${step.note}`));
    container.append(wrapper);
  });

  if (lesson.challenge) {
    const wrapper = el('div', 'step');
    wrapper.append(el('h3', null, 'Challenge'));
    wrapper.append(el('p', null, lesson.challenge.prompt));
    if (lesson.challenge.hint) wrapper.append(el('div', 'aside-note', `Hint: ${lesson.challenge.hint}`));
    container.append(wrapper);
  }
  container.scrollTop = 0;
}

async function loadSchema() {
  try {
    const data = await fetch('/api/schema').then((r) => r.json());
    const nav = $('#schema');
    nav.innerHTML = '';

    const group = (label, items) => {
      if (!items.length) return;
      const wrap = el('span');
      wrap.append(el('b', null, `${label}: `));
      items.forEach((item, index) => {
        const code = el('code', null, item.name + (item.chunks ? ` (${item.chunks})` : ''));
        code.title = `SELECT * FROM ${item.name} LIMIT 20;`;
        code.addEventListener('click', () => {
          const sql = `SELECT * FROM ${item.name} LIMIT 20;`;
          editor.value = sql;
          runSql(sql);
        });
        wrap.append(code);
        if (index < items.length - 1) wrap.append(document.createTextNode(' '));
      });
      nav.append(wrap);
    };

    group('hypertables', data.hypertables);
    group('aggregates', data.continuousAggregates);
  } catch {
    /* schema strip is decorative; ignore failures */
  }
}

async function init() {
  lessons = await fetch('/api/lessons').then((r) => r.json());
  const select = $('#module-select');
  for (const lesson of lessons) {
    const option = el('option', null, `${lesson.id} · ${lesson.title}`);
    option.value = lesson.id;
    select.append(option);
  }
  select.addEventListener('change', () => {
    renderLesson(lessons.find((l) => l.id === select.value));
  });
  if (lessons.length) renderLesson(lessons[0]);

  $('#run').addEventListener('click', () => runSql(editor.value));
  $('#explain').addEventListener('click', () => {
    const sql = editor.value.trim().replace(/;\s*$/, '');
    if (!sql) return;
    // Don't stack EXPLAIN on a statement that already has one.
    runSql(/^explain/i.test(sql) ? sql : `EXPLAIN (ANALYZE, BUFFERS) ${sql}`);
  });
  editor.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      runSql(editor.value);
    }
  });

  await loadSchema();
}

init();
