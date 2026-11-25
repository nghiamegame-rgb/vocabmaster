// Browser test: Dictation sync between two devices through a simulated backend
// (the real dictation-apps-script.js running in a Node VM behind a fake proxy route).
// Pass ≠ proof that the real Apps Script/Vercel deployment works.
// Run: node test/dictation-sync-browser.test.js
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { dictationBackend } from './helpers/dictation-backend.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await createServer({
  cacheDir: mkdtempSync(join(tmpdir(), 'dictation-sync-vite-')),
  server: { host: '127.0.0.1', port: 0, hmr: false },
});
const backend = dictationBackend();
const statusFor = body => (body.ok ? 200 : body.error === 'conflict' ? 409 : body.error === 'unauthorized' ? 401 : 400);
let unconfigured = false;
let posts = 0;

let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });

  async function device(name) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/api/dictation-sync') {
        if (unconfigured) return route.fulfill({ status: 503, json: { ok: false, error: 'unconfigured' } });
        const request = route.request();
        let body;
        if (request.method() === 'POST') {
          posts++;
          body = backend.context.doPost({ postData: { contents: JSON.stringify({ ...JSON.parse(request.postData()), secret: 'test-secret' }) } });
        } else body = backend.get();
        return route.fulfill({ status: statusFor(body), json: JSON.parse(JSON.stringify(body)) });
      }
      if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false } });
      return route.continue();
    });
    await context.addInitScript(() => {
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak(u) { setTimeout(() => u.onend?.(), 10); }, cancel() {}, getVoices: () => [{ lang: 'en-US' }], addEventListener() {} } });
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`));
    await page.goto(origin);
    await page.locator('#nav-tab-dictation').click();
    return { context, page, errors };
  }
  const synced = page => page.locator('#dictation-sync-status[data-status="ok"]').waitFor({ timeout: 15000 });

  // ── Device A creates a lesson and saves a word ──
  const A = await device('A');
  await synced(A.page);
  await A.page.locator('#dictation-section-library').click();
  await A.page.locator('#dictation-lesson-title').fill('Bài đồng bộ');
  await A.page.locator('#dictation-lesson-text').fill('Hello world. | Xin chào thế giới.\nGood night.');
  await A.page.locator('#dictation-add-lesson').click();
  await A.page.locator('#dictation-section-practice').click();
  await A.page.locator('#dictation-answer').fill('hello');
  await A.page.locator('button[data-word="hello"]').click();
  await A.page.locator('li[data-saved="true"] button[data-word="hello"]').waitFor();
  await A.page.locator('#dictation-answer').fill('hello world');
  await A.page.locator('#dictation-submit').click();
  await A.page.getByText('Chính xác! Cả câu đúng.').waitFor();
  await A.page.locator('#dictation-sync-status[data-status="pending"]').waitFor();
  await synced(A.page); // after the 2.5 s debounce
  let cloud = backend.get();
  assert.equal(cloud.sentences.length, 2);
  assert.equal(cloud.sentences[0].lastResult, 'correct');
  assert.deepEqual(cloud.words.map(w => w.id), ['hello']);
  assert.equal(backend.sheets.get('Từ vựng').getRange(2, 1).getValue(), 'Hello', 'readable column shows the word as in the sentence');
  assert.equal(backend.sheets.get('Câu hoàn chỉnh').getRange(2, 5).getValue(), 'Đúng');

  // ── Device B receives everything, then deletes the word ──
  const B = await device('B');
  await synced(B.page);
  await B.page.locator('#dictation-counter').waitFor();
  assert.equal(await B.page.locator('#dictation-cell-1').getAttribute('data-status'), 'correct');
  await B.page.locator('#dictation-section-words').click();
  await B.page.locator('#dictation-words-view-list').click();
  await B.page.locator('#dictation-word-hello').waitFor();
  await B.page.getByRole('button', { name: 'Xoá từ Hello' }).click();
  await B.page.getByText('Chưa có từ nào.', { exact: false }).waitFor();
  await synced(B.page);
  assert.equal(liveRecords(backend.get().words).length, 0);

  // ── Device A (stale copy still showing the word) syncs: the deletion wins ──
  await A.page.locator('#dictation-section-words').click();
  await A.page.locator('#dictation-words-view-list').click();
  await A.page.locator('#dictation-word-hello').waitFor();
  await A.page.locator('#dictation-sync-now').click();
  await A.page.getByText('Chưa có từ nào.', { exact: false }).waitFor();
  await synced(A.page);
  assert.equal(liveRecords(backend.get().words).length, 0, 'old device did not revive the word');
  const local = await A.page.evaluate(() => JSON.parse(localStorage.getItem('vocabmaster_dictation_data')));
  assert.ok(local.words[0].deletedAt, 'tombstone stored locally');

  // ── Not configured yet: clear message inside the tab, data stays local ──
  unconfigured = true;
  const postsBefore = posts;
  const C = await device('C');
  await C.page.locator('#dictation-sync-status[data-status="unconfigured"]').waitFor();
  assert.match(await C.page.locator('#dictation-sync-status').innerText(), /Chưa cài đặt đồng bộ Google Sheet/);
  assert.equal(posts, postsBefore);
  assert.equal(await C.page.locator('#nav-sync-status [data-sync-chip]').count() <= 1, true, 'no extra navbar chip for Dictation');

  for (const d of [A, B, C]) { assert.deepEqual(d.errors, []); await d.context.close(); }
  console.log('PASS: Dictation sync — device A → Sheet → device B, deletion on B wins over stale A, unconfigured message, no navbar chip.');
} finally { await browser?.close(); await server.close(); }

function liveRecords(list) { return (list || []).filter(r => !r.deletedAt); }
