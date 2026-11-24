// Browser test: Listening "Tự mở bàn phím" toggle (auto-focus of the typing input on each
// new word). Real App in disposable Edge contexts, localhost mocks only, audio stubbed.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await createServer({
  cacheDir: mkdtempSync(join(tmpdir(), 'listening-autofocus-vite-')),
  server: { host: '127.0.0.1', port: 0, hmr: false },
});
const KEY = 'vocabmaster_listening_autofocus';
const WORDS = ['resilient', 'collaborate', 'sustainable', 'initiate', 'accessible', 'community'].map((english, i) => ({
  id: `w${i + 1}`, english, vietnamese: `nghĩa ${i + 1}`, annotation: '', wordType: 'Word', level: 1, currentStreak: 0, createdAt: 1000 + i,
}));

let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });

  async function openContext(options, { stubCoarse = false } = {}) {
    const context = await browser.newContext(options);
    const errors = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/api/vocab-sync') {
        return route.fulfill({ json: { protocol: 1, generation: 'lf-gen', revision: 0, words: WORDS, tombstones: [], paused: false, ok: true } });
      }
      if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false } });
      return route.continue();
    });
    await context.addInitScript(({ stubCoarse }) => {
      // Silence audio: the app's speech/Audio fallback must not hit the network or block.
      try {
        Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak() {}, cancel() {}, getVoices: () => [], addEventListener() {}, removeEventListener() {} } });
      } catch { /* ignore */ }
      window.Audio = class { play() { return Promise.resolve(); } pause() {} addEventListener() {} removeEventListener() {} };
      if (stubCoarse) {
        const real = window.matchMedia.bind(window);
        window.matchMedia = q => (q === '(pointer: coarse)' ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : real(q));
      }
    }, { stubCoarse });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    return { context, page, errors };
  }

  async function openListening(page) {
    await page.goto(origin);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('vocabmaster_vocab_sync_v1') || '{}').base?.generation === 'lf-gen');
    await page.locator('#nav-tab-listening').click();
    await page.locator('#listening-type-answer').waitFor();
  }
  const inputFocused = page => page.evaluate(() => document.activeElement?.id === 'listening-type-answer');
  const roundWord = page => page.evaluate(() => document.querySelector('#listening-card-0')?.getAttribute('aria-label'));
  async function nextWord(page) {
    const before = await page.evaluate(() => [...document.querySelectorAll('[id^="listening-card-"]')].map(c => c.getAttribute('aria-label')).join('|'));
    await page.locator('#listening-next-btn').click();
    await page.waitForFunction(prev => [...document.querySelectorAll('[id^="listening-card-"]')].map(c => c.getAttribute('aria-label')).join('|') !== prev, before);
    await page.locator('#listening-type-answer').waitFor();
    await page.waitForTimeout(300); // the app focuses after 50 ms; leave ample time
  }

  // ── (1) Desktop: default ON → the input gets focus on every new word ──────────────────
  {
    const { context, page, errors } = await openContext({ viewport: { width: 1280, height: 800 } });
    await openListening(page);
    assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), false);
    const toggle = page.locator('#lr-autofocus-toggle');
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    assert.match(await toggle.innerText(), /Tự mở bàn phím: Bật/);
    assert.ok((await toggle.getAttribute('title')).length > 20);
    await page.waitForFunction(() => document.activeElement?.id === 'listening-type-answer');
    await nextWord(page);
    assert.equal(await inputFocused(page), true, 'ON: focus after Skip');
    assert.equal(await page.evaluate(k => localStorage.getItem(k), KEY), null, 'nothing saved until the user chooses');

    // ── (2) Turn OFF → focused input is blurred; new words do not focus; typing still works ──
    await page.locator('#listening-type-answer').focus();
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
    assert.match(await toggle.innerText(), /Tự mở bàn phím: Tắt/);
    assert.equal(await inputFocused(page), false, 'OFF: input blurred');
    assert.equal(await page.evaluate(k => localStorage.getItem(k), KEY), 'off');
    for (let i = 0; i < 2; i++) {
      await nextWord(page);
      assert.equal(await inputFocused(page), false, `OFF: no focus on new word #${i + 1}`);
      assert.ok(await page.locator('#listening-type-answer').isVisible(), 'OFF: input still shown');
    }
    await page.locator('#listening-type-answer').click();
    await page.keyboard.type('xyz');
    assert.equal(await page.locator('#listening-type-answer').inputValue(), 'xyz', 'OFF: user can still type');
    assert.equal(await inputFocused(page), true);

    // Turn ON again → focuses immediately; then OFF again for the reload check.
    await page.locator('#replay-audio-btn').focus();
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
    assert.equal(await inputFocused(page), true, 'ON: focus immediately');
    assert.equal(await page.evaluate(k => localStorage.getItem(k), KEY), 'on');
    await toggle.click();
    assert.equal(await page.evaluate(k => localStorage.getItem(k), KEY), 'off');

    // ── (3) Reload keeps the choice ──────────────────────────────────────────────────────
    await openListening(page);
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#lr-autofocus-toggle').getAttribute('aria-pressed'), 'false');
    assert.equal(await inputFocused(page), false, 'reload: still OFF');
    await nextWord(page);
    assert.equal(await inputFocused(page), false);

    // Unrelated stores were not touched by the setting.
    const words = await page.evaluate(() => JSON.parse(localStorage.getItem('vocabmaster_words')));
    assert.ok(words.every(w => !('listeningAutofocus' in w)));
    assert.ok(!(await page.evaluate(() => localStorage.getItem('vocabmaster_vocab_sync_v1'))).includes('autofocus'));
    assert.ok(await roundWord(page));
    assert.deepEqual(errors, []);
    await context.close();
    console.log('  ✓ desktop: default ON, toggle OFF/ON, saved across reload');
  }

  // ── (4) Touch device, nothing saved → default OFF ────────────────────────────────────
  {
    let { context, page, errors } = await openContext({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });
    await page.goto(origin);
    let coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
    let how = 'Playwright isMobile + hasTouch';
    if (!coarse) {
      await context.close();
      ({ context, page, errors } = await openContext({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true }, { stubCoarse: true }));
      how = 'matchMedia stub (emulation did not report pointer: coarse)';
    }
    await openListening(page);
    coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
    assert.equal(coarse, true);
    assert.equal(await page.evaluate(k => localStorage.getItem(k), KEY), null, 'fresh context: no saved choice');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#lr-autofocus-toggle').getAttribute('aria-pressed'), 'false');
    assert.equal(await inputFocused(page), false, 'touch default: no focus');
    await nextWord(page);
    assert.equal(await inputFocused(page), false, 'touch default: no focus on new word');
    assert.ok(await page.locator('#listening-type-answer').isVisible());

    // A saved 'on' wins over the touch default.
    await page.locator('#lr-autofocus-toggle').tap();
    assert.equal(await page.evaluate(k => localStorage.getItem(k), KEY), 'on');
    await openListening(page);
    assert.equal(await page.locator('#lr-autofocus-toggle').getAttribute('aria-pressed'), 'true');
    await page.waitForFunction(() => document.activeElement?.id === 'listening-type-answer');
    await page.locator('#lr-autofocus-toggle').tap();

    // ── (5) No horizontal overflow at 375 / 320 px ─────────────────────────────────────
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 740 });
      await page.waitForTimeout(100);
      const m = await page.evaluate(() => {
        const t = document.getElementById('lr-autofocus-toggle').getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth - window.innerWidth, left: t.left, right: t.right, height: t.height, vw: window.innerWidth };
      });
      assert.ok(m.overflow <= 0, `${width}px: page overflows by ${m.overflow}px`);
      assert.ok(m.left >= 0 && m.right <= m.vw, `${width}px: toggle inside the screen`);
      assert.ok(m.height <= 40, `${width}px: toggle stays one line (${m.height}px)`);
    }
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`  ✓ touch: default OFF via ${how}; saved ON wins; no overflow at 375/320`);
  }
  console.log('PASS: Listening auto-open keyboard toggle.');
} finally { await browser?.close(); await server.close(); }
