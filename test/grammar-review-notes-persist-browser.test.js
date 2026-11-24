/** Isolated real App/browser test for Grammar Review note-visibility persistence across sentences. */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { LS_SENTENCE_NOTES } from '../src/utils/sentenceNotes.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const screenshotDir = process.env.REVIEW_NOTES_SCREENSHOT_DIR || '';
if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });

const s1 = 'Local communities often organize clean-up events near the river every weekend.';
const s2 = 'Students who review grammar regularly can identify complex clauses much faster.';
const s3 = 'Many employees prefer flexible hours because they reduce daily commuting stress.';
const s4 = 'Public libraries remain quiet places for independent study throughout the year.';
const s5 = 'Clear examples help learners remember useful sentence patterns during exams.';

const cpRange = (sentence, phrase) => {
  const index = sentence.indexOf(phrase);
  assert.ok(index >= 0, `Phrase "${phrase}" not found in "${sentence}"`);
  const start = Array.from(sentence.slice(0, index)).length;
  return { start, end: start + Array.from(phrase).length };
};

const makeQuestion = (sentence, savedId, phrase) => ({
  id: `ai_${savedId}`,
  schemaVersion: 2,
  type: 'sentence-analysis',
  sentence,
  topic: 'Prepositions',
  vietnameseSentence: `Bản dịch mẫu cho ${savedId}.`,
  grammarPoints: [{ category: 'Prepositions', phrase, explanation: 'Giải thích mẫu.' }],
  readingItems: [],
  savedId,
  savedAt: 1,
  userNotes: '',
  hardMarked: false,
});

const makeNote = (sentence, key, phrase, id, text) => ({
  id,
  sentenceKey: key,
  sentence,
  ...cpRange(sentence, phrase),
  quote: phrase,
  text,
  createdAt: 1,
  updatedAt: 1,
});

const initial = {
  vocabmaster_grammar_saved: JSON.stringify([
    makeQuestion(s1, 'gq_1', 'near the river'),
    makeQuestion(s2, 'gq_2', 'complex clauses'),
    makeQuestion(s3, 'gq_3', 'flexible hours'),
    makeQuestion(s4, 'gq_4', 'throughout the year'),
    makeQuestion(s5, 'gq_5', 'sentence patterns'),
  ]),
  vocabmaster_grammar_review: JSON.stringify({
    gq_1: { level: 2, totalReviews: 1, wrongCount: 0, nextReviewAt: 0 },
    gq_2: { level: 2, totalReviews: 1, wrongCount: 0, nextReviewAt: 0 },
    gq_3: { level: 2, totalReviews: 1, wrongCount: 0, nextReviewAt: 0 },
    gq_4: { level: 2, totalReviews: 1, wrongCount: 0, nextReviewAt: 0 },
    gq_5: { level: 2, totalReviews: 1, wrongCount: 0, nextReviewAt: 0 },
  }),
  vocabmaster_grammar_underlines: JSON.stringify({
    gq_1: [{ ...cpRange(s1, 'clean-up events'), color: 'yellow' }],
    gq_2: [{ ...cpRange(s2, 'complex clauses'), color: 'blue' }],
    gq_3: [{ ...cpRange(s3, 'flexible hours'), color: 'green' }],
    gq_5: [{ ...cpRange(s5, 'sentence patterns'), color: 'pink' }],
  }),
  [LS_SENTENCE_NOTES]: JSON.stringify({
    gq_1: [makeNote(s1, 'gq_1', 'clean-up events', 'n1', 'sự kiện dọn dẹp')],
    gq_2: [makeNote(s2, 'gq_2', 'complex clauses', 'n2', 'mệnh đề phức')],
    gq_3: [makeNote(s3, 'gq_3', 'flexible hours', 'n3', 'giờ làm linh hoạt')],
    // gq_4 intentionally has NO notes
    gq_5: [makeNote(s5, 'gq_5', 'sentence patterns', 'n5', 'mẫu câu')],
  }),
};

const server = await createServer({
  cacheDir: mkdtempSync(join(tmpdir(), 'vocabmaster-review-notes-persist-')),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client', 'lucide-react'] },
  server: { host: '127.0.0.1', port: 0, hmr: false },
});

