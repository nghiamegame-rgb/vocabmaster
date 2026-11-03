// Real App, synthetic records and isolated storage; all non-local requests blocked.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const question = (sentence, topic, savedId) => ({
  schemaVersion: 2, type: 'sentence-analysis', sentence, topic, analysisTopic: 'Mixed',
  vietnameseSentence: 'Bản dịch kiểm tra.', grammarPoints: [{ category: topic === 'Mixed' || typeof topic !== 'string' ? 'Tenses' : topic, phrase: sentence, explanation: 'Giải thích kiểm tra.' }], readingItems: [],
  ...(savedId ? { savedId, savedAt: 1 } : {}),
});
const imported = [
  question('The book that I borrowed is interesting.', 'Relative Clauses'),
  question('People living nearby often walk to work.', 'Participles & Reduced Clauses'),
  question('If it rains, we will stay inside.', 'Conditionals'),
  question('We study several grammar points together.', 'Mixed'),
  question('Every student has a different learning style.', 'Subject-Verb Agreement'),
];
const labels = ['Mệnh đề quan hệ', 'Mệnh đề rút gọn', 'Câu điều kiện', 'Tổng hợp', 'Hòa hợp chủ ngữ – động từ'];
const saved = [
  question('The report that she wrote was helpful.', 'Relative Clauses', 'relative'),
  question('Students studying abroad often develop independence.', 'Participles & Reduced Clauses', 'reduced'),
  question('This record keeps its mixed classification.', 'Mixed', 'mixed'),
  { sentence: 'We will _____ tomorrow.', options: { A: 'meet', B: 'met', C: 'meets', D: 'meeting' }, answer: 'A', topic: 'Modal Verbs', savedId: 'legacy', savedAt: 1 },
  question('No classification was stored for this sentence.', undefined, 'missing'),
  question('This sentence has an unknown classification.', 'Unknown', 'unknown'),
  question('This sentence has an invalid classification.', { bad: true }, 'invalid'),
];
const fixture = {
  vocabmaster_grammar_saved: JSON.stringify(saved),
  vocabmaster_grammar_review: JSON.stringify({ relative: { level: 3, totalReviews: 2, nextReviewAt: 0 } }),
  vocabmaster_grammar_sentence_notes: JSON.stringify({ relative: [{ id: 'note-1', sentenceKey: 'relative', sentence: saved[0].sentence, start: 4, end: 10, quote: 'report', text: 'báo cáo', createdAt: 1, updatedAt: 1 }] }),
  vocabmaster_grammar_underlines: JSON.stringify({ relative: [{ start: 4, end: 10, color: 'blue' }] }),
};
const artifacts = mkdtempSync(join(tmpdir(), 'vocabmaster-topic-screens-'));
const server = await createServer({ cacheDir: mkdtempSync(join(tmpdir(), 'vocabmaster-topic-vite-')), server: { host: '127.0.0.1', port: 0, hmr: false } });
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, headless: true } : { channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false } });
    return route.continue();
  });
  await page.addInitScript(data => {
    Math.random = () => 0.99; // Keep review ordering deterministic in this isolated context.
    for (const [key, value] of Object.entries(data)) localStorage.setItem(key, value);
  }, fixture);
  const card = () => page.locator('[data-grammar-sentence-card]');
  async function check(label, hidden = true) {
    assert.equal(await card().locator('[data-grammar-topic]').innerText(), label);
    if (hidden) assert.equal(await card().getByRole('button', { name: 'Hiện phân tích', exact: true }).getAttribute('aria-expanded'), 'false');
    const boxes = await card().evaluate(element => {
      const rect = selector => { const r = element.querySelector(selector)?.getBoundingClientRect(); return r && { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; };
      return { badge: rect('[data-grammar-topic]'), sentence: rect('[data-sentence-text]'), controls: rect('[data-sentence-controls]') };
    });
    assert.ok(boxes.badge.bottom <= boxes.sentence.y, 'badge is above the English text');
    if (boxes.controls) assert.ok(boxes.badge.bottom <= boxes.controls.y, 'badge does not overlap notes controls');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  await page.goto(origin);
  await page.locator('#nav-tab-grammar').click();
  await page.getByRole('button', { name: '5', exact: true }).click();
  await page.getByPlaceholder('Dán JSON từ AI vào đây.', { exact: false }).fill(JSON.stringify(imported));
  await page.getByRole('button', { name: 'Kiểm tra & bắt đầu', exact: true }).click();
  await check(labels[0]); // Unsaved import, Mixed batch, before any reveal.
  await card().getByRole('button', { name: 'Hiện phân tích', exact: true }).click();
  await check(labels[0], false);
  await card().getByRole('button', { name: 'Ẩn phân tích', exact: true }).click();
  await page.getByRole('button', { name: 'Câu tiếp', exact: true }).click();
  await check(labels[1]);
  await page.getByRole('button', { name: 'Câu trước', exact: true }).click();
  await check(labels[0]);
  for (const n of [4, 5, 3, 2, 1]) {
    await page.getByRole('button', { name: `Đến câu ${n}`, exact: true }).click();
    await check(labels[n - 1]);
  }
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole('button', { name: 'Đến câu 5', exact: true }).click();
    await check(labels[4]);
    await card().screenshot({ path: join(artifacts, `practice-${width}.png`) });
  }
  await page.getByRole('button', { name: 'Đến câu 1', exact: true }).click();
  await page.getByRole('button', { name: 'Lưu câu', exact: true }).click();
  const expected = new Map([...saved.map(q => [q.sentence.replace('_____', q.options?.A || ''), typeof q.topic !== 'string' || q.topic === 'Unknown' ? 'Chưa phân loại' : ({ 'Relative Clauses': labels[0], 'Participles & Reduced Clauses': labels[1], Mixed: 'Tổng hợp', 'Modal Verbs': 'Động từ khuyết thiếu' })[q.topic]]), [imported[0].sentence, labels[0]]]);
  await page.locator('#grammar-tab-saved').click();
  for (const c of await card().all()) {
    const text = await c.locator('[data-sentence-text]').textContent();
    assert.equal(await c.locator('[data-grammar-topic]').innerText(), expected.get(text));
  }
  // Malformed classification is safe even when using Saved's text search.
  await page.getByPlaceholder('Tìm kiếm câu hỏi, từ khoá, chủ đề...').fill('Chưa phân loại');
  assert.equal(await card().count(), 3);
  await page.getByPlaceholder('Tìm kiếm câu hỏi, từ khoá, chủ đề...').fill('');
  await page.locator('#grammar-tab-review').click();
  await page.getByRole('button', { name: 'Bắt đầu ôn tập', exact: true }).click();
  for (let i = 0; i < saved.length + 1; i++) {
    const text = await card().locator('[data-sentence-text]').textContent();
    await check(expected.get(text));
    if (text === saved[0].sentence) {
      assert.equal(await card().locator('[data-sentence-note]').count(), 0);
      await card().getByRole('button', { name: 'Hiện ghi chú (1)', exact: true }).click();
      await check(expected.get(text));
      assert.equal(await card().locator('[data-sentence-note]').innerText(), 'báo cáo');
      assert.equal(await card().locator('[data-sentence-text] [style*="underline"]').count(), 1);
      for (const width of [1280, 375, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await check(expected.get(text));
        await card().screenshot({ path: join(artifacts, `review-${width}.png`) });
      }
      await card().getByRole('button', { name: 'Ẩn ghi chú (1)', exact: true }).click();
      await check(expected.get(text));
    }
    await card().getByRole('button', { name: i === saved.length ? 'Hoàn tất' : 'Câu tiếp', exact: true }).click();
  }
  for (const key of ['vocabmaster_grammar_review', 'vocabmaster_grammar_underlines', 'vocabmaster_grammar_sentence_notes']) assert.equal(await page.evaluate(k => localStorage.getItem(k), key), fixture[key]);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('vocabmaster_grammar_saved')));
  for (const record of saved) assert.deepEqual(after.find(q => q.savedId === record.savedId), JSON.parse(JSON.stringify(record)));
  assert.deepEqual(errors, []);
  console.log(`PASS: unsaved Mixed import, prev/next/numbered navigation, same labels across three screens, legacy/Mixed/invalid fallback, notes controls and 1280/375/320px. Screenshots: ${artifacts}`);
  await context.close();
} finally { await browser?.close(); await server.close(); }
