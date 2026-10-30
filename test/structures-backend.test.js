import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { mergeStructures } from '../src/utils/grammarSyncMerge.js';

// Execute actual Apps Script entry points entirely in memory.
export function backend() {
  const sheets = new Map();
  let locked = false;
  function makeSheet() {
    const cells = new Map();
    return {
      getLastRow: () => Math.max(0, ...[...cells.keys()].map(key => Number(key.split(',')[0]))),
      clearContents() { cells.clear(); },
      getRange(row, col, rows = 1, cols = 1) {
        return {
          getValue: () => cells.get(`${row},${col}`) ?? '',
          setValue(value) { cells.set(`${row},${col}`, value); },
          getValues: () => Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => cells.get(`${row + i},${col + j}`) ?? '')),
          setValues(values) { values.forEach((r, i) => r.forEach((v, j) => cells.set(`${row + i},${col + j}`, v))); },
          clearContent() { for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) cells.delete(`${row + i},${col + j}`); },
        };
      },
    };
  }
  const ss = { getSheetByName: name => sheets.get(name), insertSheet: name => sheets.set(name, makeSheet()) };
  const context = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush() {} },
    LockService: { getScriptLock: () => ({ tryLock() { if (locked) return false; locked = true; return true; }, releaseLock() { locked = false; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
  });
  vm.runInContext(readFileSync(new URL('../grammar-apps-script.js', import.meta.url), 'utf8'), context);
  return {
    sheets, context,
    get: () => context.doGet({ parameter: { scope: 'structures' } }),
    post: payload => context.doPost({ postData: { contents: JSON.stringify(payload) } }),
  };
}
const item = (extra = {}) => ({ id: 's1', english: 'despite + noun', vietnamese: 'meaning', level: 3, createdAt: 1, updatedAt: 1, ...extra });
const payload = (structures, expectedRevision) => ({ action: 'saveStructures', structuresSchema: 1, structures, expectedRevision });

test('actual backend: CAS, backup, stale/empty rejection, independent grammar writes', () => {
  const b = backend();
  assert.equal(b.get().structuresRevision, 0);
  const s = item();
  assert.equal(b.post(payload([s], 0)).ok, true);
  const firstSaved = b.get().structures[0];
  assert.equal(b.post(payload([s], 0)).error, 'conflict');
  assert.equal(b.post(payload([], 1)).error, 'conflict');
  const latest = mergeStructures([item({ notes: 'phone', updatedAt: 2 })], b.get().structures);
  assert.equal(b.post(payload(latest, 1)).ok, true);
  assert.equal(b.sheets.get('StructuresBackup').getRange(2, 1).getValue(), JSON.stringify(firstSaved));
  assert.equal(b.post(payload([s], 2)).error, 'conflict');
  const q = { savedId: 'q1', sentence: 'Test _____', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, answer: 'A', topic: 'Tenses' };
  assert.equal(b.post({ action: 'save', savedQuestions: [q], reviewProgress: { q1: { level: 4 } }, expectedRevision: 0 }).ok, true);
  assert.equal(b.get().structuresRevision, 2);
  assert.equal(b.get().structures[0].notes, 'phone');
  assert.equal(b.post(payload(mergeStructures([item({ deletedAt: 100 })], latest), 2)).ok, true);
  assert.equal(b.sheets.get('Meta').getRange(1, 1).getValue(), 1);
  assert.equal(b.sheets.get('Meta').getRange(1, 2).getValue(), '{"q1":{"level":4}}');
  assert.equal(b.sheets.get('SavedQuestions').getRange(1, 1).getValue(), JSON.stringify(q));
  assert.equal(b.post(payload(latest, 3)).error, 'conflict');
});

test('actual backend rejects malformed rows and events without erasing data', () => {
  const b = backend();
  assert.equal(b.post(payload([item({ reviewEvents: { bad: { at: 'oops', correct: true } } })], 0)).error, 'validation');
  assert.equal(b.post(payload([item(), item()], 0)).error, 'validation');
  b.get();
  b.sheets.get('Structures').getRange(1, 1).setValue('broken JSON');
  assert.equal(b.get().ok, false);
  assert.equal(b.post(payload([], 0)).ok, false);
  assert.equal(b.sheets.get('Structures').getRange(1, 1).getValue(), 'broken JSON');
});

test('actual backend rolls back failed writes; interrupted transactions block hydration', () => {
  const b = backend();
  b.post(payload([item()], 0));
  const previous = JSON.stringify(b.get());
  let flushes = 0;
  b.context.SpreadsheetApp.flush = () => { if (++flushes === 2) throw new Error('simulated write failure'); };
  const changed = mergeStructures([item({ notes: 'new', updatedAt: 2 })], b.get().structures);
  assert.equal(b.post(payload(changed, 1)).ok, false);
  assert.equal(JSON.stringify(b.get()), previous);
  b.sheets.get('Meta').getRange(1, 6).setValue('structures-write-in-progress');
  assert.equal(b.get().ok, false);
  assert.equal(b.post(payload(changed, 1)).ok, false);
  assert.ok(b.sheets.get('StructuresBackup').getRange(2, 1).getValue());
});

test('frontend and Apps Script merges agree for offline progress and tombstones', () => {
  const b = backend();
  const base = { level: 3, currentStreak: 0, totalReviews: 0, wrongCount: 0, lastReviewedAt: null, nextReviewAt: null };
  const laptop = item({ reviewBase: base, reviewEvents: { a: { at: 10, correct: true } }, notes: '', updatedAt: 10 });
  const phone = item({ reviewBase: base, reviewEvents: { b: { at: 20, correct: false } }, notes: 'old', updatedAt: 5, deletedAt: 30 });
  const merged = mergeStructures([laptop], [phone]);
  assert.deepEqual(JSON.parse(JSON.stringify(b.context.mergeStructures([laptop], [phone]))), merged);
  assert.equal(b.post(payload([laptop], 0)).ok, true);
  assert.equal(b.post(payload(merged, 1)).ok, true);
  assert.equal(b.get().structures[0].totalReviews, 2);
  assert.equal(b.get().structures[0].level, 2);
  assert.equal(b.get().structures[0].deletedAt, 30);
});
