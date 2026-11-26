// Dictation sync backend + proxy + client, all in memory (no network, no real Sheet).
// Pass ≠ proof that the real Apps Script/Vercel deployment works.
// Run: node test/dictation-backend.test.js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import proxy from '../api/dictation-sync.js';
import { dictationBackend } from './helpers/dictation-backend.js';
import { mergeDictationData, canonicalJson, liveRecords, listenTotals } from '../src/utils/dictationSyncMerge.js';
import { emptyDictationData, addLesson, deleteLesson, recordSentenceResult, saveWord, unsaveWord, recordWordListen } from '../src/utils/dictationModel.js';
import { fetchDictationFromCloud, pushDictationToCloud } from '../src/utils/dictationCloud.js';

const lessonData = () => {
  let d = addLesson(emptyDictationData(), { title: 'Bài 1', items: [{ english: 'Hello there.', vietnamese: 'Xin chào.' }, { english: '=SUM(A1) is text', vietnamese: '' }], now: 1000, lessonId: 'L1' }).data;
  d = saveWord(d, 'Hello', 1100).data;
  return d;
};

test('secret is required; wrong secret rejected', () => {
  assert.equal(dictationBackend({ secret: null }).get().error, 'unauthorized');
  const b = dictationBackend();
  assert.equal(b.get('nope').error, 'unauthorized');
  assert.equal(b.post({ action: 'save', schema: 1, expectedRevision: 0, sentences: [], words: [] }, 'nope').error, 'unauthorized');
  assert.equal(b.sheets.size, 0, 'nothing created for unauthorized calls');
});

test('empty backend, first save, readable Vietnamese rows, JSON round trip', () => {
  const b = dictationBackend();
  assert.deepEqual(b.get(), { ok: true, schema: 1, revision: 0, sentences: [], words: [] });
  const data = mergeDictationData(lessonData(), {});
  const r = b.save(data, 0);
  assert.deepEqual(r, { ok: true, schema: 1, revision: 1, writtenSentences: 2, writtenWords: 1 });
  const got = b.get();
  assert.equal(got.revision, 1);
  assert.equal(canonicalJson({ sentences: got.sentences, words: got.words }), canonicalJson(data));
  const sentences = b.sheets.get('Câu hoàn chỉnh');
  assert.deepEqual(sentences.getRange(1, 1, 1, 5).getValues()[0], ['Tên bài', 'Thứ tự', 'Câu tiếng Anh', 'Bản dịch tiếng Việt', 'Kết quả gần nhất']);
  assert.deepEqual(sentences.getRange(2, 1, 1, 7).getValues()[0], ['Bài 1', 1, 'Hello there.', 'Xin chào.', 'Chưa làm', 0, 'Đang dùng']);
  assert.equal(sentences.getRange(3, 3).getValue(), "'=SUM(A1) is text", 'formula-looking text is escaped');
  const words = b.sheets.get('Từ vựng');
  assert.deepEqual(words.getRange(1, 1, 1, 3).getValues()[0], ['Từ', 'Câu gốc', 'Tên bài']);
  assert.deepEqual(words.getRange(2, 1, 1, 3).getValues()[0], ['Hello', '', '']);
  assert.equal(b.sheets.get('Meta').getRange(1, 2).getValue(), 1);
  assert.equal(b.sheets.get('Meta').getRange(3, 2).getValue(), '', 'journal cleared');
});

test('words with empty sentence/lesson merge cleanly alongside legacy words with sentence/lesson', () => {
  const b = dictationBackend();
  const legacy = {
    sentences: [],
    words: [{ id: 'old', word: 'Old', sentenceId: 'L0_0', sentence: 'Old sentence.', lessonTitle: 'Bài cũ', savedAt: 500, updatedAt: 500 }],
  };
  assert.equal(b.save(legacy, 0).ok, true);
  const fresh = saveWord(emptyDictationData(), 'Fresh', 1000).data;
  const merged = mergeDictationData(fresh, b.get());
  assert.equal(b.context.dictValidateData(JSON.parse(JSON.stringify(merged))), '');
  assert.equal(b.save(merged, 1).ok, true);
  const got = b.get();
  assert.deepEqual(got.words.map(w => [w.id, w.sentence, w.lessonTitle]), [['old', 'Old sentence.', 'Bài cũ'], ['fresh', '', '']]);
});

