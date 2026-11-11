import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { VocabSync, reconcile, STATE_KEY, PAUSE_KEY, BACKUP_PREFIX, equal } from '../src/utils/vocabSync.js';
import proxy from '../api/vocab-sync.js';
const w = (id, extra = {}) => ({ id, english: id, vietnamese: 'meaning', annotation: 'note', level: 2, currentStreak: 1, createdAt: 1, ...extra });
const snap = (words = [], extra = {}) => ({ protocol: 1, generation: 'g1', revision: 0, words, tombstones: [], ...extra });
const copy = x => JSON.parse(JSON.stringify(x));
class Storage {
  constructor(data = {}) { this.data = new Map(Object.entries(data)); }
  getItem(k) { return this.data.get(k) ?? null; }
  setItem(k, v) { this.data.set(k, v); }
}
class Backups {
  constructor() { this.data = new Map(); }
  async put(content) { this.data.set(content, content); }
  async entries() { return Object.fromEntries(this.data); }
}
function backend() {
  const props = new Map(), files = new Map(); let index = 0, mirror = [], failMirror = false;
  const properties = { getProperty: k => props.get(k) ?? null, setProperty: (k, v) => props.set(k, v), deleteProperty: k => props.delete(k) };
  const file = (id, text) => ({ getId: () => id, getBlob: () => ({ getDataAsString: () => text }) });
  const context = vm.createContext({ console, Set, JSON, Number, Object, Error,
    PropertiesService: { getScriptProperties: () => properties },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    DriveApp: { createFile: (name, text) => { const id = String(++index); const f = file(id, text); files.set(id, f); return f; }, getFileById: id => { if (!files.has(id)) throw Error('missing'); return files.get(id); } },
    SpreadsheetApp: { flush() {}, getActiveSpreadsheet: () => ({ getSheets: () => [{ getLastRow: () => mirror.length, getRange: () => ({ setValues: rows => { if (failMirror) throw Error('mirror_failure'); mirror = rows; } }) }] }) },
    Utilities: { getUuid: () => crypto.randomUUID(), DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 }, computeDigest: (_, text) => [...crypto.createHash('sha256').update(text).digest()] },
    ContentService: { MimeType: { JSON: 1 }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
  });
  vm.runInContext(fs.readFileSync('google-apps-script.js', 'utf8'), context);
  props.set('VOCAB_SYNC_SECRET', 'test-secret');
  const init = s => context.vocabCommit(copy(s));
  const read = () => context.doGet({ parameter: { secret: 'test-secret' } });
  const post = p => context.doPost({ postData: { contents: JSON.stringify(Array.isArray(p) ? p : { ...p, secret: 'test-secret' }) } });
  const transport = { read: async () => { const r = read(); if (!r.ok) throw Error(r.error); return r; }, write: async p => { const r = post(p); if (!r.ok) throw Error(r.error); return r; } };
  return { context, props, files, init, read, post, transport, fail: () => { failMirror = true; } };
}
function client(b, base, words = base?.words || [], extra = {}) {
  const storage = new Storage({ [STATE_KEY]: JSON.stringify({ base, words }), [PAUSE_KEY]: 'false', vocabmaster_grammar_saved: 'KEEP', vocabmaster_stats: 'KEEP' });
  const c = new VocabSync({ storage, transport: b.transport, backups: new Backups(), ...extra }); c.active = true;
  return c;
}
function payload(s, words, tombstones = []) { return { protocol: 1, generation: s.generation, expectedRevision: s.revision, requestId: crypto.randomUUID(), words, tombstones, confirmEmpty: !words.length }; }
function enabled(words = []) { const b = backend(); b.init(snap(words)); b.context.resumeVocabularyWrites(); return b; }

