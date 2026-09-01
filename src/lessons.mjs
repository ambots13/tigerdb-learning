// Discovers lesson modules in modules/<nn>-<slug>/lesson.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { root } from './db.mjs';

export const modulesDir = path.join(root, 'modules');

export function listModuleDirs() {
  if (!fs.existsSync(modulesDir)) return [];
  return fs
    .readdirSync(modulesDir)
    .filter((name) => /^\d\d-/.test(name))
    .filter((name) => fs.existsSync(path.join(modulesDir, name, 'lesson.mjs')))
    .sort();
}

export async function loadLesson(dirName) {
  const file = path.join(modulesDir, dirName, 'lesson.mjs');
  const mod = await import(pathToFileURL(file).href);
  const lesson = mod.default;
  lesson.dir = dirName;
  lesson.id = lesson.id ?? dirName.slice(0, 2);
  return lesson;
}

export async function loadAllLessons() {
  const lessons = [];
  for (const dir of listModuleDirs()) lessons.push(await loadLesson(dir));
  return lessons;
}

/** Resolve "3", "03", "hypertables", or "01-hypertables" to a lesson. */
export async function resolveLesson(selector) {
  const dirs = listModuleDirs();
  const needle = String(selector).toLowerCase();
  const padded = /^\d+$/.test(needle) ? needle.padStart(2, '0') : null;
  const match =
    dirs.find((d) => d.toLowerCase() === needle) ||
    (padded && dirs.find((d) => d.startsWith(`${padded}-`))) ||
    dirs.find((d) => d.slice(3).toLowerCase() === needle) ||
    dirs.find((d) => d.slice(3).toLowerCase().includes(needle));
  if (!match) return null;
  return loadLesson(match);
}
