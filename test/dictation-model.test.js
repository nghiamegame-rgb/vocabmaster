// Dictation data model: edits, tombstones, conflict-free merge, LocalStorage.
// Run: node test/dictation-model.test.js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  emptyDictationData, addLesson, deleteLesson, recordSentenceResult, saveWord, unsaveWord, recordWordListen, lessonsOf, lessonProgress,
} from '../src/utils/dictationModel.js';
import {
  mergeDictationData, validateDictationData, canonicalJson, liveRecords, listenTotals, totalCount,
} from '../src/utils/dictationSyncMerge.js';
import { readDictationData, writeDictationData, LS_DICTATION_DATA, getDictationDeviceId, readDictationPrefs } from '../src/utils/dictationStorage.js';

const items = [{ english: 'Hello there.', vietnamese: 'Xin chào.' }, { english: 'How are you?', vietnamese: '' }];
const lesson = (now = 1000, id = 'L1') => addLesson(emptyDictationData(), { title: 'Bài 1', items, now, lessonId: id });

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), map };
}

test('addLesson creates ordered sentences; lessonsOf groups them', () => {
  const { data, lessonId, lessonTitle } = lesson();
  assert.equal(lessonId, 'L1');
  assert.equal(lessonTitle, 'Bài 1');
  assert.deepEqual(data.sentences.map(s => [s.id, s.order, s.english]), [['L1_0', 0, 'Hello there.'], ['L1_1', 1, 'How are you?']]);
  assert.equal(validateDictationData(data), '');
  const [l] = lessonsOf(data);
  assert.equal(l.sentences.length, 2);
  assert.deepEqual(lessonProgress(l), { correct: 0, wrong: 0, todo: 2 });
});

test('results: last result wins, attempts counted per device', () => {
  let { data } = lesson();
  data = recordSentenceResult(data, 'L1_0', false, 'devA', 2000);
  data = recordSentenceResult(data, 'L1_0', true, 'devA', 2000);
  const s = data.sentences[0];
  assert.equal(s.lastResult, 'correct');
  assert.ok(s.lastResultAt > 2000, 'strictly increasing even with the same clock');
  assert.deepEqual(s.attempts, { devA: 2 });
  assert.deepEqual(lessonProgress(lessonsOf(data)[0]), { correct: 1, wrong: 0, todo: 1 });
});

test('saveWord: lower-case id, no duplicate record, tombstone and re-save', () => {
  let { data } = lesson();
  const sentence = data.sentences[0];
  let r = saveWord(data, { word: 'Hello,', sentence }, 3000);
  assert.equal(r.status, 'saved');
  data = r.data;
  assert.deepEqual(data.words.map(w => [w.id, w.word, w.sentence, w.lessonTitle]), [['hello', 'Hello', 'Hello there.', 'Bài 1']]);
  r = saveWord(data, { word: 'HELLO', sentence }, 3100);
  assert.equal(r.status, 'exists');
  assert.equal(r.data, data);
  data = recordWordListen(data, 'hello', true, 'devA');
  data = unsaveWord(data, 'hello', 4000);
  assert.equal(liveRecords(data.words).length, 0);
  assert.equal(data.words.length, 1, 'kept as tombstone');
  data = saveWord(data, { word: 'hello', sentence }, 4000).data;
  const w = data.words[0];
  assert.equal(w.deletedAt, undefined);
  assert.ok(w.updatedAt > 4000);
  assert.deepEqual(listenTotals(w), { correct: 1, wrong: 0 }, 'listen counters survive re-save');
  assert.equal(saveWord(data, { word: '—', sentence }).status, 'invalid');
});

test('deleteLesson tombstones its sentences only', () => {
  let { data } = lesson();
  data = addLesson(data, { title: 'Bài 2', items: [{ english: 'Bye.' }], now: 1500, lessonId: 'L2' }).data;
  data = deleteLesson(data, 'L1', 5000);
  assert.deepEqual(lessonsOf(data).map(l => l.id), ['L2']);
  assert.equal(data.sentences.length, 3);
});

