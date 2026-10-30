import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import * as merge from '../src/utils/grammarSyncMerge.js';
import { selectStructures } from '../src/utils/structureStorage.js';
import { buildStructurePrompt, validateStructureQuestions } from '../src/utils/structureQuiz.js';
import proxy from '../api/grammar-sync.js';
const item = (id = 's1', extra = {}) => ({ id, english: 'despite + noun', vietnamese: 'meaning', example: '', notes: '', topic: '', createdAt: 1, updatedAt: 0,
  level: 3, currentStreak: 0, totalReviews: 0, wrongCount: 0, lastReviewedAt: null, nextReviewAt: null,
  reviewBase: { level: 3, currentStreak: 0, totalReviews: 0, wrongCount: 0, lastReviewedAt: null, nextReviewAt: null }, reviewEvents: {}, ...extra });
const cloud = (structures = [], revision = 0) => ({ structures, revision });
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

function harness({ records = [], endpoint = '', fetchCloud, pushCloud } = {}) {
  const storage = new Map([['vocabmaster_grammar_structures', JSON.stringify(records)], ['url', endpoint]]);
  const slots = [], effects = [], timers = new Map(), listeners = new Map();
  const gets = [], posts = [];
  let cursor = 0, dirty = false, result, timerId = 0;
  const changed = (a, b) => !a || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));
  const context = vm.createContext({
    ...merge, console, crypto: { randomUUID },
    getGrammarCloudUrl: () => storage.get('url'),
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
    fetchStructuresFromCloud: async url => { gets.push(url); return fetchCloud ? fetchCloud(url) : cloud(); },
    pushStructuresToCloud: async (structures, revision, url) => {
      const payload = { structures, revision, url };
      posts.push(payload);
      return pushCloud ? pushCloud(payload) : { ok: true };
    },
  });
  const storageApi = load(context, '../src/utils/structureStorage.js', ['getStructures', 'saveStructures']);
  Object.assign(context, storageApi);
  // This harness invokes the hook through its simulated lifecycle, outside React.
  const { useStructuresStore: invokeStore } = load(context, '../src/hooks/useStructuresStore.js', ['useStructuresStore']);
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


test('offline and unsupported backend preserve local records; no POST before GET', async () => {
  const get = deferred();
  const h = harness({ records: [item()], endpoint: '/sync', fetchCloud: () => get.promise });
  h.state.updateStructure('s1', { english: 'edited', vietnamese: 'meaning', notes: 'offline' });
  await h.tick();
  assert.equal(h.posts.length, 0);
  get.resolve(null);
  await h.settle();
  assert.equal(h.state.syncStatus, 'error');
  assert.equal(h.state.structures[0].notes, 'offline');
  assert.equal(JSON.parse(h.storage.get('vocabmaster_grammar_structures'))[0].notes, 'offline');
});

test('hydrates before CAS, merges edits during GET and retains edits during POST', async () => {
  const get = deferred(), post = deferred();
  const h = harness({ records: [item()], endpoint: '/sync', fetchCloud: () => get.promise, pushCloud: () => post.promise });
  h.state.updateStructure('s1', { english: 'new', vietnamese: 'meaning', notes: 'during GET' });
  get.resolve(cloud([item('cloud')], 7));
  await h.settle();
  assert.equal(h.posts[0].revision, 7);
  assert.equal(h.posts[0].structures.length, 2);
  h.state.recordStructureResult('s1', false);
  post.resolve({ ok: true });
  await h.settle();
  assert.equal(h.state.syncStatus, 'pending');
  assert.equal(h.state.structures.find(s => s.id === 's1').level, 2);
  await h.tick();
  assert.equal(h.posts.length, 2);
  assert.equal(h.posts[1].structures.find(s => s.id === 's1').totalReviews, 1);
});

test('CAS conflict refetches and merges offline answers on both devices exactly once', async () => {
  let calls = 0;
  const phone = item('s1', { reviewEvents: { phone: { at: 10, correct: true } } });
  const h = harness({ records: [item()], endpoint: '/sync', fetchCloud: () => ++calls === 1 ? cloud([], 0) : cloud([phone], 1),
    pushCloud: () => calls === 1 ? { ok: false, error: 'conflict' } : { ok: true } });
  h.state.recordStructureResult('s1', false);
  await h.settle();
  assert.equal(h.posts.length, 2);
  assert.equal(h.posts[1].revision, 1);
  assert.equal(h.state.structures[0].totalReviews, 2);
  assert.equal(Object.keys(h.state.structures[0].reviewEvents).length, 2);
});

test('deletion tombstones survive stale devices; import merges without wiping; no quiz progress before answering', async () => {
  const h = harness({ records: [item()], endpoint: '', fetchCloud: () => cloud() });
  await h.settle();
  assert.equal(h.state.structures[0].totalReviews, 0);
  h.state.deleteStructure('s1');
  h.state.importStructures([item('s1'), item('new')]);
  assert.deepEqual(h.state.structures.map(s => s.id), ['new']);
  assert.equal(JSON.parse(h.storage.get('vocabmaster_grammar_structures')).find(s => s.id === 's1').deletedAt > 0, true);
  const before = h.storage.get('vocabmaster_grammar_structures');
  assert.equal(h.state.importStructures([{ english: 'invalid' }]).ok, false);
  assert.equal(h.storage.get('vocabmaster_grammar_structures'), before);
});

