import { validateSentenceAnalysis } from './grammarSentence.js';

/**
 * grammarSyncMerge.js — Deterministic merging and validation utilities
 * for Grammar cloud synchronization.
 *
 * Ensures:
 * 1. Zero data loss during conflicts (union of questions, smart field merge).
 * 2. Learning progress is never downgraded (highest review level / wrongCount kept).
 * 3. Strict schema validation to reject malformed payloads.
 */

/**
 * Validates a single question against the required schema.
 * @param {object} q
 * @param {number} [index]
 * @returns {string | null} error message if invalid, null if valid
 */
export function validateQuestion(q, index = 0) {
  if (!q || typeof q !== 'object') {
    return `Question at index ${index} must be a valid object.`;
  }
  if (!q.savedId || typeof q.savedId !== 'string' || q.savedId.trim().length === 0) {
    return `Question at index ${index} missing valid savedId.`;
  }
  if (q.schemaVersion !== undefined || q.type !== undefined) return validateSentenceAnalysis(q);
  if (!q.sentence || typeof q.sentence !== 'string' || !q.sentence.includes('_____')) {
    return `Question at index ${index} missing sentence with "_____".`;
  }
  if (!q.options || typeof q.options !== 'object') {
    return `Question at index ${index} missing options.`;
  }
  const keys = ['A', 'B', 'C', 'D'];
  for (const k of keys) {
    if (typeof q.options[k] !== 'string') {
      return `Question at index ${index} missing string option ${k}.`;
    }
  }
  if (!keys.includes(q.answer)) {
    return `Question at index ${index} has invalid answer: ${q.answer}`;
  }
  if (!q.topic || typeof q.topic !== 'string') {
    return `Question at index ${index} missing topic.`;
  }
  return null;
}

/** Validate a grammar structure stored in the shared Grammar spreadsheet. */
export function validateStructure(item, index = 0) {
  if (!item || typeof item !== 'object') return `Structure at index ${index} must be a valid object.`;
  if (!item.id || typeof item.id !== 'string') return `Structure at index ${index} missing valid id.`;
  if (!item.english || typeof item.english !== 'string') return `Structure at index ${index} missing english pattern.`;
  if (!item.vietnamese || typeof item.vietnamese !== 'string') return `Structure at index ${index} missing Vietnamese meaning.`;
  if (item.level !== undefined && (!Number.isInteger(Number(item.level)) || Number(item.level) < 1 || Number(item.level) > 5)) {
    return `Structure at index ${index} has invalid level.`;
  }
  if (Array.isArray(item)) return 'Invalid structure object.';
  for (const key of ['example', 'notes', 'topic']) {
    if (item[key] !== undefined && typeof item[key] !== 'string') return `Invalid structure ${key}.`;
  }
  for (const key of ['updatedAt', 'deletedAt', 'createdAt', 'lastReviewedAt', 'nextReviewAt', 'currentStreak', 'wrongCount', 'totalReviews']) {
    if (item[key] != null && (!Number.isFinite(item[key]) || item[key] < 0)) return `Invalid structure ${key}.`;
  }
  if (item.reviewBase !== undefined) {
    if (!item.reviewBase || typeof item.reviewBase !== 'object' || Array.isArray(item.reviewBase)) return 'Invalid review base.';
    const error = validateStructure({ id: item.id, english: item.english, vietnamese: item.vietnamese, ...item.reviewBase, reviewBase: undefined, reviewEvents: undefined });
    if (error) return error;
  }
  if (item.reviewEvents !== undefined) {
    if (!item.reviewBase || !item.reviewEvents || typeof item.reviewEvents !== 'object' || Array.isArray(item.reviewEvents)) return 'Invalid review events.';
    for (const event of Object.values(item.reviewEvents)) {
      if (!event || typeof event.correct !== 'boolean' || !Number.isFinite(event.at) || event.at <= 0) return 'Invalid review event.';
    }
  }
  return null;
}

/**
 * Validates the full sync payload.
 * @param {object} payload
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, error: 'Payload must be a JSON object.' };
  }
  if (payload.action !== 'save') {
    return { valid: false, error: 'Invalid action: must be "save".' };
  }
  if (typeof payload.expectedRevision !== 'number' || isNaN(payload.expectedRevision) || payload.expectedRevision < 0) {
    return { valid: false, error: 'expectedRevision must be a non-negative number.' };
  }
  if (!Array.isArray(payload.savedQuestions)) {
    return { valid: false, error: 'savedQuestions must be an array.' };
  }
  for (let i = 0; i < payload.savedQuestions.length; i++) {
    const err = validateQuestion(payload.savedQuestions[i], i);
    if (err) return { valid: false, error: err };
  }
  if (payload.reviewProgress && (typeof payload.reviewProgress !== 'object' || Array.isArray(payload.reviewProgress))) {
    return { valid: false, error: 'reviewProgress must be an object map.' };
  }
  if (payload.structures !== undefined) {
    if (!Array.isArray(payload.structures)) return { valid: false, error: 'structures must be an array.' };
    for (let i = 0; i < payload.structures.length; i++) {
      const err = validateStructure(payload.structures[i], i);
      if (err) return { valid: false, error: err };
    }
  }
  return { valid: true };
}

/**
 * Merges local and server saved questions without losing any questions.
 * Preserves new items from both sides, resolving conflicts deterministically.
 *
 * @param {object[]} localQuestions
 * @param {object[]} serverQuestions
 * @returns {object[]}
 */