test('legacy phone adopts clean snapshot, archives all 614 entries, never uploads', async () => {
  const b = enabled([w('VSTEP')]); let writes = 0;
  const c = client(b, null, Array.from({ length: 614 }, (_, n) => w('old' + n)), { transport: { read: b.transport.read, write: async () => { writes++; } } });
  await c.sync(); assert.equal(writes, 0); assert.deepEqual(c.state.words, [w('VSTEP')]);
  assert.ok([...c.backups.data.values()].some(v => v.includes('old613')));
  assert.equal(c.storage.getItem('vocabmaster_grammar_saved'), 'KEEP'); assert.equal(c.storage.getItem('vocabmaster_stats'), 'KEEP'); c.stop();
});
test('old generation with pending additions is quarantined after replacement', async () => {
  const b = enabled([w('clean')]); const c = client(b, snap([w('old')], { generation: 'old' }), [w('old'), w('useful-offline')]);
  await c.sync(); assert.deepEqual(c.state.words, [w('clean')]); assert.equal(b.read().revision, 0); assert.match(c.notice, /Vocabulary/); c.stop();
});
test('backend rejects legacy, outdated generation/revision, tombstone loss and missing deletion', () => {
  const b = enabled([w('a')]); const s = b.read();
  assert.equal(b.post([w('legacy')]).error, 'protocol_required');
  assert.equal(b.post({ words: [] }).error, 'protocol_required');
  assert.equal(b.post({ ...payload(s, []), generation: 'old' }).error, 'generation');
  assert.equal(b.post({ ...payload(s, []), expectedRevision: 99 }).error, 'conflict');
  assert.equal(b.post(payload(s, [])).error, 'missing_deletion');
  assert.equal(b.post(payload(s, [], ['a'])).ok, true);
  assert.equal(b.post(payload(b.read(), [w('a')])).error, 'lost_tombstone');
});
test('deleting last word commits explicit empty snapshot; stale device cannot resurrect it', async () => {
  const b = enabled([w('a')]); const old = copy(b.read());
  const a = client(b, old, []); await a.sync(); assert.equal(b.read().words.length, 0);
  const phone = client(b, old); await phone.sync(); assert.equal(phone.state.words.length, 0);
  assert.deepEqual(b.read().tombstones, ['a']); a.stop(); phone.stop();
});
test('offline additions and distinct concurrent updates are preserved', async () => {
  const b = enabled([w('a'), w('b')]), old = copy(b.read());
  const a = client(b, old, [w('a', { annotation: 'A' }), w('b'), w('new-a')]); await a.sync();
  const phone = client(b, old, [w('a'), w('b', { annotation: 'B' }), w('new-b')]); await phone.sync();
  assert.deepEqual(b.read().words.map(x => x.id).sort(), ['a','b','new-a','new-b']);
  assert.equal(b.read().words.find(x => x.id === 'a').annotation, 'A'); assert.equal(b.read().words.find(x => x.id === 'b').annotation, 'B'); a.stop(); phone.stop();
});
test('same-record conflict preserves local note in backup, deletion beats stale edits', () => {
  const base = snap([w('a')]);
  assert.equal(reconcile(base, [w('a', { annotation: 'local' })], snap([w('a', { annotation: 'remote' })])).conflicts[0].annotation, 'local');
  const result = reconcile(base, [w('a', { annotation: 'local' })], snap([], { tombstones: ['a'] }));
  assert.equal(result.words.length, 0); assert.equal(result.conflicts.length, 1);
});
test('failed GET and malformed empty response preserve pending data; no success', async () => {
  for (const read of [async () => { throw Error('offline'); }, async () => ({ data: [] })]) {
    const b = enabled(); const c = client(b, snap(), [w('new')], { transport: { read, write: async () => assert.fail('unexpected POST') } });
    await c.sync(); assert.equal(c.status, 'error'); assert.equal(c.state.words[0].id, 'new'); c.stop();
  }
});
test('false ACK with equal counts, opaque response, network failure cannot report success', async () => {
  for (const write of [async () => snap([w('wrong')], { revision: 1 }), async () => undefined, async () => { throw Error('failed'); }]) {
    const b = enabled(); const c = client(b, snap(), [w('new')], { transport: { read: b.transport.read, write } });
    await c.sync(); assert.equal(c.status, 'error'); assert.equal(c.state.words[0].id, 'new'); c.stop();
  }
});
test('edits during POST remain pending and are sent on next sync', async () => {
  const b = enabled(); let release;
  const c = client(b, snap(), [w('a')], { transport: { read: b.transport.read, write: p => new Promise(resolve => { release = () => resolve(b.post(p)); }) } });
  const running = c.sync(); await new Promise(resolve => setImmediate(resolve));
  await c.edit(words => [...words, w('b')]); release(); await running;
  assert.equal(c.state.words.length, 2); assert.equal(c.state.base.words.length, 1);
  c.transport = b.transport; await c.sync(); assert.equal(b.read().words.length, 2); c.stop();
});
test('pause cancels queued writes; pause during GET prevents POST; default is paused', async () => {
  const b = enabled(); let release;
  const c = client(b, snap(), [w('a')], { delay: 5, transport: { read: () => new Promise(resolve => { release = () => resolve(b.read()); }), write: async () => assert.fail('POST after pause') } });
  const running = c.sync(); await new Promise(resolve => setImmediate(resolve)); c.pause(); release(); await running;
  assert.equal(b.read().words.length, 0); await c.edit(words => [...words, w('b')]); c.stop();
  await new Promise(resolve => setTimeout(resolve, 15)); assert.equal(b.read().revision, 0);
  const d = new VocabSync({ storage: new Storage(), transport: b.transport }); assert.equal(d.paused(), true);
});
test('recovery changes generation under lock; racing old POST rejected, old ACK ignored after pause', async () => {
  const b = enabled([w('old')]); const before = b.read();
  const c = client(b, before, [w('old'), w('pending')]); let release;
  c.transport = { read: b.transport.read, write: p => new Promise(resolve => { release = () => resolve(b.post(p)); }) };
  const run = c.sync(); await new Promise(resolve => setImmediate(resolve)); c.pause();
  b.context.pauseVocabularyWrites(); b.init(snap([w('clean')], { generation: 'recovered' })); b.context.resumeVocabularyWrites();
  release(); await run; assert.equal(b.read().words[0].id, 'clean');
  assert.equal(b.post(payload(before, [w('old')])).error, 'generation');
  c.transport = b.transport; await c.sync(); assert.deepEqual(c.state.words, [w('clean')]); c.stop();
});
test('commit failure retains prior authoritative snapshot and backups', () => {
  const b = enabled([w('old')]), head = b.props.get('VOCAB_HEAD'); b.fail();
  assert.equal(b.post(payload(b.read(), [w('old'), w('new')])).ok, false);
  assert.equal(b.props.get('VOCAB_HEAD'), head); assert.equal(b.read().words.length, 1); assert.equal(b.files.size, 2);
});
test('admin restore requires paused mode and exact confirmed hash; initializes new generation revision zero', () => {
  const b = enabled([w('old')]); const f = b.context.DriveApp.createFile('clean.json', JSON.stringify([w('clean')]), 'application/json');
  b.props.set('VOCAB_RECOVERY_FILE_ID', f.getId()); assert.throws(() => b.context.restoreConfirmedVocabulary(), /pause_first/);
  b.context.pauseVocabularyWrites(); assert.throws(() => b.context.restoreConfirmedVocabulary(), /confirmation_required/);
  b.props.set('VOCAB_CONFIRMED_SHA256', b.context.previewVocabularyRecovery().sha256);
  const restored = b.context.restoreConfirmedVocabulary(); assert.notEqual(restored.generation, 'g1'); assert.equal(restored.revision, 0); assert.equal(b.read().paused, true);
});
test('storage failure blocks upload/adoption rather than discarding pending data', async () => {
  const b = enabled([w('clean')]); const c = client(b, null, [w('legacy')]); c.storage.setItem = () => { throw Error('quota'); };
  await c.sync(); assert.equal(c.status, 'error'); assert.equal(c.state.words[0].id, 'legacy'); assert.equal(b.read().revision, 0); c.stop();
});
test('proxy defaults to containment and rejects legacy payloads without network', async () => {
  const saved = { ...process.env }; const previous = global.fetch;
  process.env.VOCAB_APPS_SCRIPT_URL = 'https://invalid.example/'; process.env.VOCAB_SYNC_SECRET = 'test'; delete process.env.VOCAB_WRITES_ENABLED;
  global.fetch = () => assert.fail('network');
  const response = () => ({ setHeader() {}, status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; } });
  try {
    let res = response(); await proxy({ method: 'POST', body: {} }, res); assert.equal(res.body.error, 'paused');
    process.env.VOCAB_WRITES_ENABLED = 'true'; res = response(); await proxy({ method: 'POST', body: [] }, res); assert.equal(res.body.error, 'protocol_required');
  } finally { global.fetch = previous; for (const key of ['VOCAB_APPS_SCRIPT_URL','VOCAB_SYNC_SECRET','VOCAB_WRITES_ENABLED']) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } }
});
test('canonical content comparison is independent of field order, not of content', () => { assert.ok(equal({ a: 1, b: 2 }, { b: 2, a: 1 })); assert.ok(!equal([w('a')], [w('b')])); });

