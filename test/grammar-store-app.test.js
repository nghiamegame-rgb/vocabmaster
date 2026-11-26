/**
 * The Grammar store lives in App (like the Structures store), so Grammar sync
 * keeps running when the Grammar tab is closed; Grammar.jsx only renders the
 * store it receives through props. Run: node test/grammar-store-app.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

globalThis.fetch = () => { throw new Error('Network must not be used'); };
globalThis.window ??= {}; // audio.js (imported via GrammarReview -> VoiceSettings) checks 'speechSynthesis' in window
// No localStorage on purpose: Grammar must not read storage or start a store itself.
delete globalThis.localStorage;

test('App owns the Grammar store and passes it to Grammar', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /import \{ useGrammarStore \} from '\.\/hooks\/useGrammarStore'/);
  assert.match(app, /const grammarStore = useGrammarStore\(\);/);
  assert.match(app, /<Grammar[\s\S]*?grammarStore=\{grammarStore\}/);
  const grammar = readFileSync(new URL('../src/components/Grammar.jsx', import.meta.url), 'utf8');
  assert.ok(!/useGrammarStore\(/.test(grammar), 'Grammar.jsx must not create its own store');
});

const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
});
try {
  const { default: Grammar } = await server.ssrLoadModule('/src/components/Grammar.jsx');
  const noop = () => {};
  const grammarStore = {
    savedQuestions: [], dataLoadError: '', storageError: 'SENTINEL-STORE-ERROR', reviewProgress: {},
    grammarStats: { totalAnswered: 0, correctAnswers: 0, byTopic: {}, byDifficulty: {}, sessions: [] },
    underlines: {}, sentenceNotes: {}, updateSentenceNote: noop, syncStatus: 'ok', hasPending: false,
    cloudConfigured: true, setCloudConfigured: noop, dueForReview: [], wrongQuestions: [],
    saveQuestion: noop, unsaveQuestion: noop, isQuestionSaved: () => false, toggleHardMark: noop,
    updateNotes: noop, recordReview: noop, recordGrammarSession: noop, updateUnderlines: noop, syncFromCloud: noop,
  };
  await test('Grammar renders the store passed by App without touching storage', () => {
    const html = renderToStaticMarkup(createElement(Grammar, {
      grammarStore, addWord: noop, words: [], structureStore: { structures: [], syncStatus: 'ok', syncFromCloud: noop },
    }));
    assert.ok(html.includes('SENTINEL-STORE-ERROR'));
    assert.ok(html.includes('Đã đồng bộ'));
  });
} finally {
  await server.close();
}
