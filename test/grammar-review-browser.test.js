// Real App/StrictMode, disposable Edge storage, no production requests.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseline = process.env.REVIEW_BASELINE === '1';
const artifacts = mkdtempSync(join(tmpdir(), 'grammar-review-'));
const server = await createServer({
  plugins: baseline ? [{ name: 'review-head-reproduction', enforce: 'pre', load(id) {
    const path = id.replaceAll('\\', '/').split('/src/')[1];
    if (['components/grammar/GrammarReview.jsx', 'components/grammar/GrammarAnalysis.jsx', 'hooks/useGrammarStore.js', 'utils/grammarStorage.js'].includes(path)) {
      return execFileSync('git', ['show', `HEAD:src/${path}`], { encoding: 'utf8' });
    }
  } }] : [],
  cacheDir: join(artifacts, 'vite'), server: { host: '127.0.0.1', port: 0, hmr: false },
});
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false } });
    return route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Math.random = () => 0.99;
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('vocabmaster_grammar_saved', JSON.stringify(['a', 'b', 'c'].map(savedId => ({
        savedId, schemaVersion: 2, type: 'sentence-analysis', topic: 'Tenses',
        sentence: `Student ${savedId} studies English every day.`, vietnameseSentence: 'Câu kiểm tra.', grammarPoints: [], readingItems: [],
        hardMarked: true, userNotes: 'Keep this note.', savedAt: 1,
      }))));
      localStorage.setItem('vocabmaster_grammar_review', JSON.stringify(Object.fromEntries(['a', 'b', 'c'].map(id => [id, { level: 3, totalReviews: 4, wrongCount: 1, nextReviewAt: 0 }]))));
      sessionStorage.setItem('seeded', '1');
    }
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === window.failReviewKey) throw new DOMException('Test quota', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  const read = () => page.evaluate(() => ({
    review: JSON.parse(localStorage.getItem('vocabmaster_grammar_review')),
    stats: JSON.parse(localStorage.getItem('vocabmaster_grammar_stats')),
    pending: localStorage.getItem('vocabmaster_grammar_pending'),
    saved: localStorage.getItem('vocabmaster_grammar_saved'),
  }));
  async function openReview() {
    await page.getByRole('button', { name: 'Grammar', exact: true }).click();
    await page.getByRole('button', { name: /^Ôn tập/ }).click();
    await page.getByRole('button', { name: /^Tất cả \(/ }).click();
    await page.getByRole('button', { name: 'Bắt đầu ôn tập', exact: true }).click();
  }
  const yes = () => page.getByRole('button', { name: /^Đã hiểu/ });
  const no = () => page.getByRole('button', { name: /^Cần ôn lại/ });
  const color = button => button.evaluate(el => getComputedStyle(el).backgroundColor);
  await page.goto(origin); await openReview();
  const initial = await read();
  for (const [id, value, level, days] of [['a', true, 4, 14], ['b', false, 2, 3]]) {
    assert.equal(await yes().isEnabled(), true); assert.equal(await no().isEnabled(), true);
    const colorsBefore = [await color(yes()), await color(no())];
    await (value ? yes() : no()).click();
    assert.equal(await yes().isDisabled(), true); assert.equal(await no().isDisabled(), true);
    // Native rapid repeated/cross-button clicks must not record again.
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')].filter(b => /^(Đã hiểu|Cần ôn lại)/.test(b.textContent));
      for (let i = 0; i < 10; i++) buttons.forEach(b => b.click());
    });
    const stored = await read(); const rec = stored.review[id];
    assert.equal(rec.level, level); assert.equal(rec.totalReviews, 5);
    assert.equal(rec.wrongCount, value ? 1 : 2);
    assert.ok(Math.abs(rec.nextReviewAt - rec.lastReviewAt - days * 86400000) < 100);
    assert.equal(stored.stats.sentenceActivity.reviewed, id === 'a' ? 1 : 2);
    assert.equal(stored.stats.sentenceActivity.understood, 1);
    assert.equal(stored.stats.sentenceActivity.sessions[0].understood, value ? 1 : 0);
    assert.equal(stored.pending, 'true'); assert.equal(stored.saved, initial.saved);
    await page.mouse.move(0, 0);
    const colorsAfter = [await color(yes()), await color(no())];
    if (baseline) assert.deepEqual(colorsAfter, colorsBefore);
    else { assert.equal(colorsAfter[0], colorsAfter[1]); assert.notDeepEqual(colorsAfter, colorsBefore); }
    await page.screenshot({ path: join(artifacts, `${baseline ? 'before' : 'after'}-${id}.png`) });
    console.log(JSON.stringify({ id, value, rec, disabled: true, colorsBefore, colorsAfter }));
    await page.getByRole('button', { name: 'Câu tiếp', exact: true }).click();
  }
  if (baseline) {
    await page.evaluate(() => { window.failReviewKey = 'vocabmaster_grammar_review'; });
    await yes().click();
    assert.equal((await read()).review.c.totalReviews, 4);
    await page.evaluate(() => { window.failReviewKey = ''; });
    await yes().click();
    assert.equal((await read()).review.c.totalReviews, 6, 'HEAD mutates the review ref before a failed save, so retry counts twice');
    console.log('Reproduced HEAD quota failure: persisted totalReviews jumps 4 -> 6 on retry.');
  } else {
    for (const key of ['vocabmaster_grammar_pending', 'vocabmaster_grammar_stats', 'vocabmaster_grammar_review']) {
      const before = await read();
      await page.evaluate(key => { window.failReviewKey = key; }, key);
      await yes().click();
      await page.getByRole('alert').filter({ hasText: 'Chưa lưu' }).waitFor();
      assert.equal(await yes().isEnabled(), true); assert.equal(await no().isEnabled(), true);
      assert.deepEqual(await read(), before);
      await page.evaluate(() => { window.failReviewKey = ''; });
    }
    await yes().click();
    assert.equal((await read()).review.c.totalReviews, 5);
    assert.equal((await read()).stats.sentenceActivity.reviewed, 3);
    await page.getByRole('button', { name: 'Hoàn tất', exact: true }).click();
    await page.getByText('Đã hiểu: 2 · Cần ôn lại: 1 · Đã ôn: 3/3', { exact: true }).waitFor();
  }
  const committed = await read();
  await page.reload(); await openReview();
  assert.deepEqual(await read(), committed);
  assert.equal(await yes().isEnabled(), true);
  if (baseline) assert.equal(errors.length, 1);
  else assert.deepEqual(errors, []);
  console.log(`PASS ${baseline ? 'baseline reproduction' : 'review success/failure/retry/reload'}; screenshots: ${artifacts}`);
} finally { await browser?.close(); await server.close(); }