test('CAS conflict, stale/partial payloads rejected, backup kept', () => {
  const b = dictationBackend();
  const v1 = mergeDictationData(lessonData(), {});
  assert.equal(b.save(v1, 0).ok, true);
  assert.equal(b.save(v1, 0).error, 'conflict', 'old revision');
  assert.equal(b.save(emptyDictationData(), 1).error, 'conflict', 'cannot drop records even with the right revision');
  const older = mergeDictationData(lessonData(), {});
  const newer = mergeDictationData(deleteLesson(v1, 'L1', 5000), {});
  assert.equal(b.save(newer, 1).ok, true);
  assert.equal(b.save(older, 2).error, 'conflict', 'stale snapshot would revive deleted lesson');
  assert.equal(liveRecords(b.get().sentences).length, 0);
  const backup = b.sheets.get('Sao lưu');
  assert.equal(backup.getRange(1, 2).getValue(), 'revision 1');
  assert.ok(backup.getRange(2, 2).getValue().includes('"L1_0"'));
  assert.equal(b.save({ sentences: [{ id: 'x' }], words: [] }, 2).error, 'validation');
  assert.equal(b.post({ action: 'other', schema: 1, expectedRevision: 2, sentences: [], words: [] }).error, 'validation');
});

test('interrupted write and corrupt rows block reads instead of losing data', () => {
  const b = dictationBackend();
  assert.equal(b.save(mergeDictationData(lessonData(), {}), 0).ok, true);
  b.sheets.get('Meta').getRange(3, 2).setValue('dictation-write-in-progress');
  assert.equal(b.get().error, 'interrupted');
  b.sheets.get('Meta').getRange(3, 2).clearContent();
  b.sheets.get('Từ vựng').getRange(2, 10).setValue('{broken');
  assert.equal(b.get().error, 'server_error');
});

test('server merge rules equal the client merge rules', () => {
  const b = dictationBackend();
  let a = lessonData();
  a = recordSentenceResult(a, 'L1_0', true, 'devA', 2000);
  a = recordWordListen(a, 'hello', true, 'devA');
  let c = lessonData();
  c = recordSentenceResult(c, 'L1_0', false, 'devB', 2500);
  c = recordWordListen(c, 'hello', false, 'devB');
  c = unsaveWord(c, 'hello', 2600);
  c = saveWord(c, 'there', 2700).data;
  const cases = [[a, c], [c, a], [a, a], [emptyDictationData(), c], [deleteLesson(a, 'L1', 3000), c]];
  for (const [x, y] of cases) {
    const client = mergeDictationData(x, y);
    const server = JSON.parse(JSON.stringify(b.context.dictMergeData(JSON.parse(JSON.stringify(x)), JSON.parse(JSON.stringify(y)))));
    assert.equal(canonicalJson(server), canonicalJson(client));
    assert.equal(b.context.dictValidateData(JSON.parse(JSON.stringify(client))), '');
  }
});

test('two devices through the real client functions: no loss, no revival', async () => {
  const b = dictationBackend();
  // Fake fetch that runs the Apps Script directly (what the proxy forwards).
  const fetchImpl = async (url, options = {}) => {
    const body = options.method === 'POST'
      ? b.context.doPost({ postData: { contents: JSON.stringify({ ...JSON.parse(options.body), secret: 'test-secret' }) } })
      : b.get();
    return { ok: body.ok !== false, status: body.ok === false ? 400 : 200, headers: { get: () => 'application/json' }, json: async () => body };
  };
  async function syncDevice(local) {
    for (let i = 0; i < 2; i++) {
      const cloud = await fetchDictationFromCloud('/api/dictation-sync', fetchImpl);
      assert.equal(cloud.ok, true);
      const merged = mergeDictationData(local, cloud);
      if (canonicalJson(merged) === canonicalJson(mergeDictationData(cloud, {}))) return merged;
      const r = await pushDictationToCloud(merged, cloud.revision, '/api/dictation-sync', fetchImpl);
      if (r.ok) return merged;
      assert.equal(r.error, 'conflict');
    }
    throw new Error('sync failed');
  }
  let phone = await syncDevice(lessonData());
  let laptop = await syncDevice(emptyDictationData());
  assert.equal(liveRecords(laptop.words).length, 1, 'laptop received the phone data');
  laptop = recordWordListen(laptop, 'hello', true, 'laptop');
  laptop = await syncDevice(laptop);
  phone = unsaveWord(phone, 'hello', 9000); // phone still has the old copy, then deletes
  phone = await syncDevice(phone);
  const stale = lessonData(); // a third, old device that never saw the deletion
  await syncDevice(stale);
  const final = b.get();
  assert.equal(liveRecords(final.words).length, 0, 'deleted word stays deleted');
  assert.deepEqual(listenTotals(final.words[0]), { correct: 1, wrong: 0 }, 'listen count from the laptop kept');
  assert.equal(final.sentences.length, 2);
});

