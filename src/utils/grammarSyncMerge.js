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
