import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import * as merge from '../src/utils/grammarSyncMerge.js';
import proxy from '../api/grammar-sync.js';

const question = (id = 'q1', extra = {}) => ({
  savedId: id, sentence: `${id} _____`, options: { A: 'a', B: 'b', C: 'c', D: 'd' },
  answer: 'A', topic: 'Tenses', savedAt: 1, hardMarked: false, userNotes: '', ...extra,
});
const cloud = (questions = [question()], revision = 3, review = {}) => ({
  savedQuestions: questions, serverRevision: revision, reviewProgress: review,
});
const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const load = (context, file, names) => vm.runInContext(
  read(file).replace(/^import\s[\s\S]*?;\r?\n/gm, '').replace(/\bexport /g, '')
    + `\n;({${names.join(',')}})`, context, { filename: file },
);

// Execute the application hook with a small deterministic hook lifecycle and
// deferred network/timers. No copied sync logic, renderer dependency or real IO.
function harness({ questions = [], review = {}, pending = false, revision = 0, endpoint = '', fetchCloud, pushCloud } = {}) {
  const storage = new Map([
    ['vocabmaster_grammar_saved', JSON.stringify(questions)],
    ['vocabmaster_grammar_review', JSON.stringify(review)],
    ['vocabmaster_grammar_pending', String(pending)],
    ['vocabmaster_grammar_revision', String(revision)],
    ['vocabmaster_grammar_cloud_url', endpoint],
  ]);
  const slots = [], effects = [], timers = new Map(), listeners = new Map();
  const gets = [], posts = [];
  let cursor = 0, dirty = false, result, timerId = 0;
  const changed = (a, b) => !a || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));
  const context = vm.createContext({
    ...merge, console,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
    window: {
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); },
    },
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: id => timers.delete(id),
    useState(initial) {
      const i = cursor++;
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, value => {
        const next = typeof value === 'function' ? value(slots[i].value) : value;
        if (!Object.is(slots[i].value, next)) { slots[i].value = next; dirty = true; }
      }];
    },
    useRef(initial) {
      const i = cursor++;
      return slots[i] ??= { current: initial };
    },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { value: fn, deps };
      return slots[i].value;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || changed(slots[i].deps, deps)) {
        const previous = slots[i];
        slots[i] = { deps, effect: fn };
        effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
    fetchGrammarFromCloud: async url => { gets.push(url); return fetchCloud ? fetchCloud(url) : cloud(); },
    pushGrammarToCloud: async payload => {
      posts.push(payload);
      return pushCloud ? pushCloud(payload) : { ok: true, revision: payload.expectedRevision + 1 };
    },
  });
  const storageApi = load(context, '../src/utils/grammarStorage.js', [
    'getSavedQuestions', 'saveSavedQuestions', 'getGrammarStats', 'saveGrammarStats',
    'getReviewProgress', 'saveReviewProgress', 'getGrammarRevision', 'saveGrammarRevision',
    'getGrammarCloudUrl', 'saveGrammarCloudUrl', 'hasGrammarPending', 'setGrammarPending',
    'isGrammarDueForReview', 'calcNextReviewAt', 'GRAMMAR_REVIEW_INTERVALS',
  ]);
  Object.assign(context, storageApi);
  // This harness invokes the hook through its simulated lifecycle, outside React.
  const { useGrammarStore: invokeStore } = load(context, '../src/hooks/useGrammarStore.js', ['useGrammarStore']);
  function render() {
    dirty = false;
    cursor = 0;
    result = invokeStore();
    for (const effect of effects.splice(0)) effect();
  }
  async function settle() {
    for (let i = 0; i < 15; i++) { await Promise.resolve(); if (dirty) render(); }
  }
  render();
  return {
    get state() { if (dirty) render(); return result; },
    storage, gets, posts, settle, storageApi,
    async tick() { const batch = [...timers.values()]; timers.clear(); batch.forEach(fn => fn()); await settle(); },
    async online() { listeners.get('online')?.(); await settle(); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
    // React StrictMode's setup -> cleanup -> setup replay.
    replayEffects() { slots.forEach(slot => { if (slot?.effect) { slot.cleanup?.(); slot.cleanup = slot.effect(); } }); },
  };
}

