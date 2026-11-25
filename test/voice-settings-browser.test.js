// Browser test: voice settings (choose voice, speed, exam mode) in Listening and
// Dictation. Real App in disposable Edge contexts; the browser's speech engine is
// replaced by a fake voice list; no external network. A pass does not prove how real
// voices sound on a real device. Run: node test/voice-settings-browser.test.js
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const shots = process.env.VOICE_SCREENSHOT_DIR || '';
if (shots) mkdirSync(shots, { recursive: true });
const server = await createServer({
  cacheDir: mkdtempSync(join(tmpdir(), 'voice-vite-')),
  server: { host: '127.0.0.1', port: 0, hmr: false },
});
const KEY = 'vocabmaster_voice_prefs';
const WORDS = ['resilient', 'collaborate', 'sustainable', 'initiate', 'accessible', 'community'].map((english, i) => ({
  id: `w${i + 1}`, english, vietnamese: `nghĩa ${i + 1}`, annotation: '', wordType: 'Word', level: 1, currentStreak: 0, createdAt: 1000 + i,
}));
const VOICE_SETS = {
  desktop: [
    ['Google français', 'fr-FR'],
    ['Microsoft Zira - English (United States)', 'en-US'],
    ['Microsoft David - English (United States)', 'en-US'],
    ['Microsoft George - English (United Kingdom)', 'en-GB'],
    ['Microsoft Aria Online (Natural) - English (United States)', 'en-US'],
    ['Microsoft Natasha Online (Natural) - English (Australia)', 'en-AU'],
    ['Zarvox', 'en-US'],
  ],
  phone: [['Samantha', 'en-US'], ['Daniel', 'en-GB']],
  none: [['Google français', 'fr-FR']],
};
const ZIRA = VOICE_SETS.desktop[1][0];
const GEORGE = VOICE_SETS.desktop[3][0];

