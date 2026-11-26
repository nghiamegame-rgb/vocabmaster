// Browser test: Grammar → Ôn tập "Nghe câu" + shared VoiceSettings (voice, rate, exam mode),
// cancel on next/finish/unmount, no auto-speak, assessment preserved, mobile fit.
// Real App in disposable Edge context; speechSynthesis stubbed; localhost only.
// Run: node test/grammar-review-speak-browser.test.js
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const s1 = 'Local communities often organize clean-up events near the river every weekend.';
const s2 = 'Students who review grammar regularly can identify complex clauses much faster.';
const s3 = 'Many employees prefer flexible hours because they reduce daily commuting stress.';

const makeQuestion = (sentence, savedId, phrase) => ({
  id: `ai_${savedId}`,
  schemaVersion: 2,
  type: 'sentence-analysis',
  sentence,
  topic: 'Prepositions',
  vietnameseSentence: `Bản dịch tiếng Việt cho ${savedId}.`,
  grammarPoints: [{ category: 'Prepositions', phrase, explanation: 'Giải thích mẫu.' }],
  readingItems: [],
  savedId,
  savedAt: 1,
  userNotes: '',
  hardMarked: false,
});

const VOICES = [
  ['Microsoft Zira - English (United States)', 'en-US'],
  ['Microsoft David - English (United States)', 'en-US'],
  ['Microsoft George - English (United Kingdom)', 'en-GB'],
  ['Microsoft Aria Online (Natural) - English (United States)', 'en-US'],
  ['Microsoft Natasha Online (Natural) - English (Australia)', 'en-AU'],
];
const GEORGE = VOICES[2][0];

const initial = {
  vocabmaster_grammar_saved: JSON.stringify([
    makeQuestion(s1, 'gq_s1', 'near the river'),
    makeQuestion(s2, 'gq_s2', 'complex clauses'),
    makeQuestion(s3, 'gq_s3', 'flexible hours'),
  ]),
  vocabmaster_grammar_review: JSON.stringify({
    gq_s1: { level: 2, totalReviews: 1, wrongCount: 0, nextReviewAt: 0 },
    gq_s2: { level: 2, totalReviews: 1, wrongCount: 0, nextReviewAt: 0 },
    gq_s3: { level: 2, totalReviews: 1, wrongCount: 0, nextReviewAt: 0 },
  }),
  vocabmaster_voice_prefs: JSON.stringify({
    voiceURI: GEORGE,
    name: GEORGE,
    rate: 1.05,
    examMode: false,
  }),
};

const server = await createServer({
  cacheDir: mkdtempSync(join(tmpdir(), 'grammar-review-speak-')),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client', 'lucide-react'] },
  server: { host: '127.0.0.1', port: 0, hmr: false },
});

