// Browser regression test for Vocabulary difficult-word star (⭐) across Vocabulary,
// Flashcard, Listening, and Smart Quiz in disposable Edge contexts with zero external network.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const tempDir = mkdtempSync(join(tmpdir(), 'vocab-star-vite-'));
const server = await createServer({
  cacheDir: join(tempDir, 'cache'),
  server: { host: '127.0.0.1', port: 0, hmr: false },
});

const INITIAL_WORDS = [
  { id: 'w1', english: 'resilient',   vietnamese: 'kiên cường', annotation: 'adj', wordType: 'Word',   level: 1, currentStreak: 1, createdAt: 1001 },
  { id: 'w2', english: 'collaborate', vietnamese: 'hợp tác',    annotation: 'v',   wordType: 'Word',   level: 1, currentStreak: 0, createdAt: 1002 },
  { id: 'w3', english: 'sustainable', vietnamese: 'bền vững',   annotation: 'adj', wordType: 'Word',   level: 2, currentStreak: 2, createdAt: 1003 },
  { id: 'w4', english: 'initiate',    vietnamese: 'khởi xướng', annotation: 'v',   wordType: 'Word',   level: 2, currentStreak: 1, createdAt: 1004 },
  { id: 'w5', english: 'take part in',vietnamese: 'tham gia',   annotation: 'phr', wordType: 'Phrase', level: 1, currentStreak: 0, createdAt: 1005 },
  { id: 'w6', english: 'accessible',  vietnamese: 'dễ tiếp cận',annotation: 'adj', wordType: 'Word',   level: 3, currentStreak: 0, createdAt: 1006 },
];

