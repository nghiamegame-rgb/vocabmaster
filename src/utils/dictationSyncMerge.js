// Dictation data: validation and conflict-free merge (pure, tested in Node).
// The same rules are duplicated in dictation-apps-script.js; keep them in step.
//
// Records are never removed: deleting writes a tombstone (deletedAt) so an old
// device cannot bring the record back. Merge rules per record (same id):
//   • content fields: the version with the larger updatedAt wins (deterministic tie-break);
//   • sentence result: the larger lastResultAt wins;
//   • counters (attempts, listen): kept per device and merged with max, so
//     increments made on two devices are both kept and replays do not double-count.

export const DICTATION_SCHEMA = 1;
export const MAX_DICTATION_RECORDS = 20000;

const SENTENCE_CONTENT = ['id', 'lessonId', 'lessonTitle', 'order', 'english', 'vietnamese', 'createdAt', 'updatedAt', 'deletedAt'];
const WORD_CONTENT = ['id', 'word', 'sentenceId', 'sentence', 'lessonTitle', 'savedAt', 'updatedAt', 'deletedAt'];

const isStr = (v, max, min = 0) => typeof v === 'string' && v.length >= min && v.length <= max;
const isTime = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isCount = v => Number.isInteger(v) && v >= 0;
const isPlainObject = v => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

function counterError(map, nested) {
  if (!isPlainObject(map)) return 'counters must be an object';
  for (const [device, value] of Object.entries(map)) {
    if (!isStr(device, 100, 1)) return 'bad device id';
    if (nested) {
      if (!isPlainObject(value) || !isCount(value.correct ?? 0) || !isCount(value.wrong ?? 0)) return 'bad listen counter';
    } else if (!isCount(value)) return 'bad counter';
  }
  return '';
}

/** '' when valid, otherwise a short reason. */
export function validateDictationSentence(s) {
  if (!isPlainObject(s)) return 'sentence must be an object';
  if (!isStr(s.id, 120, 1) || !isStr(s.lessonId, 100, 1)) return 'bad id';
  if (!isStr(s.lessonTitle, 200) || !isStr(s.english, 2000, 1) || !isStr(s.vietnamese ?? '', 2000)) return 'bad text';
  if (!isCount(s.order) || !isTime(s.createdAt) || !isTime(s.updatedAt)) return 'bad order/time';
  if (s.deletedAt !== undefined && s.deletedAt !== null && !isTime(s.deletedAt)) return 'bad deletedAt';
  if (![undefined, null, 'correct', 'wrong'].includes(s.lastResult)) return 'bad lastResult';
  if (s.lastResultAt !== undefined && !isTime(s.lastResultAt)) return 'bad lastResultAt';
  if (s.attempts !== undefined) return counterError(s.attempts, false);
  return '';
}

export function validateDictationWord(w) {
  if (!isPlainObject(w)) return 'word must be an object';
  if (!isStr(w.id, 100, 1) || !isStr(w.word, 100, 1)) return 'bad word';
  if (!isStr(w.sentenceId ?? '', 120) || !isStr(w.sentence ?? '', 2000) || !isStr(w.lessonTitle ?? '', 200)) return 'bad source';
  if (!isTime(w.savedAt) || !isTime(w.updatedAt)) return 'bad time';
  if (w.deletedAt !== undefined && w.deletedAt !== null && !isTime(w.deletedAt)) return 'bad deletedAt';
  if (w.listen !== undefined) return counterError(w.listen, true);
  return '';
}

/** Validates a whole { sentences, words } snapshot (unique ids, limits). */
export function validateDictationData(data) {
  if (!isPlainObject(data) || !Array.isArray(data.sentences) || !Array.isArray(data.words)) return 'data must have sentences and words arrays';
  if (data.sentences.length > MAX_DICTATION_RECORDS || data.words.length > MAX_DICTATION_RECORDS) return 'too many records';
  for (const s of data.sentences) { const e = validateDictationSentence(s); if (e) return e; }
  for (const w of data.words) { const e = validateDictationWord(w); if (e) return e; }
  if (new Set(data.sentences.map(s => s.id)).size !== data.sentences.length) return 'duplicate sentence id';
  if (new Set(data.words.map(w => w.id)).size !== data.words.length) return 'duplicate word id';
  return '';
}

