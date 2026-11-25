// Browser test: Dictation → Thư viện bài → "Xuất Excel (.xlsx)" downloads a one-column
// sentence list; the .json backup is unchanged. Real App in a disposable Edge context,
// localhost only. Needs Python in PATH. Run: node test/dictation-export-browser.test.js
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { inspectXlsx } from './helpers/inspect-xlsx.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await createServer({
  cacheDir: mkdtempSync(join(tmpdir(), 'dictation-export-vite-')),
  server: { host: '127.0.0.1', port: 0, hmr: false },
});

let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  const downloads = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('download', d => downloads.push(d.suggestedFilename()));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false, error: 'unconfigured' } });
    return route.continue();
  });
  await page.goto(origin);
  await page.locator('#nav-tab-dictation').click();
  await page.locator('#dictation-section-library[aria-selected="true"]').waitFor();
  const exportButton = page.locator('#dictation-export-xlsx');
  const note = page.getByText('File Excel chỉ chứa các câu tiếng Anh, mỗi dòng một câu.', { exact: false });
  await note.waitFor();
  assert.ok(!(await note.innerText()).includes('2 sheet'));

  // ── Empty library: message, no file ──
  await exportButton.click();
  await page.getByText('Chưa có câu nào để xuất.', { exact: true }).waitFor();
  await page.waitForTimeout(1000);
  assert.deepEqual(downloads, [], 'nothing downloaded');

  async function addLesson(title, text) {
    await page.locator('#dictation-lesson-title').fill(title);
    await page.locator('#dictation-lesson-text').fill(text);
    await page.locator('#dictation-add-lesson').click();
    await page.getByText(`Đã tạo bài “${title}”`, { exact: false }).waitFor();
  }
  await addLesson('Bài một', 'The shop opens at nine. | Cửa hàng mở lúc chín giờ.\nPlease wait here.');
  await addLesson('Bài sẽ xoá', 'This lesson is removed.');
  await addLesson('Bài ba', 'please WAIT here.\nSee you tomorrow. | Hẹn mai gặp.');
  await page.getByRole('button', { name: 'Xoá bài Bài sẽ xoá' }).click();
  await page.getByRole('button', { name: 'Xoá bài', exact: true }).click();

  // ── Export ──
  const [file] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
  assert.match(file.suggestedFilename(), /^Dictation-\d{4}-\d{2}-\d{2}\.xlsx$/);
  await page.getByText('Đã xuất Excel: 3 câu.', { exact: true }).waitFor();
  const book = inspectXlsx(readFileSync(await file.path()));
  assert.deepEqual(book.sheets.map(s => s.name), ['Câu tiếng Anh']);
  assert.deepEqual(book.sheets[0].rows.map(row => row.map(cell => cell.value)),
    [['The shop opens at nine.'], ['Please wait here.'], ['See you tomorrow.']]);

  // ── The .json backup still holds everything, deleted records included ──
  const [backup] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Xuất bản sao (.json)' }).click()]);
  const json = JSON.parse(readFileSync(await backup.path(), 'utf8'));
  assert.equal(json.dictation.sentences.length, 5);
  assert.equal(json.dictation.sentences.filter(s => s.deletedAt).length, 1);
  assert.equal(json.dictation.sentences[0].vietnamese, 'Cửa hàng mở lúc chín giờ.');
  assert.ok(Array.isArray(json.dictation.words));
  assert.deepEqual(errors, []);
  console.log('PASS: Dictation Excel export — empty message without a file, one sheet/one column of sentences, note text, .json backup unchanged.');
  await context.close();
} finally { await browser?.close(); await server.close(); }
