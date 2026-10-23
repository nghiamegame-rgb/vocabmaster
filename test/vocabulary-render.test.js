/**
 * Render the real Vocabulary component with synthetic data, without a browser,
 * LocalStorage writes or network requests. Run: node test/vocabulary-render.test.js
 * These checks cover initial rendering; browser interactions still need UI QA.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const previousWindow = globalThis.window;
const previousFetch = globalThis.fetch;
// audio.js probes window at module load. No speech engine is needed here.
globalThis.window = {};
globalThis.fetch = () => { throw new Error('Network must not be used by render tests'); };

const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});

try {
  const { default: Vocabulary } = await server.ssrLoadModule('/src/components/Vocabulary.jsx');
  const noop = () => {};
  const types = ['Word', 'Phrase', 'Preposition', 'Family'];
  const words = Object.freeze(Array.from({ length: 1000 }, (_, i) => Object.freeze({
    id: `fixture-${i}`,
    english: `word-${i}`,
    vietnamese: `meaning-${i}`,
    annotation: `note-${i}`,
    imageUrl: `https://example.invalid/image-${i}.jpg`,
    wordType: types[i % types.length],
    level: i % 5 + 1,
    currentStreak: i % 8,
    createdAt: 1700000000000 + i,
    lastReviewedDate: 1700000000000 + i,
  })));

  function render(collection, vocabFilter = null) {
    return renderToStaticMarkup(createElement(Vocabulary, {
      words: collection,
      addWord: noop,
      deleteWord: noop,
      updateWord: noop,
      bulkUpdateLevel: noop,
      vocabFilter,
      setVocabFilter: noop,
    }));
  }
  function cardCount(html) {
    return (html.match(/id="select-fixture-/g) || []).length;
  }

  await test('opening 441 or 1,000 entries mounts only 24 cards and images', () => {
    for (const count of [441, 1000]) {
      const html = render(words.slice(0, count));
      assert.equal(cardCount(html), 24);
      assert.equal((html.match(/<img /g) || []).length, 24);
      assert.ok(html.includes(`${count} words`));
      assert.ok(html.includes(`${count} matching; 1–24 shown`));
      assert.ok(html.includes(`value="${Math.ceil(count / 24)}"`));
      assert.ok(!html.includes('id="select-fixture-24"'));
    }
  });

  await test('page boundaries and empty collections render correctly', () => {
    for (const count of [0, 1, 24, 25]) {
      const html = render(words.slice(0, count));
      assert.equal(cardCount(html), Math.min(count, 24));
      assert.equal(html.includes('Vocabulary pages (top)'), count > 24);
      if (count === 0) assert.ok(html.includes('No words yet'));
    }
  });

  await test('images use lazy loading and asynchronous decoding', () => {
    const html = render(words);
    assert.equal((html.match(/loading="lazy"/g) || []).length, 24);
    assert.equal((html.match(/decoding="async"/g) || []).length, 24);
    // Lazy images must not produce React's eager image preload hints.
    assert.ok(!html.includes('rel="preload"'));
  });

  await test('each level filters the full collection before pagination', () => {
    for (let level = 1; level <= 5; level++) {
      const html = render(words, level);
      assert.equal(cardCount(html), 24);
      assert.ok(html.includes('200 matching; 1–24 shown'));
      const ids = [...html.matchAll(/id="select-fixture-(\d+)"/g)].map(match => Number(match[1]));
      assert.deepEqual(ids, words.filter(w => w.level === level).slice(0, 24)
        .map(w => Number(w.id.slice('fixture-'.length))));
    }
  });

  await test('all four categories, annotations, meanings and image URLs remain visible', () => {
    const html = render(words);
    for (let i = 0; i < 4; i++) {
      assert.ok(html.includes(types[i]));
      assert.ok(html.includes(`note-${i}`));
      assert.ok(html.includes(`meaning-${i}`));
      assert.ok(html.includes(words[i].imageUrl));
      assert.ok(html.includes(`id="edit-fixture-${i}"`));
      assert.ok(html.includes(`id="delete-fixture-${i}"`));
      assert.ok(html.includes(`id="speak-fixture-${i}"`));
    }
    assert.ok(html.includes('id="select-all-btn"'));
    assert.ok(html.includes('id="import-btn"'));
    assert.ok(html.includes('id="export-btn"'));
  });

  await test('adding a prepended entry keeps the render bound and existing data intact', () => {
    const before = JSON.stringify(words);
    const newWord = Object.freeze({ ...words[0], id: 'fixture-new', english: 'new-entry' });
    const html = render([newWord, ...words]);
    assert.equal(cardCount(html), 24);
    assert.ok(html.includes('1001 words'));
    assert.ok(html.indexOf('id="select-fixture-new"') < html.indexOf('id="select-fixture-0"'));
    assert.equal(JSON.stringify(words), before);
  });
} finally {
  await server.close();
  globalThis.window = previousWindow;
  globalThis.fetch = previousFetch;
}
