import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareGrammarImport, completeGrammarImport } from '../src/utils/grammarImport.js';

const reading = text => ({ category: 'phrase', text, explanation: 'Cụm hữu ích.' });
const notes = ['Lỗi hay gặp: quên that sau so.', 'Mẹo đọc hiểu: so that chỉ mục đích.'];
const item = extra => ({
  schemaVersion: 2, type: 'sentence-analysis', id: 's1',
  sentence: 'She left early so that she could catch the first train.',
  vietnameseSentence: 'Cô ấy đi sớm để kịp chuyến tàu đầu.', topic: 'Conjunctions',
  grammarPoints: [{ category: 'Conjunctions', phrase: 'so that', explanation: 'Chỉ mục đích.' }],
  readingItems: [reading('left early'), reading('catch the first train')], readingNotes: notes, ...extra,
});
const run = extra => prepareGrammarImport(JSON.stringify([item(extra)]));

test('a sentence with two reading items and both notes has no warning', () => {
  assert.deepEqual(run().warnings, []);
  assert.deepEqual(run({ readingNotes: notes.map(n => n.normalize('NFD')) }).warnings, []);
});

test('thin sentences warn but still import', () => {
  for (const extra of [
    { readingItems: [reading('left early')] },
    { readingItems: undefined },
    { readingNotes: undefined },
    { readingNotes: [notes[0]] },
    { readingNotes: [notes[1]] },
  ]) {
    const result = run(extra);
    assert.deepEqual(result.warnings, ['Câu 1: ít nội dung học'], JSON.stringify(extra));
    assert.deepEqual(result.errors, []);
    assert.equal(completeGrammarImport(result).valid, true);
  }
});

test('an invalid reading item does not count towards the two', () => {
  const result = run({ readingItems: [reading('left early'), reading('not in the sentence')] });
  assert.deepEqual(result.warnings, ['Câu 1: ít nội dung học']);
  assert.equal(completeGrammarImport(result, { excludedItems: result.optionalIssues.map(i => i.key) }).valid, true);
});
