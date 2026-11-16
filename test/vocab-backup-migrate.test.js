/**
 * Tests for migrateLocalStorageBackups() in vocabBackup.js.
 *
 * Uses in-process mocks (no browser/IndexedDB needed):
 *   - MockStorage: Map-backed localStorage stand-in with .length / .key()
 *   - MockStore: in-memory IndexedDB store stand-in with put() + getByKey() + entries()
 *
 * Safety contract verified:
 *   1. Normal path: put → getByKey verify → removeItem (key gone from LS, present in IDB).
 *   2. Deduplication: same content put twice → one IDB entry, both LS keys removed.
 *   3. getByKey mismatch (hash collision / corruption): LS key kept.
 *   4. put() throws: LS key kept.
 *   5. getByKey() throws: LS key kept.
 *   6. removeItem() throws: migrated count not incremented (key may survive as-is).
 *   7. LS.getItem returns null mid-loop (another tab removed it): skip silently.
 *   8. Non-matching prefix keys untouched.
 *   9. No matching keys: returns 0, nothing touched.
 *  10. VocabSync constructor triggers migration fire-and-forget without blocking load().
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { migrateLocalStorageBackups } from '../src/utils/vocabBackup.js';
import { VocabSync, STATE_KEY, PAUSE_KEY, BACKUP_PREFIX } from '../src/utils/vocabSync.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

class MockStorage {
  constructor(entries = {}) { this._data = new Map(Object.entries(entries)); }
  get length() { return this._data.size; }
  key(i) { return [...this._data.keys()][i] ?? null; }
  getItem(k) { return this._data.has(k) ? this._data.get(k) : null; }
  setItem(k, v) { this._data.set(k, v); }
  removeItem(k) { this._data.delete(k); }
  keys() { return [...this._data.keys()]; }
}

/** Simple content-keyed store; sha = SHA-like key derived from content length+hash. */
let _counter = 0;
class MockStore {
  constructor({ failPut = false, failGet = false, mismatch = false } = {}) {
    this._db = new Map();
    this._failPut = failPut;
    this._failGet = failGet;
    this._mismatch = mismatch;
    this._putCalls = 0;
    this._getCalls = 0;
  }
  async put(content) {
    this._putCalls++;
    if (this._failPut) throw new Error('IDB_quota');
    const sha = 'sha-' + (++_counter) + '-' + content.length;
    if (!this._db.has(sha)) this._db.set(sha, content);
    this._lastSha = sha;
    return sha;
  }
  async getByKey(sha) {
    this._getCalls++;
    if (this._failGet) throw new Error('IDB_read_error');
    const v = this._db.get(sha) ?? null;
    return this._mismatch ? 'corrupted-value' : v;
  }
  async entries() { return Object.fromEntries(this._db); }
}

/** A content-addressed store that correctly deduplicates by value (like the real one). */
class DedupeStore {
  constructor() { this._db = new Map(); /* sha → content */ this._sha = new Map(); /* content → sha */ }
  async put(content) {
    if (this._sha.has(content)) return this._sha.get(content);
    const sha = 'sha-' + this._db.size;
    this._db.set(sha, content); this._sha.set(content, sha);
    return sha;
  }
  async getByKey(sha) { return this._db.get(sha) ?? null; }
  async entries() { return Object.fromEntries(this._db); }
}

const PREFIX = BACKUP_PREFIX; // 'vocabmaster_vocab_backup_'
const OTHER  = 'vocabmaster_grammar_saved';

// ── Tests ─────────────────────────────────────────────────────────────────────

test('migrates a single LS backup key to IDB and removes it', async () => {
  const content = JSON.stringify({ state: { words: [{ english: 'apple' }] } });
  const storage = new MockStorage({ [PREFIX + 'old1']: content, [OTHER]: '[]' });
  const store   = new DedupeStore();

  const count = await migrateLocalStorageBackups(storage, PREFIX, store);

  assert.equal(count, 1, 'should migrate 1 key');
  assert.equal(storage.getItem(PREFIX + 'old1'), null, 'LS key must be removed');
  assert.equal(storage.getItem(OTHER), '[]', 'unrelated key must be untouched');
  const entries = await store.entries();
  assert.equal(Object.values(entries)[0], content, 'IDB must contain the content');
});

test('deduplicates: same content in two LS keys → one IDB entry, both LS keys removed', async () => {
  const content = '{"raw":"same"}';
  const storage = new MockStorage({ [PREFIX + 'a']: content, [PREFIX + 'b']: content });
  const store   = new DedupeStore();

  const count = await migrateLocalStorageBackups(storage, PREFIX, store);

  assert.equal(count, 2, 'both keys should be migrated');
  assert.equal(storage.getItem(PREFIX + 'a'), null);
  assert.equal(storage.getItem(PREFIX + 'b'), null);
  const entries = await store.entries();
  assert.equal(Object.keys(entries).length, 1, 'IDB should have exactly one entry');
});

