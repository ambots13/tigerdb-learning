#!/usr/bin/env node
// Entry point: `npm run lesson <id>` / `npm run lessons`
import { assertConnection, closePool, query } from './db.mjs';
import { loadAllLessons, resolveLesson } from './lessons.mjs';
import { runLesson } from './runner.mjs';
import { c, rule, wrap } from './render.mjs';

function parseArgs(argv) {
  const options = { auto: false, from: 0 };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--auto') options.auto = true;
    else if (arg === '--from') options.from = Number(argv[++i]);
    else if (arg.startsWith('--from=')) options.from = Number(arg.split('=')[1]);
    else positional.push(arg);
  }
  return { options, positional };
}

async function showList() {
  const lessons = await loadAllLessons();
  console.log('');
  console.log(`  ${c.bold(c.cyan('TigerData Learning Lab'))}`);
  console.log(rule());
  let track = null;
  for (const lesson of lessons) {
    const current = Number(lesson.id) <= 8 ? 'Core track' : 'Advanced track';
    if (current !== track) {
      track = current;
      console.log(
        `  ${c.bold(c.yellow(track))} ${c.gray(
          track === 'Core track'
            ? '- start here, in order'
            : '- standalone deep dives, any order',
        )}`,
      );
    }
    console.log(
      `  ${c.bold(c.yellow(lesson.id))}  ${c.bold(lesson.title.padEnd(36))} ${c.gray(lesson.duration || '')}`,
    );
    console.log(`      ${c.gray(lesson.summary)}`);
  }
  console.log(rule());
  console.log(`  ${c.gray('Run one with:')} npm run lesson 01`);
  console.log(`  ${c.gray('Free-form playground:')} npm run play\n`);
}

async function seedWarning() {
  const { rows } = await query(
    "SELECT to_regclass('public.readings') IS NOT NULL AS seeded",
  );
  if (!rows[0]?.seeded) {
    console.log(
      `\n  ${c.yellow('!')} Sample data not found. Run ${c.bold('npm run seed')} first.\n`,
    );
    return false;
  }
  return true;
}

async function main() {
  const { options, positional } = parseArgs(process.argv.slice(2));
  const selector = positional[0];

  if (!selector || selector === 'list') {
    await showList();
    return;
  }

  const version = await assertConnection();
  const lesson = await resolveLesson(selector);
  if (!lesson) {
    console.error(`\n  ${c.red('No module matches')} "${selector}"\n`);
    await showList();
    process.exitCode = 1;
    return;
  }

  if (lesson.requiresSeed !== false && !(await seedWarning())) {
    process.exitCode = 1;
    return;
  }

  console.log(c.gray(`\n  Connected · TimescaleDB ${version}`));
  await runLesson(lesson, options);
}

main()
  .catch((error) => {
    console.error(`\n  ${c.red('Error:')} ${wrap(error.message, '  ').trimStart()}\n`);
    process.exitCode = 1;
  })
  .finally(closePool);
