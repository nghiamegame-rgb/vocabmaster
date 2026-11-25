// Dictation "Từ đã lưu" listening practice: choices, filters, counters.
// Run: node test/dictation-practice.test.js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  practiceFilterOptions, filterPracticeWords, createWordPicker, buildWordRound, isTypedWord,
  ALL_LESSONS, NO_LESSON, MAX_CHOICES,
} from '../src/utils/dictationPractice.js';
import { emptyDictationData, addLesson, saveWord, unsaveWord, recordWordListen } from '../src/utils/dictationModel.js';
import { liveRecords, listenTotals, mergeDictationData, validateDictationData } from '../src/utils/dictationSyncMerge.js';
import { normalizeWord } from '../src/utils/dictationCheck.js';

function dataWith(words, lessonTitle = 'Bài 1') {
  let data = addLesson(emptyDictationData(), { title: lessonTitle, items: [{ english: words.join(' ') || 'x' }], now: 1000, lessonId: 'L1' }).data;
  words.forEach((word, i) => { data = saveWord(data, { word, sentence: data.sentences[0] }, 2000 + i).data; });
  return data;
}
const live = data => liveRecords(data.words);
const word = (id, extra = {}) => ({ id, word: id, lessonTitle: '', savedAt: 1, updatedAt: 1, ...extra });
const ids = list => list.map(w => w.id).sort();

function checkRound(round, pool, words) {
  assert.ok(pool.some(w => w.id === round.correct.id), 'answer comes from the filtered pool');
  assert.equal(round.cards.length, Math.min(MAX_CHOICES, words.length));
  assert.equal(round.cards.filter(c => c.id === round.correct.id).length, 1, 'answer shown exactly once');
  assert.equal(new Set(round.cards.map(c => c.id)).size, round.cards.length, 'no repeated card');
  assert.equal(new Set(round.cards.map(c => normalizeWord(c.word))).size, round.cards.length, 'no two cards read the same');
}

test('rounds: answer from the pool, 3 wrong choices that differ from it and from each other', () => {
  const words = live(dataWith(['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf']));
  const picker = createWordPicker();
  let previous = null;
  const positions = new Set();
  for (let i = 0; i < 500; i++) {
    const round = buildWordRound({ pool: words, words, previousId: previous, picker });
    checkRound(round, words, words);
    assert.notEqual(round.correct.id, previous, 'never the same word twice in a row');
    positions.add(round.cards.findIndex(c => c.id === round.correct.id));
    previous = round.correct.id;
  }
  assert.equal(positions.size, 4, 'the answer moves between all four places');
});

test('every pool word is asked once before any repeats', () => {
  const words = ['a1', 'b2', 'c3', 'd4', 'e5'].map(w => word(w));
  const picker = createWordPicker();
  let previous = null;
  const asked = [];
  for (let i = 0; i < 25; i++) { previous = picker.next(words, previous).id; asked.push(previous); }
  for (let start = 0; start < 25; start += 5) {
    const group = asked.slice(start, start + 5);
    assert.equal(new Set(group).size, 5, `cycle ${start / 5}: ${group}`);
  }
  assert.ok(asked.every((id, i) => i === 0 || id !== asked[i - 1]));
  assert.equal(new Set(asked).size, 5);
});

test('look-alike words never appear together', () => {
  const words = [word('us', { word: 'US' }), word('u-s', { word: 'U.S.' }), word('x2', { word: 'Us,' }), word('cat'), word('dog'), word('sun'), word('map')];
  const picker = createWordPicker();
  for (let i = 0; i < 300; i++) {
    const round = buildWordRound({ pool: words, words, picker });
    const keys = round.cards.map(c => normalizeWord(c.word));
    assert.equal(new Set(keys).size, keys.length, keys.join());
  }
});

test('a narrow filter borrows wrong choices from the other saved words', () => {
  const words = ['one', 'two', 'three', 'four', 'five'].map(w => word(w));
  const round = buildWordRound({ pool: [words[2]], words, picker: createWordPicker() });
  assert.equal(round.correct.id, 'three');
  checkRound(round, [words[2]], words);
  const two = buildWordRound({ pool: [words[0], words[1]], words, picker: createWordPicker() });
  checkRound(two, [words[0], words[1]], words);
  assert.ok(two.cards.some(c => c.id === 'one') && two.cards.some(c => c.id === 'two'), 'pool words used first');
});

