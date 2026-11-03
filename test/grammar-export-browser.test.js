// Real App + Edge, disposable storage and blocked external network.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { inspectXlsx } from './helpers/inspect-xlsx.js';
import { WEBHOOK_URL } from '../src/config.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const question = (text, savedId) => ({ schemaVersion: 2, type: 'sentence-analysis', sentence: text, savedId,
  topic: 'Tenses', vietnameseSentence: 'Bản dịch thử.', grammarPoints: [{ category: 'Tenses', phrase: text, explanation: 'Giải thích.' }], readingItems: [] });
const saved = [question('They purchase books.', 'saved-1'), { savedId: 'legacy', sentence: 'In fact, they _____ art.', options: { A: 'purchase', B: 'PRIVATE', C: 'PRIVATE', D: 'PRIVATE' }, answer: 'A', topic: 'Tenses' }];
const fixture = {
  vocabmaster_words: JSON.stringify(['purchase', 'in fact', 'art', 'café', '=1+1', ...Array.from({ length: 32 }, (_, i) => `phrase ${i}`)].map((english, i) => ({ id: `w${i}`, english, annotation: 'PRIVATE', vietnamese: 'PRIVATE', level: 3, currentStreak: 2 }))),
  vocabmaster_grammar_saved: JSON.stringify(saved),
  vocabmaster_grammar_review: JSON.stringify({ 'saved-1': { level: 3, totalReviews: 2 } }),
  vocabmaster_grammar_underlines: JSON.stringify({ 'saved-1': [{ start: 0, end: 4, color: 'blue' }] }),
  vocabmaster_grammar_sentence_notes: '{}',
};
const server = await createServer({ cacheDir: mkdtempSync(join(tmpdir(), 'grammar-export-vite-')), server: { host: '127.0.0.1', port: 0, hmr: false } });
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, headless: true } : { channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let release;
  let cloudQuestions = null;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) {
      if (!url.searchParams.has('scope')) await gate;
      if (cloudQuestions && !url.searchParams.has('scope') && route.request().method() === 'GET') return route.fulfill({ json: { ok: true, revision: 1, savedQuestions: cloudQuestions, reviewProgress: {} } });
      return route.fulfill({ status: 503, json: { ok: false } });
    }
    return route.continue();
  });
  await page.addInitScript(data => {
    for (const [key, value] of Object.entries(data)) localStorage.setItem(key, value);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.copiedExcelPrompt = text; } } });
  }, fixture);
  await page.goto(origin);
  await page.locator('#nav-tab-grammar').click();
  const panel = page.getByTestId('grammar-export');
  await panel.getByText('Đang tải/đồng bộ hai kho.', { exact: false }).waitFor();
  assert.equal(await panel.getByRole('button', { name: 'Xuất Excel + Prompt', exact: true }).isDisabled(), true);
  release();
  await panel.getByText('Đang tải/đồng bộ hai kho.', { exact: false }).waitFor({ state: 'hidden' });
  assert.equal(await panel.getByRole('button', { name: 'Xuất Excel + Prompt', exact: true }).isDisabled(), true);
  await panel.getByRole('checkbox').check();
  const download = async name => {
    const [file] = await Promise.all([page.waitForEvent('download'), panel.getByRole('button', { name, exact: true }).click()]);
    const workbook = inspectXlsx(readFileSync(await file.path()));
    return { file, workbook };
  };
  const first = await download('Xuất Excel + Prompt');
  const preview = panel.locator('#grammar-excel-prompt');
  const original = await preview.inputValue();
  assert.ok(original.includes(first.file.suggestedFilename()));
  assert.ok(!original.includes('PRIVATE'));
  assert.equal(first.workbook.sheets[0].rows.length, 38);
  assert.deepEqual(first.workbook.sheets[1].rows.slice(1).map(r => r[0].value), ['They purchase books.', 'In fact, they purchase art.']);
  assert.ok(original.includes('["purchase",2]'));
  await panel.getByRole('button', { name: 'Copy Prompt Excel', exact: true }).click();
  assert.equal(await page.evaluate(() => window.copiedExcelPrompt), original);
  await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('denied'); }; });
  await panel.getByRole('button', { name: 'Copy Prompt Excel', exact: true }).click();
  await panel.getByText('Không thể copy tự động.', { exact: false }).waitFor();
  const retry = await download('Tải lại Excel');
  assert.equal(retry.file.suggestedFilename(), first.file.suggestedFilename());
  assert.deepEqual(retry.workbook, first.workbook);
  await preview.focus();
  assert.equal(await preview.evaluate(el => el.selectionEnd - el.selectionStart), original.length);
  // Configuration invalidates both download and copy; old prompt stays paired.
  await page.getByRole('button', { name: '5', exact: true }).click();
  await page.locator('select').selectOption('Tenses');
  await panel.getByText('Gói Excel + Prompt đã lỗi thời', { exact: false }).waitFor();
  assert.equal(await panel.getByRole('button', { name: 'Tải lại Excel', exact: true }).isDisabled(), true);
  assert.equal(await panel.getByRole('button', { name: 'Copy Prompt Excel', exact: true }).isDisabled(), true);
  assert.equal(await preview.inputValue(), original);
  const regenerated = await download('Tạo lại Excel + Prompt');
  const current = await preview.inputValue();
  assert.notEqual(regenerated.file.suggestedFilename(), first.file.suggestedFilename());
  assert.ok(current.includes('MAIN FOCUS: Tenses'));
  assert.ok(current.includes('Generate exactly 5 complete'));
  // Unsaved Practice imports must not leak into the exported saved corpus.
  const imported = Array.from({ length: 5 }, (_, i) => question(`They purchase fresh fruit number ${i}.`));
  await page.getByPlaceholder('Dán JSON từ AI vào đây.', { exact: false }).fill(JSON.stringify(imported));
  await page.getByRole('button', { name: 'Kiểm tra & bắt đầu', exact: true }).click();
  await page.getByRole('button', { name: 'Lưu câu', exact: true }).waitFor();
  await page.locator('#grammar-tab-saved').click();
  await page.locator('#grammar-tab-practice').click();
  assert.equal(await preview.inputValue(), current);
  assert.equal(await panel.getByText('Gói Excel + Prompt đã lỗi thời', { exact: false }).count(), 0);
  await panel.getByRole('checkbox').check();
  const unchanged = await download('Tải lại Excel');
  assert.deepEqual(unchanged.workbook, regenerated.workbook);
  // Saving one of those sentences must invalidate the export snapshot.
  await page.getByPlaceholder('Dán JSON từ AI vào đây.', { exact: false }).fill(JSON.stringify(imported));
  await page.getByRole('button', { name: 'Kiểm tra & bắt đầu', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Tôi vẫn muốn luyện' }).check();
  await page.getByRole('button', { name: 'Xác nhận và bắt đầu', exact: true }).click();
  await page.getByRole('button', { name: 'Lưu câu', exact: true }).click();
  await page.locator('#grammar-tab-saved').click();
  await page.locator('#grammar-tab-practice').click();
  await panel.getByText('Gói Excel + Prompt đã lỗi thời', { exact: false }).waitFor();
  await panel.getByRole('checkbox').check();
  const savedExport = await download('Tạo lại Excel + Prompt');
  assert.equal(savedExport.workbook.sheets[1].rows.length, 4);
  assert.ok((await preview.inputValue()).includes('["purchase",3]'));
  // A newer GET must stale the package without replacing its old prompt/file.
  const beforeCloud = await preview.inputValue();
  cloudQuestions = [...saved, question('They purchase notebooks.', 'cloud-added')];
  await page.getByRole('button', { name: 'Lỗi đồng bộ · Thử lại', exact: true }).click();
  await panel.getByText('Gói Excel + Prompt đã lỗi thời', { exact: false }).waitFor();
  assert.equal(await preview.inputValue(), beforeCloud);
  assert.equal(await panel.getByRole('button', { name: 'Copy Prompt Excel', exact: true }).isDisabled(), true);
  const fromCloud = await download('Tạo lại Excel + Prompt');
  assert.equal(fromCloud.workbook.sheets[1].rows.length, 5);
  assert.ok((await preview.inputValue()).includes('["purchase",4]'));
  for (const key of ['vocabmaster_words', 'vocabmaster_grammar_review', 'vocabmaster_grammar_underlines', 'vocabmaster_grammar_sentence_notes']) assert.equal(await page.evaluate(k => localStorage.getItem(k), key), fixture[key]);
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await panel.screenshot({ path: join(tmpdir(), `grammar-export-${width}.png`) });
  }
  assert.deepEqual(errors, []);
  await context.close();
  // Missing and invalid local stores must be distinguishable, never partial.
  for (const [name, data, blocked] of [
    ['empty', {}, false],
    ['legacy-unresolved', { vocabmaster_grammar_saved: JSON.stringify([{ savedId: 'bad', sentence: 'They _____ books.' }]) }, true],
    ['broken-grammar', { vocabmaster_grammar_saved: '{broken' }, true],
    ['broken-vocab', { vocabmaster_words: '{broken' }, true],
    ['unavailable-vocab', {}, true],
  ]) {
    const c = await browser.newContext({ acceptDownloads: true });
    const p = await c.newPage();
    p.on('pageerror', error => errors.push(error.message));
    await p.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false } });
      return route.continue();
    });
    await p.addInitScript(values => { for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value); }, data);
    if (name === 'unavailable-vocab') await p.addInitScript(() => {
      const get = Storage.prototype.getItem;
      Storage.prototype.getItem = function(key) { if (key === 'vocabmaster_words') throw new Error('read unavailable'); return get.call(this, key); };
    });
    await p.goto(origin);
    await p.locator('#nav-tab-grammar').click();
    const exportPanel = p.getByTestId('grammar-export');
    await exportPanel.getByRole('checkbox').check();
    await exportPanel.getByText('Đang tải/đồng bộ hai kho.', { exact: false }).waitFor({ state: 'hidden' });
    assert.equal(await exportPanel.getByRole('button', { name: 'Xuất Excel + Prompt', exact: true }).isDisabled(), blocked, name);
    if (name.startsWith('broken-')) {
      await exportPanel.getByRole('alert').waitFor();
      const key = name === 'broken-vocab' ? 'vocabmaster_words' : 'vocabmaster_grammar_saved';
      assert.equal(await p.evaluate(k => localStorage.getItem(k), key), data[key]);
    }
    if (!blocked) {
      const [file] = await Promise.all([p.waitForEvent('download'), exportPanel.getByRole('button', { name: 'Xuất Excel + Prompt', exact: true }).click()]);
      assert.deepEqual(inspectXlsx(readFileSync(await file.path())).sheets.map(s => s.rows.length), [1, 1]);
    }
    await c.close();
  }
  assert.deepEqual(errors, []);
  // A successful Vocabulary GET stays confirmed after its Navbar badge expires.
  const verifiedContext = await browser.newContext({ acceptDownloads: true });
  const verifiedPage = await verifiedContext.newPage();
  let readRequests = 0;
  verifiedPage.on('pageerror', error => errors.push(error.message));
  await verifiedPage.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname === WEBHOOK_URL && route.request().method() === 'GET') {
      readRequests++;
      return route.fulfill({ json: { ok: true, protocol: 1, generation: 'fixture', revision: 0, tombstones: [], paused: true, words: JSON.parse(fixture.vocabmaster_words) } });
    }
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) {
      if (url.searchParams.has('scope')) return route.fulfill({ status: 503, json: { ok: false } });
      if (route.request().method() === 'POST') {
        const payload = route.request().postDataJSON();
        return route.fulfill({ json: { ok: true, revision: payload.expectedRevision + 1, written: payload.savedQuestions.length } });
      }
      readRequests++;
      return route.fulfill({ json: { ok: true, revision: 1, savedQuestions: saved, reviewProgress: JSON.parse(fixture.vocabmaster_grammar_review) } });
    }
    return route.continue();
  });
  await verifiedPage.addInitScript(data => { for (const [key, value] of Object.entries(data)) localStorage.setItem(key, value); }, fixture);
  await verifiedPage.goto(origin);
  await verifiedPage.locator('#nav-tab-grammar').click();
  const verifiedPanel = verifiedPage.getByTestId('grammar-export');
  await verifiedPanel.getByRole('button', { name: 'Xuất Excel + Prompt', exact: true }).waitFor();
  await verifiedPage.waitForTimeout(3300);
  assert.equal(await verifiedPanel.getByRole('checkbox').count(), 0, await verifiedPanel.innerText());
  assert.equal(await verifiedPanel.getByRole('button', { name: 'Xuất Excel + Prompt', exact: true }).isEnabled(), true);
  const readsBeforeExport = readRequests;
  await Promise.all([verifiedPage.waitForEvent('download'), verifiedPanel.getByRole('button', { name: 'Xuất Excel + Prompt', exact: true }).click()]);
  assert.equal(readRequests, readsBeforeExport);
  await verifiedContext.close();
  assert.deepEqual(errors, []);
  console.log('PASS: real XLSX downloads, snapshot/settings/import/save, copy/manual fallback, preserved data, loading/offline/empty/corrupt stores, desktop/375/320px');
} finally {
  await browser?.close();
  await server.close();
}