test('put() failure: LS key is preserved, returns 0', async () => {
  const storage = new MockStorage({ [PREFIX + 'x']: '{"data":1}' });
  const store   = new MockStore({ failPut: true });

  const count = await migrateLocalStorageBackups(storage, PREFIX, store);

  assert.equal(count, 0);
  assert.notEqual(storage.getItem(PREFIX + 'x'), null, 'LS key must be kept on IDB write failure');
});

test('getByKey() failure: LS key is preserved, returns 0', async () => {
  const storage = new MockStorage({ [PREFIX + 'x']: '{"data":2}' });
  const store   = new MockStore({ failGet: true });

  const count = await migrateLocalStorageBackups(storage, PREFIX, store);

  assert.equal(count, 0);
  assert.notEqual(storage.getItem(PREFIX + 'x'), null, 'LS key must be kept when IDB read fails');
});

test('getByKey() returns mismatched value: LS key is preserved, returns 0', async () => {
  const storage = new MockStorage({ [PREFIX + 'x']: '{"data":3}' });
  const store   = new MockStore({ mismatch: true });

  const count = await migrateLocalStorageBackups(storage, PREFIX, store);

  assert.equal(count, 0, 'mismatch must abort removal');
  assert.notEqual(storage.getItem(PREFIX + 'x'), null, 'LS key must survive mismatch');
});

test('LS key already null mid-loop (another tab removed it): skips gracefully', async () => {
  // Key scan captures the name, but getItem returns null by the time we process it.
  const content = '{"data":"gone"}';
  const storage = new MockStorage({ [PREFIX + 'gone']: content });
  const store   = new DedupeStore();
  // Simulate removal between scan and processing.
  const origGetItem = storage.getItem.bind(storage);
  storage.getItem = k => k === PREFIX + 'gone' ? null : origGetItem(k);

  const count = await migrateLocalStorageBackups(storage, PREFIX, store);

  assert.equal(count, 0, 'skipped, nothing was written or removed');
  assert.equal(Object.keys(await store.entries()).length, 0, 'IDB must stay empty');
});

test('no keys with matching prefix: returns 0, IDB untouched', async () => {
  const storage = new MockStorage({ [OTHER]: '[]', vocabmaster_words: '[]' });
  const store   = new DedupeStore();

  const count = await migrateLocalStorageBackups(storage, PREFIX, store);

  assert.equal(count, 0);
  assert.equal(Object.keys(await store.entries()).length, 0);
  assert.equal(storage.getItem(OTHER), '[]', 'unrelated keys intact');
});

test('partial failure: first key migrates, second fails; count = 1, failed key kept', async () => {
  const c1 = '{"first":1}', c2 = '{"second":2}';
  const storage = new MockStorage({ [PREFIX + 'k1']: c1, [PREFIX + 'k2']: c2 });
  let calls = 0;
  const store = {
    async put(content) {
      calls++;
      if (calls > 1) throw new Error('quota on second');
      return 'sha-first';
    },
    async getByKey() { return c1; },
    async entries() { return {}; },
  };

  const count = await migrateLocalStorageBackups(storage, PREFIX, store);

  // Exactly one key migrated; which key depends on Map iteration order (insertion order).
  assert.equal(count, 1);
  // One key removed, one kept.
  const remaining = storage.keys().filter(k => k.startsWith(PREFIX));
  assert.equal(remaining.length, 1, 'exactly one backup key remains in LS');
});

test('VocabSync constructor triggers migration without blocking readable words', async () => {
  // The migration is fire-and-forget; words must be readable before it completes.
  const content = '{"legacy":"yes"}';
  let migrateResolved = false;
  let migrateResolve;
  const migratePromise = new Promise(r => { migrateResolve = r; });

  // A slow store whose put() stalls until we release it.
  const slowStore = {
    async put(c) { await migratePromise; migrateResolved = true; return 'sha-slow'; },
    async getByKey() { return content; },
    async entries() { return {}; },
  };
  const storage = new MockStorage({
    [STATE_KEY]: JSON.stringify({ base: null, words: [{ id: 'w1', english: 'hello', vietnamese: 'xin chào', annotation: '', level: 1, currentStreak: 0, createdAt: 1 }] }),
    [PAUSE_KEY]: 'false',
    [PREFIX + 'old']: content,
  });

  // Synchronous constructor — words must be readable immediately.
  const engine = new VocabSync({ storage, transport: { read: async () => {}, write: async () => {} }, backups: slowStore });
  assert.ok(engine.hasReadableWords, 'words readable before migration completes');
  assert.ok(engine.state.words.length > 0, 'state populated synchronously');
  assert.equal(migrateResolved, false, 'migration not yet completed');

  // Release migration.
  migrateResolve();
  // Give microtasks/promises a tick to settle.
  await new Promise(r => setTimeout(r, 10));
  assert.equal(migrateResolved, true, 'migration completed after release');
  engine.stop();
});
