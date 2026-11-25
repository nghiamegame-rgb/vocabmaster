// In-memory Google Sheet + real dictation-apps-script.js in a VM (no network).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function dictationBackend({ secret = 'test-secret' } = {}) {
  const sheets = new Map();
  let locked = false;
  function makeSheet(name) {
    const cells = new Map();
    return {
      cells,
      getName: () => name,
      getLastRow: () => Math.max(0, ...[...cells.keys()].map(key => Number(key.split(',')[0]))),
      clearContents() { cells.clear(); },
      getRange(row, col, rows = 1, cols = 1) {
        return {
          getValue: () => cells.get(`${row},${col}`) ?? '',
          setValue(value) { cells.set(`${row},${col}`, value); },
          getValues: () => Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => cells.get(`${row + i},${col + j}`) ?? '')),
          setValues(values) {
            assert.equal(values.length, rows, 'setValues row count matches range');
            values.forEach((r, i) => { assert.equal(r.length, cols, 'setValues column count matches range'); r.forEach((v, j) => cells.set(`${row + i},${col + j}`, v)); });
          },
          clearContent() { for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) cells.delete(`${row + i},${col + j}`); },
        };
      },
    };
  }
  const ss = { getSheetByName: name => sheets.get(name) || null, insertSheet: name => { const s = makeSheet(name); sheets.set(name, s); return s; } };
  const context = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush() {} },
    LockService: { getScriptLock: () => ({ tryLock() { if (locked) return false; locked = true; return true; }, releaseLock() { locked = false; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => (key === 'DICTATION_SYNC_SECRET' ? secret : null) }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
  });
  vm.runInContext(readFileSync(new URL('../../dictation-apps-script.js', import.meta.url), 'utf8'), context);
  return {
    sheets, context,
    get: (s = 'test-secret') => context.doGet({ parameter: { secret: s } }),
    post: (payload, s = 'test-secret') => context.doPost({ postData: { contents: JSON.stringify({ ...payload, secret: s }) } }),
    save: (data, expectedRevision) => context.doPost({ postData: { contents: JSON.stringify({ action: 'save', schema: 1, expectedRevision, sentences: data.sentences, words: data.words, secret: 'test-secret' }) } }),
  };
}

