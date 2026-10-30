import assert from 'node:assert/strict';
import test from 'node:test';
import { hardcoreByLesson, getHardcoreLesson } from '../src/hardcore.mjs';
import { loadAllLessons } from '../src/lessons.mjs';
import { validateHardcoreLesson } from '../src/hardcore-validation.mjs';

test('every lesson has a complete Hardcore Mode supplement', async () => {
  const lessons = await loadAllLessons();

  assert.equal(Object.keys(hardcoreByLesson).length, lessons.length);
  for (const lesson of lessons) {
    const hardcore = getHardcoreLesson(lesson.id);
    assert.ok(hardcore, `missing Hardcore Mode content for lesson ${lesson.id}`);
    assert.match(hardcore.duration, /\d/);
    assert.ok(hardcore.mentalModel.length >= 120);
    assert.ok(hardcore.prerequisites.length >= 2);
    assert.ok(hardcore.pitfalls.length >= 2);
    assert.equal(hardcore.checkpoints.length, 3);
    assert.equal(hardcore.drills.length, 2);
    assert.ok(hardcore.deepDive, `missing deep curriculum for lesson ${lesson.id}`);
    assert.ok(hardcore.deepDive.estimatedMinutes >= 120);
    assert.ok(hardcore.deepDive.estimatedMinutes <= 240);
    assert.equal(
      hardcore.deepDive.phases.reduce((total, phase) => total + phase.minutes, 0),
      hardcore.deepDive.estimatedMinutes,
    );
    assert.ok(hardcore.deepDive.phases.length >= 8);
    assert.ok(hardcore.deepDive.outcomes.length >= 4);
    assert.ok(hardcore.deepDive.sources.length >= 3);
    assert.deepEqual(validateHardcoreLesson(hardcore), []);

    const sourceIds = new Set(hardcore.deepDive.sources.map((source) => source.id));
    const activities = hardcore.deepDive.phases.flatMap((phase) => phase.activities);
    assert.ok(activities.length >= 10);
    assert.equal(new Set(activities.map((activity) => activity.id)).size, activities.length);
    assert.ok(activities.some((activity) => activity.type === 'failure-lab'));
    assert.ok(activities.some((activity) => activity.type === 'scenario'));
    assert.ok(activities.some((activity) => activity.type === 'assessment'));

    for (const activity of activities) {
      assert.ok(['documented', 'measured', 'recommendation'].includes(activity.claim));
      assert.ok(activity.instructions.length >= 2);
      assert.ok(activity.evidence.length >= 1);
      for (const sourceId of activity.sourceIds ?? []) {
        assert.ok(sourceIds.has(sourceId), `${lesson.id} references unknown source ${sourceId}`);
      }
    }

    for (const checkpoint of hardcore.checkpoints) {
      assert.equal(checkpoint.options.length, 3);
      assert.ok(Number.isInteger(checkpoint.answer));
      assert.ok(checkpoint.answer >= 0 && checkpoint.answer < checkpoint.options.length);
      assert.ok(checkpoint.options[checkpoint.answer]);
      assert.ok(checkpoint.explanation.length >= 20);
    }

    for (const drill of hardcore.drills) {
      for (const field of ['title', 'prompt', 'starterSql', 'hint', 'solution', 'success']) {
        assert.equal(typeof drill[field], 'string');
        assert.ok(drill[field].trim(), `${lesson.id} drill is missing ${field}`);
      }
    }
  }
});

test('unknown lessons do not receive unrelated Hardcore Mode content', () => {
  assert.equal(getHardcoreLesson('missing'), null);
});