let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, headless: true } : { channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false, error: 'unconfigured' } });
    return route.continue();
  });

  await context.addInitScript(({ data, voicesList }) => {
    Math.random = () => 0.99; // keep deterministic queue order gq_s1 -> gq_s2 -> gq_s3
    if (!sessionStorage.getItem('gr_speak_init')) {
      for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
      sessionStorage.setItem('gr_speak_init', '1');
    }
    const voices = voicesList.map(([name, lang]) => ({ name, lang, voiceURI: name, localService: true }));
    window.__spoken = [];
    window.__cancelCount = 0;
    const synth = {
      onvoiceschanged: null,
      getVoices: () => voices,
      speak(u) {
        window.__spoken.push({ text: u.text, voice: u.voice?.name, lang: u.lang, rate: u.rate });
        setTimeout(() => u.onend?.(), 30);
      },
      cancel() { window.__cancelCount += 1; },
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  }, { data: initial, voicesList: VOICES });

  await page.goto(origin);
  await page.locator('#nav-tab-grammar').click();
  await page.locator('#grammar-tab-review').click();
  await page.getByRole('button', { name: 'Bắt đầu ôn tập', exact: true }).click();

  // (a) Both "Nghe câu" and "Giọng đọc" buttons are present; no auto-speak on entering session
  const speakBtn = page.locator('#grammar-review-speak');
  await speakBtn.waitFor({ state: 'visible' });
  await page.locator('#voice-settings-toggle').waitFor({ state: 'visible' });
  assert.equal(await speakBtn.getAttribute('aria-label'), 'Nghe câu');
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__spoken.length), 0, 'must not auto-speak on entering review');

  // (b) Clicking "Nghe câu" speaks the exact English sentence (not Vietnamese) using vocabmaster_voice_prefs
  await speakBtn.click();
  const spoken1 = await page.evaluate(() => window.__spoken);
  assert.equal(spoken1.length, 1);
  assert.equal(spoken1[0].text, s1);
  assert.equal(spoken1[0].voice, GEORGE);
  assert.equal(spoken1[0].lang, 'en-GB');
  assert.equal(spoken1[0].rate, 1.05);

  // (c) Clicking "Câu tiếp" cancels speech and does NOT auto-speak Q2
  const cancelsBeforeNext = await page.evaluate(() => window.__cancelCount);
  await page.getByRole('button', { name: 'Câu tiếp', exact: true }).click();
  await page.getByText('Câu 2/3').waitFor();
  assert.ok((await page.evaluate(() => window.__cancelCount)) > cancelsBeforeNext, 'next sentence must cancel speech');
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__spoken.length), 1, 'must not auto-speak on next sentence');

  // (d) Speaking Q2 then clicking "Đã hiểu" still updates review progress normally
  await speakBtn.click();
  const spoken2 = await page.evaluate(() => window.__spoken);
  assert.equal(spoken2.length, 2);
  assert.equal(spoken2[1].text, s2);
  await page.getByRole('button', { name: 'Đã hiểu', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Đã hiểu ✓', exact: true }).isDisabled(), true);
  const progressAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('vocabmaster_grammar_review')));
  assert.equal(progressAfter.gq_s2.level, 3);
  assert.equal(progressAfter.gq_s2.totalReviews, 2);

  // (e) Exam mode: replaying the same sentence keeps the voice; next sentence switches to another voice
  await page.locator('#voice-settings-toggle').click();
  await page.locator('#voice-exam-toggle').click();
  assert.equal(await page.locator('#voice-exam-toggle').getAttribute('aria-checked'), 'true');
  await page.locator('#voice-settings-toggle').click(); // close panel

  await speakBtn.click();
  await speakBtn.click();
  const examSame = await page.evaluate(() => window.__spoken.slice(-2));
  assert.equal(examSame[0].text, s2);
  assert.equal(examSame[1].text, s2);
  assert.equal(examSame[0].voice, examSame[1].voice, 'exam mode replay on same sentence keeps the same voice');

  await page.getByRole('button', { name: 'Câu tiếp', exact: true }).click();
  await page.getByText('Câu 3/3').waitFor();
  await speakBtn.click();
  const examNext = await page.evaluate(() => window.__spoken.at(-1));
  assert.equal(examNext.text, s3);
  assert.notEqual(examNext.voice, examSame[0].voice, 'exam mode on a different sentence switches to another voice');

  // Mobile fit (375px & 320px): wait for UnderlinedSentence ResizeObserver to re-measure lines, then check overflow
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `${width}px horizontal overflow: ${overflow}`);
  }

  // Finishing session cancels ongoing speech
  const cancelsBeforeFinish = await page.evaluate(() => window.__cancelCount);
  await page.getByRole('button', { name: 'Kết thúc phiên', exact: true }).click();
  await page.getByText('Đã kết thúc ôn tập').waitFor();
  assert.ok((await page.evaluate(() => window.__cancelCount)) > cancelsBeforeFinish, 'finishing session must cancel speech');

  assert.deepEqual(errors, [], 'no uncaught browser errors');
  console.log('PASS: Grammar Review speak button & VoiceSettings (prefs, cancel on next/finish, no auto-speak, assessment preserved, exam mode rotation, 375/320px).');
  await context.close();
} finally {
  await browser?.close();
  await server.close();
}
