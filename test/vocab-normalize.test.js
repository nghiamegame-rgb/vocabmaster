/**
 * New/imported Vocabulary entries are normalised to the constraints that the
 * Vocabulary Apps Script (google-apps-script.js::vocabValidate) enforces, so an
 * imported file can never block every later sync. Runs Apps Script in a VM;
 * no network. Run: node test/vocab-normalize.test.js
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import fs from 'node:fs';
import { normalizeWordInput } from '../src/utils/vocabWord.js';

const context = vm.createContext({ Set, JSON, Number, Object, Error });
vm.runInContext(fs.readFileSync('google-apps-script.js', 'utf8'), context);
const backendAccepts = words => {
  try { context.vocabValidate({ protocol: 1, generation: 'g', revision: 0, words, tombstones: [] }); return true; }
  catch (error) { return error.message; }
};
const NOW = 1_800_000_000_000;

test('invalid imported values are rejected by the real backend before normalisation', () => {
  assert.equal(backendAccepts([{ id: 'a', english: 'x', vietnamese: 'y', level: 7 }]), 'invalid_level');
  assert.equal(backendAccepts([{ id: 'a', english: 'x', vietnamese: 'y', imageUrl: 5 }]), 'invalid_field');
  assert.equal(backendAccepts([{ id: 'a', english: 'x', vietnamese: 'y', currentStreak: -2 }]), 'invalid_number');
});

test('valid input is unchanged and not counted as adjusted', () => {
  const input = { english: ' negotiate ', vietnamese: ' đàm phán ', annotation: 'v', imageUrl: '', wordType: 'Phrase', level: 3, currentStreak: 2, createdAt: 5, lastReviewedDate: 6, hardMarked: true };
  const { word, adjusted } = normalizeWordInput(input, NOW);
  assert.deepEqual(word, { english: 'negotiate', vietnamese: 'đàm phán', annotation: 'v', imageUrl: '', wordType: 'Phrase', level: 3, currentStreak: 2, createdAt: 5, lastReviewedDate: 6, hardMarked: true });
  assert.deepEqual(adjusted, []);
  // Missing optional fields get defaults without being reported as adjustments.
  const minimal = normalizeWordInput({ english: 'go', vietnamese: 'đi' }, NOW);
  assert.deepEqual(minimal.word, { english: 'go', vietnamese: 'đi', annotation: '', imageUrl: '', wordType: 'Word', level: 1, currentStreak: 0, createdAt: NOW });
  assert.deepEqual(minimal.adjusted, []);
});

test('out-of-range and wrongly typed values move to the nearest valid value', () => {
  const cases = [
    [{ level: 7 }, { level: 5 }, ['level']],
    [{ level: 0 }, { level: 1 }, ['level']],
    [{ level: -3 }, { level: 1 }, ['level']],
    [{ level: 2.6 }, { level: 3 }, ['level']],
    [{ level: '4' }, { level: 4 }, ['level']],
    [{ level: 'abc' }, { level: 1 }, ['level']],
    [{ currentStreak: -2 }, { currentStreak: 0 }, ['currentStreak']],
    [{ currentStreak: 3.7 }, { currentStreak: 3 }, ['currentStreak']],
    [{ imageUrl: 5 }, { imageUrl: '5' }, ['imageUrl']],
    [{ annotation: { a: 1 } }, { annotation: '' }, ['annotation']],
    [{ wordType: 9 }, { wordType: 'Word' }, ['wordType']],
    [{ createdAt: -1 }, { createdAt: NOW }, ['createdAt']],
    [{ lastReviewedDate: 'yesterday' }, {}, ['lastReviewedDate']],
    [{ hardMarked: 'yes' }, { hardMarked: true }, ['hardMarked']],
  ];
  for (const [extra, expected, fields] of cases) {
    const { word, adjusted } = normalizeWordInput({ english: 'x', vietnamese: 'y', ...extra }, NOW);
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(word[key], value, JSON.stringify(extra));
    if ('lastReviewedDate' in extra) assert.equal('lastReviewedDate' in word, false);
    assert.deepEqual(adjusted, fields, JSON.stringify(extra));
  }
});

test('every normalised word passes the real Apps Script validator', () => {
  const nasty = [
    { english: 'a', vietnamese: 'b', level: 99, currentStreak: -5, imageUrl: 1, annotation: null, wordType: false, createdAt: 'x', lastReviewedDate: -9, hardMarked: 1 },
    { english: 'c', vietnamese: 7, level: null, currentStreak: Infinity },
    { english: 'd', vietnamese: 'e', level: '2', currentStreak: '3' },
  ];
  const words = nasty.map((input, i) => ({ id: `id-${i}`, ...normalizeWordInput(input, NOW).word }));
  assert.equal(backendAccepts(words), true);
});

test('entries without English text are refused', () => {
  assert.equal(normalizeWordInput({ english: '   ', vietnamese: 'x' }, NOW), null);
  assert.equal(normalizeWordInput(null, NOW), null);
  assert.equal(normalizeWordInput({ english: 5, vietnamese: 'x' }, NOW), null);
});

test('addWord and the JSON import both use the normaliser and report adjusted entries', () => {
  const store = fs.readFileSync('src/hooks/useVocabStore.js', 'utf8');
  assert.match(store, /import \{ normalizeWordInput \} from '\.\.\/utils\/vocabWord(\.js)?'/);
  assert.match(store, /normalizeWordInput\(wordObj/);
  const page = fs.readFileSync('src/components/Vocabulary.jsx', 'utf8');
  assert.match(page, /normalizeWordInput\(/);
  assert.match(page, /Đã chỉnh \$\{adjustedCount\} mục/);
});