test('fewer than 4 saved words: only the possible cards; none: no round', () => {
  for (const count of [1, 2, 3]) {
    const words = ['one', 'two', 'three'].slice(0, count).map(w => word(w));
    const picker = createWordPicker();
    const first = buildWordRound({ pool: words, words, picker });
    checkRound(first, words, words);
    assert.equal(first.cards.length, count);
    const second = buildWordRound({ pool: words, words, previousId: first.correct.id, picker });
    if (count > 1) assert.notEqual(second.correct.id, first.correct.id);
    else assert.equal(second.correct.id, 'one', 'a single word repeats');
    assert.notEqual(second.key, first.key, 'each question is a new round');
  }
  assert.equal(buildWordRound({ pool: [], words: [], picker: createWordPicker() }), null);
});

test('typed answer: case, punctuation and apostrophe style ignored; empty never matches', () => {
  const w = word("don't", { word: "Don't" });
  assert.equal(isTypedWord('don’t', w), true);
  assert.equal(isTypedWord('  DON\'T ', w), true);
  assert.equal(isTypedWord('dont', w), false);
  assert.equal(isTypedWord('don', w), false);
  assert.equal(isTypedWord('', word('x', { word: '—' })), false);
});

test('filters: lesson, heard wrong, never practised (combined as an intersection)', () => {
  const words = [
    word('a', { lessonTitle: 'Bài 10' }),
    word('b', { lessonTitle: 'Bài 2', listen: { d: { correct: 1, wrong: 0 } } }),
    word('c', { lessonTitle: 'Bài 2', listen: { d: { correct: 0, wrong: 2 }, e: { correct: 1, wrong: 0 } } }),
    word('d'),
  ];
  const options = practiceFilterOptions(words);
  assert.deepEqual(options.lessons.map(o => [o.label, o.count]), [['Bài 2', 2], ['Bài 10', 1], ['(Không rõ bài)', 1]]);
  assert.equal(options.wrongCount, 1);
  assert.equal(options.newCount, 2);
  const lesson2 = options.lessons[0].value;
  assert.deepEqual(ids(filterPracticeWords(words)), ['a', 'b', 'c', 'd']);
  assert.deepEqual(ids(filterPracticeWords(words, { lesson: lesson2 })), ['b', 'c']);
  assert.deepEqual(ids(filterPracticeWords(words, { lesson: NO_LESSON })), ['d']);
  assert.deepEqual(ids(filterPracticeWords(words, { wrongOnly: true })), ['c']);
  assert.deepEqual(ids(filterPracticeWords(words, { newOnly: true })), ['a', 'd']);
  assert.deepEqual(ids(filterPracticeWords(words, { lesson: lesson2, wrongOnly: true })), ['c']);
  assert.deepEqual(filterPracticeWords(words, { wrongOnly: true, newOnly: true }), []);
  assert.equal(ALL_LESSONS, '');
});

test('missing data: filters are not offered and nothing breaks', () => {
  assert.deepEqual(practiceFilterOptions([]), { lessons: [], wrongCount: 0, newCount: 0 });
  const bare = [{ id: 'x', word: 'x' }, { id: 'y', word: 'y', lessonTitle: '   ', listen: {} }, { id: 'z', word: 'z', lessonTitle: null, listen: { d: {} } }];
  const options = practiceFilterOptions(bare);
  assert.deepEqual(options.lessons, []);
  assert.equal(options.wrongCount, 0);
  assert.equal(options.newCount, 3);
  assert.equal(filterPracticeWords(bare, { newOnly: true }).length, 3);
});

test('answers update only that word’s listen counters, and survive sync merging', () => {
  let data = dataWith(['alpha', 'bravo']);
  data = recordWordListen(data, 'alpha', true, 'devA');
  data = recordWordListen(data, 'alpha', false, 'devA');
  const other = recordWordListen(dataWith(['alpha', 'bravo']), 'alpha', false, 'devB');
  const merged = mergeDictationData(data, other);
  const alpha = merged.words.find(w => w.id === 'alpha');
  assert.deepEqual(listenTotals(alpha), { correct: 1, wrong: 2 });
  assert.deepEqual(listenTotals(merged.words.find(w => w.id === 'bravo')), { correct: 0, wrong: 0 });
  assert.deepEqual(ids(filterPracticeWords(live(merged), { wrongOnly: true })), ['alpha']);
  assert.deepEqual(ids(filterPracticeWords(live(merged), { newOnly: true })), ['bravo']);
  assert.equal(validateDictationData(merged), '', 'same data shape as before (Sheet unchanged)');
  // Removed words leave the practice source.
  assert.deepEqual(ids(live(unsaveWord(merged, 'alpha', 9000))), ['bravo']);
});