test('sentence activity preserves legacy stats and uses existing L1–L5 scheduling', async () => {
  const h = harness();
  await h.settle();
  h.state.recordGrammarSession({ topic: 'Tenses', total: 5, correct: 3 });
  const before = JSON.parse(JSON.stringify(h.state.grammarStats));
  h.state.recordGrammarSession({ mode: 'sentence-analysis', activity: 'practice', topic: 'Tenses', total: 4 });
  h.state.recordReview('q1', true);
  assert.equal(h.state.reviewProgress.q1.level, 2);
  assert.ok(h.state.reviewProgress.q1.nextReviewAt > Date.now() + 2.9 * 86400000);
  h.state.recordReview('q1', false);
  assert.equal(h.state.reviewProgress.q1.level, 1);
  assert.equal(h.state.reviewProgress.q1.totalReviews, 2);
  assert.equal(h.state.reviewProgress.q1.wrongCount, 1);
  assert.ok(h.state.reviewProgress.q1.nextReviewAt > Date.now() + 0.9 * 86400000);
  const after = h.state.grammarStats;
  for (const key of Object.keys(before)) assert.equal(JSON.stringify(after[key]), JSON.stringify(before[key]));
  assert.equal(after.sentenceActivity.analyzed, 4);
  assert.equal(after.sentenceActivity.reviewed, 2);
  assert.equal(after.sentenceActivity.understood, 1);
  // Empty sessions and returning from the results page must not create activity.
  h.state.recordGrammarSession({ mode: 'sentence-analysis', activity: 'practice', total: 0 });
  assert.equal(h.state.grammarStats.sentenceActivity.sessions.length, 3);
  h.unmount();
});

test('review retains extra legacy progress fields and handles missing counters', async () => {
  const h = harness({ review: { q1: { level: 5, legacyNote: 'keep' } }, fetchCloud: () => cloud([], 0) });
  await h.settle();
  h.state.recordReview('q1', true);
  assert.equal(h.state.reviewProgress.q1.level, 5);
  assert.equal(h.state.reviewProgress.q1.totalReviews, 1);
  assert.equal(h.state.reviewProgress.q1.wrongCount, 0);
  assert.equal(h.state.reviewProgress.q1.legacyNote, 'keep');
  h.unmount();
});

test('default endpoint, startup hydration, no upload before successful GET', async () => {
  const get = deferred();
  const h = harness({ fetchCloud: () => get.promise });
  assert.equal(h.gets[0], '/api/grammar-sync');
  h.state.saveQuestion({ ...question('local'), savedId: undefined });
  await h.tick();
  assert.equal(h.posts.length, 0);
  get.resolve(cloud([question('server')], 8));
  await h.settle();
  await h.tick();
  assert.equal(h.posts.length, 1);
  assert.equal(h.posts[0].savedQuestions.length, 2);
  assert.equal(h.posts[0].expectedRevision, 8);
  assert.equal(h.state.hasPending, false);
});

test('clean startup downloads IDs, notes, stars and review without POST', async () => {
  const h = harness({ fetchCloud: () => cloud([question('q1', { userNotes: 'note', hardMarked: true })], 4, { q1: { level: 5 } }) });
  await h.settle();
  await h.tick();
  assert.equal(h.posts.length, 0);
  assert.equal(h.state.savedQuestions[0].userNotes, 'note');
  assert.equal(h.state.savedQuestions[0].hardMarked, true);
  assert.equal(h.state.reviewProgress.q1.level, 5);
  assert.equal(h.state.syncStatus, 'ok');
});

