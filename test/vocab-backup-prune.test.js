/**
 * Vocabulary IndexedDB backups are pruned: at least the 30 most recent routine
 * snapshots are kept, archive/conflict/adopt backups, backups that existed
 * before this version and the oldest surviving backup are never deleted, and an
 * edit no longer backs up the unchanged previous state a second time.
 * Uses the real vocabBackup.js/vocabSync.js with an in-memory IndexedDB.
 * Run: node test/vocab-backup-prune.test.js
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installFakeIndexedDB } from './helpers/fake-indexeddb.js';
import { createVocabBackupStore, BACKUP_DB, BACKUP_KEEP_RECENT } from '../src/utils/vocabBackup.js';
import { VocabSync, STATE_KEY, PAUSE_KEY } from '../src/utils/vocabSync.js';

const databases = installFakeIndexedDB();
const content = map => [...(map?.values() || [])];
const backupMap = () => databases.get(BACKUP_DB)?.stores.get('backups');
const dataKeys = () => [...(backupMap()?.keys() || [])].filter(key => /^[0-9a-f]{64}$/.test(key));
const reset = () => databases.clear();

class MockStorage {
  constructor(entries = {}) { this.data = new Map(Object.entries(entries)); }
  get length() { return this.data.size; }
  key(i) { return [...this.data.keys()][i] ?? null; }
  getItem(k) { return this.data.has(k) ? this.data.get(k) : null; }
  setItem(k, v) { this.data.set(k, String(v)); }
  removeItem(k) { this.data.delete(k); }
}
const word = (id, level = 1) => ({ id, english: id, vietnamese: 'nghĩa', annotation: '', level, currentStreak: 0, createdAt: 1 });

test('keeps at least the 30 most recent routine backups and the oldest one, with a bounded total', async () => {
  reset();
  assert.equal(BACKUP_KEEP_RECENT, 30);
  const store = createVocabBackupStore();
  const keys = [];
  for (let i = 0; i < 120; i++) keys.push(await store.put(JSON.stringify({ state: { n: i } }), 'state'));
  const alive = new Set(dataKeys());
  assert.ok(alive.size <= BACKUP_KEEP_RECENT + 10, `bounded, got ${alive.size}`);
  for (const key of keys.slice(-30)) assert.ok(alive.has(key), 'recent backup kept');
  assert.ok(alive.has(keys[0]), 'oldest surviving backup kept');
  const entries = await store.entries();
  assert.equal(Object.keys(entries).length, alive.size, 'metadata is not exported as backups');
});

test('archive/conflict/adopt backups and pre-existing backups are never pruned', async () => {
  reset();
  // A backup written by the previous version (no metadata) must survive.
  const legacyStore = createVocabBackupStore();
  const legacyKey = await legacyStore.put(JSON.stringify({ raw: 'old', legacy: '[]' }));
  const store = createVocabBackupStore();
  const archives = [];
  for (const [i, reason] of ['generation-or-legacy', 'concurrent-edit-or-deletion'].entries()) {
    archives.push(await store.put(JSON.stringify({ reason, data: [i] }), 'archive'));
  }
  const migrated = await store.put('{"from":"localStorage"}');
  for (let i = 0; i < 100; i++) await store.put(JSON.stringify({ state: { n: i } }), 'state');
  const alive = new Set(dataKeys());
  for (const key of [legacyKey, ...archives, migrated]) assert.ok(alive.has(key));
  // A routine snapshot that is later archived becomes protected.
  const shared = JSON.stringify({ state: { shared: true } });
  const sharedKey = await store.put(shared, 'state');
  await store.put(shared, 'archive');
  for (let i = 0; i < 100; i++) await store.put(JSON.stringify({ state: { m: i } }), 'state');
  assert.ok(new Set(dataKeys()).has(sharedKey));
});

test('a single backup is never deleted', async () => {
  reset();
  const store = createVocabBackupStore();
  const key = await store.put('{"only":true}', 'state');
  assert.deepEqual(dataKeys(), [key]);
});

test('many consecutive gradings keep the backup count bounded and keep the archive', async () => {
  reset();
  const storage = new MockStorage({ [STATE_KEY]: JSON.stringify({ base: null, words: [word('alpha'), word('beta')] }), [PAUSE_KEY]: 'true' });
  const engine = new VocabSync({ storage, transport: { read: async () => { throw new Error('offline'); }, write: async () => { throw new Error('offline'); } } });
  await engine.archive('concurrent-edit-or-deletion', [word('kept-conflict')]);
  for (let i = 0; i < 150; i++) {
    await engine.edit(words => words.map(w => w.id === 'alpha' ? { ...w, currentStreak: i + 1, lastReviewedDate: 1000 + i } : w));
  }
  const values = content(backupMap()).filter(value => !String(value).startsWith('{"at"'));
  assert.ok(dataKeys().length <= BACKUP_KEEP_RECENT + 15, `bounded, got ${dataKeys().length}`);
  assert.ok(values.some(value => value.includes('kept-conflict')), 'archive kept');
  assert.ok(values.some(value => {
    try { return JSON.parse(JSON.parse(value).raw).words[0].currentStreak === 150; } catch { return false; }
  }), 'latest state backed up');
  assert.equal(JSON.parse(storage.getItem(STATE_KEY)).words[0].currentStreak, 150);
});

test('an edit backs up only the new state when storage did not change since the last backup', async () => {
  reset();
  const storage = new MockStorage({ [STATE_KEY]: JSON.stringify({ base: null, words: [word('alpha')] }), [PAUSE_KEY]: 'true' });
  const engine = new VocabSync({ storage, transport: { read: async () => { throw new Error('offline'); }, write: async () => { throw new Error('offline'); } } });
  const calls = [];
  const put = engine.backups.put.bind(engine.backups);
  engine.backups.put = (value, kind) => { calls.push(kind); return put(value, kind); };
  await engine.edit(words => words.map(w => ({ ...w, level: 2 })));
  calls.length = 0;
  await engine.edit(words => words.map(w => ({ ...w, level: 3 })));
  assert.deepEqual(calls, ['state'], 'unchanged previous state is not backed up again');
  // Another tab changed the cache: its state is protected before being overwritten.
  storage.setItem(STATE_KEY, JSON.stringify({ base: null, words: [word('alpha', 4), word('other-tab')] }));
  calls.length = 0;
  await engine.edit(words => words.map(w => ({ ...w, level: 5 })));
  assert.deepEqual(calls, ['pre-write', 'state']);
});
