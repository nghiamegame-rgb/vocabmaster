/**
 * Real App + React DOM + browser Selection + local autosave regression.
 * Run: node test/underline-rendering.test.js
 * Requires Playwright (or PLAYWRIGHT_MODULE pointing to its index.mjs) and
 * installed Edge (or PLAYWRIGHT_EXECUTABLE_PATH). No dependency changes needed.
 * A fresh browser context uses synthetic data; all external requests are blocked.
 */
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { UNDERLINE_COLORS } from '../src/utils/sentenceUnderline.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sentence = 'The quick brown fox jumps over the lazy dog.';
const practiceSentence = 'The quick brown fox runs through the quiet park.';
const question = (text, index) => ({
  schemaVersion: 2, type: 'sentence-analysis', id: `s${index}`,
  sentence: text, vietnameseSentence: 'Câu dịch dùng riêng cho kiểm tra.', topic: 'Prepositions',
  grammarPoints: [{ category: 'Prepositions', phrase: text.includes('over') ? 'over' : 'through', explanation: 'Giới từ trong câu kiểm tra.' }],
  readingItems: [],
});
const savedQuestion = { ...question(sentence, 1), savedId: 'gq_browser', savedAt: 1, hardMarked: false, userNotes: 'Keep these notes.' };
const review = { gq_browser: { level: 3, wrongCount: 2, totalReviews: 4, nextReviewAt: 0 } };
const oldMarks = [{ start: 0, end: 3, color: 'pink' }];
const storageKeys = {
  saved: 'vocabmaster_grammar_saved', review: 'vocabmaster_grammar_review',
  stats: 'vocabmaster_grammar_stats', underlines: 'vocabmaster_grammar_underlines',
};
const initialStorage = {
  [storageKeys.saved]: JSON.stringify([savedQuestion]),
  [storageKeys.review]: JSON.stringify(review),
  [storageKeys.underlines]: JSON.stringify({ gq_untouched: oldMarks }),
  vocabmaster_grammar_pending: 'false',
};

