import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GRAMMAR_TOPICS_DONE_KEY, parseTopicsDone, readTopicsDone, writeTopicsDone, setTopicDone,
} from '../src/utils/grammarTopicDone.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
}

test('parseTopicsDone: garbage, non-array, Mixed and duplicates are cleaned', () => {
  assert.deepEqual(parseTopicsDone(null), []);
  assert.deepEqual(parseTopicsDone('not json'), []);
  assert.deepEqual(parseTopicsDone('{"a":1}'), []);
  assert.deepEqual(parseTopicsDone('["Tenses","Tenses","Mixed",3,""]'), ['Tenses']);
});

test('setTopicDone adds/removes without mutating and never stores Mixed', () => {
  const start = ['Tenses'];
  assert.deepEqual(setTopicDone(start, 'Passive Voice', true), ['Tenses', 'Passive Voice']);
  assert.deepEqual(setTopicDone(['Tenses'], 'Tenses', false), []);
  assert.deepEqual(setTopicDone(['Tenses'], 'Tenses', true), ['Tenses']);
  assert.deepEqual(setTopicDone([], 'Mixed', true), []);
  assert.deepEqual(start, ['Tenses']);
});

test('write then read round-trips; broken storage never throws', () => {
  const storage = fakeStorage();
  assert.equal(writeTopicsDone(storage, ['Tenses', 'Conditionals']), true);
  assert.deepEqual(readTopicsDone(storage), ['Tenses', 'Conditionals']);
  assert.ok(GRAMMAR_TOPICS_DONE_KEY in storage.data);
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
  assert.deepEqual(readTopicsDone(broken), []);
  assert.equal(writeTopicsDone(broken, ['Tenses']), false);
  assert.equal(writeTopicsDone(null, ['Tenses']), false);
  assert.deepEqual(readTopicsDone(null), []);
});