test('startup preserves non-pending local data and merges a concurrent cloud update through CAS', async () => {
  let gets = 0, posts = 0;
  const h = harness({
    pending: false,
    questions: [question('local'), question('shared', { userNotes: 'local note', hardMarked: true })],
    review: { local: { level: 3 }, shared: { level: 4, totalReviews: 6 } },
    fetchCloud: () => cloud([
      question('shared', { userNotes: 'cloud note' }), question('remote'),
      ...(gets++ ? [question('concurrent')] : []),
    ], gets === 1 ? 8 : 9, { shared: { level: 2, totalReviews: 7 }, remote: { level: 5 } }),
    pushCloud: p => ++posts === 1
      ? { ok: false, error: 'conflict' }
      : { ok: true, revision: p.expectedRevision + 1 },
  });
  await h.settle();
  assert.equal(h.posts.length, 0);
  assert.equal(h.state.hasPending, true);
  assert.equal(JSON.parse(h.storage.get('vocabmaster_grammar_saved')).length, 3);
  assert.equal(JSON.parse(h.storage.get('vocabmaster_grammar_review')).local.level, 3);
  await h.tick();
  assert.equal(h.posts.length, 2);
  assert.equal(h.posts[0].expectedRevision, 8);
  const retry = h.posts[1];
  assert.equal(retry.expectedRevision, 9);
  assert.equal(retry.savedQuestions.length, 4);
  assert.equal(retry.savedQuestions.find(q => q.savedId === 'shared').userNotes, 'local note');
  assert.equal(retry.savedQuestions.find(q => q.savedId === 'shared').hardMarked, true);
  assert.equal(retry.reviewProgress.local.level, 3);
  assert.equal(retry.reviewProgress.shared.level, 4);
  assert.equal(retry.reviewProgress.shared.totalReviews, 7);
  assert.equal(retry.reviewProgress.remote.level, 5);
  assert.equal(h.state.hasPending, false);
});

test('startup preserves review-only local data even without pending changes', async () => {
  const h = harness({ review: { q1: { level: 5, totalReviews: 12 } }, pending: false });
  await h.settle();
  assert.equal(h.state.reviewProgress.q1.level, 5);
  assert.equal(h.state.hasPending, true);
  await h.tick();
  assert.equal(h.posts.length, 1);
  assert.equal(h.posts[0].reviewProgress.q1.totalReviews, 12);
  assert.equal(h.posts[0].savedQuestions[0].savedId, 'q1');
  assert.equal(h.state.hasPending, false);
});

test('legacy custom endpoint stays configured; reset restores proxy and fetches', async () => {
  const endpoint = 'https://script.google.com/macros/s/legacy/exec';
  const h = harness({ endpoint });
  await h.settle();
  assert.equal(h.gets[0], endpoint);
  h.storageApi.saveGrammarCloudUrl('');
  h.state.setCloudConfigured();
  await h.settle();
  assert.equal(h.gets.at(-1), '/api/grammar-sync');
});

test('empty pending cache with confirmed empty cloud does not issue an empty POST', async () => {
  const h = harness({ pending: true, fetchCloud: () => cloud([], 0) });
  await h.settle();
  await h.tick();
  assert.equal(h.posts.length, 0);
  assert.equal(h.state.hasPending, false);
  assert.equal(h.state.syncStatus, 'ok');
});

test('failed initial GET blocks writes, preserves pending and retries on reconnect', async () => {
  let offline = true;
  const h = harness({ questions: [question()], pending: true, fetchCloud: () => offline ? null : cloud([question('remote')]) });
  await h.settle();
  h.state.updateNotes('q1', 'offline note');
  await h.tick();
  assert.equal(h.posts.length, 0);
  assert.equal(h.state.syncStatus, 'error');
  assert.equal(h.state.hasPending, true);
  offline = false;
  await h.online();
  await h.tick();
  assert.equal(h.posts[0].savedQuestions.length, 2);
  assert.equal(h.posts[0].savedQuestions.find(q => q.savedId === 'q1').userNotes, 'offline note');
});

test('edits during POST remain pending and get a second upload with new revision', async () => {
  const first = deferred();
  let calls = 0;
  const h = harness({ pushCloud: p => ++calls === 1 ? first.promise : { ok: true, revision: p.expectedRevision + 1 } });
  await h.settle();
  h.state.updateNotes('q1', 'first');
  await h.tick();
  h.state.updateNotes('q1', 'latest');
  h.state.recordReview('q1', true);
  await h.tick(); // Previously this timer could be consumed while a POST was busy.
  first.resolve({ ok: true, revision: 4 });
  await h.settle();
  assert.equal(h.state.hasPending, true);
  assert.equal(h.storage.get('vocabmaster_grammar_pending'), 'true');
  await h.tick();
  assert.equal(h.posts.length, 2);
  assert.equal(h.posts[1].savedQuestions[0].userNotes, 'latest');
  assert.equal(h.posts[1].reviewProgress.q1.level, 2);
  assert.equal(h.posts[1].expectedRevision, 4);
  assert.equal(h.state.hasPending, false);
});