/** Stable JSON (sorted keys, undefined dropped) for comparisons. */
export function canonicalJson(value) {
  const canon = v => {
    if (Array.isArray(v)) return v.map(canon);
    if (v && typeof v === 'object') {
      const out = {};
      for (const key of Object.keys(v).sort()) if (v[key] !== undefined && v[key] !== null) out[key] = canon(v[key]);
      return out;
    }
    return v;
  };
  return JSON.stringify(canon(value));
}

function pick(record, fields) {
  const out = {};
  for (const f of fields) if (record[f] !== undefined && record[f] !== null) out[f] = record[f];
  return out;
}

function newerContent(a, b, fields) {
  const ca = pick(a, fields), cb = pick(b, fields);
  if ((a.updatedAt || 0) !== (b.updatedAt || 0)) return (a.updatedAt || 0) > (b.updatedAt || 0) ? ca : cb;
  return canonicalJson(ca) >= canonicalJson(cb) ? ca : cb;
}

function maxCounters(a = {}, b = {}) {
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) out[key] = Math.max(a[key] || 0, b[key] || 0);
  return out;
}

function maxListen(a = {}, b = {}) {
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[key] = {
      correct: Math.max(a[key]?.correct || 0, b[key]?.correct || 0),
      wrong: Math.max(a[key]?.wrong || 0, b[key]?.wrong || 0),
    };
  }
  return out;
}

export function mergeDictationSentence(a, b) {
  if (!a) a = b; if (!b) b = a; // a single record is normalised too
  const merged = newerContent(a, b, SENTENCE_CONTENT);
  const ra = a.lastResultAt || 0, rb = b.lastResultAt || 0;
  const result = ra !== rb ? (ra > rb ? a : b) : (String(a.lastResult || '') >= String(b.lastResult || '') ? a : b);
  if (result.lastResult) { merged.lastResult = result.lastResult; merged.lastResultAt = result.lastResultAt || 0; }
  const attempts = maxCounters(a.attempts, b.attempts);
  if (Object.keys(attempts).length) merged.attempts = attempts;
  return merged;
}

export function mergeDictationWord(a, b) {
  if (!a) a = b; if (!b) b = a; // a single record is normalised too
  const merged = newerContent(a, b, WORD_CONTENT);
  const listen = maxListen(a.listen, b.listen);
  if (Object.keys(listen).length) merged.listen = listen;
  return merged;
}

function mergeList(local = [], remote = [], mergeOne, order) {
  const map = new Map();
  for (const r of [...remote, ...local]) map.set(r.id, map.has(r.id) ? mergeOne(map.get(r.id), r) : mergeOne(null, r));
  return [...map.values()].sort(order);
}

const sentenceOrder = (a, b) => (a.createdAt - b.createdAt) || (a.lessonId < b.lessonId ? -1 : a.lessonId > b.lessonId ? 1 : 0)
  || (a.order - b.order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const wordOrder = (a, b) => (a.savedAt - b.savedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Commutative, idempotent merge of two snapshots. */
export function mergeDictationData(local = {}, remote = {}) {
  return {
    sentences: mergeList(local.sentences, remote.sentences, mergeDictationSentence, sentenceOrder),
    words: mergeList(local.words, remote.words, mergeDictationWord, wordOrder),
  };
}

export const liveRecords = list => (list || []).filter(r => !r.deletedAt);
export const totalCount = map => Object.values(map || {}).reduce((sum, n) => sum + (Number(n) || 0), 0);
export const listenTotals = word => Object.values(word?.listen || {}).reduce(
  (sum, c) => ({ correct: sum.correct + (c.correct || 0), wrong: sum.wrong + (c.wrong || 0) }), { correct: 0, wrong: 0 });
