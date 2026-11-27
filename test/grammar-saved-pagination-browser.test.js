/**
 * Isolated real App/browser test for GrammarSaved pagination & search optimization.
 * Run: node test/grammar-saved-pagination-browser.test.js
 * Requires Playwright + Edge (see docs/HANDOFF.md).
 */
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const makeQuestion = (index) => ({
  savedId: `gq_p_${index + 1}`,
  savedAt: 1700000000000 + index * 1000,
  schemaVersion: 2,
  type: 'sentence-analysis',
  sentence: `Sample saved sentence number ${index + 1} for pagination check.`,
  vietnameseSentence: `Bản dịch câu số ${index + 1}.`,
  topic: index % 2 === 0 ? 'Tenses' : 'Relative Clauses',
  grammarPoints: [{ category: index % 2 === 0 ? 'Tenses' : 'Relative Clauses', phrase: `number ${index + 1}`, explanation: `Giải thích chi tiết câu ${index + 1}.` }],
  readingItems: [{ category: 'vocabulary', text: 'pagination', explanation: `Từ khóa kiểm tra ${index + 1}.` }],
  structures: [`Cấu trúc mẫu ${index + 1}`],
  readingNotes: [`Ghi chú đọc hiểu ${index + 1}`],
  hardMarked: index === 14, // item #15 (on page 2)
  userNotes: index === 20 ? 'Ghi chú đặc biệt số 21' : '',
});

const saved25 = Array.from({ length: 25 }, (_, i) => makeQuestion(i));

const server = await createServer({
  cacheDir: mkdtempSync(join(tmpdir(), 'vocabmaster-gsaved-page-vite-')),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client', 'lucide-react'] },
  server: { host: '127.0.0.1', port: 0, hmr: false },
});

let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, headless: true }
    : { channel: 'msedge', headless: true });

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false } });
    return route.continue();
  });

  await page.addInitScript(data => {
    if (!sessionStorage.getItem('gsaved_page_init')) {
      localStorage.setItem('vocabmaster_grammar_saved', JSON.stringify(data));
      sessionStorage.setItem('gsaved_page_init', '1');
    }
  }, saved25);

  await page.goto(origin);
  await page.locator('#nav-tab-grammar').click();
  await page.locator('#grammar-tab-saved').click();

  const cards = page.locator('[data-grammar-sentence-card]');
  const topNav = page.getByRole('navigation', { name: 'Saved sentence pages (top)' });
  const bottomNav = page.getByRole('navigation', { name: 'Saved sentence pages (bottom)' });

  // Page 1: 10 cards (1..10), top & bottom Pagination visible
  assert.equal(await cards.count(), 10, 'page 1 renders 10 cards');
  assert.equal(await topNav.isVisible(), true);
  assert.equal(await bottomNav.isVisible(), true);
  await page.getByText('25 kết quả (hiển thị 1–10)', { exact: true }).waitFor();
  assert.ok((await cards.first().innerText()).includes('number 1 for pagination'));
  assert.ok((await cards.last().innerText()).includes('number 10 for pagination'));

  // Open analysis and enter note-editing mode on card 1, then click Next page -> page 2 has 10 cards (11..20), analysis collapsed & note editor closed
  await cards.first().getByRole('button', { name: 'Hiện phân tích', exact: true }).first().click();
  assert.equal(await page.getByText('Giải thích nhanh', { exact: true }).count(), 1);
  await cards.first().getByRole('button', { name: 'Thêm ghi chú...' }).click();
  assert.equal(await page.getByPlaceholder('Ghi chú của bạn...').count(), 1);
  await topNav.getByRole('button', { name: 'Next page' }).click();

  assert.equal(await cards.count(), 10, 'page 2 renders 10 cards');
  await page.getByText('25 kết quả (hiển thị 11–20)', { exact: true }).waitFor();
  assert.ok((await cards.first().innerText()).includes('number 11 for pagination'));
  assert.ok((await cards.last().innerText()).includes('number 20 for pagination'));
  assert.equal(await page.getByText('Giải thích nhanh', { exact: true }).count(), 0, 'expanded analysis closes on page change');
  assert.equal(await page.getByPlaceholder('Ghi chú của bạn...').count(), 0, 'note editor closes on page change');

  // Search while on page 2 resets back to page 1 and matches precomputed fields (e.g. userNotes)
  const searchInput = page.getByPlaceholder('Tìm kiếm câu hỏi, từ khoá, chủ đề...');
  await searchInput.fill('Ghi chú đặc biệt số 21');
  assert.equal(await cards.count(), 1, 'search finds matching sentence across pages');
  await page.getByText('1 kết quả (hiển thị 1–1)', { exact: true }).waitFor();
  assert.equal(await topNav.count(), 0, 'pagination hides when only 1 page');

  // Clear search -> back on page 1
  await searchInput.fill('');
  assert.equal(await cards.count(), 10);
  await page.getByText('25 kết quả (hiển thị 1–10)', { exact: true }).waitFor();

  // Navigate to page 3 (last page, 5 cards: 21..25), delete all 5 one by one -> steps back to page 2 without empty page
  await topNav.getByRole('combobox', { name: 'Saved sentence page' }).selectOption('3');
  assert.equal(await cards.count(), 5, 'page 3 has 5 cards');
  await page.getByText('25 kết quả (hiển thị 21–25)', { exact: true }).waitFor();

  for (let remaining = 5; remaining >= 1; remaining--) {
    await cards.first().getByTitle('Xoá khỏi thư viện').click();
  }
  // After deleting the last card on page 3, we must automatically land on page 2 (10 cards: 11..20), never an empty page.
  assert.equal(await cards.count(), 10, 'deleting last item on last page steps back to previous page');
  await page.getByText('20 kết quả (hiển thị 11–20)', { exact: true }).waitFor();
  assert.equal(await topNav.getByRole('combobox', { name: 'Saved sentence page' }).inputValue(), '2');

  // Hard filter resets page from 2 to 1
  await page.getByRole('button', { name: /Khó \(⭐\)/ }).click();
  assert.equal(await cards.count(), 1);
  await page.getByText('1 kết quả (hiển thị 1–1)', { exact: true }).waitFor();

  // Quick stress check with 254 saved questions: renders only 10 cards and stays responsive
  const saved254 = Array.from({ length: 254 }, (_, i) => makeQuestion(i));
  await page.evaluate(data => {
    localStorage.setItem('vocabmaster_grammar_saved', JSON.stringify(data));
  }, saved254);
  await page.reload();
  await page.locator('#nav-tab-grammar').click();
  const t0 = Date.now();
  await page.locator('#grammar-tab-saved').click();
  await page.getByText('254 kết quả (hiển thị 1–10)', { exact: true }).waitFor();
  const openMs = Date.now() - t0;
  assert.equal(await cards.count(), 10, '254 saved sentences still mounts only 10 cards');
  const tSearch = Date.now();
  await page.getByPlaceholder('Tìm kiếm câu hỏi, từ khoá, chủ đề...').fill('Cấu trúc mẫu 250');
  await page.getByText('1 kết quả (hiển thị 1–1)', { exact: true }).waitFor();
  const searchMs = Date.now() - tSearch;

  assert.deepEqual(errors, [], 'no uncaught browser errors');
  console.log(`PASS grammar-saved-pagination-browser: 25-item pagination/search/delete-last-page + 254-item stress check (open=${openMs}ms, search=${searchMs}ms)`);
  await context.close();
} finally {
  await browser?.close();
  await server.close();
}