test('simultaneous CAS conflict keeps pending; next GET merges both additions', async () => {
  const b = enabled(); const old = copy(b.read());
  let dispatch;
  const a = client(b, old, [w('a')], { transport: { read: b.transport.read, write: p => new Promise(resolve => { dispatch = () => { const ack = b.post(p); if (!ack.ok) resolve(Promise.reject(Error(ack.error))); else resolve(ack); }; }) } });
  const run = a.sync(); await new Promise(resolve => setImmediate(resolve));
  const phone = client(b, old, [w('b')]); await phone.sync(); dispatch(); await run;
  assert.equal(a.status, 'error'); assert.equal(a.state.words[0].id, 'a');
  a.transport = b.transport; await a.sync(); assert.deepEqual(b.read().words.map(x => x.id).sort(), ['a', 'b']); a.stop(); phone.stop();
});
test('accepted POST with lost response recovers by GET without duplicate revision', async () => {
  const b = enabled(); const c = client(b, snap(), [w('a')], { transport: { read: b.transport.read, write: async p => { b.post(p); throw Error('response_lost'); } } });
  await c.sync(); assert.equal(c.status, 'error'); assert.equal(b.read().revision, 1);
  c.transport = b.transport; await c.sync(); assert.equal(c.status, 'ok'); assert.equal(b.read().revision, 1); c.stop();
});
test('corrupt local cache is not overwritten or treated as empty', () => {
  const storage = new Storage({ vocabmaster_words: '{broken', vocabmaster_grammar_underlines: 'KEEP' });
  const c = new VocabSync({ storage, transport: {} });
  assert.ok(c.loadError); assert.equal(c.hasReadableWords, false); assert.equal(c.state, null);
  assert.equal(storage.getItem('vocabmaster_words'), '{broken'); assert.equal(storage.getItem('vocabmaster_grammar_underlines'), 'KEEP');
});
test('actual cloud adapter rejects failed HTTP/opaque responses and sends readable same-origin protocol', async () => {
  const { fetchFromCloud, pushToCloud } = await import('../src/utils/cloud.js'); const previous = global.fetch;
  try {
    global.fetch = async (url, opts) => { assert.equal(url, '/api/vocab-sync'); assert.notEqual(opts.mode, 'no-cors'); return { ok: false, json: async () => ({ ok: true }) }; };
    await assert.rejects(fetchFromCloud(), /request_failed/);
    global.fetch = async () => ({ ok: true, json: async () => { throw Error('opaque'); } });
    await assert.rejects(pushToCloud({}), /opaque/);
    global.fetch = async (_url, opts) => ({ ok: true, json: async () => ({ ...snap(), ok: true, sent: JSON.parse(opts.body) }) });
    const response = await pushToCloud({ protocol: 1 }); assert.equal(response.sent.protocol, 1);
  } finally { global.fetch = previous; }
});
test('hardMarked star flag validates, merges orthogonally with progress/field edits, and never resurrects deleted words', async () => {
  const b = enabled([w('alpha'), w('beta', { hardMarked: true }), w('gone')]);
  assert.equal(b.post(payload(b.read(), [w('alpha', { hardMarked: 'yes' }), w('beta'), w('gone')])).error, 'invalid_field');

  const base = copy(b.read());
  // Device A stars alpha and unstars beta; Device B updates alpha's SRS progress and edits beta's meaning + deletes gone while A stars gone.
  const localWords = [
    w('alpha', { hardMarked: true }),
    w('beta'),
    w('gone', { hardMarked: true }),
  ];
  const remoteSnap = snap([
    w('alpha', { level: 3, currentStreak: 0, lastReviewedDate: 999 }),
    w('beta', { hardMarked: true, vietnamese: 'nghĩa mới', annotation: 'updated' }),
  ], { revision: 1, tombstones: ['gone'] });

  const merged = reconcile(base, localWords, remoteSnap);
  const mergedAlpha = merged.words.find(x => x.id === 'alpha');
  const mergedBeta = merged.words.find(x => x.id === 'beta');
  assert.equal(mergedAlpha.hardMarked, true);
  assert.equal(mergedAlpha.level, 3);
  assert.equal(mergedAlpha.currentStreak, 0);
  assert.equal(mergedAlpha.lastReviewedDate, 999);
  assert.equal(mergedBeta.hardMarked, undefined);
  assert.equal(mergedBeta.vietnamese, 'nghĩa mới');
  assert.equal(mergedBeta.annotation, 'updated');
  assert.equal(merged.words.some(x => x.id === 'gone'), false);
  assert.deepEqual(merged.tombstones, ['gone']);
  // Only 'gone' (deleted remotely while starred locally) is archived as conflict; alpha and beta merged cleanly!
  assert.deepEqual(merged.conflicts.map(x => x.id), ['gone']);

  // End-to-end two-device sync with backend
  const d1 = client(b, base, [w('alpha', { hardMarked: true }), w('beta', { hardMarked: true }), w('gone')]);
  await d1.sync();
  assert.equal(b.read().words.find(x => x.id === 'alpha').hardMarked, true);

  const d2 = client(b, base, [w('alpha', { level: 4, currentStreak: 0, lastReviewedDate: 5000 }), w('beta'), w('gone')]);
  await d2.sync();
  assert.equal(d2.notice, '');
  const afterD2 = b.read().words;
  assert.equal(afterD2.find(x => x.id === 'alpha').hardMarked, true);
  assert.equal(afterD2.find(x => x.id === 'alpha').level, 4);
  assert.equal(afterD2.find(x => x.id === 'beta').hardMarked, undefined);
  d1.stop(); d2.stop();
});
test('transient sync error notice persisted during offline edit clears after subsequent successful sync', async () => {
  const b = enabled([w('a')]);
  const initial = copy(b.read());
  let failRead = true;
  const c = client(b, initial, [w('a')], {
    transport: {
      read: async () => { if (failRead) throw Error('Failed to fetch'); return b.transport.read(); },
      write: b.transport.write,
    },
  });
  await c.sync();
  assert.match(c.message, /Vocabulary chưa đồng bộ: Failed to fetch/);
  // Editing while offline persists state (including notice) to storage
  await c.edit(words => words.map(x => ({ ...x, hardMarked: true })));
  assert.match(c.message, /Failed to fetch/);
  // Reconnect and sync: transient error notice must clear
  failRead = false;
  await c.sync();
  assert.equal(c.status, 'ok');
  assert.equal(c.notice, '');
  assert.equal(JSON.parse(c.storage.getItem(STATE_KEY)).notice, '');
  assert.equal(b.read().words[0].hardMarked, true);
  c.stop();
});

