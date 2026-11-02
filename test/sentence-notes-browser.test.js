/** Isolated real App/browser test. Playwright/Edge setup: docs/HANDOFF.md. */
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';
import { LS_SENTENCE_NOTES } from '../src/utils/sentenceNotes.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const first = '🎉 low-income households need support, while low-income households near the river often face higher housing costs during the winter.';
const second = 'Families living in the countryside often depend on local transport to reach schools and hospitals in winter.';
const practice = 'Workers in small towns often look after relatives in the evening.';
const otherPractice = 'People in the city often visit the park in summer.';
const cpRange = (sentence, phrase, occurrence = 0) => {
  let index = -1;
  for (let i = 0; i <= occurrence; i++) index = sentence.indexOf(phrase, index + 1);
  assert.ok(index >= 0);
  const start = Array.from(sentence.slice(0, index)).length;
  return { start, end: start + Array.from(phrase).length };
};
const question = (sentence, savedId) => ({
  id: 'same-ai-id', schemaVersion: 2, type: 'sentence-analysis', sentence, topic: 'Prepositions',
  vietnameseSentence: 'Bản dịch kiểm tra.', grammarPoints: [{ category: 'Prepositions', phrase: sentence.includes('near') ? 'near' : 'in', explanation: 'Giải thích kiểm tra.' }],
  readingItems: [], ...(savedId ? { savedId, savedAt: 1, userNotes: 'KEEP USER NOTES', hardMarked: false } : {}),
});
const seedNote = (sentence, key, phrase, id) => ({ id, sentenceKey: key, sentence, ...cpRange(sentence, phrase), quote: phrase,
  text: `Ghi chú ban đầu ${id}`, createdAt: 1, updatedAt: 1 });
