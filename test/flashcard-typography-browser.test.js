// Browser regression test for site-wide Nunito typography (Fraunces completely removed,
// no serif fallback on any visible element across all 7 tabs, weight 800 on main words/headings,
// no negative letter-spacing, and long words wrap cleanly at 375px without overflow).
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
    id: 'w-long-1',
    english: 'responsibilities',
    annotation: 'Danh từ số nhiều · Nghĩa vụ hoặc trách nhiệm trong công việc và cuộc sống.',
    vietnamese: 'trách nhiệm, bổn phận',
    wordType: 'Word',
    level: 1,
    currentStreak: 0,
    createdAt: 1004,
  },
  {
    id: 'w-long-2',
    english: 'enthusiastic',
    annotation: 'Tính từ · Enthusiastic about something nghĩa là hào hứng với điều gì.',
    vietnamese: 'nhiệt tình, hào hứng',
    wordType: 'Word',
    level: 2,
    currentStreak: 2,
    createdAt: 1003,
  },
  {
    id: 'w-long-3',
    english: 'congestion',
    annotation: 'Danh từ · Traffic congestion là tình trạng tắc nghẽn giao thông.',
    vietnamese: 'sự tắc nghẽn',
    wordType: 'Word',
    level: 3,
    currentStreak: 4,
    createdAt: 1002,
  },
  {
    id: 'w-phrase',
    english: 'praised for',
    annotation: 'Cụm từ · Praise someone for something nghĩa là khen ai vì điều gì.',
    vietnamese: 'được khen ngợi vì',
    wordType: 'Phrase',
    level: 4,
    currentStreak: 8,
    createdAt: 1001,
  },
];