// ── Proxy ────────────────────────────────────────────────────────────────────
function response() {
  return {
    headers: {}, code: 200, body: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}
async function withEnv(env, fetchImpl, run) {
  const saved = { url: process.env.DICTATION_APPS_SCRIPT_URL, secret: process.env.DICTATION_SYNC_SECRET, fetch: globalThis.fetch };
  for (const [key, value] of Object.entries(env)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url: String(url), options }); return fetchImpl(url, options); };
  try { await run(calls); } finally {
    globalThis.fetch = saved.fetch;
    if (saved.url === undefined) delete process.env.DICTATION_APPS_SCRIPT_URL; else process.env.DICTATION_APPS_SCRIPT_URL = saved.url;
    if (saved.secret === undefined) delete process.env.DICTATION_SYNC_SECRET; else process.env.DICTATION_SYNC_SECRET = saved.secret;
  }
}

test('proxy: 503 unconfigured without env, injects secret, maps statuses, hides errors, no CORS', async () => {
  for (const env of [{ DICTATION_APPS_SCRIPT_URL: undefined, DICTATION_SYNC_SECRET: 's' }, { DICTATION_APPS_SCRIPT_URL: 'https://script.example/exec', DICTATION_SYNC_SECRET: undefined }]) {
    await withEnv(env, async () => { throw new Error('no network'); }, async calls => {
      const res = response();
      await proxy({ method: 'GET', query: {} }, res);
      assert.equal(res.code, 503);
      assert.deepEqual(res.body, { ok: false, error: 'unconfigured' });
      assert.equal(calls.length, 0);
    });
  }
  const env = { DICTATION_APPS_SCRIPT_URL: 'https://script.example/exec', DICTATION_SYNC_SECRET: 'server-secret' };
  await withEnv(env, async () => ({ ok: true, json: async () => ({ ok: false, error: 'conflict', serverRevision: 3 }) }), async calls => {
    const res = response();
    await proxy({ method: 'POST', body: JSON.stringify({ action: 'save', secret: 'from-browser' }) }, res);
    assert.equal(res.code, 409);
    assert.equal(JSON.parse(calls[0].options.body).secret, 'server-secret', 'browser cannot choose the secret');
    assert.equal(res.headers['access-control-allow-origin'], undefined);
    assert.equal(res.headers['cache-control'], 'no-store');
  });
  await withEnv(env, async () => ({ ok: true, json: async () => ({ ok: true, schema: 1, revision: 0, sentences: [], words: [] }) }), async calls => {
    const res = response();
    await proxy({ method: 'GET', query: {} }, res);
    assert.equal(res.code, 200);
    assert.equal(new URL(calls[0].url).searchParams.get('secret'), 'server-secret');
    assert.ok(calls[0].options.signal, 'upstream call has a timeout signal');
  });
  await withEnv(env, async () => { throw new Error('boom https://script.example/exec?secret=server-secret'); }, async () => {
    const res = response();
    await proxy({ method: 'GET', query: {} }, res);
    assert.equal(res.code, 502);
    assert.deepEqual(res.body, { ok: false, error: 'proxy_failed' });
  });
  await withEnv(env, async () => ({ ok: true, json: async () => ({}) }), async () => {
    const res = response();
    await proxy({ method: 'POST', body: '{bad' }, res);
    assert.equal(res.code, 400);
    const res2 = response();
    await proxy({ method: 'DELETE' }, res2);
    assert.equal(res2.code, 405);
  });
});

test('client: unconfigured / html dev server / bad schema are errors, never data', async () => {
  const reply = (status, body, type = 'application/json') => async () => ({ ok: status < 400, status, headers: { get: () => type }, json: async () => body });
  assert.deepEqual(await fetchDictationFromCloud('/x', reply(503, { ok: false, error: 'unconfigured' })), { ok: false, error: 'unconfigured' });
  assert.deepEqual(await fetchDictationFromCloud('/x', reply(200, null, 'text/html')), { ok: false, error: 'no_backend' });
  assert.deepEqual(await fetchDictationFromCloud('/x', reply(200, { ok: true, schema: 2, revision: 0, sentences: [], words: [] })), { ok: false, error: 'invalid_response' });
  assert.deepEqual(await fetchDictationFromCloud('/x', async () => { throw new Error('offline'); }), { ok: false, error: 'network' });
  assert.deepEqual(await pushDictationToCloud(emptyDictationData(), 4, '/x', reply(200, { ok: true, schema: 1, revision: 9, writtenSentences: 0, writtenWords: 0 })),
    { ok: false, error: 'http_200' }, 'a revision that is not expected+1 is not accepted as saved');
});
