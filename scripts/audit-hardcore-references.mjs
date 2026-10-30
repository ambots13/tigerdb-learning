#!/usr/bin/env node
import { getHardcoreLesson } from '../src/hardcore.mjs';
import { loadAllLessons } from '../src/lessons.mjs';

const timeoutMs = Number(process.env.REFERENCE_AUDIT_TIMEOUT_MS || 10000);
const lessons = await loadAllLessons();
const sources = lessons
  .map((lesson) => getHardcoreLesson(lesson.id)?.deepDive?.sources ?? [])
  .flat();
const uniqueSources = [...new Map(sources.map((source) => [source.id, source])).values()];
const failures = [];

for (const source of uniqueSources) {
  if (!source.url || !source.locator?.heading && !source.locator?.anchor && !source.locator?.searchPhrase) {
    failures.push(`${source.id}: missing URL or exact locator`);
    continue;
  }
  try {
    const response = await fetch(source.url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
    if (!response.ok) failures.push(`${source.id}: HTTP ${response.status} (${source.url})`);
  } catch (error) {
    failures.push(`${source.id}: ${error.message} (${source.url})`);
  }
}

console.log(`Audited ${uniqueSources.length} unique Hardcore references.`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('All references resolved and include exact locators.');
}
