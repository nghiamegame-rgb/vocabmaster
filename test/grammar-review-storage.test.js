import assert from 'node:assert/strict';
import { test } from 'node:test';
import { saveGrammarReviewResult, LS_GRAMMAR_PENDING as pending, LS_GRAMMAR_STATS as stats, LS_GRAMMAR_REVIEW as review } from '../src/utils/grammarStorage.js';

test('diagnostics retain original failure and every rollback error without data', () => {
  const logs = [], values = new Map([[pending, 'false'], [stats, '{"private":"old"}'], [review, '{}']]);
  const originalConsole = console.error;
  const originalStorage = globalThis.localStorage;
  let rollback = false;
  console.error = (...args) => logs.push(args);
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) {
      if (key === review) { rollback = true; throw new DOMException('PRIVATE write message', 'QuotaExceededError'); }
      if (rollback) throw new DOMException('PRIVATE rollback message', 'SecurityError');
      values.set(key, value);
    },
  };
  try {
    assert.throws(() => saveGrammarReviewResult({ private: 'review' }, { private: 'stats' }), error => {
      assert.deepEqual(error.diagnostics, [
        { operation: 'setItem', key: review, errorType: 'QuotaExceededError' },
        { operation: 'rollback.setItem', key: stats, errorType: 'SecurityError' },
        { operation: 'rollback.setItem', key: pending, errorType: 'SecurityError' },
      ]);
      assert.ok(!JSON.stringify(logs).includes('PRIVATE'));
      assert.ok(!JSON.stringify(logs).includes('private'));
      return true;
    });
  } finally { console.error = originalConsole; globalThis.localStorage = originalStorage; }
});

test('read/security and serialization errors identify the operation before any write', () => {
  const originalConsole = console.error, originalStorage = globalThis.localStorage;
  console.error = () => {};
  globalThis.localStorage = { getItem() { throw new DOMException('private', 'SecurityError'); } };
  try {
    assert.throws(() => saveGrammarReviewResult({}, {}), error => {
      assert.deepEqual(error.diagnostics, [{ operation: 'getItem', key: pending, errorType: 'SecurityError' }]);
      return true;
    });
    const circular = {}; circular.self = circular;
    assert.throws(() => saveGrammarReviewResult({}, circular), error => {
      assert.deepEqual(error.diagnostics, [{ operation: 'stringify', key: stats, errorType: 'TypeError' }]);
      return true;
    });
  } finally { console.error = originalConsole; globalThis.localStorage = originalStorage; }
});