const initialUnderline = [{ ...cpRange(first, 'low-income', 1), color: 'white' }];
const initial = {
  vocabmaster_grammar_saved: JSON.stringify([question(first, 'gq_one'), question(second, 'gq_two')]),
  vocabmaster_grammar_review: JSON.stringify({ gq_one: { level: 2, totalReviews: 2, wrongCount: 1, nextReviewAt: 0 }, gq_two: { level: 3, totalReviews: 5, wrongCount: 2, nextReviewAt: 0 } }),
  vocabmaster_grammar_underlines: JSON.stringify({ gq_one: initialUnderline }),
  [LS_SENTENCE_NOTES]: JSON.stringify({ gq_one: [seedNote(first, 'gq_one', 'low-income households', 'n1')], gq_two: [seedNote(second, 'gq_two', 'in the countryside', 'n2')] }),
};
const server = await createServer({
  cacheDir: mkdtempSync(join(tmpdir(), 'vocabmaster-notes-vite-')),
  optimizeDeps: { noDiscovery: true, include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client', 'lucide-react'] },
  server: { host: '127.0.0.1', port: 0, hmr: false },
});
const artifacts = mkdtempSync(join(tmpdir(), 'vocabmaster-sentence-notes-'));
let browser;
try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, headless: true } : { channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
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
    Math.random = () => 0.99;
    if (!sessionStorage.getItem('notes_initialized')) {
      for (const [key, value] of Object.entries(data)) localStorage.setItem(key, value);
      sessionStorage.setItem('notes_initialized', 'true');
    }
  }, initial);
  const read = key => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), key);
  const records = async key => (await read(LS_SENTENCE_NOTES))[key] || [];
  const paragraph = text => page.locator('[data-sentence-text]').filter({ hasText: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) });
  const area = text => paragraph(text).locator('..');
  const editor = page.getByRole('textbox', { name: 'Nội dung ghi chú', exact: true });
  async function openGrammar() {
    await page.locator('#nav-tab-grammar').click();
    await page.getByRole('button', { name: 'Lỗi đồng bộ · Thử lại', exact: true }).waitFor();
  }
  async function select(text, range) {
    await paragraph(text).scrollIntoViewIfNeeded();
    await paragraph(text).evaluate((element, offsets) => {
      const nodes = [], walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) nodes.push(walker.currentNode);
      const at = cp => {
        for (const node of nodes) {
          const chars = Array.from(node.textContent);
          if (cp <= chars.length) return [node, chars.slice(0, cp).join('').length];
          cp -= chars.length;
        }
        throw new Error('Bad offset');
      };
      const range = document.createRange(); range.setStart(...at(offsets.start)); range.setEnd(...at(offsets.end));
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    }, range);
  }
  async function note(text, key, range, content) {
    await select(text, range);
    await page.getByRole('button', { name: 'Ghi chú', exact: true }).click();
    assert.equal(await editor.evaluate(element => element === document.activeElement), true);
    await editor.fill(content);
    const record = (await records(key)).find(n => n.start === range.start && n.end === range.end);
    assert.equal(record?.text, content, 'autosave happens during input, before Xong/blur');
    assert.equal(await area(text).locator(`[data-sentence-note="${record.id}"]`).isVisible(), true, 'note renders immediately with analysis collapsed');
    assert.equal(await page.getByText('Giải thích nhanh', { exact: true }).count(), 0);
    return record;
  }
  async function close() { await page.getByRole('button', { name: 'Xong', exact: true }).click(); }
  async function layoutSafe(text) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const geometry = await area(text).evaluate(element => {
      const box = rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
      const sentence = element.querySelector('[data-sentence-text]');
      const walker = document.createTreeWalker(sentence, NodeFilter.SHOW_TEXT), rects = [];
      while (walker.nextNode()) {
        const range = document.createRange(); range.selectNodeContents(walker.currentNode);
        rects.push(...[...range.getClientRects()].map(box));
      }
      return { area: box(element.getBoundingClientRect()), text: rects,
        notes: [...element.querySelectorAll('[data-sentence-note]')].map(note => ({ ...box(note.getBoundingClientRect()), id: note.dataset.sentenceNote })) };
    });
    const overlap = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    for (const [index, box] of geometry.notes.entries()) {
      assert.ok(box.left >= geometry.area.left - 1 && box.right <= geometry.area.right + 1, 'note stays in sentence width');
      assert.ok(box.bottom <= geometry.area.bottom + 1, 'sentence area reserves annotation height');
      assert.ok(!geometry.text.some(text => overlap(box, text)), 'note does not overlap English text');
      assert.ok(!geometry.notes.slice(index + 1).some(other => overlap(box, other)), 'notes do not overlap each other');
    }
  }
  async function editorInViewport() {
    const box = await page.getByRole('dialog', { name: 'Ghi chú đoạn văn bản' }).boundingBox();
    const view = page.viewportSize();
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= view.width + 1 && box.y + box.height <= view.height + 1, 'editor stays inside viewport');
    assert.ok(box.width >= Math.min(180, view.width - 16) && box.width <= 321);
  }

  await page.goto(origin); await openGrammar(); await page.locator('#grammar-tab-saved').click();
  assert.equal(await area(first).locator('[data-sentence-note="n1"]').isVisible(), true, 'Saved notes shown by default');
  const beforeReview = await read('vocabmaster_grammar_review');
  const secondRange = cpRange(first, 'low-income households', 1);
  const created = await note(first, 'gq_one', secondRange, 'hộ gia đình thu nhập thấp · cụm danh từ');
  assert.equal(created.quote, 'low-income households');
  assert.equal((await records('gq_one')).length, 2, 'repeated phrases use their positions');
  await editorInViewport(); await close();
  assert.deepEqual((await read('vocabmaster_grammar_underlines')).gq_one, initialUnderline, 'notes do not change underline spans');

  await select(first, secondRange); await page.getByRole('button', { name: 'Ghi chú', exact: true }).click();
  await editor.fill('<b>plain text</b>'); await editor.pressSequentially(' · giải thích mới'); await editor.press('Escape');
  assert.equal((await records('gq_one')).length, 2, 'same range edits rather than duplicates');
  assert.equal((await records('gq_one')).find(n => n.id === created.id).text, '<b>plain text</b> · giải thích mới');
  assert.equal(await area(first).locator('[data-sentence-note] b').count(), 0, 'plain text only');
  await page.screenshot({ path: join(artifacts, 'notes-compact-desktop.png'), fullPage: true });
  await select(first, cpRange(first, ' '));
  assert.equal(await page.getByRole('button', { name: 'Ghi chú', exact: true }).count(), 0, 'whitespace is ignored');
  await select(first, { start: 3, end: 3 });
  assert.equal(await page.getByRole('button', { name: 'Ghi chú', exact: true }).count(), 0, 'collapsed selections are ignored');
  await area(first).evaluate(element => {
    const text = element.querySelector('[data-sentence-text]');
    const label = element.querySelector('[data-sentence-note]');
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT); walker.nextNode();
    const labelWalker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT); labelWalker.nextNode();
    const range = document.createRange(); range.setStart(walker.currentNode, 0); range.setEnd(labelWalker.currentNode, 1);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    text.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  assert.equal(await page.getByRole('button', { name: 'Ghi chú', exact: true }).count(), 0, 'a selection extending into a label is rejected');
  assert.equal(await paragraph(first).textContent(), first, 'annotation text is excluded from English offsets');

  const overlapRange = { start: secondRange.start + 4, end: secondRange.end + 10 };
  const overlapping = await note(first, 'gq_one', overlapRange, 'Ghi chú chồng vùng, có thể dài hơn một dòng. '.repeat(6));
  const shortHeight = (await editor.boundingBox()).height;
  await editor.fill('Dòng ghi chú dài cần xuống hàng\n'.repeat(12));
  assert.ok((await editor.boundingBox()).height > shortHeight, 'editor grows vertically');
  await editorInViewport(); await close(); await layoutSafe(first);
  // Underlining across note ranges retains their identity and text.
  const beforeNotes = await records('gq_one');
  await select(first, secondRange); await page.getByRole('button', { name: 'Xanh lá', exact: true }).click();
  assert.deepEqual(await records('gq_one'), beforeNotes);

  await page.setViewportSize({ width: 375, height: 740 });
  await layoutSafe(first);
  assert.equal(await area(first).locator(`[data-sentence-note="${overlapping.id}"]`).count(), 1, 'wrapped phrase has exactly one annotation');
  await page.screenshot({ path: join(artifacts, 'notes-mobile.png'), fullPage: true });
  await area(first).locator(`[data-sentence-note="${overlapping.id}"]`).click();
  await editorInViewport();
  await page.screenshot({ path: join(artifacts, 'editor-mobile.png') });
  await page.setViewportSize({ width: 320, height: 640 });
  await layoutSafe(first); await editorInViewport();
  await page.evaluate(() => window.scrollBy(0, 120));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  await editorInViewport();
  await close();
  await page.setViewportSize({ width: 1100, height: 1000 }); await layoutSafe(first);
  await area(first).screenshot({ path: join(artifacts, 'notes-desktop.png') });

  await area(first).locator(`[data-sentence-note="${overlapping.id}"]`).click();
  await editor.fill(''); await close();
  assert.equal((await records('gq_one')).some(n => n.id === overlapping.id), false, 'clearing deletes the existing note');
  await area(first).locator(`[data-sentence-note="${created.id}"]`).click();
  await page.getByRole('button', { name: 'Xóa ghi chú', exact: true }).click();
  assert.equal((await records('gq_one')).some(n => n.id === created.id), false);
  await select(first, cpRange(first, 'support')); await page.getByRole('button', { name: 'Ghi chú', exact: true }).click();
  await close(); assert.equal((await records('gq_one')).length, 1, 'empty drafts leave no record');
  await note(first, 'gq_one', cpRange(first, 'support'), 'outside close autosaves');
  await page.getByRole('heading', { name: 'Câu đã lưu', exact: true }).click();
  assert.equal(await editor.count(), 0);
  assert.deepEqual(await read('vocabmaster_grammar_review'), beforeReview);
  console.log('PASS Saved: immediate autosave/edit/clear/delete/plain text/overlap/Unicode/underline independence, responsive layout and editor');

  await page.locator('#grammar-tab-review').click();
  await page.getByRole('button', { name: 'Bắt đầu ôn tập', exact: true }).click();
  assert.equal(await area(first).locator('[data-sentence-note]').count(), 0, 'Review starts with notes hidden');
  await page.getByRole('button', { name: /^Hiện ghi chú/ }).click();
  assert.ok(await area(first).locator('[data-sentence-note]').count());
  await page.getByRole('button', { name: 'Câu tiếp', exact: true }).click();
  assert.equal(await area(second).locator('[data-sentence-note]').count(), 0, 'each new Review sentence hides notes');
  await note(second, 'gq_two', cpRange(second, 'local transport'), 'phương tiện địa phương');
  assert.equal(await area(second).locator('[data-sentence-note="n2"]').isVisible(), true, 'creation reveals existing notes too');
  await close();
  assert.deepEqual(await read('vocabmaster_grammar_review'), beforeReview);
  await page.getByRole('button', { name: 'Đã hiểu', exact: true }).click();
  const assessed = await read('vocabmaster_grammar_review');
  await area(second).locator('[data-sentence-note="n2"]').click(); await editor.fill('edited without assessment changes'); await close();
  assert.equal(await page.getByRole('button', { name: 'Đã hiểu ✓', exact: true }).isDisabled(), true);
  assert.deepEqual(await read('vocabmaster_grammar_review'), assessed);
  console.log('PASS Review: hidden per sentence, manual reveal, create/edit reveals notes without changing assessment or analysis');

  async function importPractice(sentences) {
    await page.getByRole('button', { name: '5', exact: true }).click();
    await page.locator('textarea').fill(JSON.stringify(sentences.map(text => question(text))));
    await page.getByRole('button', { name: 'Kiểm tra & bắt đầu', exact: true }).click();
    const confirm = page.getByRole('button', { name: 'Xác nhận và bắt đầu', exact: true });
    if (await confirm.count()) {
      await page.getByRole('checkbox', { name: /Tôi vẫn muốn luyện/ }).check(); await confirm.click();
    }
  }
  await page.locator('#grammar-tab-practice').click();
  const batch = [practice, otherPractice, 'We meet in the park.', 'They work in the city.', 'I live in a village.'];
  await importPractice(batch);
  assert.equal(await area(practice).locator('[data-sentence-note]').count(), 0, 'same AI id does not share notes');
  const unsaved = await note(practice, `text:${practice}`, cpRange(practice, 'look after'), 'chăm sóc');
  await close();
  assert.equal((await read('vocabmaster_grammar_saved')).length, 2, 'creating a note does not save the sentence');
  await page.getByRole('button', { name: 'Câu tiếp', exact: true }).click();
  assert.equal(await area(otherPractice).locator('[data-sentence-note]').count(), 0);
  const reopen = await note(otherPractice, `text:${otherPractice}`, cpRange(otherPractice, 'in the city'), 'trong thành phố'); await close();
  await page.getByRole('button', { name: 'Câu trước', exact: true }).click();
  assert.equal(await area(practice).locator(`[data-sentence-note="${unsaved.id}"]`).isVisible(), true, 'Practice shows notes on revisit');
  await page.getByRole('button', { name: 'Lưu câu', exact: true }).click();
  const saved = (await read('vocabmaster_grammar_saved')).find(q => q.sentence === practice);
  assert.equal((await records(saved.savedId))[0].id, unsaved.id);
  assert.equal((await records(`text:${practice}`)).length, 0);
  assert.equal(await area(practice).locator(`[data-sentence-note="${unsaved.id}"]`).isVisible(), true);
  await page.getByRole('button', { name: 'Đến câu 5', exact: true }).click();
  await page.getByRole('button', { name: 'Kết thúc', exact: true }).click();
  assert.equal((await records(`text:${otherPractice}`))[0].id, reopen.id, 'session completion keeps unsaved-sentence notes');
  await page.reload(); await openGrammar();
  assert.equal(await page.getByRole('button', { name: 'Kiểm tra & bắt đầu', exact: true }).count(), 1, 'temporary practice session is not restored');
  await importPractice([otherPractice, 'We eat in the garden.', 'He waits in the hall.', 'I study in the evening.', 'She lives in a city.']);
  assert.equal(await area(otherPractice).locator(`[data-sentence-note="${reopen.id}"]`).isVisible(), true, 'notes return when unsaved sentence is manually reopened');
  await page.locator('#grammar-tab-saved').click();
  assert.equal(await area(practice).locator(`[data-sentence-note="${unsaved.id}"]`).isVisible(), true, 'saved sentence notes survive reload');
  assert.equal((await read('vocabmaster_grammar_saved')).find(q => q.savedId === 'gq_one').userNotes, 'KEEP USER NOTES');
  await page.evaluate(() => {
    const key = 'vocabmaster_grammar_saved', questions = JSON.parse(localStorage.getItem(key));
    questions.find(q => q.savedId === 'gq_one').sentence = questions.find(q => q.savedId === 'gq_one').sentence.replace('support', 'assistance');
    localStorage.setItem(key, JSON.stringify(questions));
  });
  await page.reload(); await openGrammar(); await page.locator('#grammar-tab-saved').click();
  assert.equal(await area(first.replace('support', 'assistance')).locator('[data-sentence-note]').count(), 0, 'changed sentence content cannot inherit old anchors');
  console.log('PASS Practice: stable identity before/after save, same AI IDs isolated, notes survive tabs/completion/reload without restoring session');

  // Visual acceptance: adjacent short annotations should be one compact row.
  const compactSentence = 'The school provides educational materials for children in the village.';
  const compactNotes = [
    { ...seedNote(compactSentence, 'gq_compact', 'educational', 'n_educational'), text: 'giáo dục' },
    { ...seedNote(compactSentence, 'gq_compact', 'materials', 'n_materials'), text: 'vật chất' },
  ];
  await page.evaluate(({ q, notes, noteKey }) => {
    const key = 'vocabmaster_grammar_saved';
    localStorage.setItem(key, JSON.stringify([...JSON.parse(localStorage.getItem(key)), q]));
    const map = JSON.parse(localStorage.getItem(noteKey)); map[q.savedId] = notes;
    localStorage.setItem(noteKey, JSON.stringify(map));
  }, { q: question(compactSentence, 'gq_compact'), notes: compactNotes, noteKey: LS_SENTENCE_NOTES });
  await page.reload(); await openGrammar(); await page.locator('#grammar-tab-saved').click();
  const compactArea = area(compactSentence);
  const educational = compactArea.locator('[data-sentence-note="n_educational"]');
  const materials = compactArea.locator('[data-sentence-note="n_materials"]');
  const persistedBeforeLayout = await read(LS_SENTENCE_NOTES);
  await compactArea.scrollIntoViewIfNeeded(); await page.mouse.move(0, 0); await layoutSafe(compactSentence);
  const compactGeometry = await compactArea.evaluate(async (element, notes) => {
    const { sentenceRangeRect } = await import('/src/utils/sentenceGeometry.js');
    return notes.map(note => {
      const label = element.querySelector(`[data-sentence-note="${note.id}"]`), box = label.getBoundingClientRect();
      const phrase = sentenceRangeRect(element.querySelector('[data-sentence-text]'), note.start, note.end);
      const style = getComputedStyle(label);
      return { width: box.width, top: box.top, center: (box.left + box.right) / 2,
        phraseCenter: (phrase.left + phrase.right) / 2, gap: box.top - phrase.bottom,
        text: label.textContent, font: style.fontSize, background: style.backgroundColor, border: style.borderLeftWidth };
    });
  }, compactNotes);
  assert.ok(Math.abs(compactGeometry[0].top - compactGeometry[1].top) < 1, 'adjacent short notes share one row');
  for (const [index, label] of compactGeometry.entries()) {
    assert.equal(label.text, compactNotes[index].text, 'no repeated English, arrow or card header');
    assert.ok(label.width < 100, 'short display notes size to measured content, not the editor minimum');
    assert.ok(Math.abs(label.center - label.phraseCenter) < 1, 'center beneath the associated phrase');
    assert.ok(label.gap >= 5 && label.gap <= 7, 'compact gap below actual text bounds');
    assert.equal(label.font, '12px'); assert.equal(label.background, 'rgba(0, 0, 0, 0)'); assert.equal(label.border, '0px');
  }
  const controls = await compactArea.locator('[data-sentence-controls]').boundingBox();
  assert.ok(controls.y + controls.height <= (await paragraph(compactSentence).boundingBox()).y, 'top-right controls reserve their own row');
  await compactArea.screenshot({ path: join(artifacts, 'educational-materials-desktop.png') });
  const visibleHeight = (await paragraph(compactSentence).boundingBox()).height;
  await compactArea.getByRole('button', { name: /^Ẩn ghi chú/ }).click(); await layoutSafe(compactSentence);
  const hiddenHeight = (await paragraph(compactSentence).boundingBox()).height;
  assert.ok(visibleHeight - hiddenHeight >= 16, 'hiding notes removes annotation padding');
  assert.ok(Math.abs(hiddenHeight - await paragraph(compactSentence).evaluate(el => parseFloat(getComputedStyle(el).lineHeight))) < 1, 'ordinary hidden sentence spacing is one line');
  await compactArea.getByRole('button', { name: /^Hiện ghi chú/ }).click(); await layoutSafe(compactSentence);
  assert.deepEqual(await read(LS_SENTENCE_NOTES), persistedBeforeLayout, 'layout/visibility never rewrite stored notes');
  await educational.hover();
  assert.notEqual(await educational.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', 'hover indicates editability');
  await educational.press('Tab'); await page.keyboard.press('Shift+Tab');
  assert.equal(await educational.evaluate(el => el === document.activeElement), true);
  assert.notEqual(await educational.evaluate(el => getComputedStyle(el).outlineStyle), 'none', 'keyboard focus remains visible');
  assert.equal(await educational.getAttribute('aria-label'), 'Sửa ghi chú: educational');

  await educational.click(); await editorInViewport();
  const longText = 'Giải thích dài cần được giữ nguyên và xuống dòng, không cắt bớt nội dung. '.repeat(10);
  await editor.fill(longText); await layoutSafe(compactSentence);
  const expanded = await educational.boundingBox();
  assert.ok(expanded.width <= 321 && expanded.height > 32, 'long display note wraps at a sensible maximum');
  assert.equal(await educational.textContent(), longText);
  assert.equal(await educational.evaluate(el => el.scrollHeight <= el.clientHeight + 1), true, 'complete note is visible without clipping');
  await editor.fill('giáo dục'); await layoutSafe(compactSentence);
  assert.ok((await educational.boundingBox()).width < 100 && (await educational.boundingBox()).height <= 17, 'display dimensions shrink immediately while the editor stays comfortable');
  await editorInViewport(); await close();
  const overlappingCompact = await note(compactSentence, 'gq_compact', {
    start: compactNotes[0].start + 2, end: compactNotes[1].end - 2,
  }, 'cụm danh từ'); await close(); await layoutSafe(compactSentence);
  const rows = await compactArea.locator('[data-sentence-note]').evaluateAll(labels => [...new Set(labels.map(label => Math.round(label.getBoundingClientRect().top)))]);
  assert.equal(rows.length, 2, 'one real collision needs only one additional annotation row');
  await compactArea.locator(`[data-sentence-note="${overlappingCompact.id}"]`).click();
  await page.getByRole('button', { name: 'Xóa ghi chú', exact: true }).click();
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 740 }); await layoutSafe(compactSentence);
    await compactArea.getByRole('button', { name: /^Ẩn ghi chú/ }).click();
    const hiddenScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    await compactArea.getByRole('button', { name: /^Hiện ghi chú/ }).click(); await layoutSafe(compactSentence);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= Math.max(hiddenScrollWidth, width), 'showing annotations does not introduce horizontal page scrolling');
    assert.equal(await educational.count(), 1); assert.equal(await materials.count(), 1);
    if (width === 375) await compactArea.screenshot({ path: join(artifacts, 'educational-materials-mobile.png') });
  }
  const samples = await compactArea.evaluate(async element => {
    const result = [];
    for (let i = 0; i < 6; i++) { await new Promise(resolve => requestAnimationFrame(resolve)); result.push(element.getBoundingClientRect().height); }
    return result;
  });
  assert.equal(new Set(samples).size, 1, 'measured annotation layout settles without oscillation');
  console.log('PASS Compact annotations: educational/materials share a row; measured centering, widths/gaps, focus/hover, long/wrapped notes, hidden spacing and responsive controls');
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  console.log(`Visual artifacts: ${artifacts}`);
} finally {
  await browser?.close(); await server.close();
}
