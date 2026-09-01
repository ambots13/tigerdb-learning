#!/usr/bin/env node
// Acceptance test: runs every step of every module against the database and
// checks that each module's reference solution still returns what it claims.
//
//   npm run verify            verify against the current database
//   npm run verify -- --fresh re-seed first, then verify
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { assertConnection, closePool, root } from './db.mjs';
import { loadAllLessons } from './lessons.mjs';
import { runLesson } from './runner.mjs';
import { c, rule, table } from './render.mjs';

/** Run a lesson with its output suppressed, so verify stays readable. */
async function runQuietly(lesson) {
  const original = console.log;
  const captured = [];
  console.log = (...args) => captured.push(args.join(' '));
  try {
    const result = await runLesson(lesson, { auto: true });
    return { ...result, output: captured };
  } finally {
    console.log = original;
  }
}

async function main() {
  const fresh = process.argv.includes('--fresh');
  const version = await assertConnection();
  console.log(`\n  ${c.bold('Verifying TigerData Learning Lab')} ${c.gray(`· TimescaleDB ${version}`)}`);

  if (fresh) {
    console.log(`  ${c.gray('Re-seeding ...')}`);
    execFileSync(process.execPath, [path.join(root, 'src', 'seed.mjs')], { stdio: 'ignore' });
  }
  console.log(rule());

  const lessons = await loadAllLessons();
  const results = [];
  let failures = 0;

  for (const lesson of lessons) {
    process.stdout.write(`  ${lesson.id} ${lesson.title.padEnd(34)}`);
    const started = Date.now();
    try {
      const outcome = await runQuietly(lesson);
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      const challenge = lesson.challenge
        ? outcome.challengePassed
          ? 'pass'
          : 'FAIL'
        : 'none';
      if (challenge === 'FAIL') failures += 1;
      results.push({
        module: lesson.id,
        steps: lesson.steps.length,
        challenge,
        took: `${seconds}s`,
      });
      console.log(
        challenge === 'FAIL'
          ? `${c.red('challenge failed')} ${c.gray(`(${seconds}s)`)}`
          : `${c.green('ok')} ${c.gray(`${lesson.steps.length} steps · ${seconds}s`)}`,
      );
    } catch (error) {
      failures += 1;
      results.push({ module: lesson.id, steps: lesson.steps.length, challenge: 'ERROR', took: '-' });
      console.log(c.red('failed'));
      console.log(`     ${c.red(error.message.split('\n')[0])}`);
    }
  }

  console.log(rule());
  console.log(table(results, ['module', 'steps', 'challenge', 'took'], 20));
  console.log('');
  if (failures) {
    console.log(`  ${c.red(c.bold(`${failures} module(s) failed.`))}\n`);
    process.exitCode = 1;
  } else {
    console.log(`  ${c.green(c.bold(`All ${lessons.length} modules passed.`))}\n`);
  }
}

main()
  .catch((error) => {
    console.error(`\n  ${c.red('Verify failed:')} ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(closePool);
