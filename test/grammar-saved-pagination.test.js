/**
 * Render the real GrammarSaved component with synthetic data (no browser).
 * Run: node test/grammar-saved-pagination.test.js
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const previousWindow = globalThis.window;
globalThis.window = {};

const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});

try {
  const { default: GrammarSaved } = await server.ssrLoadModule('/src/components/grammar/GrammarSaved.jsx');
  const noop = () => {};

  const makeQuestion = (index) => ({
    savedId: `gq_${index}`,
    savedAt: 1700000000000 + index * 1000,
    schemaVersion: 2,
    type: 'sentence-analysis',
    sentence: `Saved grammar sentence number ${index + 1}.`,
    vietnameseSentence: `Bản dịch câu số ${index + 1}.`,
    topic: index % 2 === 0 ? 'Tenses' : 'Relative Clauses',
    grammarPoints: [{ category: 'Tenses', phrase: `sentence number ${index + 1}`, explanation: 'Giải thích mẫu.' }],
    readingItems: [],
    hardMarked: index % 5 === 0,
    userNotes: '',
  });

  const questions = Array.from({ length: 254 }, (_, i) => makeQuestion(i));

  function render(list) {
    return renderToStaticMarkup(createElement(GrammarSaved, {
      savedQuestions: list,
      reviewProgress: {},
      cloudConfigured: false,
      onUnsave: noop,
      onToggleHard: noop,
      onUpdateNotes: noop,
      onQuickAdd: noop,
      onUnderlineChange: noop,
      underlines: {},
      sentenceNotes: {},
      onNoteChange: noop,
    }));
  }

  function cardCount(html) {
    return (html.match(/data-grammar-sentence-card=""/g) || []).length;
  }

  await test('25 and 254 saved questions mount only 10 cards on page 1 with top/bottom Pagination', () => {
    for (const count of [25, 254]) {
      const html = render(questions.slice(0, count));
      assert.equal(cardCount(html), 10);
      assert.ok(html.includes(`${count} câu đã lưu`));
      assert.ok(html.includes(`${count} kết quả (hiển thị 1–10)`));
      assert.ok(html.includes('aria-label="Saved sentence pages (top)"'));
      assert.ok(html.includes('aria-label="Saved sentence pages (bottom)"'));
      assert.ok(html.includes('aria-label="Saved sentence page"'));
      assert.ok(html.includes(`value="${Math.ceil(count / 10)}"`));
      assert.ok(html.includes('Saved grammar sentence number 1.'));
      assert.ok(html.includes('Saved grammar sentence number 10.'));
      assert.ok(!html.includes('Saved grammar sentence number 11.'));
    }
  });

  await test('page boundaries (0, 1, 10, 11) toggle Pagination visibility accurately', () => {
    for (const count of [0, 1, 10, 11]) {
      const html = render(questions.slice(0, count));
      assert.equal(cardCount(html), Math.min(count, 10));
      assert.equal(html.includes('Saved sentence pages (top)'), count > 10);
      assert.equal(html.includes('Saved sentence pages (bottom)'), count > 10);
      if (count === 0) {
        assert.ok(html.includes('0 kết quả'));
        assert.ok(html.includes('Chưa có câu hỏi nào được lưu'));
      } else {
        assert.ok(html.includes(`${count} kết quả (hiển thị 1–${Math.min(count, 10)})`));
      }
    }
  });
} finally {
  await server.close();
  globalThis.window = previousWindow;
}
