#!/usr/bin/env node
import { loadAllLessons } from './lessons.mjs';
import { getHardcoreLesson } from './hardcore.mjs';
import { closePool, query } from './db.mjs';

const shouldRun = process.argv.includes('--run');

function classify(error) {
  if (!error) return null;
  if (error.code === '42601') return 'SQL syntax error';
  if (['42883', '42704', '0A000'].includes(error.code)) return 'unavailable extension or function';
  if (['42P01', '42703'].includes(error.code)) return 'incorrect schema assumption';
  if (['3D000', '28P01'].includes(error.code)) return 'missing setup';
  if (error.code === '40001' || error.code === '40P01') return 'state mutation from an earlier activity';
  return 'version incompatibility or unknown execution failure';
}

function add(items, lessonId, activityId, sql, kind) {
  if (typeof sql !== 'string' || !sql.trim()) return;
  items.push({ lessonId, activityId, kind, sql: sql.trim() });
}

const lessons = await loadAllLessons();
const items = [];
for (const lesson of lessons) {
  const hardcore = getHardcoreLesson(lesson.id);
  lesson.steps.forEach((step, index) => add(items, lesson.id, `step-${index + 1}`, Array.isArray(step.sql) ? step.sql.join('\n\n') : step.sql, 'lesson-step'));
  hardcore?.drills.forEach((drill, index) => add(items, lesson.id, `drill-${index + 1}`, drill.starterSql, 'drill-starter'));
  hardcore?.deepDive?.phases.flatMap((phase) => phase.activities).forEach((activity) => {
    add(items, lesson.id, activity.id, activity.sql, 'activity');
    add(items, lesson.id, activity.id, activity.starterSql, 'activity-starter');
  });
}

const inventory = [];
for (const item of items) {
  const record = { ...item, error: null, sqlState: null, classification: null };
  if (shouldRun) {
    try {
      await query(item.sql);
    } catch (error) {
      record.error = error.message;
      record.sqlState = error.code ?? null;
      record.classification = classify(error);
    }
  }
  inventory.push(record);
}

process.stdout.write(`${JSON.stringify({
  generatedAt: new Date().toISOString(),
  mode: shouldRun ? 'executed' : 'manifest',
  count: inventory.length,
  failures: inventory.filter((item) => item.error).length,
  items: inventory,
}, null, 2)}\n`);

if (shouldRun) await closePool();
