import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../src/web/public/app.js', import.meta.url), 'utf8');
const sqlGuide = await readFile(new URL('../src/web/public/sql-guide.js', import.meta.url), 'utf8');

test('Hardcore browser contract keeps guided stages and progressive disclosure', () => {
  for (const requiredText of [
    'Words to know',
    'Expected result:',
    'Progressive hints',
    'Reveal worked answer',
    'Common mistakes and recovery',
    'Read this exact part:',
    'estimate, not a deadline',
    'activityId: activity.id',
    'Concept check',
    'activityChecksComplete',
    'All concept checks complete',
    'check.retryExplanations[optionIndex]',
  ]) {
    assert.ok(app.includes(requiredText), `app.js is missing ${requiredText}`);
  }
  assert.ok(app.includes('details'), 'worked answers should use native disclosure elements');
  assert.doesNotMatch(
    app,
    /Re-read the activity goal and the evidence you are expected to record/,
  );
});

test('SQL guide accepts exact activity explanations before generic definitions', () => {
  assert.match(sqlGuide, /contextualInsights/);
  assert.match(sqlGuide, /const exact = contextualInsights/);
  assert.match(sqlGuide, /explainToken\(tokens, index, title, context\)/);
});
