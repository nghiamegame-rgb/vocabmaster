// Browser test for Smart Quiz Multiple-Choice audio + visual feedback (right-column image slot)
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
    explanation: 'Resilient (adj) nghĩa là kiên cường.',
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
  const countNotice = page.getByText('AI chỉ trả về', { exact: false });
  if (await countNotice.isVisible().catch(() => false)) {
    await page.locator('#start-quiz-btn').click();
  }
  await page.locator('#option-0').waitFor();
}

async function assertNoOptionCovered(page, contextLabel) {
  const results = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('[id^="option-"]'));
    return buttons.map(btn => {
      btn.scrollIntoView({ block: 'nearest' });
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(cx, cy);
      const ok = Boolean(hit && (hit === btn || btn.contains(hit)));
      return {
        id: btn.id,
        ok,
        hitTag: hit?.tagName || null,
        hitId: hit?.id || null,
      };
    });
  });
  assert.ok(results.length === 4, `${contextLabel}: expected 4 options, found ${results.length}`);
  for (const r of results) {
    assert.equal(
      r.ok,
      true,
      `${contextLabel}: ${r.id} center is covered by <${r.hitTag} id="${r.hitId}">`
    );
  }
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

  // ── 1. Desktop (1280px): reserved slot before answer (no leak), same bbox after answer, no option covered, >= 1800ms ──
  await startMcQuiz(page, QUIZ_QUESTIONS);
  await page.waitForTimeout(260); // allow page-enter animation & data-URI preload to settle

  const slot = page.locator('#quiz-mc-image-slot');
  await slot.waitFor({ state: 'visible' });

  // Fixed overlay must no longer exist
  assert.equal(await page.locator('#quiz-mc-feedback-overlay').count(), 0, 'Fixed overlay must be removed');

  // (a) Before answering: slot exists, NO <img>, NO initial letter, NO answer word anywhere in slot DOM
  const preSlotInfo = await slot.evaluate(el => ({
    imgCount: el.querySelectorAll('img').length,
    text: (el.textContent || '').trim(),
    html: el.innerHTML.toLowerCase(),
  }));
  assert.equal(preSlotInfo.imgCount, 0, 'Must not render <img> before answering');
  assert.equal(preSlotInfo.text, '', 'Must not render initial letter or word text before answering');
  assert.ok(!preSlotInfo.html.includes('resilient'), 'Must not leak answer word in slot HTML before answering');

  if (screenshotDir) {
    await page.screenshot({ path: join(screenshotDir, 'quiz-slot-1280-before.png') });
  }

  const slotBoxBefore = await slot.boundingBox();
  const qCardBefore = await page.locator('.vm-card').first().boundingBox();
  const optionsBefore = await page.locator('[id^="option-"]').evaluateAll(els =>
    els.map(el => el.getBoundingClientRect().top)
  );
  assert.ok(Math.abs(slotBoxBefore.width - 176) <= 2 && Math.abs(slotBoxBefore.height - 176) <= 2,
    `Expected ~176x176 slot on desktop, got ${slotBoxBefore.width}x${slotBoxBefore.height}`);

  const q1CorrectIdx = await page.locator('[id^="option-"]').evaluateAll(els =>
    els.findIndex(el => el.textContent.includes('kiên cường'))
  );
  assert.ok(q1CorrectIdx >= 0, 'Expected Vietnamese option for resilient');

  const clickTime1 = Date.now();
  await page.locator(`#option-${q1CorrectIdx}`).click();

  // Wait for image inside slot
  await slot.locator('img').waitFor({ state: 'visible' });

  // (c) Verify spoken word is q.wordEnglish ('resilient') and <img> + word label are shown
  const speech1 = await page.evaluate(() => window.__speechLog.at(-1));
  assert.equal(speech1.text, 'resilient');
  assert.equal(await slot.locator('img').getAttribute('alt'), 'resilient');
  assert.ok((await slot.textContent()).includes('resilient'));

  // (b) Bounding box of slot, question card top, and all 4 options must NOT shift
  const slotBoxAfter = await slot.boundingBox();
  const qCardAfter = await page.locator('.vm-card').first().boundingBox();
  const optionsAfter = await page.locator('[id^="option-"]').evaluateAll(els =>
    els.map(el => el.getBoundingClientRect().top)
  );
  assert.ok(
    Math.abs(slotBoxBefore.x - slotBoxAfter.x) <= 1 &&
    Math.abs(slotBoxBefore.y - slotBoxAfter.y) <= 1 &&
    Math.abs(slotBoxBefore.width - slotBoxAfter.width) <= 1 &&
    Math.abs(slotBoxBefore.height - slotBoxAfter.height) <= 1,
    `Image slot bbox shifted: before=${JSON.stringify(slotBoxBefore)} after=${JSON.stringify(slotBoxAfter)}`
  );
  assert.ok(Math.abs(qCardBefore.y - qCardAfter.y) <= 1, 'Question card top must not shift');
  for (let i = 0; i < optionsBefore.length; i++) {
    assert.ok(
      Math.abs(optionsBefore[i] - optionsAfter[i]) <= 1,
      `Option ${i} shifted from y=${optionsBefore[i]} to y=${optionsAfter[i]}`
    );
  }

  // (d) Nothing covers any option button
  await assertNoOptionCovered(page, '1280px after answer');

  // (e) No horizontal overflow at 1280px
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
    'Horizontal overflow at 1280px'
  );

  if (screenshotDir) {
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(screenshotDir, 'quiz-slot-1280-after.png') });
  }

  // Must NOT advance before 1800ms
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

  const speech2 = await page.evaluate(() => window.__speechLog.at(-1));
  assert.equal(speech2.text, 'collaborate');
  assert.equal(await slot.locator('img').count(), 0);
  assert.ok((await slot.textContent()).includes('collaborate'));

  await page.waitForTimeout(1950);
  assert.ok((await page.locator('.vm-card').first().textContent()).includes('Các nhóm nên'),
    'Must wait for audio onEnd even after 1800ms');

  await page.waitForFunction(() => document.body.textContent.includes('Phát triển'), { timeout: 2000 });
  const advanceDuration2 = Date.now() - clickTime2;
  assert.ok(advanceDuration2 >= 2250, `Advanced before slow audio finished: ${advanceDuration2}ms`);

  // ── 3. Audio never fires onEnd + broken imageUrl -> fallback WordInitialTile + 4000ms safety ceiling ──
  await page.evaluate(() => { window.__speechMode = 'never'; });
  const clickTime3 = Date.now();
  await page.locator('#option-0').click();

  const speech3 = await page.evaluate(() => window.__speechLog.at(-1));
  assert.equal(speech3.text, 'sustainable');
  assert.equal(await slot.locator('img').count(), 0);
  assert.ok((await slot.textContent()).includes('sustainable'));

  // Must NOT stall: advances at 4000ms ceiling (to the spliced re-test of 'collaborate')
  await page.waitForFunction(() => document.body.textContent.includes('Các nhóm nên'), { timeout: 5500 });
  const advanceDuration3 = Date.now() - clickTime3;
  assert.ok(advanceDuration3 >= 3800 && advanceDuration3 < 5400,
    `Expected safety ceiling ~4000ms, got ${advanceDuration3}ms`);

  // ── 4. Leaving Quiz screen (unmount) stops speech & clears timers ──
  const cancelBeforeLeave = await page.evaluate(() => window.__cancelCount);
  await page.locator('#option-0').click();
  await page.locator('#nav-tab-vocabulary').click();
  await page.locator('#star-w1').waitFor();
  const cancelAfterLeave = await page.evaluate(() => window.__cancelCount);
  assert.ok(cancelAfterLeave > cancelBeforeLeave, 'Leaving Quiz must cancel ongoing speech');

  // ── 5. Responsive checks at 375px and 320px (no leak, fixed slot bbox, no option covered, no overflow) ──
  await page.evaluate(() => { window.__speechMode = 'never'; });
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await startMcQuiz(page, [QUIZ_QUESTIONS[0]]);
    await page.waitForTimeout(260);

    const mSlotBefore = await slot.boundingBox();
    const expectedSize = width === 375 ? 96 : 72;
    assert.ok(
      Math.abs(mSlotBefore.width - expectedSize) <= 2 && Math.abs(mSlotBefore.height - expectedSize) <= 2,
      `Expected ~${expectedSize}x${expectedSize} slot at ${width}px, got ${mSlotBefore.width}x${mSlotBefore.height}`
    );

    // No leak before answering
    assert.equal(await slot.locator('img').count(), 0);
    assert.equal((await slot.textContent()).trim(), '');

    if (screenshotDir && width === 375) {
      await page.screenshot({ path: join(screenshotDir, 'quiz-slot-375-before.png') });
    }

    const qCardBeforeM = await page.locator('.vm-card').first().boundingBox();
    await page.locator('#option-0').click();
    await slot.locator('img').waitFor({ state: 'visible' });

    const mSlotAfter = await slot.boundingBox();
    const qCardAfterM = await page.locator('.vm-card').first().boundingBox();
    assert.ok(
      Math.abs(mSlotBefore.x - mSlotAfter.x) <= 1 &&
      Math.abs(mSlotBefore.y - mSlotAfter.y) <= 1 &&
      Math.abs(mSlotBefore.width - mSlotAfter.width) <= 1 &&
      Math.abs(mSlotBefore.height - mSlotAfter.height) <= 1,
      `Slot bbox shifted at ${width}px: before=${JSON.stringify(mSlotBefore)} after=${JSON.stringify(mSlotAfter)}`
    );
    assert.ok(Math.abs(qCardBeforeM.y - qCardAfterM.y) <= 1, `Question card top shifted at ${width}px`);

    // On mobile (< 640px), caption text overlay must be hidden
    const captionVisible = await slot.locator('span').first().isVisible();
    assert.equal(captionVisible, false, `Word caption must be hidden below 640px (width=${width}px)`);

    // Nothing covers any option button
    await assertNoOptionCovered(page, `${width}px after answer`);

    // No horizontal overflow
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    assert.equal(noOverflow, true, `Horizontal overflow at ${width}px`);

    if (screenshotDir && width === 375) {
      await page.waitForTimeout(250);
      await page.screenshot({ path: join(screenshotDir, 'quiz-slot-375-after.png') });
    }

    // Unmount before next viewport
    await page.locator('#nav-tab-vocabulary').click();
    await page.locator('#star-w1').waitFor();
  }

  assert.deepEqual(errors, []);
  console.log('PASS: Smart Quiz MC right-slot image & audio feedback (no leak, fixed bbox, no option covered, timing/unmount, 1280/375/320px).');
  await context.close();
} finally {
  await browser?.close();
  await server.close();
}
