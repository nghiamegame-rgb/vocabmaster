// Browser test: Dictation → "Từ đã lưu" → listening practice with text cards, filters,
// counters saved and synced to the (simulated) Sheet, small word counts, phones.
// Real App in disposable Edge contexts; speech faked; no external network. A pass does
// not prove real voices or the real Google Sheet. Run: node test/dictation-word-practice-browser.test.js
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { dictationBackend } from './helpers/dictation-backend.js';
import { emptyDictationData, addLesson, saveWord, recordWordListen } from '../src/utils/dictationModel.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const shots = process.env.WORD_PRACTICE_SCREENSHOT_DIR || '';
if (shots) mkdirSync(shots, { recursive: true });
const server = await createServer({
  cacheDir: mkdtempSync(join(tmpdir(), 'word-practice-vite-')),
  server: { host: '127.0.0.1', port: 0, hmr: false },
});

/** Saved-word data: lessons { title, words }, plus listen results to record. */
function seed(lessons, results = []) {
  let data = emptyDictationData();
  lessons.forEach(({ title, words }, i) => {
    data = addLesson(data, { title, items: [{ english: words.join(' ') }], now: 1000 + i, lessonId: `L${i}` }).data;
    const sentence = data.sentences.at(-1);
    words.forEach((word, j) => { data = saveWord(data, { word, sentence }, 2000 + i * 100 + j).data; });
  });
  for (const [id, ok] of results) data = recordWordListen(data, id, ok, 'dev_seeded');
  return { schema: 1, sentences: data.sentences, words: data.words };
}

