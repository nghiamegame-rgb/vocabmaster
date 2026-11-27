import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import {
  buildGenerationTopicOptions,
  buildTopicOptions,
  getSentenceTopicLabel,
  GRAMMAR_TOPIC_PRIORITY,
  GRAMMAR_TOPIC_TARGET_MAX,
  GRAMMAR_TOPIC_TARGET_MIN,
} from '../src/utils/grammarTopic.js';
import { TOPIC_LABELS } from '../src/utils/grammarPrompt.js';

globalThis.window ??= {}; // audio.js (imported via GrammarReview -> VoiceSettings) checks 'speechSynthesis' in window

test('buildTopicOptions orders topics by VSTEP priority, numbers them, counts total/due/starred, disables 0-count except All, and puts unknown topics last', () => {
  const future = Date.now() + 86400000 * 7;
  const saved = [
    { savedId: '1', topic: 'Tenses', hardMarked: true },
    { savedId: '2', topic: 'Tenses', hardMarked: false },
    { savedId: '3', topic: 'Conditionals', hardMarked: true },
    { savedId: '4', topic: 'Mixed', hardMarked: false },
    { savedId: '5', topic: 'Zebra Custom', hardMarked: false },
    { savedId: '6', topic: 'Alpha Custom', hardMarked: true },
    { savedId: '7', topic: undefined, hardMarked: false },
  ];
  const review = {
    '1': { nextReviewAt: 0 },
    '2': { nextReviewAt: future },
    '3': { nextReviewAt: 0 },
    '4': { nextReviewAt: future },
    '5': { nextReviewAt: 0 },
    '6': { nextReviewAt: future },
  };

  const options = buildTopicOptions(saved, review, false);
  assert.deepEqual(
    options.map(o => o.value),
    ['All', 'Mixed', ...GRAMMAR_TOPIC_PRIORITY, 'Alpha Custom', 'Zebra Custom']
  );

  // All & Mixed are top-level (group: null), unnumbered
  assert.equal(options[0].group, null);
  assert.equal(options[0].disabled, false);
  assert.equal(options[0].count, 7);
  assert.equal(options[0].dueCount, 4); // 1, 3, 5, and 7 (no review record => due)
  assert.equal(options[0].label, 'Tất cả chủ đề — 7 câu · 4 đến hạn');

  assert.equal(options[1].group, null);
  assert.equal(options[1].disabled, false);
  assert.equal(options[1].count, 1);
  assert.equal(options[1].dueCount, 0);
  assert.equal(options[1].label, 'Tổng hợp — 1 câu');

  // Priority 1..18 numbering, labels, groups, and 0-count disabled
  const tenses = options.find(o => o.value === 'Tenses');
  assert.equal(tenses.group, 'Trọng tâm (1–6)');
  assert.equal(tenses.count, 2);
  assert.equal(tenses.dueCount, 1);
  assert.equal(tenses.disabled, false);
  assert.equal(tenses.label, '1. Các thì — 2 câu · 1 đến hạn');

  const wordForms = options.find(o => o.value === 'Word Forms');
  assert.equal(wordForms.group, 'Trọng tâm (1–6)');
  assert.equal(wordForms.count, 0);
  assert.equal(wordForms.dueCount, 0);
  assert.equal(wordForms.disabled, true);
  assert.equal(wordForms.label, '2. Từ loại — 0 câu');

  const conditionals = options.find(o => o.value === 'Conditionals');
  assert.equal(conditionals.group, 'Trọng tâm (1–6)');
  assert.equal(conditionals.label, '6. Câu điều kiện — 1 câu · 1 đến hạn');

  const relative = options.find(o => o.value === 'Relative Clauses');
  assert.equal(relative.group, 'Quan trọng (7–12)');
  assert.equal(relative.label, '7. Mệnh đề quan hệ — 0 câu');
  assert.equal(relative.disabled, true);

  const reported = options.find(o => o.value === 'Reported Speech');
  assert.equal(reported.group, 'Bổ sung (13–18)');
  assert.equal(reported.label, '13. Câu tường thuật — 0 câu');
  assert.equal(reported.disabled, true);

  const participles = options.find(o => o.value === 'Participles & Reduced Clauses');
  assert.equal(participles.group, 'Bổ sung (13–18)');
  assert.equal(participles.label, '18. Mệnh đề rút gọn — 0 câu');

  // Unknown topics sorted alphabetically, numbered 19, 20, in group "Khác"
  const alpha = options.find(o => o.value === 'Alpha Custom');
  assert.equal(alpha.group, 'Khác');
  assert.equal(alpha.count, 1);
  assert.equal(alpha.dueCount, 0);
  assert.equal(alpha.disabled, false);
  assert.equal(alpha.label, '19. Alpha Custom — 1 câu');

  const zebra = options.find(o => o.value === 'Zebra Custom');
  assert.equal(zebra.group, 'Khác');
  assert.equal(zebra.count, 1);
  assert.equal(zebra.dueCount, 1);
  assert.equal(zebra.disabled, false);
  assert.equal(zebra.label, '20. Zebra Custom — 1 câu · 1 đến hạn');

  // Starred-only mode updates counts and disables topics with 0 starred items
  const starred = buildTopicOptions(saved, review, true);
  assert.equal(starred[0].count, 3);
  assert.equal(starred[0].dueCount, 2);
  assert.equal(starred[0].disabled, false);
  assert.equal(starred[1].value, 'Mixed');
  assert.equal(starred[1].count, 0);
  assert.equal(starred[1].disabled, true);
  assert.equal(starred.find(o => o.value === 'Tenses').count, 1);
  assert.equal(starred.find(o => o.value === 'Tenses').disabled, false);
  assert.equal(starred.find(o => o.value === 'Zebra Custom').count, 0);
  assert.equal(starred.find(o => o.value === 'Zebra Custom').disabled, true);
  assert.equal(starred.find(o => o.value === 'Alpha Custom').count, 1);
  assert.equal(starred.find(o => o.value === 'Alpha Custom').disabled, false);

  // Empty savedQuestions: All is NEVER disabled, everything else is disabled, no "Khác" items
  const empty = buildTopicOptions([], {}, false);
  assert.equal(empty.length, 2 + GRAMMAR_TOPIC_PRIORITY.length);
  assert.equal(empty[0].value, 'All');
  assert.equal(empty[0].count, 0);
  assert.equal(empty[0].disabled, false);
  assert.equal(empty[0].label, 'Tất cả chủ đề — 0 câu');
  for (const opt of empty.slice(1)) {
    assert.equal(opt.count, 0);
    assert.equal(opt.disabled, true);
  }
});

