import assert from 'node:assert/strict';
import { test } from 'node:test';
import { editSentenceNote, notesForSentence, moveSentenceNotes, readSentenceNotes, writeSentenceNotes, LS_SENTENCE_NOTES } from '../src/utils/sentenceNotes.js';
import { packSentenceNotes } from '../src/utils/sentenceGeometry.js';

const sentence = '🎉 fox fox and fox.';
const draft = { key: `text:${sentence}`, sentence, start: 2, end: 5, text: 'con cáo', id: 'n1' };
test('exact Unicode positions, repeated phrases, overlap and same-range edits', () => {
  let map = editSentenceNote({}, draft, 1);
  map = editSentenceNote(map, { ...draft, id: 'n2', start: 6, end: 9 }, 2);
  map = editSentenceNote(map, { ...draft, id: 'n3', start: 3, end: 8, text: 'overlap' }, 3);
  map = editSentenceNote(map, { ...draft, id: 'replacement', text: 'fox · danh từ' }, 4);
  const notes = notesForSentence(map, draft.key, sentence);
  assert.equal(notes.length, 3);
  assert.equal(notes.find(n => n.start === 2).id, 'n1');
  assert.equal(notes.find(n => n.id === 'n1').quote, 'fox');
  assert.equal(notes.find(n => n.id === 'n2').quote, 'fox');
  assert.equal(notes.find(n => n.id === 'n1').text, 'fox · danh từ');
  assert.equal(notesForSentence(map, draft.key, 'a changed sentence').length, 0);
  assert.equal(notesForSentence(map, 'another_sentence_with_same_ai_id', sentence).length, 0);
});
test('empty drafts do not persist; clearing/deleting preserves other notes', () => {
  assert.deepEqual(editSentenceNote({}, { ...draft, text: '  ' }), {});
  const initial = editSentenceNote({}, draft, 1);
  const second = editSentenceNote(initial, { ...draft, key: 'gq_other', id: 'n2' }, 2);
  const result = editSentenceNote(second, { ...draft, text: '' });
  assert.equal(result[draft.key], undefined);
  assert.deepEqual(result.gq_other, second.gq_other);
  assert.equal(initial[draft.key][0].text, 'con cáo', 'no mutation of previous snapshot');
});
test('before-save notes move to savedId, preserving identity and plain text', () => {
  const source = editSentenceNote({}, { ...draft, text: '<script>plain text</script>' }, 10);
  const moved = moveSentenceNotes(source, sentence, 'gq_saved');
  assert.equal(moved[draft.key], undefined);
  const notes = notesForSentence(moved, 'gq_saved', sentence);
  assert.equal(notes[0].id, 'n1');
  assert.equal(notes[0].createdAt, source[draft.key][0].createdAt);
  assert.equal(notes[0].text, '<script>plain text</script>');
  assert.equal(source[draft.key].length, 1);
});
test('invalid ranges, whitespace, snapshots and corrupt storage fail safely', () => {
  for (const patch of [{ start: -1 }, { end: 999 }, { end: 2 }, { start: NaN }, { start: 1.5 }, { start: 1, end: 2 }]) {
    assert.deepEqual(editSentenceNote({}, { ...draft, ...patch }), {});
  }
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const saved = new Map([['vocabmaster_grammar_review', 'KEEP']]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value),
  } });
  try {
    const map = editSentenceNote({}, draft, 1);
    assert.equal(writeSentenceNotes(map), true);
    assert.deepEqual(readSentenceNotes(), map);
    assert.equal(saved.get('vocabmaster_grammar_review'), 'KEEP');
    saved.set(LS_SENTENCE_NOTES, JSON.stringify({ [draft.key]: [{ ...map[draft.key][0], end: 999 }, null] }));
    assert.deepEqual(readSentenceNotes()[draft.key], []);
    for (const bad of ['null', '[]', '{broken']) {
      saved.set(LS_SENTENCE_NOTES, bad); assert.deepEqual(readSentenceNotes(), {});
    }
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});
test('layout reserves separate rows for overlapping notes, anchored to final line', () => {
  const lines = [{ start: 0, end: 10, height: 28 }, { start: 10, end: 30, height: 28 }];
  const layout = packSentenceNotes(lines, [
    { id: 'a', start: 0, end: 8, left: 0, width: 180, height: 50 },
    { id: 'b', start: 3, end: 9, left: 20, width: 180, height: 75 },
    { id: 'c', start: 4, end: 22, left: 400, width: 240, height: 90 },
  ], 320);
  assert.ok(layout.padding[0] >= 125);
  assert.equal(layout.items.filter(item => item.id === 'c').length, 1);
  assert.ok(layout.items.find(item => item.id === 'c').top > 28 + layout.padding[0]);
  for (const item of layout.items) assert.ok(item.left >= 0 && item.left + item.width <= 320);
  const a = layout.items.find(item => item.id === 'a'), b = layout.items.find(item => item.id === 'b');
  assert.ok(a.top + a.height <= b.top);
});
test('compact measured labels share a row; only real collisions reserve another row', () => {
  const lines = [{ start: 0, end: 40, height: 28, contentBottom: 23 }];
  const short = [
    { id: 'educational', start: 0, end: 11, left: 20, width: 48, height: 16 },
    { id: 'materials', start: 12, end: 21, left: 85, width: 44, height: 16 },
  ];
  const compact = packSentenceNotes(lines, short, 320);
  assert.equal(compact.items[0].top, compact.items[1].top);
  assert.equal(compact.items[0].top, 29, 'six px below measured text bottom');
  assert.equal(compact.padding[0], 23, 'reserve only the annotation row plus gaps');
  assert.deepEqual(packSentenceNotes(lines, [], 320).padding, [0]);
  const collision = packSentenceNotes(lines, [...short,
    { id: 'overlap', start: 2, end: 20, left: 40, width: 100, height: 16 }], 320);
  assert.equal(new Set(collision.items.map(item => item.lane)).size, 2);
  assert.equal(collision.padding[0] - compact.padding[0], 22);
});
