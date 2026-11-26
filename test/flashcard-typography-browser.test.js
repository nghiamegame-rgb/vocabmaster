// Browser regression test for Flashcard & Vocabulary typography (Nunito body/annotations,
// Fraunces only on large >=24px headings/words, no negative letter-spacing on annotations).
// Run: node test/flashcard-typography-browser.test.js
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const tempDir = mkdtempSync(join(tmpdir(), 'vocab-typo-vite-'));
const server = await createServer({
  cacheDir: join(tempDir, 'cache'),
  server: { host: '127.0.0.1', port: 0, hmr: false },
});

const SAMPLE_WORDS = [
  {
    id: 'w-phrase',
    english: 'praised for',
    annotation: 'Cụm từ · Praise someone for something nghĩa là khen ai vì điều gì.',
    vietnamese: 'được khen ngợi vì',
    wordType: 'Phrase',
    level: 1,
    currentStreak: 0,
    createdAt: 1001,
  },
];

let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, headless: true }
    : { channel: 'msedge', headless: true });

  for (const width of [1280, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false } });
      return route.continue();
    });

    await page.addInitScript(words => {
      if (!sessionStorage.getItem('typo_init')) {
        localStorage.setItem('vocabmaster_words', JSON.stringify(words));
        sessionStorage.setItem('typo_init', '1');
      }
    }, SAMPLE_WORDS);

    await page.goto(origin);
    await page.locator('#nav-tab-flashcard').click();
    const annotation = page.getByTestId('flashcard-annotation').first();
    await annotation.waitFor();

    const flashMetrics = await page.evaluate(() => {
      const card = document.querySelector('.flashcard-front');
      const heading = card.querySelector('h2');
      const note = card.querySelector('[data-testid="flashcard-annotation"]');
      const hStyle = getComputedStyle(heading);
      const nStyle = getComputedStyle(note);
      const hRect = heading.getBoundingClientRect();
      const nRect = note.getBoundingClientRect();
      return {
        hFont: hStyle.fontFamily,
        hSize: parseFloat(hStyle.fontSize),
        nFont: nStyle.fontFamily,
        nSize: parseFloat(nStyle.fontSize),
        nLetterSpacing: nStyle.letterSpacing,
        nWordSpacing: nStyle.wordSpacing,
        nLineHeight: parseFloat(nStyle.lineHeight),
        belowHeading: nRect.top >= hRect.bottom - 2,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });

    assert.match(flashMetrics.hFont, /Fraunces/, `Flashcard heading uses Fraunces (${width}px)`);
    assert.ok(flashMetrics.hSize >= 24, `Flashcard heading >= 24px (got ${flashMetrics.hSize})`);
    assert.match(flashMetrics.nFont, /Nunito/, `Flashcard annotation uses Nunito (${width}px)`);
    assert.ok(flashMetrics.nSize >= 16, `Flashcard annotation >= 16px (got ${flashMetrics.nSize})`);
    assert.ok(
      flashMetrics.nLetterSpacing === 'normal' || parseFloat(flashMetrics.nLetterSpacing) >= 0,
      `Flashcard annotation has no negative letter-spacing (got ${flashMetrics.nLetterSpacing})`,
    );
    assert.ok(flashMetrics.nLineHeight >= flashMetrics.nSize * 1.45, 'Flashcard annotation has generous line-height');
    assert.ok(flashMetrics.belowHeading, 'Flashcard annotation renders on its own line below heading');
    assert.equal(flashMetrics.overflow, false, `No horizontal overflow on Flashcard (${width}px)`);

    // Check Vocabulary grid card typography
    await page.locator('#nav-tab-vocabulary').click();
    await page.locator('#speak-w-phrase').waitFor();
    const vocabMetrics = await page.evaluate(() => {
      const h3 = document.querySelector('.vm-card h3');
      const meaning = document.querySelector('.sb-vocab-meaning');
      const meta = document.querySelector('.sb-vocab-meta');
      return {
        h3Font: getComputedStyle(h3).fontFamily,
        h3Size: parseFloat(getComputedStyle(h3).fontSize),
        mFont: getComputedStyle(meaning).fontFamily,
        mSize: parseFloat(getComputedStyle(meaning).fontSize),
        mWeight: Number(getComputedStyle(meaning).fontWeight),
        mLetterSpacing: getComputedStyle(meaning).letterSpacing,
        metaFont: getComputedStyle(meta).fontFamily,
        metaSize: parseFloat(getComputedStyle(meta).fontSize),
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });

    assert.match(vocabMetrics.h3Font, /Fraunces/, 'Vocabulary word title uses Fraunces');
    assert.ok(vocabMetrics.h3Size >= 24, `Vocabulary word title >= 24px (got ${vocabMetrics.h3Size})`);
    assert.match(vocabMetrics.mFont, /Nunito/, 'Vocabulary meaning uses Nunito');
    assert.ok(vocabMetrics.mSize >= 16, `Vocabulary meaning >= 16px (got ${vocabMetrics.mSize})`);
    assert.ok(vocabMetrics.mWeight >= 600, `Vocabulary meaning weight >= 600 (got ${vocabMetrics.mWeight})`);
    assert.ok(
      vocabMetrics.mLetterSpacing === 'normal' || parseFloat(vocabMetrics.mLetterSpacing) >= 0,
      `Vocabulary meaning has no negative letter-spacing (got ${vocabMetrics.mLetterSpacing})`,
    );
    assert.match(vocabMetrics.metaFont, /Nunito/, 'Vocabulary meta uses Nunito');
    assert.ok(vocabMetrics.metaSize >= 14, `Vocabulary meta >= 14px (got ${vocabMetrics.metaSize})`);
    assert.equal(vocabMetrics.overflow, false, `No horizontal overflow on Vocabulary (${width}px)`);
    assert.deepEqual(errors, [], `No page errors (${width}px)`);
    await context.close();
  }

  console.log('PASS: Flashcard & Vocabulary typography checks (1280px & 375px)');
} finally {
  await browser?.close();
  await server.close();
}
