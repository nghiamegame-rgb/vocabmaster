import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { getSentenceTopicLabel } from '../src/utils/grammarTopic.js';
import { TOPIC_LABELS } from '../src/utils/grammarPrompt.js';

test('classification follows stored topic and its existing Vietnamese mapping, independently of analysis focus', () => {
  for (const [topic, label] of Object.entries(TOPIC_LABELS)) {
    const question = Object.freeze({ topic, analysisTopic: topic === 'Mixed' ? 'Tenses' : 'Mixed' });
    assert.equal(getSentenceTopicLabel(question), label);
  }
  for (const question of [undefined, null, {}, { analysisTopic: 'Relative Clauses' }, ...[null, '', 'Unknown', 'mixed', ' Tenses ', 4, {}, [], '__proto__', 'toString'].map(topic => ({ topic, analysisTopic: 'Tenses' }))]) {
    assert.equal(getSentenceTopicLabel(question), 'Chưa phân loại');
  }
});

const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { default: Card, GrammarAnalysis } = await server.ssrLoadModule('/src/components/grammar/GrammarAnalysis.jsx');
  const { default: Saved } = await server.ssrLoadModule('/src/components/grammar/GrammarSaved.jsx');
  const { default: Quiz } = await server.ssrLoadModule('/src/components/grammar/GrammarQuiz.jsx');
  const { default: Review } = await server.ssrLoadModule('/src/components/grammar/GrammarReview.jsx');
  test('shared badge precedes English before analysis, matches Saved, supports legacy/Mixed/missing/invalid without mutation', () => {
    const records = [
      { schemaVersion: 2, type: 'sentence-analysis', sentence: 'The book that I borrowed is useful.', topic: 'Relative Clauses', analysisTopic: 'Mixed', grammarPoints: [] },
      { sentence: 'We will _____ tomorrow.', options: { A: 'meet' }, answer: 'A', topic: 'Modal Verbs' },
      { sentence: 'This sentence has a stored mixed topic.', topic: 'Mixed', analysisTopic: 'Relative Clauses' },
      { sentence: 'This sentence has no topic.', analysisTopic: 'Tenses' },
      { sentence: 'This sentence has an unknown topic.', topic: 'Unknown' },
      { sentence: 'This sentence has a malformed topic.', topic: { bad: true } },
      { sentence: 'This sentence has a prototype property as topic.', topic: 'toString' },
    ].map((q, i) => ({ ...q, savedId: `saved-${i}`, savedAt: 1 }));
    const before = JSON.stringify(records);
    for (const question of records) {
      const label = getSentenceTopicLabel(question);
      const badge = html => html.match(/<span[^>]*data-grammar-topic=""[^>]*>(.*?)<\/span>/s)?.[1];
      const card = renderToStaticMarkup(createElement(Card, { question, analysisTopic: 'Tenses', onAssess() {}, onNext() {} }));
      const saved = renderToStaticMarkup(createElement(Saved, { savedQuestions: [question], reviewProgress: {} }));
      const quiz = renderToStaticMarkup(createElement(Quiz, { questions: [question], config: { topic: 'Mixed' }, isQuestionSaved: () => false, savedQuestions: [] }));
      for (const html of [card, saved, quiz]) {
        assert.equal(badge(html), label);
        assert.ok(html.indexOf('data-grammar-topic') < html.indexOf('data-sentence-text'));
        assert.ok(html.includes('Hiện phân tích'));
        assert.ok(!html.includes('Giải thích nhanh'));
        assert.ok(html.includes(label === 'Chưa phân loại' ? 'bg-slate-700/50' : 'bg-purple-600/20'));
      }
    }
    assert.doesNotThrow(() => renderToStaticMarkup(createElement(Review, { savedQuestions: records, reviewProgress: {} })));
    assert.ok(renderToStaticMarkup(createElement(GrammarAnalysis, { question: records[3] })).includes('Chủ đề chính: Chưa phân loại'));
    assert.equal(JSON.stringify(records), before);
  });
} finally { await server.close(); }