const ALL_TABS = ['dashboard', 'vocabulary', 'flashcard', 'quiz', 'listening', 'grammar', 'dictation'];

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
    const frauncesRequests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', req => {
      if (/fraunces/i.test(req.url())) frauncesRequests.push(req.url());
    });

    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false } });
      return route.continue();
    });

    await page.addInitScript(words => {
      if (!sessionStorage.getItem('typo_init')) {
        localStorage.setItem('vocabmaster_words', JSON.stringify(words));
        localStorage.setItem('vocabmaster_listening_autofocus', 'off');
        sessionStorage.setItem('typo_init', '1');
      }
    }, SAMPLE_WORDS);

    await page.goto(origin);
    await page.locator('#nav-tab-dashboard').waitFor();

    // Verify SVG text in JourneyMapSvg uses Nunito and fits inside stage pills
    const svgMetrics = await page.evaluate(() => {
      const svg = document.querySelector('svg[aria-label*="Bản đồ hành trình"]');
      if (!svg) return null;
      const texts = Array.from(svg.querySelectorAll('text')).map(el => ({
        text: el.textContent.trim(),
        fontFamily: getComputedStyle(el).fontFamily,
        len: typeof el.getComputedTextLength === 'function' ? el.getComputedTextLength() : 0,
        prevRectWidth: el.previousElementSibling?.tagName?.toLowerCase() === 'rect'
          ? parseFloat(el.previousElementSibling.getAttribute('width') || '0')
          : 0,
      }));
      return { texts };
    });
    assert.ok(svgMetrics && svgMetrics.texts.length >= 15, `JourneyMapSvg renders labels (${width}px)`);
    for (const item of svgMetrics.texts) {
      assert.match(item.fontFamily, /Nunito/, `SVG text "${item.text}" uses Nunito (${width}px)`);
      assert.doesNotMatch(item.fontFamily, /Fraunces/i, `SVG text "${item.text}" does not use Fraunces`);
      if (item.prevRectWidth > 0) {
        assert.ok(
          item.len <= item.prevRectWidth - 4,
          `SVG text "${item.text}" (${item.len.toFixed(1)}) fits inside pill (${item.prevRectWidth})`,
        );
      }
    }

    // Verify Flashcard typography + no overflow for long word 'responsibilities' (only L1 word)
    await page.locator('#nav-tab-flashcard').click();
    await page.locator('#flashcard-level-1').click();
    const annotation = page.getByTestId('flashcard-annotation').first();
    await annotation.waitFor();

    const flashMetrics = await page.evaluate(() => {
      const card = document.querySelector('.flashcard-front');
      const heading = card.querySelector('h2');
      const note = card.querySelector('[data-testid="flashcard-annotation"]');
      const hStyle = getComputedStyle(heading);
      const nStyle = getComputedStyle(note);
      const cRect = card.getBoundingClientRect();
      const hRect = heading.getBoundingClientRect();
      const nRect = note.getBoundingClientRect();
      return {
        hText: heading.textContent.trim(),
        hFont: hStyle.fontFamily,
        hSize: parseFloat(hStyle.fontSize),
        hWeight: Number(hStyle.fontWeight),
        hLetterSpacing: hStyle.letterSpacing,
        hFitsCard: hRect.left >= cRect.left - 1 && hRect.right <= cRect.right + 1,
        nFont: nStyle.fontFamily,
        nSize: parseFloat(nStyle.fontSize),
        nLetterSpacing: nStyle.letterSpacing,
        nWordSpacing: nStyle.wordSpacing,
        nLineHeight: parseFloat(nStyle.lineHeight),
        belowHeading: nRect.top >= hRect.bottom - 2,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });

    assert.equal(flashMetrics.hText, 'responsibilities', `Flashcard shows long L1 word (${width}px)`);
    assert.match(flashMetrics.hFont, /Nunito/, `Flashcard heading uses Nunito (${width}px)`);
    assert.doesNotMatch(flashMetrics.hFont, /Fraunces/i, `Flashcard heading has no Fraunces (${width}px)`);
    assert.ok(flashMetrics.hSize >= 24, `Flashcard heading >= 24px (got ${flashMetrics.hSize})`);
    assert.ok(flashMetrics.hWeight >= 800, `Flashcard heading weight >= 800 (got ${flashMetrics.hWeight})`);
    assert.ok(
      flashMetrics.hLetterSpacing === 'normal' || parseFloat(flashMetrics.hLetterSpacing) >= 0,
      `Flashcard heading has no negative letter-spacing (got ${flashMetrics.hLetterSpacing})`,
    );
    assert.ok(flashMetrics.hFitsCard, `Flashcard word "${flashMetrics.hText}" fits inside card (${width}px)`);
    assert.match(flashMetrics.nFont, /Nunito/, `Flashcard annotation uses Nunito (${width}px)`);
    assert.ok(flashMetrics.nSize >= 16, `Flashcard annotation >= 16px (got ${flashMetrics.nSize})`);
    assert.ok(
      flashMetrics.nLetterSpacing === 'normal' || parseFloat(flashMetrics.nLetterSpacing) >= 0,
      `Flashcard annotation has no negative letter-spacing (got ${flashMetrics.nLetterSpacing})`,
    );
    assert.ok(flashMetrics.nLineHeight >= flashMetrics.nSize * 1.45, 'Flashcard annotation has generous line-height');
    assert.ok(flashMetrics.belowHeading, 'Flashcard annotation renders on its own line below heading');
    assert.equal(flashMetrics.overflow, false, `No horizontal overflow on Flashcard (${width}px)`);

    // Check Vocabulary grid card typography + long words fit inside cards
    await page.locator('#nav-tab-vocabulary').click();
    await page.locator('#speak-w-long-1').waitFor();
    const vocabMetrics = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.vm-card')).filter(c => c.querySelector('h3'));
      const cardChecks = cards.map(card => {
        const h3 = card.querySelector('h3');
        const cRect = card.getBoundingClientRect();
        const hRect = h3.getBoundingClientRect();
        return {
          word: h3.textContent.trim(),
          font: getComputedStyle(h3).fontFamily,
          size: parseFloat(getComputedStyle(h3).fontSize),
          weight: Number(getComputedStyle(h3).fontWeight),
          letterSpacing: getComputedStyle(h3).letterSpacing,
          fitsCard: hRect.left >= cRect.left - 1 && hRect.right <= cRect.right + 1,
        };
      });
      const meaning = document.querySelector('.sb-vocab-meaning');
      const meta = document.querySelector('.sb-vocab-meta');
      return {
        cardChecks,
        mFont: getComputedStyle(meaning).fontFamily,
        mSize: parseFloat(getComputedStyle(meaning).fontSize),
        mWeight: Number(getComputedStyle(meaning).fontWeight),
        mLetterSpacing: getComputedStyle(meaning).letterSpacing,
        metaFont: getComputedStyle(meta).fontFamily,
        metaSize: parseFloat(getComputedStyle(meta).fontSize),
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });

    assert.ok(vocabMetrics.cardChecks.length >= 4, 'Vocabulary renders all sample cards');
    for (const c of vocabMetrics.cardChecks) {
      assert.match(c.font, /Nunito/, `Vocabulary word "${c.word}" uses Nunito (${width}px)`);
      assert.doesNotMatch(c.font, /Fraunces/i, `Vocabulary word "${c.word}" has no Fraunces (${width}px)`);
      assert.ok(c.size >= 24, `Vocabulary word "${c.word}" >= 24px (got ${c.size})`);
      assert.ok(c.weight >= 800, `Vocabulary word "${c.word}" weight >= 800 (got ${c.weight})`);
      assert.ok(
        c.letterSpacing === 'normal' || parseFloat(c.letterSpacing) >= 0,
        `Vocabulary word "${c.word}" has no negative letter-spacing (got ${c.letterSpacing})`,
      );
      assert.ok(c.fitsCard, `Vocabulary word "${c.word}" fits inside card (${width}px)`);
    }
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

    // Scan EVERY visible element across all 7 main tabs: no Fraunces and no serif font-family
    for (const tab of ALL_TABS) {
      await page.locator(`#nav-tab-${tab}`).click();
      if (tab === 'dictation') {
        await page.locator('#dictation-section-library').waitFor();
      } else {
        await page.waitForTimeout(150);
      }
      const scan = await page.evaluate(() => {
        const violations = [];
        const root = document.getElementById('root');
        const nodes = root ? root.querySelectorAll('*') : [];
        for (const el of nodes) {
          const tag = el.tagName.toLowerCase();
          if (tag === 'script' || tag === 'style' || tag === 'noscript') continue;
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          const tokens = String(style.fontFamily || '')
            .split(',')
            .map(t => t.trim().replace(/^['"]|['"]$/g, '').toLowerCase());
          const bad = tokens.find(
            t => t.includes('fraunces') || t === 'serif' || t === 'georgia' || t === 'times new roman' || t === 'times',
          );
          if (bad) {
            violations.push({
              tag,
              cls: typeof el.className === 'string' ? el.className.slice(0, 80) : '',
              fontFamily: style.fontFamily,
              bad,
            });
          }
        }
        return {
          violations,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      assert.deepEqual(scan.violations, [], `No Fraunces/serif elements on tab "${tab}" (${width}px)`);
      assert.equal(scan.overflow, false, `No horizontal overflow on tab "${tab}" (${width}px)`);
    }

    assert.deepEqual(frauncesRequests, [], `No network requests for Fraunces font files (${width}px)`);
    assert.deepEqual(errors, [], `No page errors (${width}px)`);
    await context.close();
  }

  console.log('PASS: Site-wide Nunito typography & long-word checks across 7 tabs (1280px & 375px)');
} finally {
  await browser?.close();
  await server.close();
}
