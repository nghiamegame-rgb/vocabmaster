import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { validateGrammarJSON, normalizeQuestions, buildGrammarPrompt, GRAMMAR_TOPICS } from '../src/utils/grammarPrompt.js';
import { getGrammarSentence, getQuickGrammarPoints } from '../src/utils/grammarSentence.js';
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
  assert.ok(prompt.includes('Explain ONLY parts relevant to Tenses'));
  assert.ok(prompt.includes('3–6 short grammarPoints'));
  assert.ok(!prompt.includes('Identify ALL meaningful grammar points'));
  assert.ok(buildGrammarPrompt({ topic: 'Mixed' }).includes('Mixed: choose only a few'));
  assert.ok(prompt.includes('VSTEP B1'));
  assert.ok(prompt.includes('exactly 5'));
});

test('frontend and actual Apps Script accept both formats and reject malformed v2 identically', () => {
  for (const q of [sentence, legacy, { ...sentence, analysisTopic: 'Mixed' }, { ...sentence, schemaVersion: 3 }, { ...sentence, grammarPoints: [] }, { ...sentence, sentence: 'A _____.' }, { ...sentence, answer: 'A' }]) {
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
  assert.equal(mergeSavedQuestions([sentence], [{ ...sentence, analysisTopic: 'Mixed' }])[0].analysisTopic, 'Mixed');
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
  test('quick explanation filters the chosen topic and removes formal cards without mutating old data', () => {
    const structure = { category: 'Sentence Structure & Word Order', phrase: 'The book', explanation: 'Chủ ngữ chính là The book.' };
    for (const index of [0, 1, 2]) {
      const points = [...sentence.grammarPoints];
      points.splice(index, 0, structure);
      const question = { ...sentence, grammarPoints: points };
      const before = JSON.stringify(question);
      const html = renderToStaticMarkup(createElement(GrammarAnalysis, { question }));
      assert.ok(html.indexOf(question.vietnameseSentence) < html.indexOf('Giải thích nhanh'));
      assert.ok(html.includes(sentence.grammarPoints[0].explanation));
      assert.ok(!html.includes(sentence.grammarPoints[1].explanation));
      assert.ok(!html.includes(structure.explanation));
      assert.ok(!html.includes('Chủ đề chính:'));
      assert.ok(!html.includes('Cấu trúc quan trọng'));
      assert.equal(JSON.stringify(question), before);
      const hidden = renderToStaticMarkup(createElement(Card, { question }));
      assert.ok(!hidden.includes(structure.explanation));
    }
    const explicit = renderToStaticMarkup(createElement(GrammarAnalysis, { question: sentence, analysisTopic: 'Tenses' }));
    assert.ok(explicit.includes(sentence.grammarPoints[1].explanation));
    assert.ok(!explicit.includes(sentence.grammarPoints[0].explanation));
    const mixed = renderToStaticMarkup(createElement(GrammarAnalysis, { question: { ...sentence, analysisTopic: 'Mixed' } }));
    for (const point of sentence.grammarPoints) assert.ok(mixed.includes(point.explanation));
    const selectedStructure = getQuickGrammarPoints({ ...sentence, grammarPoints: [structure, ...sentence.grammarPoints] }, structure.category);
    assert.equal(selectedStructure.length, 1);
    assert.equal(selectedStructure[0].phrase, structure.phrase);
  });
  test('old long analyses are shortened to at most six distinct exact quotes', () => {
    const points = Array.from({ length: 9 }, (_, i) => ({ category: 'Prepositions', phrase: `phrase ${i}`, explanation: `${'Giải thích cũ rất dài '.repeat(25)}. Câu tiếp theo không cần hiển thị.` }));
    const question = { ...sentence, grammarPoints: [...points, points[0]] };
    const before = JSON.stringify(question);
    const quick = getQuickGrammarPoints(question, 'Mixed');
    assert.equal(quick.length, 6);
    for (const point of quick) assert.ok(point.explanation.length <= 220);
    assert.deepEqual(quick.map(p => p.phrase), points.slice(0, 6).map(p => p.phrase));
    assert.equal(JSON.stringify(question), before);
    assert.equal(getQuickGrammarPoints({ ...sentence, grammarPoints: [points[0], points[0]] }, 'Prepositions').length, 1);
    assert.equal(getQuickGrammarPoints(question, 'Word Forms').length, 0);
  });
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
  test('review actions and next stay available before analysis, while learning content stays hidden', () => {
    for (const q of [sentence, legacy]) {
      const html = renderToStaticMarkup(createElement(Card, { question: q, onAssess() {}, onNext() {} }));
      assert.ok(html.includes(getGrammarSentence(q)));
      assert.ok(html.includes('Hiện phân tích'));
      assert.ok(html.includes('aria-expanded="false"'));
      assert.ok(html.includes('Đã hiểu'));
      assert.ok(html.includes('Cần ôn lại'));
      assert.ok(html.indexOf('Đã hiểu') < html.indexOf('Hiện phân tích'));
      assert.ok(html.indexOf('Câu tiếp') < html.indexOf('Hiện phân tích'));
      assert.ok(!html.match(/<button[^>]*>Câu tiếp<\/button>/)[0].includes('disabled'));
      assert.ok(!html.includes(q.userNotes));
      if (q.vietnameseSentence) assert.ok(!html.includes(q.vietnameseSentence));
    }
    const html = renderToStaticMarkup(createElement(Quiz, { questions: [sentence], config: { topic: 'Mixed' }, isQuestionSaved: () => false, savedQuestions: [] }));
    assert.ok(html.includes(sentence.sentence));
    assert.ok(!html.includes(sentence.vietnameseSentence));
    assert.ok(!html.includes('Đã hiểu'));
    const assessed = renderToStaticMarkup(createElement(Card, { question: sentence, onAssess() {}, assessed: false, onNext() {} }));
    assert.equal((assessed.match(/disabled=""/g) || []).length, 2);
    assert.ok(!assessed.match(/<button[^>]*>Câu tiếp<\/button>/)[0].includes('disabled'));
  });
  test('saved mixed-format library renders safely, expanded analysis includes relevant points', () => {
    const html = renderToStaticMarkup(createElement(Saved, { savedQuestions: [sentence, legacy], reviewProgress: {}, cloudConfigured: true }));
    assert.ok(!html.includes('undefined'));
    assert.ok(html.includes(sentence.sentence));
    assert.ok(!html.includes(sentence.vietnameseSentence));
    const analysis = renderToStaticMarkup(createElement(GrammarAnalysis, { question: sentence }));
    assert.ok(analysis.includes(sentence.grammarPoints[0].explanation));
    assert.ok(!analysis.includes(sentence.grammarPoints[1].explanation));
    assert.ok(analysis.includes(sentence.vietnameseSentence));
    const stats = renderToStaticMarkup(createElement(Stats, { grammarStats: { totalAnswered: 5, correctAnswers: 3, sentenceActivity: { reviewed: 2, understood: 1 } }, savedQuestions: [sentence], dueForReview: [], wrongQuestions: [] }));
    assert.ok(stats.includes('Lịch sử trắc nghiệm TOEIC cũ'));
    assert.ok(stats.includes('Mức hiểu do bạn tự đánh giá'));
  });
} finally {
  await server.close();
}
