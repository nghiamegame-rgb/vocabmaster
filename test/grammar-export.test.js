import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildGrammarExportSource, prepareGrammarExport, createGrammarWorkbook } from '../src/utils/grammarExport.js';
import { getWords } from '../src/utils/storage.js';
import { getSavedQuestions } from '../src/utils/grammarStorage.js';
import { validateGrammarJSON } from '../src/utils/grammarPrompt.js';
import { inspectXlsx } from './helpers/inspect-xlsx.js';

const settings = { count: 5, topic: 'Tenses' };
const word = english => ({ english, annotation: 'PRIVATE', vietnamese: 'PRIVATE', id: 'PRIVATE', level: 5 });
const sentence = text => ({ sentence: text, userNotes: 'PRIVATE', hardMarked: true, savedId: 'PRIVATE' });
const prepare = (words = [], records = []) => prepareGrammarExport(buildGrammarExportSource(words, records, settings));

test('real XLSX has exactly two one-column sheets, literal text, all entries and no private data', async () => {
  const words = ['café', 'well‑known', 'in fact', '=1+1', '+SUM(A1:A2)', '@test', '-2', '001', 'Café', '  ', ...Array.from({ length: 130 }, (_, i) => `entry ${i}`)].map(word);
  const records = [sentence('A well‑known café serves coffee. ☕'), sentence(' A WELL-KNOWN CAFÉ serves coffee. ☕ '),
    { sentence: 'They _____ books.', answer: 'A', options: { A: 'purchase', B: 'PRIVATE' } },
    ...Array.from({ length: 125 }, (_, i) => sentence(`They purchase item ${i}.`))];
  const before = JSON.stringify([words, records]);
  const prepared = prepare(words, records);
  const workbook = inspectXlsx(Buffer.from(await (await createGrammarWorkbook(prepared)).arrayBuffer()));
  assert.deepEqual(workbook.sheets.map(s => s.name), ['Vocabulary', 'Grammar']);
  for (const [i, header] of ['English', 'Sentence'].entries()) {
    const sheet = workbook.sheets[i];
    assert.deepEqual(sheet.rows[0].map(c => c.value), [header]);
    assert.equal(sheet.formulas, 0);
    for (const row of sheet.rows) {
      assert.equal(row.length, 1);
      assert.match(row[0].ref, /^A\d+$/);
      assert.ok(['s', 'inlineStr', 'str'].includes(row[0].type));
    }
  }
  assert.deepEqual(workbook.sheets[0].rows.slice(1).map(r => r[0].value), prepared.data.vocab.map(([text]) => text));
  assert.deepEqual(workbook.sheets[1].rows.slice(1).map(r => r[0].value), prepared.data.grammar);
  assert.equal(prepared.data.vocab.length, 138);
  assert.equal(prepared.data.grammar.length, 127);
  assert.ok(prepared.data.grammar.includes('They purchase books.'));
  assert.ok(prepared.data.grammar.includes('A well‑known café serves coffee. ☕'));
  assert.ok(!JSON.stringify(workbook).includes('PRIVATE'));
  assert.equal(JSON.stringify([words, records]), before);
});

test('saved snapshot preserves punctuation; frequencies count distinct sentences with conservative boundaries', () => {
  const prepared = prepare(['art', 'in fact', 'go', 'went', "can't", 'can'].map(word), [
    'Art, art and ART belong here.', ' ART, art and ART belong here! ', 'The department went away.',
    'In, fact, we went away.', 'In. Fact is different.', "We can’t go.",
  ].map(sentence));
  assert.deepEqual(Object.fromEntries(prepared.data.vocab), { art: 1, 'in fact': 1, go: 1, went: 2, "can't": 1, can: 0 });
  assert.equal(prepared.data.grammar.length, 5);
  assert.ok(prepared.data.grammar.includes('We can’t go.'));
});