test('CAS retry uses fresh edits; clears, unmarks and review demotion survive conflict GET', async () => {
  const conflictGet = deferred();
  let gets = 0, posts = 0;
  const initial = cloud([question('q1', { userNotes: 'old', hardMarked: true })], 3, {
    q1: { level: 4, wrongCount: 0, totalReviews: 4 },
  });
  const h = harness({
    fetchCloud: () => ++gets === 1 ? initial : conflictGet.promise,
    pushCloud: p => ++posts === 1 ? { ok: false, error: 'conflict' } : { ok: true, revision: p.expectedRevision + 1 },
  });
  await h.settle();
  h.state.updateNotes('q1', 'first edit');
  await h.tick();
  h.state.updateNotes('q1', '');
  h.state.toggleHardMark('q1');
  h.state.recordReview('q1', false);
  conflictGet.resolve({ ...initial, savedQuestions: [...initial.savedQuestions, question('q2')], serverRevision: 6 });
  await h.settle();
  assert.equal(h.posts.length, 2);
  const retry = h.posts[1];
  assert.equal(retry.expectedRevision, 6);
  assert.equal(retry.savedQuestions.length, 2);
  assert.equal(retry.savedQuestions.find(q => q.savedId === 'q1').userNotes, '');
  assert.equal(retry.savedQuestions.find(q => q.savedId === 'q1').hardMarked, false);
  assert.equal(retry.reviewProgress.q1.level, 3);
  assert.equal(retry.reviewProgress.q1.totalReviews, 5);
});

test('endpoint changes refetch and ignore old responses, including old POST acknowledgements', async () => {
  const oldPost = deferred(), newGet = deferred();
  const h = harness({
    fetchCloud: url => url === '/api/new-grammar' ? newGet.promise : cloud(),
    pushCloud: () => oldPost.promise,
  });
  await h.settle();
  h.state.updateNotes('q1', 'pending');
  await h.tick();
  h.storageApi.saveGrammarCloudUrl('/api/new-grammar');
  h.state.setCloudConfigured(true);
  await h.settle();
  assert.equal(h.gets.at(-1), '/api/new-grammar');
  oldPost.resolve({ ok: true, revision: 99 });
  await h.settle();
  assert.equal(h.state.hasPending, true);
  assert.notEqual(h.storage.get('vocabmaster_grammar_revision'), '99');
  newGet.resolve(cloud([question('new')], 12));
  await h.settle();
  await h.tick();
  assert.equal(h.posts.at(-1).url, '/api/new-grammar');
  assert.equal(h.posts.at(-1).expectedRevision, 12);
});

test('StrictMode replay and unmount ignore stale GET without changing local data', async () => {
  const requests = [];
  const h = harness({ fetchCloud: () => { const d = deferred(); requests.push(d); return d.promise; } });
  h.replayEffects();
  requests[1].resolve(cloud([question('fresh')], 5));
  await h.settle();
  requests[0].resolve(cloud([question('stale')], 1));
  await h.settle();
  assert.equal(h.state.savedQuestions[0].savedId, 'fresh');
  const promise = h.state.syncFromCloud();
  h.unmount();
  requests[2].resolve(cloud([question('late')], 7));
  await promise;
  assert.equal(JSON.parse(h.storage.get('vocabmaster_grammar_saved'))[0].savedId, 'fresh');
});

test('empty cloud preserves local questions and progress; fresh empty cache never erases cloud', async () => {
  const h = harness({ questions: [question()], review: { q1: { level: 5 } }, fetchCloud: () => cloud([], 2) });
  await h.settle();
  await h.tick();
  assert.equal(h.posts[0].savedQuestions.length, 1);
  assert.equal(h.posts[0].reviewProgress.q1.level, 5);
  assert.equal(h.posts[0].confirmEmpty, false);
  const fresh = harness();
  await fresh.settle();
  await fresh.tick();
  assert.equal(fresh.posts.length, 0);
});

test('explicit deletion after hydration can remove the final question', async () => {
  const h = harness();
  await h.settle();
  h.state.unsaveQuestion('q1');
  await h.tick();
  assert.equal(h.posts[0].savedQuestions.length, 0);
  assert.equal(h.posts[0].confirmEmpty, true);
});