let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/api/vocab-sync') return route.fulfill({ json: { protocol: 1, generation: 'voice-gen', revision: 0, words: WORDS, tombstones: [], paused: false, ok: true } });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false, error: 'unconfigured' } });
    return route.continue();
  });
  await context.addInitScript(VOICE_SETS_JSON => {
    const sets = JSON.parse(VOICE_SETS_JSON);
    const chosen = sessionStorage.getItem('mockVoices') || 'desktop';
    const wanted = sets[chosen].map(([name, lang]) => ({ name, lang, voiceURI: name, localService: true }));
    // The list starts EMPTY and arrives later, like Chrome/Edge.
    let voices = [];
    window.__spoken = [];
    window.__google = [];
    const synth = {
      getVoices: () => voices,
      speak(u) {
        window.__spoken.push({ text: u.text, voice: u.voice?.name, lang: u.lang, rate: u.rate, pitch: u.pitch });
        setTimeout(() => u.onend?.(), 20);
      },
      cancel() {},
    };
    window.__loadVoices = () => { voices = wanted; synth.onvoiceschanged?.(); };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    window.Audio = class { constructor(src) { window.__google.push(src); } play() { return Promise.resolve(); } pause() {} };
  }, JSON.stringify(VOICE_SETS));
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));

  /** Screenshot of the top of the page after entrance animations (only when asked for). */
  async function shot(name) {
    if (!shots) return;
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(350);
    await page.screenshot({ path: join(shots, name) });
  }
  const prefs = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
  const spokenCount = () => page.evaluate(() => window.__spoken.length);
  const lastSpoken = () => page.evaluate(() => window.__spoken.at(-1));
  /** Runs `action`, then returns the next utterance it causes. */
  async function speech(action) {
    const before = await spokenCount();
    await action();
    await page.waitForFunction(n => window.__spoken.length > n, before);
    return lastSpoken();
  }
  const openListening = async () => {
    await page.locator('#nav-tab-listening').click();
    await page.locator('#listening-next-btn').waitFor();
  };
  const openPanel = async () => {
    if (await page.locator('#voice-settings-panel').count() === 0) await page.locator('#voice-settings-toggle').click();
    await page.locator('#voice-settings-panel').waitFor();
  };
  async function load(set) {
    await page.evaluate(s => sessionStorage.setItem('mockVoices', s), set);
    await page.reload();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('vocabmaster_vocab_sync_v1') || '{}').base?.generation === 'voice-gen');
  }

  await page.goto(origin);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('vocabmaster_vocab_sync_v1') || '{}').base?.generation === 'voice-gen');
  await openListening();

  // ── 1. Empty list first, voices arrive later ──
  await openPanel();
  assert.equal(await page.locator('#voice-select').isDisabled(), true);
  assert.match(await page.locator('#voice-settings-notes').innerText(), /Đang tải danh sách giọng/);
  await page.evaluate(() => window.__loadVoices());
  await page.waitForFunction(() => !document.getElementById('voice-select').disabled);
  const options = await page.locator('#voice-select option').allInnerTexts();
  assert.deepEqual(options, [
    'Mặc định – Microsoft Zira (Mỹ)',
    'Microsoft Aria (Mỹ) · Natural',
    'Microsoft Natasha (Úc) · Natural',
    'Microsoft David (Mỹ)',
    'Microsoft Zira (Mỹ)',
    'Microsoft George (Anh)',
    'Zarvox (Mỹ)',
  ]);
  assert.equal(await prefs(), null, 'nothing saved until the user chooses');

  // ── 2. Choose voice and speed; preview; Listening uses them ──
  await page.locator('#voice-select').selectOption({ label: 'Microsoft George (Anh)' });
  assert.deepEqual(await prefs(), { voiceURI: GEORGE, name: GEORGE, rate: 0.9, examMode: false });
  let said = await speech(() => page.locator('#voice-preview').click());
  assert.match(said.text, /next train to London/);
  assert.equal(said.voice, GEORGE);
  assert.equal(said.lang, 'en-GB');
  assert.equal(said.rate, 0.9);
  await page.locator('#voice-rate').fill('1');
  assert.equal(await page.locator('#voice-rate-value').innerText(), '1.00×');
  assert.equal((await prefs()).rate, 1);
  said = await speech(() => page.locator('#replay-audio-btn').click());
  assert.equal(said.voice, GEORGE);
  assert.equal(said.rate, 1);

  // ── 3. Exam mode in Listening: new round → other voice, replay → same voice ──
  await page.locator('#voice-exam-toggle').click();
  assert.equal(await page.locator('#voice-exam-toggle').getAttribute('aria-checked'), 'true');
  assert.match(await page.locator('#voice-settings-toggle').innerText(), /Chế độ thi/);
  assert.match(await page.locator('#voice-settings-notes').innerText(), /trong 5 giọng/);
  const examVoices = new Set(VOICE_SETS.desktop.map(v => v[0]).filter(n => n !== 'Zarvox' && n !== 'Google français'));
  let previous = null;
  const used = new Set();
  for (let i = 0; i < 8; i++) {
    const auto = await speech(() => page.locator('#listening-next-btn').click());
    assert.ok(examVoices.has(auto.voice), `exam voice: ${auto.voice}`);
    assert.notEqual(auto.voice, previous, `round ${i}: same voice as the round before`);
    assert.ok(Math.abs(auto.rate - 1) <= 0.05 + 1e-9, `rate ${auto.rate}`);
    assert.equal(auto.pitch, undefined, 'pitch never set');
    const again = await speech(() => page.locator('#replay-audio-btn').click());
    assert.deepEqual([again.voice, again.rate, again.text], [auto.voice, auto.rate, auto.text], 'replay keeps voice and speed');
    previous = auto.voice;
    used.add(auto.voice);
  }
  assert.ok(used.size >= 2, 'several voices used');
  await shot('listening-panel-1280.png');

  // ── 4. Dictation shares the settings ──
  await page.locator('#nav-tab-dictation').click();
  await page.locator('#dictation-lesson-text').fill('The weather is nice today.\nWe leave at nine.\nSee you soon.');
  await page.locator('#dictation-add-lesson').click();
  said = await speech(() => page.locator('#dictation-section-practice').click());
  assert.equal(said.text, 'The weather is nice today.');
  await openPanel();
  assert.equal(await page.locator('#voice-exam-toggle').getAttribute('aria-checked'), 'true', 'same setting as Listening');
  assert.equal(await page.locator('#voice-select').inputValue() !== '', true);
  const first = said.voice;
  said = await speech(() => page.locator('#dictation-replay').click());
  assert.equal(said.voice, first, 'replay keeps the sentence voice');
  await page.locator('#dictation-toggle-all').click();
  said = await speech(() => page.getByRole('button', { name: 'weather', exact: true }).click());
  assert.deepEqual([said.text, said.voice], ['weather', first], 'word chip uses the sentence voice');
  said = await speech(() => page.locator('#dictation-next').click());
  assert.equal(said.text, 'We leave at nine.');
  assert.notEqual(said.voice, first, 'new sentence, new voice');
  const second = said.voice;
  said = await speech(() => page.locator('#dictation-next').click());
  assert.notEqual(said.voice, second);
  // Dictation speed buttons multiply the chosen speed.
  await page.locator('#dictation-speed-125').click();
  said = await speech(() => page.locator('#dictation-replay').click());
  assert.ok(said.rate >= 0.95 * 1.25 - 1e-9 && said.rate <= 1.05 * 1.25 + 1e-9, `rate ${said.rate}`);
  await page.locator('#dictation-speed-1').click();
  // Preview stops a running loop (the play button goes back to "Phát").
  await page.locator('#dictation-loop').click();
  await page.locator('#dictation-play').click();
  await page.locator('#voice-preview').click();
  await page.locator('#dictation-play[aria-label="Phát"]').waitFor();
  const afterPreview = await spokenCount();
  await page.waitForTimeout(1200);
  assert.equal(await spokenCount(), afterPreview, 'loop did not resume over the preview');
  await page.locator('#dictation-loop').click();
  await shot('dictation-panel-1280.png');

  // ── 5. Other screens are unchanged: default voice at 0.9, even with exam mode on ──
  await page.locator('#nav-tab-vocabulary').click();
  said = await speech(() => page.locator('#speak-w1').click());
  assert.deepEqual([said.text, said.voice, said.rate], ['resilient', ZIRA, 0.9]);

  // ── 6. Reload keeps the choice; a device without that voice uses its default ──
  await load('desktop');
  await openListening();
  await page.evaluate(() => window.__loadVoices());
  await openPanel();
  await page.waitForFunction(() => !document.getElementById('voice-select').disabled);
  assert.equal(await page.locator('#voice-select option:checked').innerText(), 'Microsoft George (Anh)');
  assert.equal(await page.locator('#voice-rate-value').innerText(), '1.00×');
  await load('phone');
  await openListening();
  await page.evaluate(() => window.__loadVoices());
  await openPanel();
  await page.waitForFunction(() => !document.getElementById('voice-select').disabled);
  await page.locator('#voice-exam-toggle').click(); // exam off
  assert.equal(await page.locator('#voice-select').inputValue(), '', 'falls back to the default option');
  said = await speech(() => page.locator('#replay-audio-btn').click());
  assert.deepEqual([said.voice, said.rate], ['Samantha', 1]);
  assert.equal((await prefs()).name, GEORGE, 'saved choice kept for the other device');
  assert.equal(await page.locator('[role="alert"]').count(), 0, 'no error shown');

  // Broken saved settings → defaults, no crash.
  await page.evaluate(k => localStorage.setItem(k, '{broken'), KEY);
  await load('desktop');
  await openListening();
  await page.evaluate(() => window.__loadVoices());
  said = await speech(() => page.locator('#replay-audio-btn').click());
  assert.deepEqual([said.voice, said.rate], [ZIRA, 0.9]);

  // ── 7. No English voice → Google fallback: exam mode ignored, with a note ──
  await page.evaluate(k => localStorage.setItem(k, JSON.stringify({ examMode: true })), KEY);
  await load('none');
  await openListening();
  await page.evaluate(() => window.__loadVoices());
  await page.locator('#voice-fallback-note').waitFor(); // visible even with the panel closed
  const googleBefore = await page.evaluate(() => window.__google.length);
  await page.locator('#replay-audio-btn').click();
  await page.waitForFunction(n => window.__google.length > n, googleBefore);
  assert.equal(await spokenCount(), 0, 'no browser voice used');
  assert.match(await page.evaluate(() => window.__google.at(-1)), /translate_tts/);
  await openPanel();
  assert.equal(await page.locator('#voice-select').isDisabled(), true);
  await page.getByText('không chọn được giọng', { exact: false }).waitFor();

  // ── 8. Phones: panel fits, no horizontal scrolling ──
  await load('desktop');
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 800 });
    for (const tab of ['listening', 'dictation']) {
      await page.locator(`#nav-tab-${tab}`).click();
      await page.locator('#voice-settings-toggle').waitFor();
      await page.evaluate(() => window.__loadVoices());
      await openPanel();
      const m = await page.evaluate(() => {
        const box = document.getElementById('voice-settings-panel').getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth - window.innerWidth, left: box.left, right: box.right, width: window.innerWidth };
      });
      assert.ok(m.overflow <= 0, `${width}px ${tab}: overflow ${m.overflow}px`);
      assert.ok(m.left >= 0 && m.right <= m.width, `${width}px ${tab}: panel inside the screen`);
      await shot(`${tab}-panel-${width}.png`);
      await page.locator('#voice-settings-toggle').click();
      await page.locator('#voice-settings-panel').waitFor({ state: 'detached' });
    }
  }

  assert.deepEqual(errors, []);
  await context.close();
  console.log('PASS: voice list (async), choose/preview/speed, exam mode (no repeat, replay keeps voice) in Listening and Dictation, other screens unchanged, saved/missing/broken settings, Google fallback note, 375/320px.');
} finally { await browser?.close(); await server.close(); }