export function mergeSavedQuestions(localQuestions = [], serverQuestions = []) {
  const map = new Map();

  function getKey(q) {
    if (q.savedId) return String(q.savedId).trim();
    if (q.sentence) return String(q.sentence).trim().toLowerCase();
    return null;
  }

  // 1. Populate from server questions
  for (const sq of serverQuestions) {
    const key = getKey(sq);
    if (!key) continue;
    map.set(key, { ...sq });
  }

  // 2. Merge local questions
  for (const lq of localQuestions) {
    const key = getKey(lq);
    if (!key) continue;

    if (!map.has(key)) {
      // Local question doesn't exist on server -> preserve local question!
      map.set(key, { ...lq });
    } else {
      // Exists in both -> merge attributes safely
      const sq = map.get(key);
      const merged = {
        ...sq,
        ...lq,
        // Preserve savedId
        savedId: sq.savedId || lq.savedId,
        // Union of hard mark
        hardMarked: Boolean(lq.hardMarked || sq.hardMarked),
        // Notes: prefer non-empty local notes, or server notes if local is empty
        userNotes: (lq.userNotes && lq.userNotes.trim().length > 0)
          ? lq.userNotes
          : (sq.userNotes || ''),
        // Earliest saved date
        savedAt: Math.min(Number(sq.savedAt) || Date.now(), Number(lq.savedAt) || Date.now()),
      };
      map.set(key, merged);
    }
  }

  // Sort descending by savedAt
  return Array.from(map.values()).sort((a, b) => (Number(b.savedAt) || 0) - (Number(a.savedAt) || 0));
}

/**
 * Merges local and server review progress without downgrading learner levels.
 *
 * @param {object} localReview { [savedId]: { level, wrongCount, nextReviewAt, ... } }
 * @param {object} serverReview { [savedId]: { level, wrongCount, nextReviewAt, ... } }
 * @returns {object}
 */
export function mergeReviewProgress(localReview = {}, serverReview = {}) {
  const merged = {};
  const allKeys = new Set([...Object.keys(localReview || {}), ...Object.keys(serverReview || {})]);

  for (const key of allKeys) {
    const lr = localReview?.[key];
    const sr = serverReview?.[key];

    if (lr && !sr) {
      merged[key] = { ...lr };
    } else if (!lr && sr) {
      merged[key] = { ...sr };
    } else if (lr && sr) {
      // Both exist: pick the highest achievement and latest timestamps
      merged[key] = {
        level: Math.max(Number(lr.level) || 1, Number(sr.level) || 1),
        wrongCount: Math.max(Number(lr.wrongCount) || 0, Number(sr.wrongCount) || 0),
        totalReviews: Math.max(Number(lr.totalReviews) || 0, Number(sr.totalReviews) || 0),
        lastReviewAt: Math.max(Number(lr.lastReviewAt) || 0, Number(sr.lastReviewAt) || 0),
        nextReviewAt: Math.max(Number(lr.nextReviewAt) || 0, Number(sr.nextReviewAt) || 0),
      };
    }
  }

  return merged;
}

/** Replay immutable review events so concurrent/offline answers are never discarded. */
export function structureProgress(item) {
  const base = item.reviewBase || item;
  let level = Number(base.level) || 1;
  let currentStreak = Number(base.currentStreak) || 0;
  let wrongCount = Number(base.wrongCount) || 0;
  let totalReviews = Number(base.totalReviews) || 0;
  let lastReviewedAt = base.lastReviewedAt || null;
  let nextReviewAt = base.nextReviewAt || null;
  const thresholds = { 1: 2, 2: 4, 3: 8, 4: 15 };
  const days = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
  const events = Object.entries(item.reviewEvents || {}).sort(([a, x], [b, y]) => x.at - y.at || a.localeCompare(b));
  for (const [, event] of events) {
    totalReviews++;
    if (event.correct) {
      currentStreak++;
      if (thresholds[level] && currentStreak >= thresholds[level]) {
        level++;
        currentStreak = 0;
      }
    } else {
      level = Math.max(1, level - 1);
      currentStreak = 0;
      wrongCount++;
    }
    lastReviewedAt = event.at;
    nextReviewAt = event.correct ? event.at + days[level] * 86400000 : event.at;
  }
  return { level, currentStreak, wrongCount, totalReviews, lastReviewedAt, nextReviewAt };
}

/** Field edits use deterministic last-write-wins; answers use a union of events.
 * Tombstones remain permanently, including on older offline devices. */
export function mergeStructures(localStructures = [], serverStructures = []) {
  const map = new Map();
  for (const source of [...serverStructures, ...localStructures]) {
    const item = {
      ...source,
      reviewBase: source.reviewBase || structureProgress({ ...source, reviewEvents: {} }),
      reviewEvents: source.reviewEvents || {},
    };
    const old = map.get(item.id);
    if (!old) {
      map.set(item.id, { ...item, ...structureProgress(item) });
      continue;
    }
    const newer = (Number(item.updatedAt) || 0) > (Number(old.updatedAt) || 0)
      || ((Number(item.updatedAt) || 0) === (Number(old.updatedAt) || 0) && JSON.stringify(item) > JSON.stringify(old));
    const winner = newer ? item : old;
    // A content edit must not select an older pre-event migration baseline.
    const bases = [old.reviewBase, item.reviewBase];
    bases.sort((a, b) => (Number(b.lastReviewedAt) || 0) - (Number(a.lastReviewedAt) || 0)
      || (Number(b.totalReviews) || 0) - (Number(a.totalReviews) || 0)
      || JSON.stringify(b).localeCompare(JSON.stringify(a)));
    const merged = {
      ...old, ...winner,
      deletedAt: Math.max(Number(old.deletedAt) || 0, Number(item.deletedAt) || 0) || null,
      reviewBase: bases[0],
      reviewEvents: { ...old.reviewEvents, ...item.reviewEvents },
    };
    map.set(item.id, { ...merged, ...structureProgress(merged) });
  }
  return [...map.values()].sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0) || a.id.localeCompare(b.id));
}
