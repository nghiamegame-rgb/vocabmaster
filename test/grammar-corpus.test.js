import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildGrammarCorpus, collectGrammarCorpus, corpusSentence } from '../src/utils/grammarCorpus.js';
import { prepareGrammarImport, completeGrammarImport } from '../src/utils/grammarImport.js';
import { buildGrammarPrompt } from '../src/utils/grammarPrompt.js';

const records = sentences => sentences.map(sentence => ({ sentence }));
const words = list => list.map(english => ({ english, level: 5, annotation: 'PRIVATE_NOTE', vietnamese: 'PRIVATE_MEANING', lastReviewedDate: 'PRIVATE_DATE' }));
const counts = (list, sentences) => Object.fromEntries(buildGrammarCorpus(words(list), records(sentences)).data.vocab);

test('distinct sentences, Unicode, case, whitespace, boundaries and phrase punctuation', () => {
  assert.deepEqual(counts(['art', 'in fact', 'café', "can't", 'can', 'well-known'], [
    'Art, art and ART belong here.', ' ART,  art and art belong here! ',
    'The department opened.', "We call it ‘art’.", 'In, fact, it works.',
    'In. Fact is a different word.', 'The cafe\u0301 is open.', 'The ＣＡＦÉ is open!',
    "We can't leave.", 'A well‑known writer arrived.',
  ]), { art: 2, 'in fact': 1, café: 1, "can't": 1, can: 0, 'well-known': 1 });
});

test('conservative morphology does not invent lemmas or collapse word families', () => {
  assert.deepEqual(counts(['purchase', 'purchased', 'purchasing', 'go', 'went', 'educate', 'education', 'educational'], [
    'They purchased educational materials.', 'They went to school for an education.',
    'They purchase books to educate children.',
  ]), { purchase: 1, purchased: 1, purchasing: 0, go: 0, went: 1, educate: 1, education: 1, educational: 1 });
});

test('legacy reconstruction uses one unambiguous answer, never distractors or explanations', () => {
  const legacy = { savedId: 'g1', sentence: 'They _____ books.', options: { A: 'purchase', B: 'art', C: 'delivery', D: 'other' }, answer: 'A', explanation: 'delivery art', vietnameseSentence: 'art' };
  assert.equal(corpusSentence(legacy), 'They purchase books.');
  const result = buildGrammarCorpus(words(['purchase', 'art', 'delivery']), [legacy, legacy, { sentence: 'THEY purchase books!' }, { sentence: 'A different topic includes purchase.', topic: 'Tenses' }]);
  assert.equal(result.data.grammar.length, 2);
  assert.deepEqual(Object.fromEntries(result.data.vocab), { purchase: 2, art: 0, delivery: 0 });
  for (const patch of [{ answer: 'X' }, { options: {} }, { sentence: 'They _____ _____.' }, { sentence: 'They [blank] books.' }, { schemaVersion: 2 }]) assert.equal(corpusSentence({ ...legacy, ...patch }), null);
  assert.equal(collectGrammarCorpus([{ sentence: null }, { sentence: 'Still _____.' }]).unresolved, 2);
});

test('payload whitelist, empty stores, full corpus, no mutation or metadata leakage', () => {
  const sourceWords = words(['delivery', 'purchase', ' PURCHASE ']);
  const sourceRecords = records(Array.from({ length: 125 }, (_, i) => `They purchase item ${i}.`));
  sourceRecords[0].userNotes = 'PRIVATE_SENTENCE_NOTE';
  const before = JSON.stringify([sourceWords, sourceRecords]);
  const result = buildGrammarCorpus(sourceWords, sourceRecords);
  assert.deepEqual(result.data.vocab, [['delivery', 0], ['purchase', 125]]);
  assert.equal(result.data.grammar.length, 125);
  const prompt = buildGrammarPrompt({ data: result.data, topic: 'Tenses', count: 5 });
  for (const secret of ['PRIVATE_NOTE', 'PRIVATE_MEANING', 'PRIVATE_DATE', 'PRIVATE_SENTENCE_NOTE', 'lastReviewedDate', 'userNotes', 'currentStreak']) assert.ok(!prompt.includes(secret));
  assert.equal(JSON.stringify([sourceWords, sourceRecords]), before);
  assert.deepEqual(buildGrammarCorpus(), { data: { vocab: [], grammar: [] }, unresolved: 0, invalidWords: 0 });
  assert.equal(buildGrammarCorpus([{ english: null }]).invalidWords, 1);
});

const question = sentence => ({ schemaVersion: 2, type: 'sentence-analysis', sentence, vietnameseSentence: 'Bản dịch.', topic: 'Tenses', grammarPoints: [{ category: 'Tenses', phrase: sentence, explanation: 'Giải thích.' }], readingItems: [] });
test('import checks full current corpus, partial/all duplicates, normalized within-batch duplicates', () => {
  const questions = [question('They purchase books.'), question('They purchase food.')];
  const initial = prepareGrammarImport(JSON.stringify(questions), { count: 2, topic: 'Tenses', recentSentences: ['They purchase books!'] });
  assert.equal(initial.duplicates.length, 1);
  assert.equal(completeGrammarImport(initial).valid, false);
  assert.equal(completeGrammarImport(initial, { allowDuplicates: true }).questions.length, 2);
  const corpus = buildGrammarCorpus(words(['purchase']), questions).data;
  assert.deepEqual(corpus.vocab, [['purchase', 2]]);
  const latest = prepareGrammarImport(JSON.stringify(questions), { count: 2, recentSentences: corpus.grammar });
  assert.equal(latest.duplicates.length, 2);
  assert.equal(completeGrammarImport(latest).valid, false);
  assert.equal(completeGrammarImport(latest, { allowDuplicates: true }).questions.length, 2);
  const repeated = prepareGrammarImport(JSON.stringify([questions[0], question('ＴＨＥＹ  purchase books!')]), { count: 2 });
  assert.ok(repeated.errors.some(error => error.reason.includes('trùng')));
});
