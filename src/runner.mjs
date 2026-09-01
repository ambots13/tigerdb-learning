// The lesson engine: walks a lesson's steps, runs SQL, shows results, and
// grades the closing challenge.
import readline from 'node:readline';
import { query, timeQuery } from './db.mjs';
import { c, heading, wrap, sqlBlock, table, bytes, ms, rule, callout } from './render.mjs';

function createPrompt(auto) {
  if (auto) {
    return { ask: async () => '', close() {} };
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const pending = [];
  const waiting = [];
  let closed = false;

  // Lines are queued as they arrive rather than read via rl.question(), because
  // piped input is consumed in one burst and readline then closes, which would
  // otherwise discard every answer after the first.
  rl.on('line', (line) => {
    if (waiting.length) waiting.shift()(line);
    else pending.push(line);
  });
  rl.on('close', () => {
    closed = true;
    while (waiting.length) waiting.shift()('');
  });
  rl.on('SIGINT', () => {
    rl.close();
    process.exit(0);
  });

  return {
    ask: (question) => {
      process.stdout.write(question);
      if (pending.length) {
        const line = pending.shift();
        process.stdout.write(`${line}\n`);
        return Promise.resolve(line);
      }
      // At EOF, behave as if the user pressed Enter instead of throwing.
      if (closed) {
        process.stdout.write('\n');
        return Promise.resolve('');
      }
      return new Promise((resolve) => waiting.push(resolve));
    },
    close: () => {
      if (!closed) rl.close();
    },
  };
}

const print = (text = '') => console.log(text);

/** Helpers handed to a step's custom run() function. */
function makeContext() {
  return { query, timeQuery, print, table, c, bytes, ms, wrap, heading, sqlBlock };
}

async function runStep(step, index, total, options, prompt) {
  print(heading(`Step ${index + 1}/${total} · ${step.title}`));
  if (step.explain) print('\n' + wrap(step.explain, '  '));

  if (step.sql) {
    const statements = Array.isArray(step.sql) ? step.sql : [step.sql];
    print('\n' + statements.map((s) => sqlBlock(s)).join('\n'));
    if (!options.auto) {
      const answer = await prompt.ask(
        `\n  ${c.dim('[Enter] run  ·  [s] skip  ·  [q] quit  ')}`,
      );
      const key = answer.trim().toLowerCase();
      if (key === 'q') return 'quit';
      if (key === 's') return 'skipped';
    }

    // Statements are sent one at a time: a multi-statement string runs inside an
    // implicit transaction, and procedures such as refresh_continuous_aggregate
    // are not allowed there.
    let result;
    for (const statement of statements) {
      const started = Date.now();
      result = await query(statement);
      const elapsed = Date.now() - started;

      if (result.rows.length) {
        if (result.fields.length === 1 && result.fields[0] === 'QUERY PLAN') {
          const limit = step.maxRows ?? 14;
          print('');
          for (const row of result.rows.slice(0, limit)) print('  ' + c.gray(row['QUERY PLAN']));
          if (result.rows.length > limit) {
            print('  ' + c.gray(`… ${result.rows.length - limit} more plan line(s)`));
          }
        } else {
          print('\n' + table(result.rows, result.fields, step.maxRows ?? 10));
        }
        print(`\n  ${c.gray(`${result.rows.length} row(s) · ${ms(elapsed)}`)}`);
      } else {
        print(`\n  ${c.green('✓')} ${result.command || 'OK'} ${c.gray(`· ${ms(elapsed)}`)}`);
      }
    }

    if (step.verify) await step.verify(result);
  }

  if (step.run) {
    if (!options.auto && !step.sql) {
      const answer = await prompt.ask(`\n  ${c.dim('[Enter] run  ·  [q] quit  ')}`);
      if (answer.trim().toLowerCase() === 'q') return 'quit';
    }
    await step.run(makeContext());
  }

  if (step.takeaway) print(callout('Takeaway', step.takeaway, c.green));
  if (step.note) print(callout('Note', step.note, c.yellow));
  return 'ok';
}

async function runChallenge(challenge, options, prompt) {
  print(heading('Challenge'));
  print('\n' + wrap(challenge.prompt, '  '));
  if (challenge.hint) print(callout('Hint', challenge.hint, c.blue));

  if (options.auto) {
    // Non-interactive: prove the reference solution still works.
    const result = await query(challenge.solution);
    const ok = await challenge.check(result.rows, result);
    print(
      ok
        ? `\n  ${c.green('✓ reference solution passes')}`
        : `\n  ${c.red('✗ reference solution FAILED')}`,
    );
    return ok;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    print(`\n  ${c.dim('Type your SQL on one line. [Enter] to reveal the answer.')}`);
    const answer = (await prompt.ask('  sql> ')).trim();
    if (!answer) break;
    try {
      const result = await query(answer);
      print('\n' + table(result.rows, result.fields, 10));
      if (await challenge.check(result.rows, result)) {
        print(`\n  ${c.green('✓ Correct.')}`);
        return true;
      }
      print(`\n  ${c.yellow('Not quite - the shape or values are off. Try again.')}`);
    } catch (error) {
      print(`\n  ${c.red('SQL error:')} ${error.message}`);
    }
  }

  print(`\n  ${c.bold('Reference solution:')}`);
  print('\n' + sqlBlock(challenge.solution));
  return false;
}

export async function runLesson(lesson, options = {}) {
  const steps = lesson.steps.filter((s) => !s.skip);
  const prompt = createPrompt(options.auto);

  print('');
  print(rule('═'));
  print(`  ${c.bold(c.cyan(`Module ${lesson.id} · ${lesson.title}`))}`);
  print(`  ${c.gray(lesson.summary)}`);
  if (lesson.objectives?.length) {
    print('');
    print(`  ${c.bold('You will learn to:')}`);
    for (const objective of lesson.objectives) print(`    ${c.cyan('·')} ${objective}`);
  }
  print(rule('═'));

  try {
    if (lesson.setup) await lesson.setup(makeContext());

    const from = options.from ? options.from - 1 : 0;
    for (let i = from; i < steps.length; i += 1) {
      const outcome = await runStep(steps[i], i, steps.length, options, prompt);
      if (outcome === 'quit') {
        print(`\n  ${c.gray('Stopped. Resume with:')} npm run lesson ${lesson.id} -- --from ${i + 1}`);
        return { completed: false };
      }
    }

    let challengePassed = true;
    if (lesson.challenge) {
      challengePassed = await runChallenge(lesson.challenge, options, prompt);
    }

    print('\n' + rule('═'));
    print(`  ${c.green(c.bold('Module complete.'))}`);
    if (lesson.next) print(`  ${c.gray(lesson.next)}`);
    print(rule('═') + '\n');
    return { completed: true, challengePassed };
  } finally {
    prompt.close();
  }
}
