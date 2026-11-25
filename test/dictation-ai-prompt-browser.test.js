// Browser test: "Sao chép prompt cho AI" copies the prompt; when the browser refuses,
// the prompt is shown already selected. Disposable Edge context, localhost only.
// Run: node test/dictation-ai-prompt-browser.test.js
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { DICTATION_AI_PROMPT } from '../src/utils/dictationAiPrompt.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await createServer({
  cacheDir: mkdtempSync(join(tmpdir(), 'ai-prompt-vite-')),
  server: { host: '127.0.0.1', port: 0, hmr: false },
});

let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false, error: 'unconfigured' } });
    return route.continue();
  });
  await context.addInitScript(() => {
    window.__copied = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async text => { if (window.__refuse) throw new DOMException('denied', 'NotAllowedError'); window.__copied.push(text); } },
    });
  });
  await page.goto(origin);
  await page.locator('#nav-tab-dictation').click();
  await page.locator('#dictation-section-library[aria-selected="true"]').waitFor();
  await page.getByText('Xuất Excel → gửi file kèm prompt này cho chatbot → dán kết quả vào ô Nạp bài mới.').waitFor();
  assert.equal(await page.locator('#dictation-export-xlsx').count(), 1);

  // ── Copy allowed ──
  await page.getByRole('button', { name: 'Sao chép prompt cho AI' }).click();
  await page.getByText('Đã sao chép prompt.', { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.__copied), [DICTATION_AI_PROMPT]);
  assert.equal(await page.locator('#dictation-ai-prompt').count(), 0);

  // ── Copy refused: shown and selected, also on a second click ──
  await page.evaluate(() => { window.__refuse = true; });
  const selection = () => page.evaluate(() => {
    const box = document.getElementById('dictation-ai-prompt');
    return { value: box.value, start: box.selectionStart, end: box.selectionEnd, focused: document.activeElement === box, readOnly: box.readOnly };
  });
  for (let i = 0; i < 2; i++) {
    await page.locator('#dictation-copy-prompt').click();
    await page.locator('#dictation-ai-prompt').waitFor();
    await page.waitForFunction(() => document.activeElement?.id === 'dictation-ai-prompt');
    assert.deepEqual(await selection(), { value: DICTATION_AI_PROMPT, start: 0, end: DICTATION_AI_PROMPT.length, focused: true, readOnly: true });
    assert.equal(await page.getByText('Đã sao chép prompt.', { exact: true }).count(), 0);
    await page.evaluate(() => document.getElementById('dictation-ai-prompt').setSelectionRange(0, 0));
  }

  // ── No clipboard at all (e.g. plain http on a phone) ──
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
  await page.locator('#dictation-section-practice').click();
  await page.locator('#dictation-section-library').click();
  await page.locator('#dictation-copy-prompt').click();
  await page.locator('#dictation-ai-prompt').waitFor();
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 800 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `${width}px overflow ${overflow}`);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: AI prompt copied; refused or missing clipboard shows it selected; fits phones.');
  await context.close();
} finally { await browser?.close(); await server.close(); }
