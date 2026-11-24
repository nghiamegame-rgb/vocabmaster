// Browser test for Smart Quiz Multiple-Choice audio + visual feedback
// in disposable Edge contexts with zero external network and stubbed speechSynthesis/Audio.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const tempDir = mkdtempSync(join(tmpdir(), 'quiz-feedback-vite-'));
const screenshotDir = process.env.QUIZ_FEEDBACK_SCREENSHOT_DIR || '';
if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });

const server = await createServer({
  cacheDir: join(tempDir, 'cache'),
  server: { host: '127.0.0.1', port: 0, hmr: false },
});

const SAMPLE_SVG_DATA_URI =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#4f46e5"/><stop offset="100%" stop-color="#0d9488"/>' +
      '</linearGradient></defs>' +
      '<rect width="320" height="240" fill="url(#g)"/>' +
      '<circle cx="160" cy="105" r="46" fill="rgba(255,255,255,0.22)"/>' +
      '<text x="160" y="114" font-family="sans-serif" font-size="22" font-weight="bold" fill="#fff" text-anchor="middle">IMG</text>' +
    '</svg>'
  );

const INITIAL_WORDS = [
  { id: 'w1', english: 'resilient',   vietnamese: 'kiên cường', annotation: 'adj', wordType: 'Word', level: 1, currentStreak: 0, createdAt: 1001, imageUrl: SAMPLE_SVG_DATA_URI },
  { id: 'w2', english: 'collaborate', vietnamese: 'hợp tác',    annotation: 'v',   wordType: 'Word', level: 1, currentStreak: 0, createdAt: 1002 },
  { id: 'w3', english: 'sustainable', vietnamese: 'bền vững',   annotation: 'adj', wordType: 'Word', level: 1, currentStreak: 0, createdAt: 1003, imageUrl: 'https://invalid.example.test/broken.png' },
  { id: 'w4', english: 'initiate',    vietnamese: 'khởi xướng', annotation: 'v',   wordType: 'Word', level: 1, currentStreak: 0, createdAt: 1004 },
];

const QUIZ_QUESTIONS = [
  {
    question: 'Người học cần có tinh thần [_____] khi ôn thi VSTEP.',
    options: ['kiên cường', 'hợp tác', 'bền vững', 'khởi xướng'],
    answerIndex: 0,
    explanation: 'Resilient (adj) nghĩa là kiên cường, có khả năng phục hồi nhanh.',
    wordEnglish: 'resilient',
  },
  {
    question: 'Các nhóm nên [_____] để hoàn thành dự án đúng hạn.',
    options: ['hợp tác', 'kiên cường', 'bền vững', 'khởi xướng'],
    answerIndex: 0,
    explanation: 'Collaborate (v) nghĩa là hợp tác cùng làm việc.',
    wordEnglish: 'collaborate',
  },
  {
    question: 'Phát triển [_____] giúp bảo vệ môi trường lâu dài.',
    options: ['bền vững', 'kiên cường', 'hợp tác', 'khởi xướng'],
    answerIndex: 0,
    explanation: 'Sustainable (adj) nghĩa là bền vững.',
    wordEnglish: 'sustainable',
  },
  {
    question: 'Công ty quyết định [_____] chương trình đào tạo mới.',
    options: ['khởi xướng', 'kiên cường', 'hợp tác', 'bền vững'],
    answerIndex: 0,
    explanation: 'Initiate (v) nghĩa là khởi xướng, bắt đầu.',
    wordEnglish: 'initiate',
  },
];

async function startMcQuiz(page, questions) {
  await page.locator('#nav-tab-quiz').click();
  await page.locator('#json-paste-textarea').waitFor();
  await page.locator('#json-paste-textarea').fill(JSON.stringify(questions));
  await page.locator('#start-quiz-btn').click();
  // If fewer questions than default 10, confirm on second click
  const countNotice = page.getByText('AI chỉ trả về', { exact: false });
  if (await countNotice.isVisible().catch(() => false)) {
    await page.locator('#start-quiz-btn').click();
  }
  await page.locator('#option-0').waitFor();
}