test('endpoint changes and StrictMode replay ignore stale responses', async () => {
  const old = deferred();
  const h = harness({ records: [item()], endpoint: '/A', fetchCloud: url => url === '/A' ? old.promise : cloud([item('B')], 5) });
  h.storage.set('url', '/B');
  old.resolve(cloud([item('A')], 10));
  await h.settle();
  assert.equal(h.state.structures.some(s => s.id === 'A'), false);
  assert.equal(h.state.structures.some(s => s.id === 'B'), true);
  assert.equal(h.posts[0].url, '/B');
  const next = deferred();
  const replay = harness({ endpoint: '/sync', fetchCloud: () => next.promise });
  replay.replayEffects();
  next.resolve(cloud([item()]));
  await replay.settle();
  assert.equal(replay.state.structures.length, 1);
  replay.unmount();
});

test('event union is commutative, idempotent; wrong answers lower level; cleared notes stay cleared', () => {
  const a = item('s1', { notes: '', updatedAt: 4, reviewEvents: { a: { at: 10, correct: true } } });
  const b = item('s1', { notes: 'old', updatedAt: 2, reviewEvents: { b: { at: 20, correct: false } } });
  const merged = merge.mergeStructures([a], [b]);
  assert.deepEqual(merged, merge.mergeStructures([b], [a]));
  assert.deepEqual(merged, merge.mergeStructures(merged, merged));
  assert.equal(merged[0].level, 2);
  assert.equal(merged[0].notes, '');
  assert.equal(merged[0].totalReviews, 2);
  assert.equal(merged[0].nextReviewAt, 20);
});

test('weighted selection is unique, prioritizes weak/due; prompt and JSON use exact IDs', () => {
  const weak = item('weak', { level: 1 }), strong = item('strong', { level: 5, nextReviewAt: Date.now() + 1e9 });
  let weakCount = 0;
  for (let i = 0; i < 3000; i++) if (selectStructures([weak, strong], 1)[0].id === 'weak') weakCount++;
  assert.ok(weakCount > 2200);
  assert.equal(new Set(selectStructures([weak, strong], 10).map(s => s.id)).size, 2);
  assert.match(buildStructurePrompt([weak], 1, 'Medium'), /"structureId":"weak"/);
  const q = { structureId: 'weak', question: 'Please [_____] today.', options: ['a', 'b', 'c', 'd'], correctIndex: 0, explanation: 'why', trapPoint: 'trap' };
  validateStructureQuestions([q], ['weak'], [weak], 1);
  for (const change of [{ structureId: 'invented' }, { correctIndex: 4 }, { question: 'no blank' }, { trapPoint: '' }, { options: ['a', 'b'] }]) {
    assert.throws(() => validateStructureQuestions([{ ...q, ...change }], ['weak'], [weak], 1));
  }
  assert.throws(() => validateStructureQuestions([q, q], ['weak', 'strong'], [weak, strong], 2));
});

test('actual client rejects old backend/opaque ACK and proxy forwards Structures scope and payload', async () => {
  const responses = [], requests = [];
  const context = vm.createContext({ ...merge, fetch: async (url, init) => { requests.push({ url, init }); return responses.shift(); } });
  const client = load(context, '../src/utils/structureCloud.js', ['fetchStructuresFromCloud', 'pushStructuresToCloud']);
  responses.push({ ok: true, json: async () => ({ ok: true, savedQuestions: [], revision: 0 }) });
  assert.equal(await client.fetchStructuresFromCloud('/sync'), null);
  responses.push({ ok: true, json: async () => ({ ok: true, structuresSchema: 1, structures: [item()], structuresRevision: 3 }) });
  assert.equal((await client.fetchStructuresFromCloud('/sync')).revision, 3);
  assert.match(requests[1].url, /scope=structures/);
  responses.push({ ok: true, json: async () => ({ ok: true, revision: 4, written: 0 }) });
  assert.equal((await client.pushStructuresToCloud([item()], 3, '/sync')).ok, false);
  responses.push({ ok: true, json: async () => ({ ok: true, structuresSchema: 1, structuresRevision: 4, writtenStructures: 1 }) });
  assert.equal((await client.pushStructuresToCloud([item()], 3, '/sync')).ok, true);
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.GRAMMAR_APPS_SCRIPT_URL;
  const originalSecret = process.env.GRAMMAR_SYNC_SECRET;
  process.env.GRAMMAR_APPS_SCRIPT_URL = 'https://example.invalid/exec';
  process.env.GRAMMAR_SYNC_SECRET = 'test-only';
  const forwarded = [];
  globalThis.fetch = async (url, init) => { forwarded.push({ url, init }); return { ok: true, json: async () => ({ ok: true }) }; };
  const res = { setHeader() {}, status() { return this; }, json(value) { return value; } };
  try {
    await proxy({ method: 'GET', query: { scope: 'structures' } }, res);
    assert.equal(new URL(forwarded[0].url).searchParams.get('scope'), 'structures');
    await proxy({ method: 'POST', body: JSON.stringify({ action: 'saveStructures', expectedRevision: 3, structures: [item()] }) }, res);
    const body = JSON.parse(forwarded[1].init.body);
    assert.equal(body.action, 'saveStructures');
    assert.equal(body.secret, 'test-only');
    assert.equal(body.structures[0].id, 's1');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.GRAMMAR_APPS_SCRIPT_URL; else process.env.GRAMMAR_APPS_SCRIPT_URL = originalUrl;
    if (originalSecret === undefined) delete process.env.GRAMMAR_SYNC_SECRET; else process.env.GRAMMAR_SYNC_SECRET = originalSecret;
  }
});