test('backup quota at startup keeps valid pending words, retries without duplicates and recovers', async () => {
  const b = enabled([w('a')]);
  const pending = [w('a', { hardMarked: true, level: 4, lastReviewedDate: 123 }), w('offline')];
  const c = client(b, snap([w('a')]), pending);
  const original = c.storage.getItem(STATE_KEY);
  c.storage.setItem(BACKUP_PREFIX + 'old', 'OLD BACKUP');
  const put = c.backups.put.bind(c.backups);
  let fail = true;
  c.backups.put = async content => { if (fail) throw new DOMException('full', 'QuotaExceededError'); return put(content); };
  let posts = 0;
  c.transport.write = async p => { posts++; assert.ok(p.words.length); return b.post(p); };
  for (let i = 0; i < 3; i++) {
    await c.sync();
    assert.deepEqual(c.state.words, pending);
    assert.equal(c.storage.getItem(STATE_KEY), original);
    assert.match(c.message, /Không đủ dung lượng/);
    assert.equal(posts, 0);
  }
  const reloaded = new VocabSync({ storage: c.storage, transport: c.transport, backups: c.backups });
  assert.deepEqual(reloaded.state.words, pending);
  reloaded.active = true; await reloaded.sync(); assert.equal(posts, 0);
  fail = false; await reloaded.sync();
  assert.equal(reloaded.status, 'ok'); assert.equal(reloaded.storageError, '');
  assert.deepEqual(b.read().words, pending);
  await reloaded.sync();
  const count = c.backups.data.size;
  const again = new VocabSync({ storage: c.storage, transport: c.transport, backups: c.backups });
  again.active = true;
  await again.sync(); await again.sync();
  assert.equal(c.backups.data.size, count);
  assert.equal(c.storage.getItem(BACKUP_PREFIX + 'old'), 'OLD BACKUP');
  c.stop(); reloaded.stop(); again.stop();
});

