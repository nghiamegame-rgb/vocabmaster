/**
 * Grammar review progress is stored one entry per row in sheet "Review" instead
 * of a single Meta!B1 cell (Google Sheets allows at most 50,000 characters per
 * cell). Legacy Meta!B1 data is still read and migrated on the first write.
 * Runs the real grammar-apps-script.js in a VM with in-memory sheets.
 * Run: node test/grammar-review-sheet.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const SECRET = 'test-secret';
const CELL_LIMIT = 50000;

function backend() {
  const sheets = new Map();
  function makeSheet() {
    const cells = new Map();
    return {
      cells,
      getLastRow: () => Math.max(0, ...[...cells.keys()].map(key => Number(key.split(',')[0]))),
      clearContents() { cells.clear(); },
      getRange(row, col, rows = 1, cols = 1) {
        const put = (key, value) => {
          if (typeof value === 'string' && value.length > CELL_LIMIT) throw new Error('Your input contains more than the maximum of 50000 characters in a single cell.');
          if (value === '') cells.delete(key); else cells.set(key, value);
        };
        return {
          getValue: () => cells.get(`${row},${col}`) ?? '',
          setValue(value) { put(`${row},${col}`, value); },
          getValues: () => Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => cells.get(`${row + i},${col + j}`) ?? '')),
          setValues(values) { values.forEach((r, i) => r.forEach((v, j) => put(`${row + i},${col + j}`, v))); },
          clearContent() { for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) cells.delete(`${row + i},${col + j}`); },
        };
      },
    };
  }
  const ss = { getSheetByName: name => sheets.get(name), insertSheet: name => sheets.set(name, makeSheet()) };
  const context = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush() {} },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => key === 'GRAMMAR_SYNC_SECRET' ? SECRET : null }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
  });
  vm.runInContext(readFileSync(new URL('../grammar-apps-script.js', import.meta.url), 'utf8'), context);
  return {
    sheets, ss,
    get: () => context.doGet({ parameter: { secret: SECRET } }),
    save: (savedQuestions, reviewProgress, expectedRevision) => context.doPost({ postData: { contents: JSON.stringify({ action: 'save', savedQuestions, reviewProgress, expectedRevision, secret: SECRET }) } }),
    seed(name, values) {
      ss.insertSheet(name);
      const sheet = sheets.get(name);
      for (const [key, value] of Object.entries(values)) sheet.cells.set(key, value);
    },
  };
}
const q = id => ({ savedId: id, sentence: `${id} _____ now.`, options: { A: 'a', B: 'b', C: 'c', D: 'd' }, answer: 'A', topic: 'Tenses' });
const rec = (n, extra = {}) => ({ level: (n % 5) + 1, wrongCount: n % 3, totalReviews: n % 7 + 1, lastReviewAt: 1731234567890 + n, nextReviewAt: 1731839367890 + n, ...extra });
const maxCell = sheets => Math.max(0, ...[...sheets.values()].flatMap(sheet => [...sheet.cells.values()].map(v => String(v).length)));
const reviewRows = b => b.sheets.get('Review')?.getRange(1, 1, b.sheets.get('Review').getLastRow(), 2).getValues() || [];

test('legacy data: Meta!B1 is still read, and the first write migrates it to the Review sheet', () => {
  const b = backend();
  const legacy = { q1: rec(1), q2: rec(2) };
  b.seed('SavedQuestions', { '1,1': JSON.stringify(q('q1')), '2,1': JSON.stringify(q('q2')) });
  b.seed('Meta', { '1,1': 4, '1,2': JSON.stringify(legacy) });
  assert.equal(b.sheets.has('Review'), false);
  const before = b.get();
  assert.equal(before.ok, true);
  assert.deepEqual(before.reviewProgress, legacy);
  assert.equal(before.revision, 4);

  const next = { ...legacy, q2: rec(2, { level: 5 }) };
  assert.equal(b.save([q('q1'), q('q2')], next, 4).ok, true);
  assert.ok(b.sheets.has('Review'), 'first write creates the Review sheet');
  assert.deepEqual(reviewRows(b), [['q1', JSON.stringify(next.q1)], ['q2', JSON.stringify(next.q2)]]);
  assert.throws(() => JSON.parse(b.sheets.get('Meta').getRange(1, 2).getValue()), 'Meta!B1 no longer holds progress JSON');
  assert.deepEqual(b.get().reviewProgress, next);
  // The pre-write backup keeps the legacy progress, row by row.
  assert.deepEqual(b.sheets.get('ReviewBackup').getRange(1, 1, 2, 2).getValues(), [['q1', JSON.stringify(legacy.q1)], ['q2', JSON.stringify(legacy.q2)]]);
});

test('new data: the Review sheet wins over a stale Meta!B1 and removed entries disappear', () => {
  const b = backend();
  b.seed('SavedQuestions', { '1,1': JSON.stringify(q('q1')), '2,1': JSON.stringify(q('q2')) });
  b.seed('Meta', { '1,1': 7, '1,2': JSON.stringify({ stale: rec(9) }) });
  b.seed('Review', { '1,1': 'q1', '1,2': JSON.stringify(rec(1)), '2,1': 'q2', '2,2': JSON.stringify(rec(2)) });
  assert.deepEqual(b.get().reviewProgress, { q1: rec(1), q2: rec(2) });
  assert.equal(b.save([q('q1'), q('q2')], { q1: rec(1, { level: 3 }) }, 7).ok, true);
  assert.deepEqual(b.get().reviewProgress, { q1: rec(1, { level: 3 }) });
  assert.equal(b.sheets.get('Review').getLastRow(), 1, 'extra rows are cleared');
  assert.equal(b.get().revision, 8);
});

test('more than 1,000 review entries never exceed the per-cell limit and round-trip exactly', () => {
  const b = backend();
  const questions = Array.from({ length: 1200 }, (_, i) => q(`gq_1731234567890_${String(i).padStart(5, '0')}`));
  const progress = Object.fromEntries(questions.map((item, i) => [item.savedId, rec(i)]));
  assert.ok(JSON.stringify(progress).length > CELL_LIMIT, 'the old single-cell layout could not hold this');
  const first = b.save(questions, progress, 0);
  assert.equal(first.ok, true, first.error);
  assert.ok(maxCell(b.sheets) <= CELL_LIMIT);
  assert.deepEqual(b.get().reviewProgress, progress);
  const fewer = Object.fromEntries(Object.entries(progress).slice(0, 1100));
  assert.equal(b.save(questions, fewer, 1).ok, true);
  assert.deepEqual(b.get().reviewProgress, fewer);
  assert.equal(b.sheets.get('ReviewBackup').getLastRow(), 1200, 'backup holds the previous 1,200 entries');
  assert.ok(maxCell(b.sheets) <= CELL_LIMIT);
});

test('a corrupt Review row blocks hydration instead of silently dropping progress', () => {
  const b = backend();
  b.seed('Meta', { '1,1': 1 });
  b.seed('Review', { '1,1': 'q1', '1,2': '{broken' });
  assert.equal(b.get().ok, false);
  assert.equal(b.save([q('q1')], { q1: rec(1) }, 1).ok, false);
  assert.equal(b.sheets.get('Review').getRange(1, 2).getValue(), '{broken');
});
