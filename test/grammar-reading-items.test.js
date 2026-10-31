import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildReadingDraft, getReadingDestinations, saveReadingDraft, validateReadingItems,
} from '../src/utils/grammarReadingItems.js';
import { validateGrammarJSON, buildGrammarPrompt } from '../src/utils/grammarPrompt.js';
import { validateQuestion, mergeSavedQuestions } from '../src/utils/grammarSyncMerge.js';

const question = {
  schemaVersion: 2, type: 'sentence-analysis', savedId: 's1',
  sentence: 'Despite the rain, the students continued to work together.',
  vietnameseSentence: 'Mặc dù trời mưa, các sinh viên vẫn tiếp tục làm việc cùng nhau.',
  topic: 'Prepositions',
  grammarPoints: [{ category: 'Prepositions', phrase: 'Despite the rain', explanation: 'Despite + cụm danh từ chỉ sự nhượng bộ.' }],
  readingNotes: ['Các sinh viên vẫn làm việc dù trời mưa.'],
  readingItems: [
    { category: 'preposition', text: 'Despite the rain', explanation: 'Despite đứng trước cụm danh từ, chỉ sự nhượng bộ.', meaning: 'mặc dù trời mưa', usefulness: 'Giúp nhận ra hai ý trái ngược.', pattern: 'despite + noun phrase' },
    { category: 'collocation', text: 'work together', explanation: 'Cụm động từ chỉ việc cùng hợp tác.', meaning: 'cùng làm việc' },
    { category: 'structure', text: 'continued to work', pattern: 'continue + to-infinitive', explanation: 'Tiếp tục làm một việc.' },
  ],
};

test('new notes are validated on import, while old string notes remain supported', () => {
  assert.equal(validateGrammarJSON([question]).valid, true);
  assert.equal(validateReadingItems({ ...question, readingItems: undefined }), null);
  assert.equal(validateQuestion(question), null);
  for (const readingItems of [null, {}, ['old text'], [{ category: 'vocabulary', text: 'invented', explanation: 'x' }], [{ category: 'random', text: 'rain', explanation: 'x' }], [{ category: 'phrase', text: 'work together', explanation: '' }], [{ ...question.readingItems[0], pattern: 1 }]]) {
    assert.equal(validateGrammarJSON([{ ...question, readingItems }]).valid, false);
  }
  assert.equal(validateGrammarJSON([{ ...question, readingItems: [] }]).valid, true);
  const copy = structuredClone(question);
  const merged = mergeSavedQuestions([question], [{ ...question, userNotes: 'keep notes' }]);
  assert.deepEqual(merged[0].readingItems, copy.readingItems);
  assert.deepEqual(merged[0].readingNotes, copy.readingNotes);
  assert.deepEqual(question, copy);
  const prompt = buildGrammarPrompt({ count: 10 });
  assert.ok(prompt.includes('40% B1'));
  assert.ok(prompt.includes('20% harder B2'));
  assert.ok(prompt.includes('10% C1-style'));
  assert.ok(prompt.includes('NO A/B/C/D'));
  assert.ok(prompt.includes('readingItems'));
});

test('destinations and prefills keep English separate from notes and seed structure examples', () => {
  const [prep, collocation, structure] = question.readingItems;
  assert.deepEqual(getReadingDestinations(prep), ['vocab', 'structure']);
  assert.deepEqual(getReadingDestinations(collocation), ['vocab']);
  assert.deepEqual(getReadingDestinations(structure), ['structure']);
  for (const category of ['vocabulary', 'word-form', 'preposition', 'phrase', 'collocation']) assert.deepEqual(getReadingDestinations({ category }), ['vocab']);
  const vocab = buildReadingDraft(prep, question, 'vocab');
  assert.equal(vocab.english, prep.text);
  assert.equal(vocab.vietnamese, prep.meaning);
  assert.equal(vocab.wordType, 'Preposition');
  assert.ok(vocab.annotation.includes(prep.explanation));
  assert.ok(vocab.annotation.includes(prep.usefulness));
  const pattern = buildReadingDraft(structure, question, 'structure');
  assert.equal(pattern.english, structure.pattern);
  assert.equal(pattern.vietnamese, structure.explanation);
  assert.equal(pattern.example, question.sentence);
  assert.equal(pattern.topic, question.topic);
});

test('quick-add routes only new editable content into the correct store without overwrites', () => {
  const words = [{ id: 'w-old', english: ' WORK   TOGETHER ', annotation: 'keep', level: 5, currentStreak: 10 }];
  const structures = [{ id: 'gs-old', english: 'DESPITE + noun phrase', level: 4, notes: 'keep' }];
  const before = JSON.stringify({ words, structures });
  const addedWords = [], addedStructures = [];
  const stores = {
    words, structures,
    addWord: item => { addedWords.push(item); return true; },
    addStructure: item => { addedStructures.push(item); return { ok: true }; },
  };
  const duplicateWord = buildReadingDraft(question.readingItems[1], question, 'vocab');
  const duplicatePattern = buildReadingDraft(question.readingItems[0], question, 'structure');
  assert.equal(saveReadingDraft('vocab', duplicateWord, stores).ok, false);
  assert.equal(saveReadingDraft('structure', duplicatePattern, stores).ok, false);
  assert.equal(addedWords.length, 0); assert.equal(addedStructures.length, 0);
  const draft = buildReadingDraft(question.readingItems[0], question, 'vocab');
  assert.equal(saveReadingDraft('vocab', { ...draft, vietnamese: 'Nghĩa đã chỉnh' }, stores).ok, true);
  assert.equal(addedWords[0].vietnamese, 'Nghĩa đã chỉnh');
  assert.equal(addedWords[0].english, draft.english);
  assert.equal(addedWords[0].annotation, draft.annotation);
  assert.equal(addedStructures.length, 0);
  const pattern = buildReadingDraft(question.readingItems[2], question, 'structure');
  assert.equal(saveReadingDraft('structure', pattern, stores).ok, true);
  assert.equal(addedStructures[0].example, question.sentence);
  assert.ok(!('level' in addedStructures[0])); // Progress is initialized by the target store.
  assert.equal(JSON.stringify({ words, structures }), before);
  assert.equal(saveReadingDraft('vocab', { english: '', vietnamese: 'x' }, stores).ok, false);
  assert.equal(saveReadingDraft('unknown', draft, stores).ok, false);
  assert.equal(saveReadingDraft('vocab', draft, { addWord: () => false }).ok, false);
  assert.equal(saveReadingDraft('structure', pattern, { addStructure: () => ({ ok: false, error: 'duplicate' }) }).error, 'duplicate');
});