test('buildGenerationTopicOptions orders by VSTEP priority, shows target short/enough/excess boundaries, keeps 0-count enabled, and puts unknown topics last', () => {
  const make = (topic, n) => Array.from({ length: n }, (_, i) => ({ savedId: `${topic}-${i}`, topic }));
  const saved = [
    ...make('Mixed', 3),
    ...make('Tenses', GRAMMAR_TOPIC_TARGET_MIN - 1), // 19 -> thiếu 1
    ...make('Word Forms', GRAMMAR_TOPIC_TARGET_MIN), // 20 -> đủ
    ...make('Subject-Verb Agreement', GRAMMAR_TOPIC_TARGET_MAX), // 40 -> đủ
    ...make('Prepositions', GRAMMAR_TOPIC_TARGET_MAX + 1), // 41 -> thừa 1
    ...make('Zebra Custom', 2),
    ...make('Alpha Custom', GRAMMAR_TOPIC_TARGET_MIN),
  ];

  const options = buildGenerationTopicOptions(saved);
  assert.deepEqual(
    options.map(o => o.value),
    ['Mixed', ...GRAMMAR_TOPIC_PRIORITY, 'Alpha Custom', 'Zebra Custom']
  );

  // Mixed at top, unnumbered, no target status, never disabled
  assert.equal(options[0].value, 'Mixed');
  assert.equal(options[0].group, null);
  assert.equal(options[0].count, 3);
  assert.equal(options[0].status, null);
  assert.equal(options[0].disabled, false);
  assert.equal(options[0].label, 'Tổng hợp — 3 câu');

  // Boundary checks: MIN-1, MIN, MAX, MAX+1, and 0
  const tenses = options.find(o => o.value === 'Tenses');
  assert.equal(tenses.group, 'Trọng tâm (1–6)');
  assert.equal(tenses.status, 'short');
  assert.equal(tenses.disabled, false);
  assert.equal(tenses.label, `1. Các thì — ${GRAMMAR_TOPIC_TARGET_MIN - 1} câu · thiếu 1`);

  const wordForms = options.find(o => o.value === 'Word Forms');
  assert.equal(wordForms.group, 'Trọng tâm (1–6)');
  assert.equal(wordForms.status, 'enough');
  assert.equal(wordForms.disabled, false);
  assert.equal(wordForms.label, `2. Từ loại — ${GRAMMAR_TOPIC_TARGET_MIN} câu · đủ`);

  const sva = options.find(o => o.value === 'Subject-Verb Agreement');
  assert.equal(sva.status, 'enough');
  assert.equal(sva.label, `3. Hòa hợp chủ ngữ – động từ — ${GRAMMAR_TOPIC_TARGET_MAX} câu · đủ`);

  const prep = options.find(o => o.value === 'Prepositions');
  assert.equal(prep.status, 'excess');
  assert.equal(prep.label, `4. Giới từ — ${GRAMMAR_TOPIC_TARGET_MAX + 1} câu · thừa 1`);

  // 0-count topic is NOT disabled
  const passive = options.find(o => o.value === 'Passive Voice');
  assert.equal(passive.count, 0);
  assert.equal(passive.status, 'short');
  assert.equal(passive.disabled, false);
  assert.equal(passive.label, `5. Câu bị động — 0 câu · thiếu ${GRAMMAR_TOPIC_TARGET_MIN}`);

  // Group boundaries
  assert.equal(options.find(o => o.value === 'Relative Clauses').group, 'Quan trọng (7–12)');
  assert.equal(options.find(o => o.value === 'Reported Speech').group, 'Bổ sung (13–18)');

  // Unknown topics last, numbered 19, 20, alphabetical, in "Khác"
  const alpha = options.find(o => o.value === 'Alpha Custom');
  assert.equal(alpha.group, 'Khác');
  assert.equal(alpha.status, 'enough');
  assert.equal(alpha.disabled, false);
  assert.equal(alpha.label, `19. Alpha Custom — ${GRAMMAR_TOPIC_TARGET_MIN} câu · đủ`);

  const zebra = options.find(o => o.value === 'Zebra Custom');
  assert.equal(zebra.group, 'Khác');
  assert.equal(zebra.status, 'short');
  assert.equal(zebra.disabled, false);
  assert.equal(zebra.label, `20. Zebra Custom — 2 câu · thiếu ${GRAMMAR_TOPIC_TARGET_MIN - 2}`);

  // Empty savedQuestions: nothing disabled, no "Khác"
  const empty = buildGenerationTopicOptions([]);
  assert.equal(empty.length, 1 + GRAMMAR_TOPIC_PRIORITY.length);
  for (const opt of empty) {
    assert.equal(opt.count, 0);
    assert.equal(opt.disabled, false);
  }
});

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
        assert.ok(html.includes(label === 'Chưa phân loại' ? 'bg-[var(--sb-paper-deep)]' : 'bg-[var(--sb-plum-soft)]'));
      }
    }
    assert.doesNotThrow(() => renderToStaticMarkup(createElement(Review, { savedQuestions: records, reviewProgress: {} })));
    assert.ok(renderToStaticMarkup(createElement(GrammarAnalysis, { question: records[3] })).includes('Chủ đề chính: Chưa phân loại'));
    assert.equal(JSON.stringify(records), before);
  });
} finally { await server.close(); }
