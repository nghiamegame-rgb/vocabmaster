// Dictation Excel export: one sheet, one column of English sentences, nothing else.
// Needs Python in PATH for the independent xlsx reader. Run: node test/dictation-export.test.js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildDictationExportSentences, createDictationWorkbook, downloadDictationWorkbook,
  EXPORT_SHEET_NAME, EXPORT_COLUMN_WIDTH,
} from '../src/utils/dictationExport.js';
import { emptyDictationData, addLesson, deleteLesson, saveWord, recordSentenceResult } from '../src/utils/dictationModel.js';
import { parseLessonInput } from '../src/utils/dictationParse.js';
import { inspectXlsx } from './helpers/inspect-xlsx.js';

const lesson = (data, id, now, lines) => addLesson(data, { title: `Bài bí mật ${id}`, items: parseLessonInput(lines).items, now, lessonId: id }).data;

test('only the English part: translations and "|" tails never appear', () => {
  let data = lesson(emptyDictationData(), 'L1', 1000, 'I like tea. | Tôi thích trà.\nShe runs. | Cô ấy chạy | (ghi chú)');
  // A record that still carries the separator inside the English field.
  data = addLesson(data, { title: 'x', items: [{ english: 'We left early. | Chúng tôi đi sớm.', vietnamese: 'BẢN DỊCH' }], now: 2000, lessonId: 'L2' }).data;
  assert.deepEqual(buildDictationExportSentences(data), ['I like tea.', 'She runs.', 'We left early.']);
});

test('deleted sentences and saved words are not exported', () => {
  let data = lesson(emptyDictationData(), 'L1', 1000, 'Keep this one.');
  data = lesson(data, 'L2', 2000, 'Delete me.\nDelete me too.');
  data = saveWord(data, { word: 'umbrella', sentence: data.sentences[0] }, 2500).data;
  data = deleteLesson(data, 'L2', 3000);
  assert.deepEqual(buildDictationExportSentences(data), ['Keep this one.']);
});

test('repeats are dropped (trimmed, ignoring case); the first one is kept', () => {
  let data = lesson(emptyDictationData(), 'L1', 1000, 'Good morning.\nGOOD MORNING.\nGood morning!');
  data = addLesson(data, { title: 'two', items: [{ english: '   good morning.   ' }, { english: 'See you.' }, { english: 'Good   morning.' }], now: 2000, lessonId: 'L2' }).data;
  assert.deepEqual(buildDictationExportSentences(data), ['Good morning.', 'Good morning!', 'See you.']);
  // A deleted first copy does not hide a later copy that is still in use.
  assert.deepEqual(buildDictationExportSentences(deleteLesson(data, 'L1', 3000)), ['good morning.', 'See you.']);
});

test('order is lesson by lesson, then position — whatever the storage order', () => {
  let data = lesson(emptyDictationData(), 'later', 5000, 'Third.\nFourth.');
  data = lesson(data, 'earlier', 1000, 'First.\nSecond.');
  data = { ...data, sentences: [...data.sentences].reverse() };
  data = recordSentenceResult(data, 'later_1', true, 'dev', 9000);
  assert.deepEqual(buildDictationExportSentences(data), ['First.', 'Second.', 'Third.', 'Fourth.']);
});

test('one line per sentence; unusable characters removed; blank ones skipped', () => {
  const data = addLesson(emptyDictationData(), {
    title: 't', now: 1, lessonId: 'L',
    items: [{ english: 'Line one\r\ncontinues\there.' }, { english: 'bad\u0001char￿.' }, { english: '   ' }, { english: '| chỉ tiếng Việt' }],
  }).data;
  assert.deepEqual(buildDictationExportSentences(data), ['Line one continues here.', 'bad char .']);
});

test('nothing to export: empty list and no download', async () => {
  assert.deepEqual(buildDictationExportSentences(emptyDictationData()), []);
  const onlyDeleted = deleteLesson(lesson(emptyDictationData(), 'L1', 1000, 'Gone.'), 'L1', 2000);
  assert.deepEqual(buildDictationExportSentences(onlyDeleted), []);
  // There is no document here: any attempt to download would throw.
  assert.deepEqual(await downloadDictationWorkbook(emptyDictationData()), { sentences: 0 });
  assert.deepEqual(await downloadDictationWorkbook(onlyDeleted), { sentences: 0 });
});

test('real XLSX: one sheet, only column A, one sentence per row, no header or formulas', async () => {
  const long = `A very long sentence ${'and more '.repeat(60)}ends here.`;
  let data = lesson(emptyDictationData(), 'L1', 1000, 'Mr. Smith doesn’t like café coffee. ☕ | Ông Smith không thích.\n=SUM(A1:A9) is text.\n+1 is also text.');
  data = lesson(data, 'L2', 2000, long);
  data = saveWord(data, { word: 'coffee', sentence: data.sentences[0] }, 2500).data;
  data = recordSentenceResult(data, 'L1_0', false, 'dev', 3000);
  const sentences = buildDictationExportSentences(data);
  const book = inspectXlsx(Buffer.from(await (await createDictationWorkbook(sentences)).arrayBuffer()));
  assert.equal(EXPORT_SHEET_NAME, 'Câu tiếng Anh');
  assert.deepEqual(book.sheets.map(s => s.name), ['Câu tiếng Anh']);
  const [sheet] = book.sheets;
  assert.equal(sheet.formulas, 0);
  assert.equal(sheet.rows.length, 4);
  sheet.rows.forEach((row, i) => {
    assert.equal(row.length, 1, `row ${i + 1} has one cell`);
    assert.equal(row[0].ref, `A${i + 1}`);
    assert.ok(['s', 'inlineStr', 'str'].includes(row[0].type), row[0].type);
  });
  assert.deepEqual(sheet.rows.map(row => row[0].value),
    ['Mr. Smith doesn’t like café coffee. ☕', '=SUM(A1:A9) is text.', '+1 is also text.', long]);
  assert.equal(sheet.columns.length, 1);
  assert.deepEqual([sheet.columns[0].min, sheet.columns[0].max], ['1', '1']);
  assert.ok(Math.abs(Number(sheet.columns[0].width) - EXPORT_COLUMN_WIDTH) <= 1, `width ${sheet.columns[0].width}`);
  const everything = JSON.stringify(book);
  // No lesson name, translation, old sheet name or date (the test timestamps are in 1970).
  for (const secret of ['Bài bí mật', 'Ông Smith', 'Từ vựng', 'Câu hoàn chỉnh', '1970']) assert.ok(!everything.includes(secret), secret);
});
