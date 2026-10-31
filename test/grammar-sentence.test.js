import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { validateGrammarJSON, normalizeQuestions, buildGrammarPrompt, GRAMMAR_TOPICS } from '../src/utils/grammarPrompt.js';
import { getGrammarSentence } from '../src/utils/grammarSentence.js';
import { validateQuestion, mergeSavedQuestions, validatePayload } from '../src/utils/grammarSyncMerge.js';

const sentence = {
  schemaVersion: 2, type: 'sentence-analysis', savedId: 'vstep-1', id: 's1',
  sentence: 'The book that I borrowed yesterday is interesting.',
  vietnameseSentence: 'Cuốn sách tôi mượn hôm qua rất thú vị.', topic: 'Relative Clauses',
  grammarPoints: [
    { category: 'Relative Clauses', phrase: 'that I borrowed yesterday', explanation: 'Mệnh đề bổ nghĩa cho book; that làm tân ngữ của borrowed.' },
    { category: 'Tenses', phrase: 'borrowed', explanation: 'Quá khứ đơn, chỉ việc mượn đã xảy ra hôm qua.' },
  ], structures: ['The book là chủ ngữ của is.'], readingNotes: ['Không nhầm borrowed với động từ chính is.'],
  userNotes: 'Ghi chú riêng', hardMarked: true, savedAt: 123,
};
const legacy = { savedId: 'old-1', sentence: 'We will _____ tomorrow.', options: { A: 'meet', B: 'met', C: 'meeting', D: 'meets' }, answer: 'A', topic: 'Modal Verbs', userNotes: 'old notes' };
const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../grammar-apps-script.js', import.meta.url), 'utf8'), context);

test('new imports enforce version, complete sentences, focus, count and exact phrases', () => {
  assert.equal(GRAMMAR_TOPICS.length, 19);
  assert.equal(validateGrammarJSON([sentence], { count: 1, topic: 'Relative Clauses' }).valid, true);
  for (const bad of [null, [], legacy, { ...sentence, schemaVersion: 3 }, { ...sentence, options: legacy.options }, { ...sentence, answer: 'A' }, { ...sentence, sentence: 'The book is _____.' }, { ...sentence, vietnameseSentence: '' }, { ...sentence, grammarPoints: [] }, { ...sentence, grammarPoints: [{ category: 'Tenses', phrase: 'missing phrase', explanation: 'x' }] }, { ...sentence, readingNotes: 'wrong' }]) {
    assert.equal(validateGrammarJSON([bad]).valid, false);
  }
  assert.equal(validateGrammarJSON([sentence], { count: 5 }).valid, false);
  assert.equal(validateGrammarJSON([sentence], { topic: 'Tenses' }).valid, false);
  assert.equal(validateGrammarJSON([sentence, sentence]).valid, false);
  assert.deepEqual(normalizeQuestions([sentence])[0], sentence);
  const prompt = buildGrammarPrompt({ count: 5, topic: 'Tenses' });
  assert.ok(prompt.includes('ALL meaningful grammar points'));
  assert.ok(prompt.includes('VSTEP B1'));
  assert.ok(prompt.includes('exactly 5'));
});

test('frontend and actual Apps Script accept both formats and reject malformed v2 identically', () => {
  for (const q of [sentence, legacy, { ...sentence, schemaVersion: 3 }, { ...sentence, grammarPoints: [] }, { ...sentence, sentence: 'A _____.' }, { ...sentence, answer: 'A' }]) {
    assert.equal(validateQuestion(q), context.validateQuestion(q, 0));
  }
  assert.equal(validateQuestion(sentence), null);
  assert.equal(validateQuestion(legacy), null);
  const payload = { action: 'save', expectedRevision: 2, savedQuestions: [legacy, sentence], reviewProgress: { 'vstep-1': { level: 4 } } };
  assert.equal(validatePayload(payload).valid, true);
  assert.equal(context.validatePayload(payload), null);
  const snapshot = JSON.stringify([legacy, sentence]);
  const merged = mergeSavedQuestions([sentence], [legacy, { ...sentence, userNotes: '' }]);
  assert.deepEqual(merged.find(q => q.savedId === sentence.savedId), sentence);
  assert.deepEqual(merged.find(q => q.savedId === legacy.savedId), legacy);
  assert.equal(getGrammarSentence(legacy), 'We will meet tomorrow.');
  assert.equal(JSON.stringify([legacy, sentence]), snapshot);
});

