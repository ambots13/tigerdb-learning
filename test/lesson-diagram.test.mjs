import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import lesson10 from '../modules/10-roaring-bitmaps/lesson.mjs';
import { getHardcoreLesson } from '../src/hardcore.mjs';
import { loadAllLessons } from '../src/lessons.mjs';

const app = await readFile(new URL('../src/web/public/app.js', import.meta.url), 'utf8');
const page = await readFile(new URL('../src/web/public/index.html', import.meta.url), 'utf8');
const server = await readFile(new URL('../src/web/server.mjs', import.meta.url), 'utf8');

test('lesson diagrams use the local strict Mermaid renderer', () => {
  assert.match(page, /\/vendor\/mermaid\/mermaid\.min\.js/);
  assert.match(server, /app\.use\('\/vendor\/mermaid'/);
  assert.match(app, /securityLevel: 'strict'/);
  assert.match(app, /View diagram as text/);
  assert.match(app, /The diagram could not be rendered/);
  assert.match(app, /Zoom in/);
  assert.match(app, /Zoom out/);
  assert.match(app, /Math\.min\(250, Math\.max\(75, nextZoom\)\)/);
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

test('course diagrams stay selective and structurally complete', async () => {
  const lessons = await loadAllLessons();
  const counts = Object.fromEntries(
    lessons.map((lesson) => [
      lesson.id,
      lesson.steps.filter((step) => step.diagram).length,
    ]),
  );

  assert.deepEqual(counts, {
    '00': 0,
    '01': 1,
    '02': 0,
    '03': 1,
    '04': 1,
    '05': 1,
    '06': 1,
    '07': 1,
    '08': 1,
    '09': 1,
    '10': 3,
    '11': 1,
    '12': 1,
    '13': 1,
    '14': 1,
  });

  for (const lesson of lessons) {
    for (const step of lesson.steps.filter((candidate) => candidate.diagram)) {
      assert.ok(step.diagram.title, `${lesson.id} ${step.title} diagram needs a title`);
      assert.ok(step.diagram.description, `${lesson.id} ${step.title} diagram needs a description`);
      assert.match(step.diagram.source, /^flowchart (?:LR|TD)\n/);
      assert.ok(step.diagram.source.includes('classDef'));
    }
  }
});
