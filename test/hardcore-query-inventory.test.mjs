import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('query inventory manifest covers executable Hardcore SQL without requiring a database', async () => {
  const { stdout } = await execFileAsync(process.execPath, ['src/hardcore-query-inventory.mjs'], {
    maxBuffer: 2 * 1024 * 1024,
  });
  const manifest = JSON.parse(stdout);
  assert.equal(manifest.mode, 'manifest');
  assert.ok(manifest.count > 20);
  assert.ok(manifest.items.every((item) => item.lessonId && item.activityId && item.sql));
});
