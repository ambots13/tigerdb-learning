import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import lesson10 from '../modules/10-roaring-bitmaps/lesson.mjs';
import { getHardcoreLesson } from '../src/hardcore.mjs';

const app = await readFile(new URL('../src/web/public/app.js', import.meta.url), 'utf8');
const page = await readFile(new URL('../src/web/public/index.html', import.meta.url), 'utf8');
const server = await readFile(new URL('../src/web/server.mjs', import.meta.url), 'utf8');

test('lesson diagrams use the local strict Mermaid renderer', () => {
  assert.match(page, /\/vendor\/mermaid\/mermaid\.min\.js/);
  assert.match(server, /app\.use\('\/vendor\/mermaid'/);
  assert.match(app, /securityLevel: 'strict'/);
  assert.match(app, /View diagram as text/);
  assert.match(app, /The diagram could not be rendered/);
});

test('lesson 10 exposes complete Mermaid definitions', () => {
  const standard = lesson10.steps.flatMap((step) => step.diagram ? [step.diagram] : []);
  const hardcore = getHardcoreLesson('10').deepDive.phases
    .flatMap((phase) => phase.activities)
    .flatMap((activity) => activity.diagram ? [activity.diagram] : []);
  const diagrams = [...standard, ...hardcore];

  assert.equal(standard.length, 3);
  assert.equal(hardcore.length, 1);
  for (const diagram of diagrams) {
    assert.ok(diagram.title);
    assert.ok(diagram.description);
    assert.match(diagram.source, /^flowchart (?:LR|TD)\n/);
    assert.ok(diagram.source.includes('classDef'));
  }
});
