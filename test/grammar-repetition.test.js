import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeRepetition, pickScenarioPool, buildRepetitionGuard } from '../src/utils/grammarBatch.js';
import { buildGrammarPrompt } from '../src/utils/grammarPrompt.js';

// 30 saved sentences: "garden" in 12, "Every" opening 6, one repeated phrase 3 times.
const corpus = Array.from({ length: 30 }, (_, i) => {
  if (i < 12) return `Neighbours share the garden tool number ${i} on weekends.`.replace(/\d+/, ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][i]);
  if (i < 18) return `Every ${['bus', 'train', 'plane', 'boat', 'taxi', 'tram'][i - 12]} arrives early today.`;
  if (i < 21) return `Visitors felt great relief when parking ${['opened', 'closed', 'expanded'][i - 18]}.`;
  return `Sentence ${'abcdefghi'[i - 21]} describes a unique ${['river', 'castle', 'market', 'bridge', 'tunnel', 'school', 'harbour', 'forest', 'museum'][i - 21]} view.`;
});

test('too few saved sentences gives no statistics', () => {
  assert.equal(analyzeRepetition([]), null);
  assert.equal(analyzeRepetition(corpus.slice(0, 19)), null);
  assert.equal(analyzeRepetition(undefined), null);
  assert.equal(analyzeRepetition('not an array'), null);
});

test('overused words, openings and phrases are counted per sentence', () => {
  const stats = analyzeRepetition(corpus);
  assert.equal(stats.total, 30);
  assert.deepEqual(stats.overusedWords.find(([word]) => word === 'garden'), ['garden', 12]);
  assert.ok(stats.overusedWords.every(([, n]) => n >= 4));
  assert.ok(!stats.overusedWords.some(([word]) => ['the', 'every', 'on'].includes(word) && word !== 'every'));
  assert.deepEqual(stats.overusedOpenings.find(([word]) => word === 'every'), ['every', 6]);
  assert.ok(stats.repeatedPhrases.some(([phrase, n]) => phrase.includes('felt great relief when') && n === 3));
  // a shorter phrase fully inside a kept longer one is dropped
  assert.ok(!stats.repeatedPhrases.some(([phrase]) => phrase === 'great relief when'));
});

test('scenario pool is deterministic per batch id, varies between ids and respects size', () => {
  assert.deepEqual(pickScenarioPool('batch-1', 10), pickScenarioPool('batch-1', 10));
  assert.notDeepEqual(pickScenarioPool('batch-1', 10), pickScenarioPool('batch-2', 10));
  assert.equal(pickScenarioPool('x', 5).length, 10);
  assert.equal(pickScenarioPool('x', 20).length, 24);
  assert.equal(new Set(pickScenarioPool('x', 20)).size, 24);
});

test('guard lists measured items only when the corpus is large enough', () => {
  const small = buildRepetitionGuard({ id: 'a', grammar: ['One short sentence.'], count: 5 });
  assert.ok(small.includes('SCENARIO POOL') && !small.includes('OVERUSED'));
  const big = buildRepetitionGuard({ id: 'a', grammar: corpus, count: 10 });
  assert.ok(big.includes('OVERUSED WORDS: ') && big.includes('garden (12)'));
  assert.ok(big.includes('OVERUSED OPENINGS: ') && big.includes('every (6)'));
  assert.ok(big.includes('REPEATED PHRASES: '));
});

test('prompt carries the guard in inline and workbook modes without leaking saved sentences in workbook mode', () => {
  const data = { vocab: [['mitigate', 0]], grammar: corpus };
  for (const workbookName of [undefined, 'Grammar-x.xlsx']) {
    const prompt = buildGrammarPrompt({ count: 10, topic: 'Mixed', data, workbookName, batchId: 'b1' });
    assert.ok(prompt.includes('REPETITION GUARD'), `guard present (${workbookName})`);
    assert.ok(prompt.includes('garden (12)'), `stats present (${workbookName})`);
    assert.ok(prompt.includes('(e) Within the new batch'), 'in-batch word rule present');
    assert.equal(prompt.includes('Neighbours share the garden tool number one'), !workbookName);
  }
  assert.equal(buildGrammarPrompt({ data, batchId: 'b1' }), buildGrammarPrompt({ data, batchId: 'b1' }));
});