let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, headless: true } : { channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false } });
    return route.continue();
  });

  await page.addInitScript(data => {
    Math.random = () => 0.99; // keep deterministic queue order gq_1..gq_5
    if (!sessionStorage.getItem('review_notes_persist_init')) {
      for (const [key, value] of Object.entries(data)) localStorage.setItem(key, value);
      sessionStorage.setItem('review_notes_persist_init', 'true');
    }
  }, initial);

  const area = () => page.locator('[data-sentence-area]').first();
  const paragraph = () => page.locator('[data-sentence-text]').first();
  const editor = page.getByRole('textbox', { name: 'Nội dung ghi chú', exact: true });

  async function selectPhrase(sentence, phrase) {
    const range = cpRange(sentence, phrase);
    await paragraph().evaluate((element, offsets) => {
      const nodes = [], walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) nodes.push(walker.currentNode);
      const at = cp => {
        for (const node of nodes) {
          const chars = Array.from(node.textContent);
          if (cp <= chars.length) return [node, chars.slice(0, cp).join('').length];
          cp -= chars.length;
        }
        throw new Error('Bad offset');
      };
      const domRange = document.createRange();
      domRange.setStart(...at(offsets.start));
      domRange.setEnd(...at(offsets.end));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(domRange);
      element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    }, range);
  }

  async function verifyNoteUnderUnderline(noteId, sentence, phrase) {
    const range = cpRange(sentence, phrase);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const geom = await area().evaluate(async (element, params) => {
      const { sentenceRangeRect } = await import('/src/utils/sentenceGeometry.js');
      const box = rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
      const textEl = element.querySelector('[data-sentence-text]');
      const labelEl = element.querySelector(`[data-sentence-note="${params.noteId}"]`);
      const phraseRect = sentenceRangeRect(textEl, params.range.start, params.range.end);
      const labelRect = labelEl.getBoundingClientRect();
      const areaRect = element.getBoundingClientRect();
      const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
      const textRects = [];
      while (walker.nextNode()) {
        const r = document.createRange();
        r.selectNodeContents(walker.currentNode);
        textRects.push(...[...r.getClientRects()].map(box));
      }
      const underlinedSpans = [...textEl.querySelectorAll('span')].filter(s => s.style.textDecorationLine === 'underline').length;
      return {
        area: box(areaRect),
        phrase: box(phraseRect),
        label: box(labelRect),
        textRects,
        underlinedSpans,
        visibility: getComputedStyle(labelEl).visibility,
      };
    }, { noteId, range });

    assert.equal(geom.visibility, 'visible', 'note label must be visible');
    assert.ok(geom.underlinedSpans >= 1, 'underline span must be present');
    const gap = geom.label.top - geom.phrase.bottom;
    assert.ok(gap >= 4 && gap <= 9, `note label must sit right below underlined phrase (gap=${gap})`);
    const overlap = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    assert.ok(!geom.textRects.some(t => overlap(geom.label, t)), 'note label must not overlap English text');
    assert.ok(geom.label.left >= geom.area.left - 1 && geom.label.right <= geom.area.right + 1, 'note label stays within sentence width');
    assert.ok(geom.label.bottom <= geom.area.bottom + 1, 'note label fits inside reserved sentence height');
  }

  await page.goto(origin);
  await page.locator('#nav-tab-grammar').click();
  await page.locator('#grammar-tab-review').click();
  await page.getByRole('button', { name: 'Bắt đầu ôn tập', exact: true }).click();

  // (a) Sentence 1 starts with notes hidden by default
  const toggleBtn1 = page.getByRole('button', { name: /^(Hiện|Ẩn) ghi chú/ });
  assert.equal(await toggleBtn1.getAttribute('aria-expanded'), 'false', 'Q1 starts with notes hidden');
  assert.equal(await area().locator('[data-sentence-note]').count(), 0);

  // Show notes + reveal analysis on Q1, then click Câu tiếp
  await toggleBtn1.click();
  assert.equal(await toggleBtn1.getAttribute('aria-expanded'), 'true');
  assert.equal(await area().locator('[data-sentence-note="n1"]').isVisible(), true);
  await page.getByRole('button', { name: 'Hiện phân tích', exact: true }).click();
  assert.equal(await page.getByText('Giải thích nhanh', { exact: true }).isVisible(), true);

  await page.getByRole('button', { name: 'Câu tiếp', exact: true }).click();

  // Q2 must show notes immediately (aria-expanded=true), while analysis resets to hidden
  const toggleBtn2 = page.getByRole('button', { name: /^(Hiện|Ẩn) ghi chú/ });
  assert.equal(await toggleBtn2.getAttribute('aria-expanded'), 'true', 'Q2 must inherit shown notes');
  assert.equal(await area().locator('[data-sentence-note="n2"]').isVisible(), true);
  assert.equal(await page.getByRole('button', { name: 'Hiện phân tích', exact: true }).getAttribute('aria-expanded'), 'false', 'Analysis must stay reset per sentence');
  assert.equal(await page.getByText('Giải thích nhanh', { exact: true }).count(), 0);

  // Verify Q2 note geometry at 1280px and capture screenshot
  await verifyNoteUnderUnderline('n2', s2, 'complex clauses');
  if (screenshotDir) {
    await page.screenshot({ path: join(screenshotDir, 'review-notes-q2-1280.png') });
  }

  // Verify Q2 note geometry & no horizontal overflow at 375px and capture screenshot
  await page.setViewportSize({ width: 375, height: 800 });
  await verifyNoteUnderUnderline('n2', s2, 'complex clauses');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'No horizontal overflow at 375px');
  if (screenshotDir) {
    await page.screenshot({ path: join(screenshotDir, 'review-notes-q2-375.png') });
  }
  await page.setViewportSize({ width: 1280, height: 800 });

  // (f) Toggling notes state must NOT close open note editor or lose underlines
  // (dispatch click without outside pointerdown so SentenceNoteEditor's own outside-click close doesn't mask it)
  await area().locator('[data-sentence-note="n2"]').click();
  await editor.waitFor({ state: 'visible' });
  await toggleBtn2.dispatchEvent('click'); // hide notes while editor stays open
  assert.equal(await toggleBtn2.getAttribute('aria-expanded'), 'false');
  assert.equal(await editor.isVisible(), true, 'Toggling notes must not close open note editor');
  const underlineCount = await paragraph().evaluate(el => [...el.querySelectorAll('span')].filter(s => s.style.textDecorationLine === 'underline').length);
  assert.ok(underlineCount >= 1, 'Toggling notes must not remove underlines');
  await page.getByRole('button', { name: 'Xong', exact: true }).click();

  // (b) Notes are currently hidden on Q2 -> Câu tiếp -> Q3 must start hidden
  await page.getByRole('button', { name: 'Câu tiếp', exact: true }).click();
  const toggleBtn3 = page.getByRole('button', { name: /^(Hiện|Ẩn) ghi chú/ });
  assert.equal(await toggleBtn3.getAttribute('aria-expanded'), 'false', 'Q3 must inherit hidden notes');
  assert.equal(await area().locator('[data-sentence-note]').count(), 0);

  // (d) Creating a new note on Q3 automatically reveals notes -> state persists to subsequent sentences
  await selectPhrase(s3, 'daily commuting');
  await page.getByRole('button', { name: 'Ghi chú', exact: true }).click();
  await editor.fill('đi lại hàng ngày');
  assert.equal(await toggleBtn3.getAttribute('aria-expanded'), 'true', 'Creating note must reveal notes');
  assert.equal(await area().locator('[data-sentence-note="n3"]').isVisible(), true);
  await page.getByRole('button', { name: 'Xong', exact: true }).click();

  // (c) Q4 has 0 notes (no toggle button) -> must NOT lose shown state for Q5
  await page.getByRole('button', { name: 'Câu tiếp', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: /^(Hiện|Ẩn) ghi chú/ }).count(), 0, 'Q4 has no notes');
  await page.getByRole('button', { name: 'Câu tiếp', exact: true }).click();

  const toggleBtn5 = page.getByRole('button', { name: /^(Hiện|Ẩn) ghi chú/ });
  assert.equal(await toggleBtn5.getAttribute('aria-expanded'), 'true', 'Q5 must still show notes after 0-note Q4');
  assert.equal(await area().locator('[data-sentence-note="n5"]').isVisible(), true);
  await verifyNoteUnderUnderline('n5', s5, 'sentence patterns');

  // (e) Finish session and start a new review session -> resets back to hidden by default
  await page.getByRole('button', { name: 'Hoàn tất', exact: true }).click();
  await page.getByRole('button', { name: 'Chọn bộ ôn', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu ôn tập', exact: true }).click();

  const toggleBtnRestart = page.getByRole('button', { name: /^(Hiện|Ẩn) ghi chú/ });
  assert.equal(await toggleBtnRestart.getAttribute('aria-expanded'), 'false', 'New review session must reset to hidden');
  assert.equal(await area().locator('[data-sentence-note]').count(), 0);

  assert.deepEqual(errors, [], 'No uncaught browser errors');
  console.log('PASS: Grammar Review note-visibility persistence (show/hide across sentences, 0-note middle sentence, note-creation reveal, session reset, editor/underline preserved, 1280/375px).');
  await context.close();
} finally {
  await browser?.close();
  await server.close();
}
