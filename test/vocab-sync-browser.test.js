// Actual React App/StrictMode, disposable Edge contexts, no external network.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await createServer({ cacheDir: mkdtempSync(join(tmpdir(), 'vocab-sync-vite-')), server: { host: '127.0.0.1', port: 0, hmr: false } });
let browser;
try {
  await server.listen(); const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext(); const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  let snapshot = { protocol: 1, generation: 'clean', revision: 0, words: [{ id: 'vstep', english: 'community', vietnamese: 'cộng đồng', level: 3, annotation: 'keep', currentStreak: 2, createdAt: 1 }], tombstones: [], paused: false, ok: true };
  let posts = 0, fail = false;
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/api/vocab-sync') {
      if (route.request().method() === 'POST') {
        posts++; const p = route.request().postDataJSON();
        if (fail) return route.fulfill({ status: 503, json: { ok: false, error: 'test_failure' } });
        assert.equal(p.generation, snapshot.generation); assert.equal(p.expectedRevision, snapshot.revision);
        snapshot = { ...snapshot, words: p.words, tombstones: p.tombstones, requestId: p.requestId, revision: snapshot.revision + 1 };
      }
      return route.fulfill({ json: snapshot });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false } });
    return route.continue();
  });
  const untouched = { vocabmaster_grammar_underlines: '{"keep":[]}', vocabmaster_grammar_sentence_notes: '{"keep":[]}', vocabmaster_grammar_saved: '[]', vocabmaster_grammar_structures: '[]', vocabmaster_stats: '{"totalQuestions":7,"correctAnswers":5}' };
  await page.addInitScript(data => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', 'yes');
    for (const [key, value] of Object.entries(data)) localStorage.setItem(key, value);
    localStorage.setItem('vocabmaster_words', JSON.stringify(Array.from({ length: 614 }, (_, i) => ({ id: 'old' + i, english: 'old' + i, vietnamese: 'old', level: 1 }))));
  }, untouched);
  await page.goto(origin);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('vocabmaster_vocab_sync_v1') || '{}').base?.generation === 'clean');
  assert.equal(posts, 0);
  await page.locator('#nav-tab-vocabulary').click();
  assert.equal(await page.getByTitle('Delete', { exact: true }).count(), 1);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Xuất bản sao Vocabulary' }).click()]);
  assert.match(readFileSync(await download.path(), 'utf8'), /old613/);
  await page.getByRole('button', { name: 'Bật đồng bộ thiết bị' }).click();
  await page.getByTitle('Delete', { exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('vocabmaster_vocab_sync_v1')).base.revision === 1);
  assert.equal(snapshot.words.length, 0); assert.deepEqual(snapshot.tombstones, ['vstep']);
  async function add(english) {
    await page.getByPlaceholder('English word / phrase *').fill(english);
    await page.getByPlaceholder('Nghĩa tiếng Việt *').fill('nghĩa');
    await page.getByRole('button', { name: 'Add Word', exact: true }).click();
  }
  await add('offline-new');
  await page.getByRole('button', { name: 'Tạm dừng đồng bộ', exact: true }).click();
  await page.waitForTimeout(2300); assert.equal(posts, 1);
  await page.reload(); await page.locator('#nav-tab-vocabulary').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('vocabmaster_vocab_sync_v1')).words.some(w => w.english === 'offline-new'));
  await page.getByRole('button', { name: 'Bật đồng bộ thiết bị' }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('vocabmaster_vocab_sync_v1')).base.revision === 2);
  fail = true; await add('failed-new');
  await page.getByText('Vocabulary chưa đồng bộ:', { exact: false }).waitFor();
  assert.equal(snapshot.words.length, 1);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('vocabmaster_vocab_sync_v1')).words.length), 2);
  fail = false;
  // Replacement while this browser has pending changes: new generation wins,
  // pending is archived and never sent to the restored generation.
  snapshot = { ...snapshot, generation: 'restored', revision: 0, words: [], tombstones: [] };
  const before = posts; await page.locator('#nav-sync-btn').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('vocabmaster_vocab_sync_v1')).base.generation === 'restored');
  assert.equal(posts, before);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('vocabmaster_vocab_sync_v1')).words.length), 0);
  const preserved = await page.evaluate(keys => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])), Object.keys(untouched));
  assert.deepEqual(preserved, untouched); assert.deepEqual(errors, []);
  await page.setViewportSize({ width: 375, height: 850 });
  assert.equal(await page.getByTestId('vocab-sync-controls').evaluate(el => el.getBoundingClientRect().right <= innerWidth && el.scrollWidth <= el.clientWidth), true);
  console.log('PASS: App/StrictMode legacy adoption, backup download, final deletion, pause queued upload, offline reload, failed POST, generation replacement, other stores preserved, 375px.');
  await context.close();
} finally { await browser?.close(); await server.close(); }
