// Real App/StrictMode + IndexedDB in disposable Edge contexts, localhost mocks only.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await createServer({ cacheDir: mkdtempSync(join(tmpdir(), 'vocab-quota-')), server: { host: '127.0.0.1', port: 0, hmr: false } });
let browser;
try {
  await server.listen(); const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext(); const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const word = { id: 'a', english: 'community', vietnamese: 'cộng đồng', annotation: 'keep', level: 4, currentStreak: 3, lastReviewedDate: 123, createdAt: 1 };
  let snapshot = { protocol: 1, generation: 'g', revision: 0, words: [word], tombstones: [], ok: true };
  const words = [{ ...word, hardMarked: true }, { ...word, id: 'offline', english: 'offline' }];
  const initial = JSON.stringify({ base: snapshot, words });
  const untouched = {
    vocabmaster_vocab_backup_old: '{"state":{"words":[{"english":"old-backup"}]}}',
    vocabmaster_grammar_saved: '[]', vocabmaster_grammar_structures: '[]',
    vocabmaster_grammar_underlines: '{"keep":[]}', vocabmaster_grammar_sentence_notes: '{"keep":[]}',
    vocabmaster_stats: '{"totalQuestions":7,"correctAnswers":5}',
  };
  let posts = 0;
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/api/vocab-sync') {
      if (route.request().method() === 'POST') {
        posts++; const p = route.request().postDataJSON();
        assert.ok(p.words.length, 'never send synthetic empty data');
        snapshot = { ...snapshot, words: p.words, tombstones: p.tombstones, requestId: p.requestId, revision: snapshot.revision + 1 };
      }
      return route.fulfill({ json: snapshot });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false } });
    return route.continue();
  });
  await page.addInitScript(({ initial, words, untouched }) => {
    if (!sessionStorage.getItem('seeded')) {
      for (const [key, value] of Object.entries(untouched)) localStorage.setItem(key, value);
      localStorage.setItem('vocabmaster_words', JSON.stringify(words));
      localStorage.setItem('vocabmaster_vocab_sync_v1', initial);
      localStorage.setItem('vocabmaster_vocab_sync_paused', 'false');
      sessionStorage.setItem('seeded', 'true'); sessionStorage.setItem('fail-backup', 'true');
    }
    // The original failing setItem path must no longer be used for new backups.
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('vocabmaster_vocab_backup_')) throw new DOMException('legacy backup full', 'QuotaExceededError');
      return set.call(this, key, value);
    };
    const add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === 'backups' && sessionStorage.getItem('fail-backup') === 'true') throw new DOMException('backup full', 'QuotaExceededError');
      return add.apply(this, args);
    };
  }, { initial, words, untouched });
  await page.goto(origin);
  const controls = page.getByTestId('vocab-sync-controls');
  await controls.getByText('Không đủ dung lượng', { exact: false }).waitFor();
  const total = page.getByText('Total Words', { exact: true }).locator('..');
  assert.match(await total.innerText(), /2/);
  assert.equal(posts, 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('vocabmaster_vocab_sync_v1')), initial);
  await page.locator('#nav-sync-btn').click();
  await controls.getByText('Không đủ dung lượng', { exact: false }).waitFor();
  await page.reload();
  await controls.getByText('Không đủ dung lượng', { exact: false }).waitFor();
  assert.equal(posts, 0); assert.match(await total.innerText(), /2/);
  await page.locator('#nav-tab-vocabulary').click();
  assert.equal(await page.locator('#star-a').getAttribute('aria-pressed'), 'true');
  const [failedDownload] = await Promise.all([page.waitForEvent('download'), controls.getByRole('button', { name: 'Xuất bản sao Vocabulary' }).click()]);
  const failedBackup = JSON.parse(readFileSync(await failedDownload.path(), 'utf8'));
  assert.equal(failedBackup.vocabmaster_vocab_backup_old, untouched.vocabmaster_vocab_backup_old);
  assert.equal(failedBackup.vocabmaster_vocab_sync_v1, initial);
  await page.evaluate(() => sessionStorage.setItem('fail-backup', 'false'));
  await page.locator('#nav-sync-btn').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('vocabmaster_vocab_sync_v1')).base.revision === 1);
  assert.deepEqual(snapshot.words, words);
  assert.equal(await controls.getByText('Không đủ dung lượng', { exact: false }).count(), 0);
  async function backupCount() {
    return page.evaluate(async () => {
      const { createVocabBackupStore } = await import('/src/utils/vocabBackup.js');
      return Object.keys(await createVocabBackupStore().entries()).length;
    });
  }
  async function sync() {
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/api/vocab-sync')),
      page.locator('#nav-sync-btn').click(),
    ]);
    await page.getByText('Vocabulary synced successfully!', { exact: false }).waitFor();
  }
  // Settle the raw snapshot after the acknowledged write, then retry and reload.
  await sync();
  const count = await backupCount();
  await page.reload(); await page.getByText('Vocabulary synced successfully!', { exact: false }).waitFor();
  await sync();
  assert.equal(await backupCount(), count);
  assert.equal(posts, 1);
  const [download] = await Promise.all([page.waitForEvent('download'), controls.getByRole('button', { name: 'Xuất bản sao Vocabulary' }).click()]);
  const backup = JSON.parse(readFileSync(await download.path(), 'utf8'));
  assert.equal(Object.keys(backup.indexedDBBackups).length, count);
  assert.ok(Object.values(backup.indexedDBBackups).some(text => text.includes('hardMarked')));
  const kept = await page.evaluate(keys => Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])), Object.keys(untouched));
  assert.deepEqual(kept, untouched);

  // Corrupt active snapshot: show the readable mirror, never silently adopt/upload it.
  await page.evaluate(() => localStorage.setItem('vocabmaster_vocab_sync_v1', '{broken'));
  await page.reload(); await controls.getByText('chỉ để xem', { exact: false }).waitFor();
  assert.match(await total.innerText(), /2/); assert.equal(posts, 1);
  await page.evaluate(() => localStorage.setItem('vocabmaster_words', '{broken'));
  await page.reload(); await controls.getByText('Chưa xác định', { exact: false }).waitFor();
  assert.match(await total.innerText(), /—/); assert.equal(posts, 1);
  assert.deepEqual(errors, []);
  console.log('PASS: real backup quota, retained Dashboard/pending/stars, retry/reload dedup, complete old+IndexedDB export, corrupt-cache guard, other stores unchanged.');
  await context.close();
} finally { await browser?.close(); await server.close(); }