test('push failure keeps pending and a manual retry fetches before uploading', async () => {
  let failed = true;
  const h = harness({ pushCloud: p => failed ? { ok: false, error: 'network' } : { ok: true, revision: p.expectedRevision + 1 } });
  await h.settle();
  h.state.updateNotes('q1', 'saved locally');
  await h.tick();
  assert.equal(h.state.hasPending, true);
  assert.equal(h.state.syncStatus, 'error');
  failed = false;
  await h.state.syncFromCloud();
  await h.tick();
  assert.equal(h.gets.length, 2);
  assert.equal(h.state.hasPending, false);
});

test('cloud client rejects malformed snapshots and unverified acknowledgements', async () => {
  let body, status = 200;
  const context = vm.createContext({
    ...merge, getGrammarCloudUrl: () => '/api/grammar-sync',
    fetch: async () => ({ ok: status === 200, status, json: async () => body }),
  });
  const client = load(context, '../src/utils/grammarCloud.js', ['fetchGrammarFromCloud', 'pushGrammarToCloud']);
  for (const invalid of [
    { savedQuestions: [] },
    { ok: true, savedQuestions: [], reviewProgress: {}, revision: '3' },
    { ok: true, savedQuestions: [null], reviewProgress: {}, revision: 3 },
    { ok: true, savedQuestions: [], reviewProgress: [], revision: 3 },
  ]) {
    body = invalid;
    assert.equal(await client.fetchGrammarFromCloud(), null);
  }
  body = { ok: true, savedQuestions: [question()], reviewProgress: {}, revision: 3 };
  assert.equal((await client.fetchGrammarFromCloud()).serverRevision, 3);
  for (const invalid of [{ ok: true }, { ok: true, revision: 3, written: 1 }, { ok: true, revision: 4, written: 0 }]) {
    body = invalid;
    assert.equal((await client.pushGrammarToCloud({ savedQuestions: [question()], expectedRevision: 3 })).ok, false);
  }
  body = { ok: true, revision: 4, written: 1 };
  assert.equal((await client.pushGrammarToCloud({ savedQuestions: [question()], expectedRevision: 3 })).ok, true);
  status = 500;
  assert.equal((await client.pushGrammarToCloud({ savedQuestions: [question()], expectedRevision: 3 })).ok, false);
});

test('proxy forwards existing Apps Script protocol and secret without real network', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.GRAMMAR_APPS_SCRIPT_URL;
  const originalSecret = process.env.GRAMMAR_SYNC_SECRET;
  const requests = [];
  let upstream = { ok: true, savedQuestions: [question()], reviewProgress: { q1: { level: 4 } }, revision: 2 };
  process.env.GRAMMAR_APPS_SCRIPT_URL = 'https://example.invalid/exec';
  process.env.GRAMMAR_SYNC_SECRET = 'test-only-secret';
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => upstream };
  };
  const response = () => ({
    code: 0, body: null, setHeader() {},
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  });
  try {
    const get = response();
    await proxy({ method: 'GET' }, get);
    assert.equal(new URL(requests[0].url).searchParams.get('secret'), 'test-only-secret');
    assert.equal(get.body.reviewProgress.q1.level, 4);
    const payload = { action: 'save', expectedRevision: 2, savedQuestions: [question()], reviewProgress: { q1: { level: 4 } }, confirmEmpty: false };
    upstream = { ok: true, revision: 3, written: 1 };
    const post = response();
    await proxy({ method: 'POST', body: JSON.stringify(payload) }, post);
    assert.deepEqual(JSON.parse(requests[1].options.body), { ...payload, secret: 'test-only-secret' });
    assert.equal(post.code, 200);
    assert.equal(post.body.revision, 3);
    upstream = { ok: false, error: 'conflict', serverRevision: 4 };
    const conflict = response();
    await proxy({ method: 'POST', body: payload }, conflict);
    assert.equal(conflict.code, 409);
    delete process.env.GRAMMAR_APPS_SCRIPT_URL;
    const missing = response();
    await proxy({ method: 'GET' }, missing);
    assert.equal(missing.code, 500);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of [['GRAMMAR_APPS_SCRIPT_URL', originalUrl], ['GRAMMAR_SYNC_SECRET', originalSecret]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