// No browser, LocalStorage or live endpoint. Render the actual components.
const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { default: Card, GrammarAnalysis } = await server.ssrLoadModule('/src/components/grammar/GrammarAnalysis.jsx');
  const { default: Saved } = await server.ssrLoadModule('/src/components/grammar/GrammarSaved.jsx');
  const { default: Quiz } = await server.ssrLoadModule('/src/components/grammar/GrammarQuiz.jsx');
  const { default: Stats } = await server.ssrLoadModule('/src/components/grammar/GrammarStats.jsx');
  test('reading learning actions are hidden initially and render with the revealed analysis', () => {
    const enriched = { ...sentence, readingItems: [
      { category: 'vocabulary', text: 'borrowed', explanation: 'Dạng quá khứ của borrow.', meaning: 'đã mượn' },
      { category: 'structure', text: 'that I borrowed yesterday', pattern: 'noun + that + subject + verb', explanation: 'Mệnh đề quan hệ bổ nghĩa cho danh từ.' },
    ] };
    const onQuickAdd = () => ({ ok: true });
    const hidden = renderToStaticMarkup(createElement(Card, { question: enriched, onQuickAdd }));
    assert.ok(!hidden.includes('+ Vocab'));
    assert.ok(!hidden.includes('+ Structure'));
    assert.ok(!hidden.includes('Dạng quá khứ'));
    const visible = renderToStaticMarkup(createElement(GrammarAnalysis, { question: enriched, onQuickAdd }));
    assert.ok(visible.includes('Lưu ý đọc hiểu'));
    assert.ok(visible.includes('+ Vocab'));
    assert.ok(visible.includes('+ Structure'));
    for (const item of enriched.readingItems) assert.ok(visible.includes(item.explanation));
    assert.ok(visible.includes(enriched.readingNotes[0]));
    const saved = renderToStaticMarkup(createElement(Saved, { savedQuestions: [enriched], reviewProgress: {}, onQuickAdd }));
    assert.ok(!saved.includes('+ Vocab'));
  });
  test('practice/review sentence card initially hides translation, analysis, notes and assessments', () => {
    for (const q of [sentence, legacy]) {
      const html = renderToStaticMarkup(createElement(Card, { question: q, onAssess() {} }));
      assert.ok(html.includes(getGrammarSentence(q)));
      assert.ok(html.includes('Hiện phân tích'));
      assert.ok(html.includes('aria-expanded="false"'));
      assert.ok(!html.includes('Đã hiểu'));
      assert.ok(!html.includes('Cần ôn lại'));
      assert.ok(!html.includes(q.userNotes));
      if (q.vietnameseSentence) assert.ok(!html.includes(q.vietnameseSentence));
    }
    const html = renderToStaticMarkup(createElement(Quiz, { questions: [sentence], config: { topic: 'Mixed' }, isQuestionSaved: () => false, savedQuestions: [] }));
    assert.ok(html.includes(sentence.sentence));
    assert.ok(!html.includes(sentence.vietnameseSentence));
  });
  test('saved mixed-format library renders safely, expanded analysis includes all points', () => {
    const html = renderToStaticMarkup(createElement(Saved, { savedQuestions: [sentence, legacy], reviewProgress: {}, cloudConfigured: true }));
    assert.ok(!html.includes('undefined'));
    assert.ok(html.includes(sentence.sentence));
    assert.ok(!html.includes(sentence.vietnameseSentence));
    const analysis = renderToStaticMarkup(createElement(GrammarAnalysis, { question: sentence }));
    for (const p of sentence.grammarPoints) assert.ok(analysis.includes(p.explanation));
    assert.ok(analysis.includes(sentence.vietnameseSentence));
    const stats = renderToStaticMarkup(createElement(Stats, { grammarStats: { totalAnswered: 5, correctAnswers: 3, sentenceActivity: { reviewed: 2, understood: 1 } }, savedQuestions: [sentence], dueForReview: [], wrongQuestions: [] }));
    assert.ok(stats.includes('Lịch sử trắc nghiệm TOEIC cũ'));
    assert.ok(stats.includes('Mức hiểu do bạn tự đánh giá'));
  });
} finally {
  await server.close();
}
