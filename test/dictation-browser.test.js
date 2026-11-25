// Browser test: Dictation tab main flow (paste lesson → listen → type → words open →
// save word → submit → sentence grid → saved words → reload). Real App in disposable
// Edge contexts, localhost only, speech stubbed. Run: node test/dictation-browser.test.js
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await createServer({
  cacheDir: mkdtempSync(join(tmpdir(), 'dictation-vite-')),
  server: { host: '127.0.0.1', port: 0, hmr: false },
});
const VOCAB = ['resilient', 'collaborate', 'sustainable', 'initiate'].map((english, i) => ({
  id: `w${i + 1}`, english, vietnamese: `nghĩa ${i + 1}`, annotation: '', wordType: 'Word', level: 2, currentStreak: 1, createdAt: 1000 + i,
}));
const LESSON = 'The weather is nice today. | Hôm nay thời tiết đẹp.\nMr. Smith doesn’t like coffee.\nWe will meet at the U.S. office tomorrow.';

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
    if (url.pathname === '/api/vocab-sync') return route.fulfill({ json: { protocol: 1, generation: 'dict-gen', revision: 0, words: VOCAB, tombstones: [], paused: false, ok: true } });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false, error: 'unconfigured' } });
    return route.continue();
  });
  await context.addInitScript(() => {
    window.__spoken = [];
    const synth = {
      speaking: false,
      speak(u) { window.__spoken.push({ text: u.text, rate: u.rate }); setTimeout(() => u.onend?.(), 30); },
      cancel() {}, getVoices: () => [{ lang: 'en-US', name: 'Test' }], addEventListener() {}, removeEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  });

  await page.goto(origin);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('vocabmaster_vocab_sync_v1') || '{}').base?.generation === 'dict-gen');
  const vocabBefore = await page.evaluate(() => localStorage.getItem('vocabmaster_words'));

  // ── Tab exists with an accessible name; opens on the library when empty ──
  await page.locator('#nav-tab-dictation').click();
  await page.locator('#dictation-section-library[aria-selected="true"]').waitFor();

  // ── Paste a lesson ──
  await page.locator('#dictation-lesson-title').fill('Bài thử');
  await page.locator('#dictation-lesson-text').fill(LESSON);
  assert.match(await page.locator('#dictation-parse-preview').innerText(), /Sẽ tạo 3 câu, 1 câu có bản dịch/);
  await page.locator('#dictation-add-lesson').click();
  await page.getByText('Đã tạo bài “Bài thử” với 3 câu.').waitFor();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('vocabmaster_dictation_data')));
  assert.equal(stored.sentences.length, 3);
  assert.equal(stored.sentences[2].english, 'We will meet at the U.S. office tomorrow.');

  // ── Practice: counter, translation toggle, speed, play ──
  await page.locator('#dictation-section-practice').click();
  assert.equal(await page.locator('#dictation-counter').innerText(), 'Câu 1/3');
  await page.locator('#dictation-translation-toggle').click();
  assert.equal(await page.locator('#dictation-translation').innerText(), 'Hôm nay thời tiết đẹp.');
  await page.locator('#dictation-speed-075').click();
  await page.locator('#dictation-replay').click();
  await page.waitForFunction(() => window.__spoken.some(s => s.text === 'The weather is nice today.' && Math.abs(s.rate - 0.675) < 1e-9));
  assert.equal(await page.locator('[data-chip-state="hidden"]').count(), 5);

  // ── Typing opens the matching words; save one word ──
  await page.locator('#dictation-answer').click();
  await page.keyboard.type('the weather is');
  assert.equal(await page.locator('[data-chip-state="open"]').count(), 3);
  assert.equal(await page.locator('#dictation-progress').innerText(), '3/5 từ đúng');
  await page.locator('button[data-word="weather"]').click();
  await page.locator('li[data-saved="true"] button[data-word="weather"]').waitFor();
  // Hint opens the next word without typing it.
  await page.keyboard.press('Control+/');
  assert.equal(await page.locator('[data-chip-state="open"]').count(), 4);
  assert.equal(await page.locator('#dictation-answer').inputValue(), 'the weather is', 'shortcut typed nothing');
  // Wrong answer → submit with Enter → comparison + red cell.
  await page.keyboard.type(' good today');
  await page.keyboard.press('Enter');
  await page.locator('#dictation-result').waitFor();
  assert.match(await page.locator('#dictation-result').innerText(), /Đúng 4\/5 từ/);
  assert.equal(await page.locator('#dictation-correct-sentence').innerText(), 'The weather is nice today.');
  assert.equal(await page.locator('#dictation-cell-1').getAttribute('data-status'), 'current');
  // Enter again → next sentence; cell 1 now red.
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('dictation-counter')?.textContent === 'Câu 2/3');
  assert.equal(await page.locator('#dictation-cell-1').getAttribute('data-status'), 'wrong');
  assert.ok(await page.evaluate(() => document.activeElement?.id === 'dictation-answer'), 'desktop default: input focused on new sentence');

  // ── Correct answer with curly apostrophe/punctuation differences ──
  await page.locator('#dictation-answer').fill("mr smith doesn't like coffee");
  await page.locator('#dictation-submit').click();
  await page.getByText('Chính xác! Cả câu đúng.').waitFor();
  await page.locator('#dictation-next').click();
  assert.equal(await page.locator('#dictation-cell-2').getAttribute('data-status'), 'correct');
  assert.match(await page.locator('#dictation-legend').innerText(), /Đúng 1 · Sai 1 · Chưa làm 1/);
  // Ctrl+↑ goes back without typing anything.
  await page.keyboard.press('Control+ArrowUp');
  await page.waitForFunction(() => document.getElementById('dictation-counter')?.textContent === 'Câu 2/3');
  // Grid jump.
  await page.locator('#dictation-cell-3').click();
  assert.equal(await page.locator('#dictation-counter').innerText(), 'Câu 3/3');

  // ── Saved words ──
  await page.locator('#dictation-section-words').click();
  await page.locator('#dictation-words-view-list').click(); // practice is the default view
  await page.locator('#dictation-word-weather').waitFor();
  assert.match(await page.locator('#dictation-word-weather').innerText(), /The weather is nice today\./);
  assert.match(await page.locator('#dictation-word-weather').innerText(), /Bài: Bài thử/);
  await page.locator('#dictation-word-search').fill('zzz');
  await page.getByText('Không có từ khớp').waitFor();
  await page.locator('#dictation-word-search').fill('');

  // ── Listening → source "Từ chép chính tả": hear the saved word, type it ──
  await page.locator('#nav-tab-listening').click();
  await page.locator('#lr-level-all').waitFor();
  assert.equal(await page.locator('#lr-source-main').getAttribute('aria-pressed'), 'true', 'main vocabulary stays the default');
  assert.match(await page.locator('#lr-source-dictation').innerText(), /Từ chép chính tả \(1\)/);
  await page.locator('#lr-source-dictation').click();
  await page.locator('#lr-dictation-input').waitFor();
  for (const hidden of ['#lr-level-all', '#lr-type-all', '#lr-hard-toggle', '#lr-due-toggle']) {
    assert.equal(await page.locator(hidden).count(), 0, `${hidden} hidden for Dictation words`);
  }
  await page.waitForFunction(() => window.__spoken.at(-1)?.text === 'weather');
  await page.locator('#lr-dictation-input').fill('whether');
  await page.keyboard.press('Enter');
  await page.locator('#lr-dictation-feedback').waitFor();
  assert.match(await page.locator('#lr-dictation-feedback').innerText(), /Chưa đúng — đáp án: weather/);
  await page.keyboard.press('Enter'); // next word (the only one again)
  await page.locator('#lr-dictation-feedback').waitFor({ state: 'detached' });
  await page.locator('#lr-dictation-input').pressSequentially('Weather');
  await page.getByText('Chính xác!').waitFor(); // auto-submits on the exact word
  await page.getByText('2 played', { exact: true }).waitFor(); // Dictation stats: 1 correct of 2
  assert.equal(await page.getByText('50%', { exact: true }).count(), 1);
  await page.locator('#lr-dictation-wrong-toggle').click();
  await page.locator('#lr-dictation-input').waitFor(); // the word was heard wrong once, so it stays in the pool
  const listened = await page.evaluate(() => JSON.parse(localStorage.getItem('vocabmaster_dictation_data')).words.find(w => w.id === 'weather').listen);
  assert.deepEqual(Object.values(listened), [{ correct: 1, wrong: 1 }]);
  assert.equal(await page.evaluate(() => localStorage.getItem('vocabmaster_words')), vocabBefore, 'main vocabulary (levels, streaks, review dates) untouched');
  await page.locator('#lr-source-main').click();
  await page.locator('#lr-level-all').waitFor();
  await page.locator('#nav-tab-dictation').click();
  await page.locator('#dictation-section-words').click();
  await page.locator('#dictation-words-view-list').click(); // practice is the default view
  assert.match(await page.locator('#dictation-word-weather').innerText(), /nghe đúng 1 · sai 1/);

  // ── Reload keeps everything; vocabulary store untouched ──
  await page.reload();
  await page.locator('#nav-tab-dictation').click();
  await page.locator('#dictation-section-practice[aria-selected="true"]').waitFor();
  assert.equal(await page.locator('#dictation-cell-1').getAttribute('data-status'), 'wrong');
  assert.equal(await page.locator('#dictation-cell-2').getAttribute('data-status'), 'correct');
  assert.equal(await page.evaluate(() => localStorage.getItem('vocabmaster_words')), vocabBefore);
  const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('vocabmaster_dictation_')).sort());
  assert.deepEqual(keys, ['vocabmaster_dictation_data', 'vocabmaster_dictation_device', 'vocabmaster_dictation_prefs']);

  // ── Delete lesson (two-step) ──
  await page.locator('#dictation-section-library').click();
  await page.getByRole('button', { name: 'Xoá bài Bài thử' }).click();
  await page.getByRole('button', { name: 'Xoá bài', exact: true }).click();
  await page.getByText('Chưa có bài nào.').waitFor();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('vocabmaster_dictation_data')));
  assert.ok(after.sentences.every(s => s.deletedAt), 'sentences kept as tombstones');
  assert.equal(after.words.filter(w => !w.deletedAt).length, 1, 'saved words stay');

  // ── No horizontal overflow on phones ──
  await page.locator('#dictation-section-practice').click();
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.locator('#dictation-section-library').click();
    await page.locator('#dictation-section-practice').click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `${width}px overflow ${overflow}`);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: Dictation tab — paste lesson, typing opens words, save word, hint, submit/compare, grid, shortcuts, saved words, Listening with saved words (main vocabulary untouched), reload, delete, no overflow.');
  await context.close();
} finally { await browser?.close(); await server.close(); }
