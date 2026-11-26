// Browser test: the Vocabulary sync message is a chip inside the navbar row (next to the
// Sync button), not a floating box over the page. Real App in disposable Edge contexts,
// localhost mocks only. Optional screenshots: NAVBAR_SCREENSHOT_DIR=<folder>.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const screenshotDir = process.env.NAVBAR_SCREENSHOT_DIR || '';
if (screenshotDir) mkdirSync(screenshotDir, { recursive: true });
const server = await createServer({
  cacheDir: mkdtempSync(join(tmpdir(), 'navbar-chip-vite-')),
  server: { host: '127.0.0.1', port: 0, hmr: false },
});

const WORDS = ['resilient', 'collaborate', 'sustainable', 'initiate', 'accessible'].map((english, i) => ({
  id: `w${i + 1}`, english, vietnamese: `nghĩa ${i + 1}`, annotation: '', wordType: 'Word', level: 1, currentStreak: 0, createdAt: 1000 + i,
}));
const TEXT = {
  syncing: '☁️ Fetching fresh data from Google Sheets…',
  ok: '✅ Vocabulary synced successfully!',
  push_error: '⚠️ Vocabulary chưa lưu/đồng bộ xong — xem chi tiết bên dưới.',
};

let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });

  for (const width of [1280, 1024, 768, 640, 375, 320]) {
    const wide = width >= 768;
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const snapshot = { protocol: 1, generation: 'chip-gen', revision: 0, words: WORDS, tombstones: [], paused: false, ok: true };
    let mode = 'hold'; let release; const held = new Promise(r => { release = r; });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/api/vocab-sync') {
        if (mode === 'hold') await held;
        if (mode === 'fail') return route.fulfill({ status: 503, json: { ok: false, error: 'unavailable' } });
        return route.fulfill({ json: snapshot });
      }
      if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false } });
      return route.continue();
    });

    // Vocabulary sync is paused by default on a new device; enable it for this disposable context.
    await page.addInitScript(() => localStorage.setItem('vocabmaster_vocab_sync_paused', 'false'));
    await page.goto(origin);
    await page.locator('#nav-tab-listening').click();
    const region = page.locator('#nav-sync-status');
    const chip = page.locator('[data-sync-chip]');

    async function checkLayout(state) {
      const label = `${width}px/${state}`;
      await chip.and(page.locator(`[data-sync-chip="${state}"]`)).waitFor({ state: 'attached' });
      assert.equal(await chip.textContent(), TEXT[state], label);
      // Listening may scroll its focused input into view; measure from the top of the page.
      await page.evaluate(() => window.scrollTo(0, 0));
      assert.equal(await region.getAttribute('role'), 'status');
      assert.equal(await region.getAttribute('aria-live'), 'polite');
      assert.ok((await page.locator('#nav-sync-btn').getAttribute('title')).startsWith(TEXT[state]), `${label} Sync title`);
      const m = await page.evaluate(() => {
        const box = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
        const nav = document.querySelector('nav');
        const row = nav.querySelector('.h-16');
        const chipEl = document.querySelector('[data-sync-chip]');
        const fixed = [...document.querySelectorAll('body *')].filter(el => getComputedStyle(el).position === 'fixed').map(el => el.tagName.toLowerCase());
        const tabs = () => [...nav.querySelectorAll('[id^="nav-tab-"]')].map(el => Math.round(el.getBoundingClientRect().left));
        const withChip = tabs();
        const regionEl = document.getElementById('nav-sync-status');
        const prev = regionEl.style.display; regionEl.style.display = 'none';
        const withoutChip = tabs();
        regionEl.style.display = prev;
        const panel = document.querySelector('[data-testid="vocab-sync-controls"]');
        const p = box(panel);
        const hit = document.elementFromPoint(p.left + 12, p.top + 12);
        return {
          docOverflow: document.documentElement.scrollWidth - window.innerWidth,
          rowOverflow: row.scrollWidth - row.clientWidth,
          nav: box(nav), row: box(row), chip: box(chipEl), region: box(regionEl), regionClip: getComputedStyle(regionEl).clipPath + ' ' + getComputedStyle(regionEl).overflow, sync: box(document.getElementById('nav-sync-btn')),
          chipPosition: getComputedStyle(chipEl).position, regionClipped: getComputedStyle(regionEl).position === 'absolute',
          fixed, withChip, withoutChip, panelTop: p.top, panelHit: panel.contains(hit),
        };
      });
      assert.ok(m.docOverflow <= 0, `${label} page overflows horizontally by ${m.docOverflow}px`);
      assert.ok(m.rowOverflow <= 0, `${label} navbar row overflows by ${m.rowOverflow}px`);
      assert.deepEqual(m.fixed, ['nav'], `${label} only the navbar is position:fixed`);
      assert.deepEqual(m.withChip, m.withoutChip, `${label} tabs must not move when the chip appears`);
      assert.ok(m.panelTop >= m.nav.bottom, `${label} page content starts below the navbar`);
      assert.ok(m.panelHit, `${label} content under the navbar is not covered`);
      assert.equal(m.chipPosition, 'static', label);
      if (wide) {
        assert.equal(m.regionClipped, false, `${label} chip visible from md`);
        assert.ok(m.chip.width > 24, `${label} chip has room (${m.chip.width}px)`);
        assert.ok(m.chip.top >= m.row.top && m.chip.bottom <= m.row.bottom, `${label} chip inside the navbar row`);
        assert.ok(m.chip.right <= m.sync.left, `${label} chip left of the Sync button`);
        assert.ok(Math.abs((m.chip.top + m.chip.bottom) / 2 - (m.sync.top + m.sync.bottom) / 2) <= 2, `${label} same row as Sync`);
        assert.ok(m.chip.height <= 26, `${label} chip is one line (${m.chip.height}px)`);
      } else {
        assert.equal(m.regionClipped, true, `${label} screen-reader only below md`);
        assert.ok(m.region.width <= 1 && m.region.height <= 1 && m.regionClip.includes('hidden'), `${label} chip clipped away below md (${JSON.stringify(m.region)} ${m.regionClip})`);
      }
      if (screenshotDir && (width === 1280 || width === 375)) {
        await page.screenshot({ path: join(screenshotDir, `after-${width}-${state}.png`), clip: { x: 0, y: 0, width, height: 200 } });
      }
    }

    // 1) Holding the first read → "syncing".
    await checkLayout('syncing');
    // 2) Read succeeds → "ok" (stays until the next sync, as before).
    mode = 'ok'; release();
    await checkLayout('ok');
    // 3) Read fails → engine error → push error message has priority.
    mode = 'fail';
    await page.locator('#nav-sync-btn').click();
    await checkLayout('push_error');
    assert.match(await chip.getAttribute('class'), /text-rose-900/);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`  ✓ ${width}px`);
  }
  console.log('PASS: sync chip inside the navbar row (md+), sr-only live region below md, no floating box, no overflow, tabs stay put.');
} finally { await browser?.close(); await server.close(); }
