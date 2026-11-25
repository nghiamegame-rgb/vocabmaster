// Dictation grading rules. Run: node test/dictation-check.test.js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeWord, displayWord, tokenizeSentence, compareDictation, matchedWordIndexes } from '../src/utils/dictationCheck.js';

test('normalizeWord: case, punctuation, curly apostrophes', () => {
  assert.equal(normalizeWord('Hello,'), 'hello');
  assert.equal(normalizeWord('“Don’t”'), "don't");
  assert.equal(normalizeWord("don't"), "don't");
  assert.equal(normalizeWord('it‘s'), "it's");
  assert.equal(normalizeWord('U.S.'), 'us');
  assert.equal(normalizeWord('well-known.'), 'well-known');
  assert.equal(normalizeWord('—'), '');
  assert.equal(normalizeWord('café!'), 'café');
  assert.equal(normalizeWord('3.5'), normalizeWord('3.5'));
});

test('displayWord keeps the visible form without surrounding punctuation', () => {
  assert.equal(displayWord('“London,”'), 'London');
  assert.equal(displayWord('don’t.'), "don't");
});

test('tokenizeSentence drops pure punctuation tokens and extra spaces', () => {
  assert.deepEqual(tokenizeSentence('  Hello ,  world — again!  ').map(t => t.key), ['hello', 'world', 'again']);
});

test('exact answer ignoring case, punctuation, spaces and apostrophe style', () => {
  const r = compareDictation("I don't think it's late, Mr. Smith.", "i  don’t think its late mr smith");
  assert.equal(r.isCorrect, false, "its ≠ it's");
  const ok = compareDictation("I don't think it's late, Mr. Smith.", "i  don’t   think it‘s late mr smith");
  assert.equal(ok.isCorrect, true);
  assert.equal(ok.correct, 7);
  assert.equal(ok.total, 7);
});

test('wrong, missing and extra words are reported in order', () => {
  const r = compareDictation('The cat sat on the mat', 'the dog sat the big mat');
  assert.deepEqual(r.items.map(i => i.type), ['correct', 'wrong', 'correct', 'missing', 'correct', 'extra', 'correct']);
  assert.equal(r.items[1].expected, 'cat');
  assert.equal(r.items[1].typed, 'dog');
  assert.equal(r.items[3].expected, 'on');
  assert.equal(r.items[5].typed, 'big');
  assert.equal(r.correct, 4);
  assert.equal(r.isCorrect, false);
});

test('empty answer: everything missing; empty sentence never correct', () => {
  const r = compareDictation('Good morning', '');
  assert.deepEqual(r.items.map(i => i.type), ['missing', 'missing']);
  assert.equal(compareDictation('', '').isCorrect, false);
});

test('extra words make the sentence wrong even when all words are present', () => {
  assert.equal(compareDictation('See you soon', 'see you very soon').isCorrect, false);
});

test('matchedWordIndexes reveals words typed in order, not partial words', () => {
  assert.deepEqual(matchedWordIndexes('The weather is nice today', 'the weath'), [0]);
  assert.deepEqual(matchedWordIndexes('The weather is nice today', 'the weather is'), [0, 1, 2]);
  assert.deepEqual(matchedWordIndexes('The weather is nice today', 'today'), [4]);
  assert.deepEqual(matchedWordIndexes('a b a', 'a'), [0]);
});