test('generation/conflict backup failure blocks adoption and POST; partial success deduplicates on retry', async () => {
  for (const generation of ['g1', 'replacement']) {
    const b = enabled([w('a', { annotation: 'remote' })]);
    if (generation !== 'g1') b.init(snap([w('a')], { generation }));
    const local = [w('a', { annotation: 'local', hardMarked: true })];
    const c = client(b, snap([w('a')]), local);
    const put = c.backups.put.bind(c.backups);
    let fail = true;
    c.backups.put = async content => {
      if (fail && JSON.parse(content).reason) throw new DOMException('full', 'QuotaExceededError');
      return put(content);
    };
    await c.sync(); const count = c.backups.data.size;
    await c.sync(); assert.equal(c.backups.data.size, count);
    assert.deepEqual(c.state.words, local); assert.equal(b.read().revision, 0);
    fail = false; await c.sync(); assert.notEqual(c.status, 'error');
    assert.ok([...c.backups.data.values()].some(v => v.includes('local') && v.includes('hardMarked')));
    c.stop();
  }
});

test('failed state write preserves an edit in memory/backup and Sync retries it before reconciliation', async () => {
  const b = enabled([w('a')]); const c = client(b, snap([w('a')]));
  const set = c.storage.setItem.bind(c.storage); let fail = true;
  c.storage.setItem = (key, value) => { if (fail && key === STATE_KEY) throw new DOMException('full', 'QuotaExceededError'); set(key, value); };
  await assert.rejects(c.edit(words => words.map(x => ({ ...x, hardMarked: true }))));
  assert.equal(c.state.words[0].hardMarked, undefined);
  assert.equal(c.pendingEdit.words[0].hardMarked, true);
  assert.ok([...c.backups.data.values()].some(v => v.includes('hardMarked')));
  await c.sync(); assert.equal(b.read().revision, 0);
  fail = false; await c.sync();
  assert.equal(c.pendingEdit, null); assert.equal(c.storageError, '');
  assert.equal(b.read().words[0].hardMarked, true); c.stop();
});