test('merge is commutative and idempotent', () => {
  const base = lesson().data;
  let a = recordSentenceResult(base, 'L1_0', true, 'devA', 2000);
  a = saveWord(a, { word: 'there', sentence: a.sentences[0] }, 2100).data;
  let b = recordSentenceResult(base, 'L1_1', false, 'devB', 2050);
  b = deleteLesson(b, 'L1', 2200);
  const ab = mergeDictationData(a, b);
  const ba = mergeDictationData(b, a);
  assert.equal(canonicalJson(ab), canonicalJson(ba));
  assert.equal(canonicalJson(mergeDictationData(ab, ab)), canonicalJson(ab));
  assert.equal(canonicalJson(mergeDictationData(ab, a)), canonicalJson(ab));
  assert.equal(validateDictationData(ab), '');
});

test('an old device cannot revive deleted records', () => {
  const old = lesson().data;
  const deleted = deleteLesson(old, 'L1', 9000);
  const merged = mergeDictationData(old, deleted);
  assert.equal(liveRecords(merged.sentences).length, 0);
  let words = saveWord(old, { word: 'hello', sentence: old.sentences[0] }, 3000).data;
  const removed = unsaveWord(words, 'hello', 8000);
  assert.equal(liveRecords(mergeDictationData(words, removed).words).length, 0);
  assert.equal(liveRecords(mergeDictationData(removed, words).words).length, 0);
});

test('counters from two devices add up; replays do not double count', () => {
  let { data } = lesson();
  data = saveWord(data, { word: 'hello', sentence: data.sentences[0] }, 3000).data;
  let a = recordWordListen(data, 'hello', true, 'devA');
  a = recordWordListen(a, 'hello', false, 'devA');
  const b = recordWordListen(data, 'hello', true, 'devB');
  const merged = mergeDictationData(mergeDictationData(a, b), a);
  assert.deepEqual(listenTotals(merged.words[0]), { correct: 2, wrong: 1 });
  const r1 = recordSentenceResult(data, 'L1_0', true, 'devA', 4000);
  const r2 = recordSentenceResult(data, 'L1_0', false, 'devB', 4500);
  const m = mergeDictationData(r1, r2).sentences[0];
  assert.equal(m.lastResult, 'wrong', 'newest result wins');
  assert.equal(totalCount(m.attempts), 2);
});

test('validation rejects malformed data and duplicates', () => {
  const { data } = lesson();
  assert.notEqual(validateDictationData({ sentences: [{ ...data.sentences[0], english: '' }], words: [] }), '');
  assert.notEqual(validateDictationData({ sentences: [data.sentences[0], data.sentences[0]], words: [] }), '');
  assert.notEqual(validateDictationData({ sentences: [], words: [{ id: 'x', word: 'x', savedAt: 1, updatedAt: 1, listen: { d: { correct: -1 } } }] }), '');
  assert.notEqual(validateDictationData({ sentences: {} }), '');
});

test('storage: round trip, corrupt data locks without overwriting, own keys only', () => {
  const storage = memoryStorage({ vocabmaster_words: '[1]' });
  assert.deepEqual(readDictationData(storage), { data: emptyDictationData(), error: '' });
  const { data } = lesson();
  writeDictationData(data, storage);
  assert.equal(canonicalJson(readDictationData(storage).data), canonicalJson(mergeDictationData(data, {})));
  assert.deepEqual([...storage.map.keys()].sort(), [LS_DICTATION_DATA, 'vocabmaster_words']);
  const broken = memoryStorage({ [LS_DICTATION_DATA]: '{oops' });
  const read = readDictationData(broken);
  assert.match(read.error, /hỏng/);
  assert.equal(broken.map.get(LS_DICTATION_DATA), '{oops');
  assert.match(readDictationData({ getItem() { throw new Error('blocked'); } }).error, /chặn/);
  const device = memoryStorage();
  const id = getDictationDeviceId(device);
  assert.match(id, /^dev_/);
  assert.equal(getDictationDeviceId(device), id);
  assert.deepEqual(readDictationPrefs(memoryStorage({ vocabmaster_dictation_prefs: '{"speed":3,"loop":true}' })),
    { speed: 1, autoplay: true, loop: true, showTranslation: false });
});