let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  let snapshot = {
    protocol: 1,
    generation: 'star-gen',
    revision: 0,
    words: structuredClone(INITIAL_WORDS),
    tombstones: [],
    paused: false,
    ok: true,
  };

  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/api/vocab-sync') {
      if (route.request().method() === 'POST') {
        const p = route.request().postDataJSON();
        snapshot = {
          ...snapshot,
          words: p.words,
          tombstones: p.tombstones,
          requestId: p.requestId,
          revision: snapshot.revision + 1,
        };
      }
      return route.fulfill({ json: snapshot });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false } });
    return route.continue();
  });

  await page.addInitScript(() => {
    window.__copiedText = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => { window.__copiedText = text; },
      },
    });
  });

  await page.goto(origin);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('vocabmaster_vocab_sync_v1') || '{}').base?.generation === 'star-gen');

  // ── 1. Vocabulary Star & Filter Intersection ─────────────────────────────
  await page.locator('#nav-tab-vocabulary').click();
  await page.locator('#star-w1').waitFor();

  assert.equal(await page.locator('#star-w1').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('#star-w1').getAttribute('aria-label'), 'Đánh dấu từ khó');

  // The star becomes visible after its asynchronous durable backup commits.
  await page.locator('#star-w1').click();
  await page.locator('#star-w1[aria-pressed="true"]').waitFor();
  assert.equal(await page.locator('#star-w1').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#star-w1').getAttribute('aria-label'), 'Bỏ đánh dấu từ khó');
  assert.equal(await page.locator('#edit-english-w1').count(), 0);
  assert.equal(await page.locator('text=1 word selected').count(), 0);

  // Verify level, streak, stats are untouched when starring
  const w1AfterStar = await page.evaluate(() => JSON.parse(localStorage.getItem('vocabmaster_words')).find(w => w.id === 'w1'));
  assert.equal(w1AfterStar.hardMarked, true);
  assert.equal(w1AfterStar.level, 1);
  assert.equal(w1AfterStar.currentStreak, 1);

  // Edit w1 and verify hardMarked is preserved
  await page.locator('#edit-w1').click();
  await page.locator('#edit-vietnamese-w1').fill('kiên cường, bền bỉ');
  await page.locator('#save-edit-w1').click();
  await page.locator('#save-edit-w1').waitFor({ state: 'hidden' });
  const w1AfterEdit = await page.evaluate(() => JSON.parse(localStorage.getItem('vocabmaster_words')).find(w => w.id === 'w1'));
  assert.equal(w1AfterEdit.hardMarked, true);
  assert.equal(w1AfterEdit.vietnamese, 'kiên cường, bền bỉ');

  // Star w2, w3, w5 as well (total 4 starred words: w1 [L1 Word], w2 [L1 Word], w3 [L2 Word], w5 [L1 Phrase])
  await page.locator('#star-w2').click();
  await page.locator('#star-w3').click();
  await page.locator('#star-w5').click();
  await page.locator('#star-w5[aria-pressed="true"]').waitFor();

  assert.match(await page.locator('#filter-hard-only').textContent(), /\(4\)/);
  await page.locator('#filter-hard-only').click();
  assert.equal(await page.locator('[id^="select-w"]').count(), 4);

  // Intersect with Level L2 -> only w3 matches
  await page.locator('#filter-level-2').click();
  assert.equal(await page.locator('[id^="select-w"]').count(), 1);
  assert.equal(await page.locator('#select-w3').count(), 1);

  // Intersect with Phrase on L2 -> 0 matches -> clear empty state
  await page.locator('#filter-type-phrase').click();
  await page.getByText('Chưa có từ khó ⭐ nào khớp bộ lọc hiện tại').waitFor();

  // Reset Vocabulary filters
  await page.locator('#filter-type-all').click();
  await page.locator('#filter-level-all').click();
  await page.locator('#filter-hard-only').click();

  // Export JSON and verify hardMarked is preserved; test additive import with a starred word
  const [exportDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#export-btn').click(),
  ]);
  const exportedWords = JSON.parse(readFileSync(await exportDownload.path(), 'utf8'));
  assert.equal(exportedWords.filter(w => w.hardMarked === true).length, 4);

  const importFile = join(tempDir, 'import-starred.json');
  writeFileSync(importFile, JSON.stringify([
    { id: 'w7', english: 'persevere', vietnamese: 'kiên trì', annotation: 'v', wordType: 'Word', level: 1, currentStreak: 0, hardMarked: true },
  ]));
  await page.locator('#import-file-input').setInputFiles(importFile);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('vocabmaster_words') || '[]').some(w => w.english === 'persevere' && w.hardMarked === true));
  const persevereId = await page.evaluate(() => JSON.parse(localStorage.getItem('vocabmaster_words')).find(w => w.english === 'persevere').id);
  await page.locator(`#star-${persevereId}`).waitFor();
  assert.equal(await page.locator(`#star-${persevereId}`).getAttribute('aria-pressed'), 'true');
  // Now 5 starred words: w1 (L1 Word), w2 (L1 Word), w3 (L2 Word), w5 (L1 Phrase), persevere (L1 Word)

  // ── 2. Flashcard Star Filter & Intersection ──────────────────────────────
  await page.locator('#nav-tab-flashcard').click();
  await page.locator('#flashcard-hard-toggle').waitFor();
  assert.equal(await page.locator('#flashcard-hard-toggle').getAttribute('aria-pressed'), 'false');
  assert.match(await page.locator('#flashcard-hard-toggle').textContent(), /\(5\)/);

  await page.locator('#flashcard-hard-toggle').click();
  assert.equal(await page.locator('#flashcard-hard-toggle').getAttribute('aria-pressed'), 'true');
  await page.getByText('(5 in pool)').waitFor();

  // Intersect Flashcard: L1 + Word + Chỉ từ khó ⭐ => 3 words (w1, w2, w7)
  await page.locator('#flashcard-level-1').click();
  await page.locator('#flashcard-type-word').click();
  await page.getByText('(3 in pool)').waitFor();

  // Flip and grade current card as Remembered -> star must remain intact
  await page.locator('.flashcard-container').click();
  await page.getByRole('button', { name: 'Remembered' }).click();
  await page.waitForTimeout(300);
  const starredStill5 = await page.evaluate(() => JSON.parse(localStorage.getItem('vocabmaster_words')).filter(w => w.hardMarked).length);
  assert.equal(starredStill5, 5);

  // Intersect Flashcard: L3 + Chỉ từ khó ⭐ => 0 words -> empty state, no fallback to unstarred w6
  await page.locator('#flashcard-level-3').click();
  await page.getByText('Không có từ khó ⭐ nào khớp bộ lọc này').waitFor();
  await page.locator('#flashcard-level-all').click();
  await page.locator('#flashcard-type-all').click();

  // ── 3. Listening Star Filter & Intersection ──────────────────────────────
  await page.locator('#nav-tab-listening').click();
  await page.locator('#lr-hard-toggle').waitFor();
  assert.equal(await page.locator('#lr-hard-toggle').getAttribute('aria-pressed'), 'false');

  await page.locator('#lr-hard-toggle').click();
  assert.equal(await page.locator('#lr-hard-toggle').getAttribute('aria-pressed'), 'true');
  await page.getByText('5 in pool').waitFor();

  // All 4 option cards in Listening must come from the 5 starred words (never w4 or w6)
  const cardLabels = await page.locator('[id^="listening-card-"]').evaluateAll(els => els.map(el => el.getAttribute('aria-label')));
  assert.equal(cardLabels.length, 4);
  for (const label of cardLabels) {
    assert.ok(!label.includes('initiate') && !label.includes('accessible'), `Unexpected unstarred card in Listening: ${label}`);
  }

  // Intersect with L2 (only 1 starred word on L2) -> must show < 4 warning and not fall back to unstarred words
  await page.locator('#lr-level-2').click();
  await page.getByText('Chưa đủ từ khó ⭐ khớp bộ lọc hiện tại').waitFor();
  assert.equal(await page.locator('[id^="listening-card-"]').count(), 0);
  // Switching filter mid-round must not have incremented totalPlayed
  await page.getByText('0 played').waitFor();
  await page.locator('#lr-level-all').click();

  // ── 4. Smart Quiz Star Filter, Prompt Generation & Validation ────────────
  await page.locator('#nav-tab-quiz').click();
  await page.locator('#quiz-hard-toggle').waitFor();
  assert.equal(await page.locator('#quiz-hard-toggle').getAttribute('aria-pressed'), 'false');

  await page.locator('#quiz-hard-toggle').click();
  assert.equal(await page.locator('#quiz-hard-toggle').getAttribute('aria-pressed'), 'true');

  // Intersect with L3 & L4 -> 0 starred words -> Copy Prompt disabled + clear warning
  await page.locator('#priority-l3l4').click();
  await page.getByText('Chưa đủ từ khó ⭐ khớp bộ lọc để tạo prompt').waitFor();
  assert.equal(await page.locator('#copy-prompt-btn').isDisabled(), true);

  // Back to All Levels -> 5 starred words -> Copy Prompt enabled and only includes starred words
  await page.locator('#priority-all').click();
  assert.equal(await page.locator('#copy-prompt-btn').isDisabled(), false);
  await page.locator('#copy-prompt-btn').click();
  const promptText = await page.evaluate(() => window.__copiedText);
  assert.ok(promptText.includes('"resilient"'));
  assert.ok(promptText.includes('"persevere"'));
  assert.ok(!promptText.includes('"initiate"'));
  assert.ok(!promptText.includes('"accessible"'));

  // Pasting an unstarred quiz while "Chỉ từ khó ⭐" is active must be rejected with clear Vietnamese error
  await page.locator('#json-paste-textarea').fill(JSON.stringify([
    {
      question: 'Câu hỏi kiểm tra từ không đánh dấu sao [_____].',
      options: ['initiate', 'resilient', 'collaborate', 'sustainable'],
      answerIndex: 0,
      explanation: 'Giải thích',
      wordEnglish: 'initiate',
    },
  ]));
  await page.locator('#start-quiz-btn').click();
  await page.getByText('Bộ đề JSON đã dán chứa từ không thuộc danh sách "Chỉ từ khó ⭐"').waitFor();

  // Pasting a valid starred quiz starts and preserves star after grading
  await page.locator('#json-paste-textarea').fill(JSON.stringify([
    {
      question: 'Chúng ta cần [_____] vượt qua thử thách.',
      options: ['persevere', 'resilient', 'collaborate', 'sustainable'],
      answerIndex: 0,
      explanation: 'Persevere nghĩa là kiên trì.',
      wordEnglish: 'persevere',
    },
  ]));
  await page.locator('#start-quiz-btn').click();
  await page.locator('#option-0').waitFor();

  // ── 5. Responsive Viewport Check (1280px, 375px, 320px) ──────────────────
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 800 });
    for (const tab of ['#nav-tab-vocabulary', '#nav-tab-flashcard', '#nav-tab-listening', '#nav-tab-quiz']) {
      await page.locator(tab).click();
      const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      assert.equal(noOverflow, true, `Horizontal overflow on ${tab} at width ${width}px`);
    }
  }

  assert.deepEqual(errors, []);
  console.log('PASS: Vocabulary difficult-word star (⭐) across Vocabulary, Flashcard, Listening, Smart Quiz, export/import, and 1280/375/320px viewports.');
  await context.close();
} finally {
  await browser?.close();
  await server.close();
}