test('unreadable authoritative cache allows display-only mirror, never uploads synthetic empty words', async () => {
  for (const legacy of [JSON.stringify([w('readable', { hardMarked: true })]), '{bad']) {
    const storage = new Storage({ [STATE_KEY]: '{bad', vocabmaster_words: legacy });
    const c = new VocabSync({ storage, backups: new Backups(), transport: { read: () => assert.fail('no GET'), write: () => assert.fail('no POST') } });
    const original = [...storage.data];
    c.active = true; await c.sync();
    assert.ok(c.loadError); assert.equal(c.status, 'error');
    assert.equal(c.hasReadableWords, legacy.startsWith('['));
    await assert.rejects(c.edit(() => []));
    assert.deepEqual([...storage.data], original); c.stop();
  }
});

test('network/storage messages remain visible during retry and clear only after success', async () => {
  const b = enabled([w('a')]); const c = client(b, snap([w('a')]));
  c.networkError = 'network failed'; c.storageError = 'storage failed';
  let release;
  c.transport.read = () => new Promise(resolve => { release = () => resolve(b.read()); });
  const run = c.sync(); await new Promise(resolve => setImmediate(resolve));
  assert.match(c.message, /network failed/); assert.match(c.message, /storage failed/);
  release(); await run;
  assert.equal(c.message, ''); c.stop();
});