let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });

  async function open(data, { viewport = { width: 1280, height: 900 }, backend = null, mobile = false } = {}) {
    const context = await browser.newContext({ viewport, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
    const errors = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === '/api/dictation-sync' && backend) {
        const request = route.request();
        const body = request.method() === 'POST'
          ? backend.context.doPost({ postData: { contents: JSON.stringify({ ...JSON.parse(request.postData()), secret: 'test-secret' }) } })
          : backend.get();
        return route.fulfill({ status: body.ok ? 200 : 409, json: JSON.parse(JSON.stringify(body)) });
      }
      if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false, error: 'unconfigured' } });
      return route.continue();
    });
    await context.addInitScript(json => {
      if (json && !sessionStorage.getItem('seeded')) {
        localStorage.setItem('vocabmaster_dictation_data', json);
        sessionStorage.setItem('seeded', '1');
      }
      window.__spoken = [];
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: {
          getVoices: () => [{ name: 'Test US', lang: 'en-US', voiceURI: 'us' }, { name: 'Test UK', lang: 'en-GB', voiceURI: 'uk' }],
          speak(u) { window.__spoken.push({ text: u.text, rate: u.rate, voice: u.voice?.name }); setTimeout(() => u.onend?.(), 20); },
          cancel() {},
        },
      });
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    }, data ? JSON.stringify(data) : '');
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin);
    await page.locator('#nav-tab-dictation').click();
    await page.locator('#dictation-section-words').click();
    // The sentence screen may have read a sentence before we left it; count from here.
    await page.evaluate(() => { window.__spoken.length = 0; });
    return { context, page, errors };
  }

  const cards = page => page.locator('[id^="dictation-card-"]');
  const stored = page => page.evaluate(() => Object.fromEntries(JSON.parse(localStorage.getItem('vocabmaster_dictation_data')).words.map(w => [
    w.id, Object.values(w.listen || {}).reduce((s, c) => [s[0] + (c.correct || 0), s[1] + (c.wrong || 0)], [0, 0]),
  ])));
  const spokenCount = page => page.evaluate(() => window.__spoken.length);
  const lastSpoken = page => page.evaluate(() => window.__spoken.at(-1));
  /** Waits for a new question (feedback gone, a new utterance after `since`). */
  async function nextQuestion(page, since) {
    await page.waitForFunction(n => !document.getElementById('dictation-practice-feedback') && window.__spoken.length > n, since);
    return (await lastSpoken(page)).text;
  }
  const choose = (page, word) => page.getByRole('button', { name: `Choose ${word}`, exact: true });

  // ── 0 saved words: guidance only ──
  {
    const { context, page, errors } = await open(null);
    assert.equal(await page.locator('#dictation-words-view-listen').getAttribute('aria-selected'), 'true', 'opens in practice mode');
    assert.match(await page.locator('#dictation-practice-empty').innerText(), /Trong Luyện nghe, khi một từ mở, bấm biểu tượng lưu/);
    assert.equal(await cards(page).count(), 0);
    await page.waitForTimeout(700);
    assert.equal(await spokenCount(page), 0);
    assert.deepEqual(errors, []);
    await context.close();
    console.log('  ✓ no saved words');
  }

  // ── Main flow: 6 words in two lessons, one already heard wrong ──
  {
    const data = seed(
      [{ title: 'Bài 1', words: ['weather', 'coffee', 'ticket'] }, { title: 'Bài 2', words: ['museum', 'airport', 'breakfast'] }],
      [['weather', false], ['coffee', true], ['ticket', true], ['museum', true]],
    );
    const backend = dictationBackend();
    const { context, page, errors } = await open(data, { backend });
    await page.waitForFunction(() => window.__spoken.length >= 1);
    let word = (await lastSpoken(page)).text;
    assert.equal((await lastSpoken(page)).rate, 0.9);
    assert.equal(await cards(page).count(), 4);
    assert.equal(await page.locator('#voice-settings-toggle').count(), 1, 'one voice button');
    assert.equal(await page.locator('#dictation-words-autofocus-toggle').count(), 1);
    await page.getByText('0 played', { exact: true }).waitFor();
    await page.getByText('Which word do you hear…').waitFor();
    assert.equal(await page.locator('#dictation-practice-input').getAttribute('placeholder'), 'Or type the word here…');
    // Text only: no image, level badge or eye button in the cards.
    for (let i = 0; i < 4; i++) {
      const card = cards(page).nth(i);
      assert.equal(await card.locator('img').count(), 0);
      assert.equal((await card.innerText()).trim(), (await card.getAttribute('aria-label')).slice('Choose '.length));
      assert.ok((await card.boundingBox()).height >= 96);
    }
    assert.equal(await page.locator('[id^="toggle-meaning-"]').count(), 0);
    assert.equal(await page.locator('#toggle-all-meanings-btn').count(), 0);
    if (shots) await page.screenshot({ path: join(shots, 'practice-1280.png'), fullPage: true });

    // Wrong choice: only the asked word gets a "wrong".
    let before = await stored(page);
    const wrongCard = page.locator(`[id^="dictation-card-"]:not([aria-label="Choose ${word}"])`).first();
    const wrongWord = (await wrongCard.getAttribute('aria-label')).slice(7);
    let since = await spokenCount(page);
    await wrongCard.click();
    assert.match(await page.locator('#dictation-practice-feedback').innerText(), new RegExp(`Wrong\\. The answer was\\s*${word}`));
    assert.equal(await choose(page, word).getAttribute('data-state'), 'correct');
    assert.equal(await choose(page, wrongWord).getAttribute('data-state'), 'wrong');
    assert.equal(await page.locator('#dictation-practice-replay').isDisabled(), true);
    assert.equal(await page.locator('#dictation-practice-input').count(), 0);
    let after = await stored(page);
    assert.deepEqual(after[word], [before[word][0], before[word][1] + 1]);
    assert.deepEqual(after[wrongWord], before[wrongWord]);
    await page.getByText('1 played', { exact: true }).waitFor();
    await page.getByText('0%', { exact: true }).waitFor();

    // Auto-advance, then a right choice with the keyboard (Enter on the card).
    const second = await nextQuestion(page, since);
    assert.notEqual(second, word, 'not the same word twice in a row');
    before = await stored(page);
    since = await spokenCount(page);
    await choose(page, second).focus();
    await page.keyboard.press('Enter');
    assert.match(await page.locator('#dictation-practice-feedback').innerText(), new RegExp(`Excellent! You heard\\s*${second}`));
    after = await stored(page);
    assert.deepEqual(after[second], [before[second][0] + 1, before[second][1]]);
    await page.getByText('50%', { exact: true }).waitFor();

    // Typing the word submits by itself; replay repeats the same voice; hint after 5.
    word = await nextQuestion(page, since);
    const first = await lastSpoken(page);
    for (let i = 0; i < 5; i++) await page.locator('#dictation-practice-replay').click();
    assert.deepEqual(await lastSpoken(page), first, 'replay: same word, voice and speed');
    await page.getByText('💡 Hint:', { exact: false }).waitFor();
    before = await stored(page);
    since = await spokenCount(page);
    await page.locator('#dictation-practice-input').pressSequentially(word.toUpperCase());
    await page.locator('#dictation-practice-feedback').waitFor();
    assert.deepEqual((await stored(page))[word], [before[word][0] + 1, before[word][1]]);

    // Keyboard toggle off: the next word does not take the focus.
    await nextQuestion(page, since);
    await page.waitForFunction(() => document.activeElement?.id === 'dictation-practice-input');
    await page.locator('#dictation-words-autofocus-toggle').click();
    assert.equal(await page.evaluate(() => localStorage.getItem('vocabmaster_listening_autofocus')), 'off');
    since = await spokenCount(page);
    await page.locator('#dictation-practice-next').click();
    await nextQuestion(page, since);
    await page.waitForTimeout(300);
    assert.notEqual(await page.evaluate(() => document.activeElement?.id), 'dictation-practice-input');

    // The same counters reach the Sheet through the existing sync.
    await page.locator('#dictation-sync-status[data-status="ok"]').waitFor({ timeout: 15000 });
    const sheet = backend.sheets.get('Từ vựng');
    const totals = await stored(page);
    for (let row = 2; row <= 7; row++) {
      const [shown, , , , right, wrong] = sheet.getRange(row, 1, 1, 6).getValues()[0];
      assert.deepEqual([right, wrong], totals[shown], `Sheet counters for ${shown}`);
    }

    // Filter by lesson.
    const options = await page.locator('#dictation-practice-lesson option').allInnerTexts();
    assert.deepEqual(options, ['Tất cả bài (6)', 'Bài 1 (3)', 'Bài 2 (3)']);
    since = await spokenCount(page);
    await page.locator('#dictation-practice-lesson').selectOption({ label: 'Bài 2 (3)' });
    await page.getByText('3 in pool', { exact: true }).waitFor();
    for (let i = 0; i < 4; i++) {
      await page.waitForFunction(n => window.__spoken.length > n, since);
      assert.ok(['museum', 'airport', 'breakfast'].includes((await lastSpoken(page)).text));
      since = await spokenCount(page);
      await page.locator('#dictation-practice-next').click();
    }
    await page.locator('#dictation-practice-lesson').selectOption({ index: 0 });

    // "Chỉ từ hay nghe sai": only words with a wrong count are asked.
    await page.locator('#dictation-practice-wrong').click();
    const wrongIds = Object.entries(await stored(page)).filter(([, c]) => c[1] > 0).map(([id]) => id);
    await page.getByText(`${wrongIds.length} in pool`, { exact: true }).waitFor();
    since = await spokenCount(page);
    await page.locator('#dictation-practice-next').click();
    assert.ok(wrongIds.includes(await nextQuestion(page, since)));
    assert.equal(await cards(page).count(), 4, 'still 4 choices with a narrow filter');
    await page.locator('#dictation-practice-wrong').click();

    // The list keeps search and delete; leaving practice stops the questions.
    await page.locator('#dictation-words-view-list').click();
    await page.locator('#dictation-word-weather').waitFor();
    assert.equal(await page.locator('#voice-settings-toggle').count(), 1);
    const quiet = await spokenCount(page);
    await page.waitForTimeout(2200);
    assert.equal(await spokenCount(page), quiet);
    await page.locator('#dictation-word-search').fill('airp');
    // Search also looks in the source sentence: the three words of Bài 2 share it.
    assert.equal(await page.locator('li[id^="dictation-word-"]').count(), 3);
    await page.locator('#dictation-word-search').fill('');
    await page.getByRole('button', { name: 'Xoá từ airport' }).click();
    await page.locator('#dictation-word-airport').waitFor({ state: 'detached' });
    await page.locator('#dictation-words-view-listen').click();
    await page.getByText('5 in pool', { exact: true }).waitFor();
    for (let i = 0; i < 6; i++) {
      assert.equal(await choose(page, 'airport').count(), 0, 'removed word is neither asked nor offered');
      await page.locator('#dictation-practice-next').click();
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('vocabmaster_words') ?? '[]'), '[]', 'main vocabulary untouched');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('  ✓ practice, counters, Sheet sync, filters, list');
  }

  // ── "Chưa luyện": answering the last new word shows its result, then the empty message ──
  {
    const data = seed([{ title: 'Bài', words: ['river', 'bridge', 'garden', 'market', 'station'] }],
      [['river', true], ['bridge', true], ['garden', false], ['market', true]]);
    const { context, page, errors } = await open(data);
    await page.locator('#dictation-practice-new').click();
    await page.getByText('1 in pool', { exact: true }).waitFor();
    await page.waitForFunction(() => window.__spoken.at(-1)?.text === 'station');
    assert.equal(await cards(page).count(), 4, 'wrong choices come from the other saved words');
    await choose(page, 'station').click();
    await page.waitForTimeout(700);
    assert.match(await page.locator('#dictation-practice-feedback').innerText(), /Excellent/, 'result stays visible');
    await page.locator('#dictation-practice-nomatch').waitFor();
    assert.equal(await page.locator('#dictation-practice-new').getAttribute('aria-pressed'), 'true', 'still there to switch off');
    assert.deepEqual((await stored(page)).station, [1, 0]);
    const since = await spokenCount(page);
    await page.locator('#dictation-practice-clear').click();
    await page.waitForFunction(n => window.__spoken.length > n, since);
    assert.equal(await cards(page).count(), 4);
    assert.equal(await page.locator('#dictation-practice-new').count(), 0, 'filter hidden when nothing is new');
    await page.getByText('1 played', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    await context.close();
    console.log('  ✓ never-practised filter');
  }

  // ── 1 and 2 words, no lesson names, nothing wrong yet ──
  for (const words of [['hello'], ['hello', 'world']]) {
    const data = seed([{ title: 'Bài', words }]);
    data.words.forEach(w => { w.lessonTitle = ''; });
    const { context, page, errors } = await open(data);
    await page.waitForFunction(() => window.__spoken.length >= 1);
    assert.equal(await cards(page).count(), words.length);
    assert.equal(await page.locator('#dictation-practice-lesson').count(), 0, 'no lesson names → filter hidden');
    assert.equal(await page.locator('#dictation-practice-wrong').count(), 0, 'nothing wrong yet → filter hidden');
    assert.equal(await page.locator('#dictation-practice-new').count(), 1);
    // Typing works, and a repeated single word is asked (and read) again.
    for (let round = 1; round <= 3; round++) {
      const asked = (await lastSpoken(page)).text;
      const since = await spokenCount(page);
      await page.locator('#dictation-practice-input').fill(asked);
      await page.getByText(`${round} played`, { exact: true }).waitFor();
      await nextQuestion(page, since);
    }
    assert.equal(Object.values(await stored(page)).reduce((s, c) => s + c[0], 0), 3);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`  ✓ ${words.length} saved word(s)`);
  }

  // ── Phones ──
  for (const width of [375, 320]) {
    const data = seed([{ title: 'Bài rất dài để thử trên màn hình nhỏ của điện thoại', words: ['internationalisation', 'responsibilities', 'a', 'environmentally-friendly'] }]);
    const { context, page, errors } = await open(data, { viewport: { width, height: 780 }, mobile: true });
    await cards(page).first().waitFor();
    await page.locator('#voice-settings-toggle').click();
    await page.locator('#voice-settings-panel').waitFor();
    await page.locator('#voice-settings-toggle').click();
    const m = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      cards: [...document.querySelectorAll('[id^="dictation-card-"]')].map(c => {
        const box = c.getBoundingClientRect(); const text = c.querySelector('span.relative').getBoundingClientRect();
        return { fits: text.left >= box.left && text.right <= box.right, height: box.height, width: box.width };
      }),
      focused: document.activeElement?.id,
    }));
    assert.ok(m.overflow <= 0, `${width}px: page overflows by ${m.overflow}px`);
    assert.equal(m.cards.length, 4);
    for (const c of m.cards) assert.ok(c.fits && c.height >= 96 && c.width >= 110, `${width}px: ${JSON.stringify(c)}`);
    assert.notEqual(m.focused, 'dictation-practice-input', 'phone default: keyboard stays closed');
    if (shots) { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300); await page.screenshot({ path: join(shots, `practice-${width}.png`), fullPage: true }); }
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`  ✓ ${width}px`);
  }
  console.log('PASS: Dictation saved-word listening practice.');
} finally { await browser?.close(); await server.close(); }