test('snapshot and settings are detached; workbook name and full prompt remain paired', () => {
  const words = [word('purchase')], records = [sentence('They purchase books.')];
  const source = buildGrammarExportSource(words, records, settings);
  const prepared = prepareGrammarExport(source);
  words.push(word('new')); records.push(sentence('They purchase food.')); source.snapshot.data.vocab[0][1] = 999;
  assert.deepEqual(prepared.data.vocab, [['purchase', 1]]);
  assert.ok(prepared.prompt.includes(prepared.workbookName));
  assert.ok(prepared.prompt.includes('"vocab":[["purchase",1]]'));
  assert.ok(!prepared.prompt.includes('They purchase books.'));
  for (const changed of [buildGrammarExportSource(words, records, settings), buildGrammarExportSource([word('purchase')], [sentence('They purchase books.')], { count: 10, topic: 'Mixed' })]) assert.notEqual(changed.key, prepared.key);
  for (const text of ['Read BOTH sheets', 'ask the user to attach it and STOP', '1–2 suitable', 'NOT mastery', 'inflections and irregular', 'B1–B2 DIFFICULTY POLICY', 'MAIN FOCUS: Tenses', 'Vietnamese', 'EXACT contiguous', 'JSON array only', 'unique ids s1 through s5']) assert.ok(prepared.prompt.includes(text), text);
  assert.ok(!prepared.prompt.includes('Optional properties on each sentence object: "id"'));
  const sample = Array.from({ length: 5 }, (_, i) => ({ schemaVersion: 2, type: 'sentence-analysis', id: `s${i + 1}`, sentence: `They purchase item ${i}.`, vietnameseSentence: 'Họ mua đồ.', topic: 'Tenses', grammarPoints: [{ category: 'Tenses', phrase: 'purchase', explanation: 'Hiện tại đơn.' }], readingItems: [] }));
  assert.equal(validateGrammarJSON(sample, settings).valid, true);
});

test('empty lists produce two header-only sheets; invalid/unavailable data blocks partial export', async () => {
  const empty = inspectXlsx(Buffer.from(await (await createGrammarWorkbook(prepare())).arrayBuffer()));
  assert.deepEqual(empty.sheets.map(s => s.rows.map(r => r.map(c => c.value))), [[['English']], [['Sentence']]]);
  for (const [words, records] of [[null, []], [[], undefined], [[{ english: null }], []], [[], [{ sentence: 'They _____ books.' }]], [[word('a'.repeat(32768))], []], [[word('bad\u0001text')], []]]) {
    const source = buildGrammarExportSource(words, records, settings);
    assert.ok(source.error);
    assert.throws(() => prepareGrammarExport(source));
  }
  assert.equal(prepare([word(''), word('   ')]).data.vocab.length, 0);
});

test('load diagnostics distinguish missing, malformed and inaccessible storage without writes', () => {
  const previous = globalThis.localStorage;
  try {
    for (const getter of [getWords, getSavedQuestions]) {
      globalThis.localStorage = { getItem: () => null };
      assert.deepEqual(getter({ withStatus: true }), { data: [], error: '' });
      for (const raw of ['{broken', '{}', 'null', '[null]']) {
        globalThis.localStorage = { getItem: () => raw };
        assert.ok(getter({ withStatus: true }).error);
      }
      globalThis.localStorage = { getItem: () => { throw new Error('blocked'); } };
      assert.ok(getter({ withStatus: true }).error);
    }
  } finally { globalThis.localStorage = previous; }
});

test('legacy fullwidth blank and curly punctuation use existing matching without rewriting readable text', () => {
  const prepared = prepare([word('café')], [{ sentence: 'The café ＿＿＿＿＿ today.', answer: 'A', options: { A: 'is “open”', B: 'PRIVATE' } }]);
  assert.deepEqual(prepared.data.grammar, ['The café is “open” today.']);
  assert.deepEqual(prepared.data.vocab, [['café', 1]]);
});