test('a failed edit during GET must recover before merge or upload, including its star and progress', async () => {
  const b = enabled([w('a')]); const c = client(b, snap([w('a')]));
  let release, fail = true;
  const put = c.backups.put.bind(c.backups);
  c.backups.put = async content => {
    if (fail && content.includes('hardMarked')) throw new DOMException('full', 'QuotaExceededError');
    return put(content);
  };
  c.transport.read = () => new Promise(resolve => { release = () => resolve(b.read()); });
  const run = c.sync(); await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(c.edit(words => words.map(x => ({ ...x, hardMarked: true, level: 4 }))));
  release(); await run;
  assert.equal(c.status, 'error'); assert.equal(b.read().revision, 0);
  assert.equal(c.pendingEdit.words[0].hardMarked, true);
  fail = false; c.transport.read = async () => b.read();
  await c.sync(); assert.equal(b.read().words[0].hardMarked, true);
  assert.equal(b.read().words[0].level, 4); assert.equal(c.pendingEdit, null); c.stop();
});

test('legacy mirror failure preserves committed authoritative state, blocks POST, retries without losing pending', async () => {
  const b = enabled([w('a')]); const c = client(b, snap([w('a')]));
  const set = c.storage.setItem.bind(c.storage); let fail = true;
  c.storage.setItem = (key, value) => { if (fail && key === 'vocabmaster_words') throw new DOMException('full', 'QuotaExceededError'); set(key, value); };
  await assert.rejects(c.edit(words => words.map(x => ({ ...x, hardMarked: true }))));
  assert.equal(JSON.parse(c.storage.getItem(STATE_KEY)).words[0].hardMarked, true);
  const reload = new VocabSync({ storage: c.storage, transport: b.transport, backups: c.backups });
  assert.equal(reload.state.words[0].hardMarked, true);
  await c.sync(); assert.equal(b.read().revision, 0);
  fail = false; await c.sync();
  assert.equal(c.storageError, ''); assert.equal(b.read().words[0].hardMarked, true); c.stop();
});

test('failed pause write cancels upload and keeps its own error until that setting is saved', async () => {
  const b = enabled([w('a')]); const c = client(b, snap([w('a')]), [w('a'), w('offline')]);
  const set = c.storage.setItem.bind(c.storage); let fail = true;
  c.storage.setItem = (key, value) => { if (fail && key === PAUSE_KEY) throw new DOMException('full', 'QuotaExceededError'); set(key, value); };
  c.pause(); assert.equal(c.paused(), true); assert.ok(c.pauseError);
  await c.sync(); assert.equal(b.read().revision, 0); assert.ok(c.pauseError);
  fail = false; await c.sync(); assert.equal(c.pauseError, '');
  assert.equal(c.status, 'paused'); assert.equal(b.read().revision, 0); c.stop();
});