let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  const snapshot = {
    protocol: 1,
    generation: 'feedback-gen',
    revision: 0,
    words: structuredClone(INITIAL_WORDS),
    tombstones: [],
    paused: true,
    ok: true,
  };

  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/api/vocab-sync') {
      return route.fulfill({ json: snapshot });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false } });
    return route.continue();
  });

  await page.addInitScript(() => {
    window.__speechMode = 'fast'; // 'fast' (200ms) | 'slow' (2400ms) | 'never'
    window.__speechLog = [];
    window.__cancelCount = 0;
    window.__activeUtteranceTimer = null;

    class MockUtterance {
      constructor(text) {
        this.text = text;
        this.lang = 'en-US';
        this.rate = 1;
        this.voice = null;
        this.onend = null;
        this.onerror = null;
      }
    }
    window.SpeechSynthesisUtterance = MockUtterance;

    const mockVoice = { name: 'Mock EN', lang: 'en-US', default: true };
    const mockSynth = {
      onvoiceschanged: null,
      getVoices() {
        return [mockVoice];
      },
      cancel() {
        window.__cancelCount += 1;
        if (window.__activeUtteranceTimer) {
          clearTimeout(window.__activeUtteranceTimer);
          window.__activeUtteranceTimer = null;
        }
      },
      speak(utt) {
        const entry = { text: utt.text, startedAt: Date.now(), ended: false };
        window.__speechLog.push(entry);
        const mode = window.__speechMode;
        if (mode === 'never') return;
        const delay = mode === 'slow' ? 2400 : 200;
        window.__activeUtteranceTimer = setTimeout(() => {
          window.__activeUtteranceTimer = null;
          entry.ended = true;
          utt.onend?.();
        }, delay);
      },
    };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: mockSynth,
    });

    // Stub Audio fallback as well so no real network audio is attempted
    window.Audio = class MockAudio {
      constructor(src) {
        this.src = src;
        this.onended = null;
        this.currentTime = 0;
      }
      play() { return Promise.resolve(); }
      pause() {}
    };
  });

  await page.goto(origin);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('vocabmaster_vocab_sync_v1') || '{}').base?.generation === 'feedback-gen');

  // ── 1. Correct answer: speaks q.wordEnglish (NOT Vietnamese option), shows preloaded image, no layout shift, waits >= 1800ms ──
  await startMcQuiz(page, QUIZ_QUESTIONS);
  // Give preloader a moment for data-URI image onload
  await page.waitForTimeout(100);

  const qCardBefore = await page.locator('.vm-card').first().boundingBox();
  const q1CorrectIdx = await page.locator('[id^="option-"]').evaluateAll(els =>
    els.findIndex(el => el.textContent.includes('kiên cường'))
  );
  assert.ok(q1CorrectIdx >= 0, 'Expected Vietnamese option for resilient');

  const clickTime1 = Date.now();
  await page.locator(`#option-${q1CorrectIdx}`).click();

  // Overlay must appear immediately
  const overlay = page.locator('#quiz-mc-feedback-overlay');
  await overlay.waitFor({ state: 'visible' });

  // Verify fixed positioning (out of flow -> zero layout shift) and pointer-events: none
  const overlayStyles = await overlay.evaluate(el => {
    const cs = getComputedStyle(el);
    return { position: cs.position, pointerEvents: cs.pointerEvents };
  });
  assert.equal(overlayStyles.position, 'fixed', 'Overlay must be position: fixed so it never shifts layout');
  assert.equal(overlayStyles.pointerEvents, 'none', 'Overlay must have pointer-events: none');

  // Verify spoken text is q.wordEnglish ('resilient'), NOT Vietnamese option
  const speech1 = await page.evaluate(() => window.__speechLog.at(-1));
  assert.equal(speech1.text, 'resilient');

  // Verify preloaded <img> is rendered and >= 160px tall
  const imgBox = await overlay.locator('img').boundingBox();
  assert.ok(imgBox && imgBox.height >= 160, `Expected feedback image height >= 160px, got ${imgBox?.height}`);
  assert.ok((await overlay.textContent()).includes('resilient'));

  // Verify question card top stays anchored and overlay does NOT overlap question/explanation card
  const qCardBox = await page.locator('.vm-card').first().boundingBox();
  assert.ok(Math.abs(qCardBefore.y - qCardBox.y) <= 1, 'Question card top must not shift when overlay appears');
  const overlayCardBox = await overlay.locator('> div').boundingBox();
  assert.ok(overlayCardBox.y >= qCardBox.y + qCardBox.height - 2,
    `Overlay (top=${overlayCardBox.y}) must not cover question/explanation card (bottom=${qCardBox.y + qCardBox.height})`);

  if (screenshotDir) {
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(screenshotDir, 'quiz-feedback-1280.png') });
  }

  // Must NOT advance before 1800ms (check around 1100ms after click)
  const elapsedSoFar = Date.now() - clickTime1;
  if (elapsedSoFar < 1200) {
    await page.waitForTimeout(1200 - elapsedSoFar);
  }
  assert.ok((await page.locator('.vm-card').first().textContent()).includes('tinh thần'),
    'Must not advance before 1800ms even when audio ended at 200ms');

  // Must advance to Question 2 after 1800ms
  await page.waitForFunction(() => document.body.textContent.includes('Các nhóm nên'), { timeout: 3000 });
  const advanceDuration1 = Date.now() - clickTime1;
  assert.ok(advanceDuration1 >= 1700, `Advanced too early: ${advanceDuration1}ms`);

  // ── 2. Wrong answer + no image -> WordInitialTile + slow audio (2400ms) waits for audio end ──
  await page.evaluate(() => { window.__speechMode = 'slow'; });
  const q2WrongIdx = await page.locator('[id^="option-"]').evaluateAll(els =>
    els.findIndex(el => !el.textContent.includes('hợp tác'))
  );
  assert.ok(q2WrongIdx >= 0);

  const clickTime2 = Date.now();
  await page.locator(`#option-${q2WrongIdx}`).click();
  await overlay.waitFor({ state: 'visible' });

  // Must still speak correct target word 'collaborate' on wrong answer
  const speech2 = await page.evaluate(() => window.__speechLog.at(-1));
  assert.equal(speech2.text, 'collaborate');
  // No imageUrl -> must render WordInitialTile (no <img>)
  assert.equal(await overlay.locator('img').count(), 0);
  assert.ok((await overlay.textContent()).includes('collaborate'));

  // At 1950ms (> 1800ms), audio (2400ms) has not ended yet -> must still be on Question 2
  await page.waitForTimeout(1950);
  assert.ok((await page.locator('.vm-card').first().textContent()).includes('Các nhóm nên'),
    'Must wait for audio onEnd even after 1800ms');

  // Should advance once slow audio ends (~2400ms)
  await page.waitForFunction(() => document.body.textContent.includes('Phát triển'), { timeout: 2000 });
  const advanceDuration2 = Date.now() - clickTime2;
  assert.ok(advanceDuration2 >= 2250, `Advanced before slow audio finished: ${advanceDuration2}ms`);

  // ── 3. Audio never fires onEnd + broken imageUrl -> fallback WordInitialTile + 4000ms safety ceiling ──
  await page.evaluate(() => { window.__speechMode = 'never'; });
  const clickTime3 = Date.now();
  await page.locator('#option-0').click();
  await overlay.waitFor({ state: 'visible' });

  const speech3 = await page.evaluate(() => window.__speechLog.at(-1));
  assert.equal(speech3.text, 'sustainable');
  // Broken image was never loaded -> immediate WordInitialTile fallback
  assert.equal(await overlay.locator('img').count(), 0);

  // Must NOT stall: advances at 4000ms ceiling (to the spliced re-test of 'collaborate')
  await page.waitForFunction(() => document.body.textContent.includes('Các nhóm nên'), { timeout: 5500 });
  const advanceDuration3 = Date.now() - clickTime3;
  assert.ok(advanceDuration3 >= 3800 && advanceDuration3 < 5400,
    `Expected safety ceiling ~4000ms, got ${advanceDuration3}ms`);

  // ── 4. Leaving Quiz screen (unmount) stops speech & clears timers ──
  const cancelBeforeLeave = await page.evaluate(() => window.__cancelCount);
  await page.locator('#option-0').click();
  await overlay.waitFor({ state: 'visible' });
  await page.locator('#nav-tab-vocabulary').click();
  await page.locator('#star-w1').waitFor();
  const cancelAfterLeave = await page.evaluate(() => window.__cancelCount);
  assert.ok(cancelAfterLeave > cancelBeforeLeave, 'Leaving Quiz must cancel ongoing speech');

  // ── 5. Responsive check at 375px and 320px (no horizontal overflow, visible without scroll, no overlap) ──
  await page.evaluate(() => { window.__speechMode = 'never'; });
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await startMcQuiz(page, [QUIZ_QUESTIONS[0]]);
    await page.waitForTimeout(100);
    await page.locator('#option-0').click();
    await overlay.waitFor({ state: 'visible' });

    const metrics = await page.evaluate(() => {
      const ov = document.querySelector('#quiz-mc-feedback-overlay > div');
      const card = document.querySelector('.vm-card');
      const ovRect = ov.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        ovTop: ovRect.top,
        ovBottom: ovRect.bottom,
        ovLeft: ovRect.left,
        ovRight: ovRect.right,
        cardBottom: cardRect.bottom,
      };
    });

    assert.ok(metrics.scrollWidth <= metrics.innerWidth, `Horizontal overflow at ${width}px: ${metrics.scrollWidth} > ${metrics.innerWidth}`);
    assert.ok(metrics.ovTop >= 0 && metrics.ovBottom <= metrics.innerHeight, `Overlay out of vertical viewport at ${width}px`);
    assert.ok(metrics.ovLeft >= 0 && metrics.ovRight <= metrics.innerWidth, `Overlay out of horizontal viewport at ${width}px`);
    assert.ok(metrics.ovTop >= metrics.cardBottom - 2, `Overlay overlaps question/explanation at ${width}px`);

    if (screenshotDir && width === 375) {
      await page.waitForTimeout(250);
      await page.screenshot({ path: join(screenshotDir, 'quiz-feedback-375.png') });
    }

    // Unmount before next viewport
    await page.locator('#nav-tab-vocabulary').click();
    await page.locator('#star-w1').waitFor();
  }

  assert.deepEqual(errors, []);
  console.log('PASS: Smart Quiz MC audio + visual feedback (correct/wrong, preload/fallback, 1800ms/audio-end/4000ms ceiling, unmount cancel, 1280/375/320px).');
  await context.close();
} finally {
  await browser?.close();
  await server.close();
}