const server = await createServer({
  cacheDir: mkdtempSync(join(tmpdir(), 'vocabmaster-underline-vite-')),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client', 'lucide-react'] },
  server: { host: '127.0.0.1', port: 0, hmr: false },
});
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, headless: true }
    : { channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    // Keep cloud offline so no network/timer-driven parent render can mask the bug.
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false, error: 'test_offline' } });
    return route.continue();
  });
  await page.addInitScript(data => {
    if (!sessionStorage.getItem('underline_fixture_initialized')) {
      for (const [key, value] of Object.entries(data)) localStorage.setItem(key, value);
      sessionStorage.setItem('underline_fixture_initialized', 'true');
    }
  }, initialStorage);

  const read = key => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), key);
  const marks = async key => (await read(storageKeys.underlines))[key] || [];
  const paragraphFor = text => page.locator('p').filter({ hasText: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
  async function collapsed() {
    const buttons = page.getByRole('button', { name: 'Hiện phân tích', exact: true });
    assert.ok(await buttons.count(), 'analysis is still collapsed');
    for (const button of await buttons.all()) assert.equal(await button.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.getByText('Giải thích nhanh', { exact: true }).count(), 0);
  }
  async function visibleMarks(paragraph) {
    return paragraph.evaluate(element => {
      let offset = 0;
      return [...element.children].flatMap(span => {
        const start = offset;
        offset += Array.from(span.textContent).length;
        return span.style.textDecorationLine === 'underline'
          ? [{ start, end: offset, color: span.style.textDecorationColor }] : [];
      });
    });
  }
  async function expectVisible(paragraph, expected) {
    const rendered = expected.map(segment => {
      const hex = UNDERLINE_COLORS[segment.color].hex.slice(1);
      const rgb = [0, 2, 4].map(at => parseInt(hex.slice(at, at + 2), 16));
      return { ...segment, color: `rgb(${rgb.join(', ')})` };
    });
    // Immediate DOM assertion, deliberately no retry/polling or extra UI action.
    assert.deepEqual(await visibleMarks(paragraph), rendered, 'visible underlines update immediately after the toolbar click');
  }
  async function apply(paragraph, key, start, end, color, expected, keepCollapsed = true) {
    await paragraph.evaluate((element, offsets) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      const locate = cp => {
        for (const node of nodes) {
          const chars = Array.from(node.textContent);
          if (cp <= chars.length) return [node, chars.slice(0, cp).join('').length];
          cp -= chars.length;
        }
        throw new Error('Selection offset outside sentence');
      };
      const range = document.createRange();
      range.setStart(...locate(offsets.start));
      range.setEnd(...locate(offsets.end));
      const selection = window.getSelection();
      selection.removeAllRanges(); selection.addRange(range);
      element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    }, { start, end });
    const name = color ? UNDERLINE_COLORS[color].label : 'Bỏ gạch chân';
    await page.getByRole('button', { name, exact: true }).click();
    await expectVisible(paragraph, expected);
    assert.deepEqual(await marks(key), expected, 'rendered marks match synchronous autosave');
    if (keepCollapsed) await collapsed();
  }
  async function exercise(paragraph, key, firstColor, secondColor) {
    await apply(paragraph, key, 4, 15, firstColor, [{ start: 4, end: 15, color: firstColor }]);
    await apply(paragraph, key, 10, 15, secondColor, [
      { start: 4, end: 10, color: firstColor }, { start: 10, end: 15, color: secondColor },
    ]);
    const result = [
      { start: 4, end: 10, color: firstColor },
      { start: 10, end: 11, color: secondColor }, { start: 13, end: 15, color: secondColor },
    ];
    await apply(paragraph, key, 11, 13, null, result);
    return result;
  }
  async function openGrammar() {
    await page.locator('#nav-tab-grammar').click();
    await page.getByRole('button', { name: 'Lỗi đồng bộ · Thử lại', exact: true }).waitFor();
  }
  async function startReview() {
    await page.locator('#grammar-tab-review').click();
    await page.getByRole('button', { name: 'Bắt đầu ôn tập', exact: true }).click();
    await collapsed();
  }

  await page.goto(origin);
  await openGrammar();
  await startReview();
  const beforeStats = await read(storageKeys.stats);
  const reviewMarks = await exercise(paragraphFor(sentence), savedQuestion.savedId, 'yellow', 'white');
  assert.deepEqual(await read(storageKeys.review), review, 'markup does not alter review progress');
  assert.deepEqual(await read(storageKeys.stats), beforeStats, 'markup does not record assessments or analysis activity');
  console.log('PASS Review: add, partial recolor and partial erase are immediate with analysis collapsed');

  await page.locator('#grammar-tab-stats').click();
  await startReview();
  await expectVisible(paragraphFor(sentence), reviewMarks);
  await page.reload();
  await openGrammar();
  await startReview();
  await expectVisible(paragraphFor(sentence), reviewMarks);
  await collapsed();
  assert.deepEqual(await read(storageKeys.saved), [savedQuestion], 'saved sentence identity and notes survive');
  console.log('PASS Review: navigate away/back and reload/reopen preserve marks');

  await page.getByRole('button', { name: 'Đã hiểu', exact: true }).click();
  const assessedReview = await read(storageKeys.review);
  const assessedStats = await read(storageKeys.stats);
  await apply(paragraphFor(sentence), savedQuestion.savedId, 16, 19, 'green', [...reviewMarks, { start: 16, end: 19, color: 'green' }]);
  assert.equal(await page.getByRole('button', { name: 'Đã hiểu ✓', exact: true }).isDisabled(), true, 'assessment state is retained');
  assert.deepEqual(await read(storageKeys.review), assessedReview);
  assert.deepEqual(await read(storageKeys.stats), assessedStats);
  console.log('PASS Review: underline edits retain an existing assessment');

  await page.locator('#grammar-tab-saved').click();
  await apply(paragraphFor(sentence), savedQuestion.savedId, 0, sentence.length, null, []);
  const savedMarks = await exercise(paragraphFor(sentence), savedQuestion.savedId, 'blue', 'pink');
  console.log('PASS Saved Sentences: immediate add, recolor and erase');

  await page.locator('#grammar-tab-practice').click();
  await page.getByRole('button', { name: '5', exact: true }).click();
  const questions = [practiceSentence, 'We walk through the woods.', 'They drive through the city.', 'I look through the window.', 'She runs through the garden.'].map((text, index) => question(text, index + 1));
  await page.locator('textarea').fill(JSON.stringify(questions));
  await page.getByRole('button', { name: 'Kiểm tra & bắt đầu', exact: true }).click();
  const practiceKey = `text:${practiceSentence}`;
  const practiceMarks = await exercise(paragraphFor(practiceSentence), practiceKey, 'green', 'white');
  await page.getByRole('button', { name: 'Lưu câu', exact: true }).click();
  const added = (await read(storageKeys.saved)).find(q => q.sentence === practiceSentence);
  assert.ok(added?.savedId);
  await expectVisible(paragraphFor(practiceSentence), practiceMarks);
  assert.deepEqual(await marks(added.savedId), practiceMarks);
  assert.deepEqual(await marks(practiceKey), []);
  await collapsed();
  // A real analysis state must also stay open when the underline props update.
  await page.getByRole('button', { name: 'Hiện phân tích', exact: true }).click();
  await apply(paragraphFor(practiceSentence), added.savedId, 0, 3, 'yellow', [{ start: 0, end: 3, color: 'yellow' }, ...practiceMarks], false);
  assert.equal(await page.getByRole('button', { name: 'Ẩn phân tích', exact: true }).getAttribute('aria-expanded'), 'true');
  assert.deepEqual(await marks(savedQuestion.savedId), savedMarks, 'editing practice leaves the other sentence untouched');
  assert.deepEqual(await marks('gq_untouched'), oldMarks, 'pre-existing underline data is preserved');
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  console.log('PASS Practice: immediate add/recolor/erase, text-key → savedId and open analysis state preserved');
} finally {
  await browser?.close();
  await server.close();
}
