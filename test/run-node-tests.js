/**
 * `npm test`: runs every Node test file one after another (no browser).
 * Browser tests need Playwright + Edge and are run separately (docs/HANDOFF.md §7).
 * Exits non-zero if any file fails.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const BROWSER = /chromium|playwright/i;
const files = readdirSync('test')
  .filter(name => name.endsWith('.test.js'))
  .filter(name => !BROWSER.test(readFileSync(`test/${name}`, 'utf8')))
  .sort();

const failed = [];
for (const name of files) {
  const started = Date.now();
  const result = spawnSync(process.execPath, [`test/${name}`], { encoding: 'utf8' });
  const ok = result.status === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${Date.now() - started} ms)`);
  if (!ok) {
    failed.push(name);
    console.log((result.stdout || '') + (result.stderr || ''));
  }
}
console.log(`\n${files.length - failed.length}/${files.length} test files passed.`);
if (failed.length) {
  console.log(`Failed: ${failed.join(', ')}`);
  process.exit(1);
}
