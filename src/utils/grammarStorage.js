/**
 * grammarStorage.js — LocalStorage utilities for the Grammar module.
 * Completely separate from vocabulary storage (LS_WORDS / LS_STATS).
 */

// ── LocalStorage keys ──────────────────────────────────────────────────────
export const LS_GRAMMAR_SAVED      = 'vocabmaster_grammar_saved';
export const LS_GRAMMAR_STATS      = 'vocabmaster_grammar_stats';
export const LS_GRAMMAR_REVIEW     = 'vocabmaster_grammar_review';
export const LS_GRAMMAR_CLOUD_URL  = 'vocabmaster_grammar_cloud_url';
export const LS_GRAMMAR_REVISION   = 'vocabmaster_grammar_revision';
export const LS_GRAMMAR_PENDING    = 'vocabmaster_grammar_pending';
export const DEFAULT_GRAMMAR_CLOUD_URL = '/api/grammar-sync';

// ── Revision & Pending Changes ─────────────────────────────────────────────

export function getGrammarRevision() {
  const val = localStorage.getItem(LS_GRAMMAR_REVISION);
  return val ? (Number(val) || 0) : 0;
}

export function saveGrammarRevision(rev) {
  localStorage.setItem(LS_GRAMMAR_REVISION, String(Math.max(0, Number(rev) || 0)));
}

export function hasGrammarPending() {
  return localStorage.getItem(LS_GRAMMAR_PENDING) === 'true';
}

export function setGrammarPending(isPending) {
  localStorage.setItem(LS_GRAMMAR_PENDING, isPending ? 'true' : 'false');
}

// ── Saved Questions ────────────────────────────────────────────────────────

/** @returns {import('./grammarTypes').SavedQuestion[]} */
export function getSavedQuestions({ withStatus = false } = {}) {
  let data = [], error = '';
  try {
    data = JSON.parse(localStorage.getItem(LS_GRAMMAR_SAVED) || '[]');
    if (!Array.isArray(data) || data.some(record => !record || typeof record !== 'object' || Array.isArray(record))) throw new Error('Invalid saved list');
  } catch {
    data = [];
    error = 'Không đọc được kho câu Grammar trên thiết bị; không coi đây là kho trống.';
  }
  return withStatus ? { data, error } : data;
}

/** @param {import('./grammarTypes').SavedQuestion[]} questions */
export function saveSavedQuestions(questions) {
  localStorage.setItem(LS_GRAMMAR_SAVED, JSON.stringify(questions));
}

// ── Grammar Stats ──────────────────────────────────────────────────────────

const DEFAULT_GRAMMAR_STATS = {
  totalAnswered:  0,
  correctAnswers: 0,
  byTopic:        {},   // { [topic]: { answered, correct } }
  byDifficulty:   {},   // { [difficulty]: { answered, correct } }
  sessions:       [],   // last 20 session summaries
};

/** @returns {object} */
export function getGrammarStats() {
  try {
    return { ...DEFAULT_GRAMMAR_STATS, ...JSON.parse(localStorage.getItem(LS_GRAMMAR_STATS) || '{}') };
  } catch {
    return { ...DEFAULT_GRAMMAR_STATS };
  }
}

/** @param {object} stats */
export function saveGrammarStats(stats) {
  localStorage.setItem(LS_GRAMMAR_STATS, JSON.stringify(stats));
}

// ── Review Progress ────────────────────────────────────────────────────────

/**
 * Review record for a saved question.
 * { questionId, level, nextReviewAt, wrongCount, hardMarked }
 */
export function getReviewProgress() {
  try {
    return JSON.parse(localStorage.getItem(LS_GRAMMAR_REVIEW) || '{}');
  } catch {
    return {};
  }
}

export function saveReviewProgress(progress) {
  localStorage.setItem(LS_GRAMMAR_REVIEW, JSON.stringify(progress));
}

// ── Grammar Cloud URL (separate from vocabulary webhook) ───────────────────

export function getGrammarCloudUrl() {
  return localStorage.getItem(LS_GRAMMAR_CLOUD_URL)?.trim() || DEFAULT_GRAMMAR_CLOUD_URL;
}

export function saveGrammarCloudUrl(url) {
  localStorage.setItem(LS_GRAMMAR_CLOUD_URL, url.trim());
}

// ── Spaced Repetition Helpers ──────────────────────────────────────────────

/**
 * Review intervals (days) per grammar review level (1–5).
 * Independent of vocabulary L1–L5.
 */
export const GRAMMAR_REVIEW_INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };

/** True when a saved question is due for grammar review today. */
export function isGrammarDueForReview(reviewRecord) {
  if (!reviewRecord || !reviewRecord.nextReviewAt) return true;
  return Date.now() >= reviewRecord.nextReviewAt;
}

/** Calculate next review timestamp based on current grammar level. */
export function calcNextReviewAt(level) {
  const days = GRAMMAR_REVIEW_INTERVALS[level] ?? 1;
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

// ── Underline markup (local only, not synced to cloud) ─────────────────────

export const LS_GRAMMAR_UNDERLINES = 'vocabmaster_grammar_underlines';

/** @returns {{ [key: string]: import('./sentenceUnderline').Segment[] }} */
export function getAllUnderlines() {
  try {
    return JSON.parse(localStorage.getItem(LS_GRAMMAR_UNDERLINES) || '{}');
  } catch {
    return {};
  }
}

/** Get underline segments for one sentence key. */
export function getUnderlinesForKey(key) {
  if (!key) return [];
  return getAllUnderlines()[key] || [];
}

/** Save underline segments for one sentence key (others untouched). */
export function saveUnderlinesForKey(key, segments) {
  if (!key) return;
  const all = getAllUnderlines();
  if (!segments || segments.length === 0) {
    delete all[key];
  } else {
    all[key] = segments;
  }
  try {
    localStorage.setItem(LS_GRAMMAR_UNDERLINES, JSON.stringify(all));
  } catch { /* quota */ }
}

/** Move underlines from a text-key to a savedId-key after saving a sentence. */
export function migrateUnderlineKey(sentence, savedId) {
  if (!sentence || !savedId) return;
  const tKey = 'text:' + sentence.trim();
  const all  = getAllUnderlines();
  if (!all[tKey]) return;
  // Keep any existing savedId marks, then add text-key marks on top
  const existing = all[savedId] || [];
  // Simple union: savedId marks take precedence (already there), add text-key ones for gaps
  // We import applyUnderline lazily to avoid circular deps — just concat and let the store normalize
  all[savedId] = [...existing, ...all[tKey]];
  delete all[tKey];
  try {
    localStorage.setItem(LS_GRAMMAR_UNDERLINES, JSON.stringify(all));
  } catch { /* quota */ }
}
