/**
 * wordSelection.js — Shared word-selection helpers for Flashcard and Listening.
 *
 * These pure functions contain no React dependencies and can be tested with
 * plain Node. Listening previously defined shuffle + pickDueWord inline;
 * they now import from here to avoid duplication.
 */

/**
 * Fisher-Yates in-place shuffle; returns a new array (does not mutate input).
 *
 * @param {T[]} arr
 * @returns {T[]}
 * @template T
 */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick the most "due" word from a pool, avoiding recently-shown words.
 *
 * Priority (same as Listening):
 *   1. Lowest mastery level first (highest learning need)
 *   2. Lowest current streak first (least practiced recently)
 *
 * The `recentIds` set contains IDs of words shown recently in this session.
 * They are excluded from selection as long as other candidates remain.
 * When the pool is too small to exclude anyone (pool.length <= recentIds.size),
 * the restriction is lifted so the session can still continue.
 *
 * @param {object[]} pool       - the filtered word pool (may change as SRS updates)
 * @param {Set<string>} recentIds - IDs of recently shown words to avoid
 * @returns {object | null}     - the chosen word, or null if pool is empty
 */
export function pickNextWord(pool, recentIds) {
  if (pool.length === 0) return null;

  // Exclude recently-seen words — but only if doing so still leaves candidates
  const candidates = pool.length > recentIds.size
    ? pool.filter(w => !recentIds.has(w.id))
    : pool; // pool too small to exclude anyone; allow repetition

  const sorted = [...candidates].sort((a, b) => {
    // Primary: lowest level (most in need of practice)
    if (a.level !== b.level) return a.level - b.level;
    // Secondary: lowest streak (least recently mastered within that level)
    return (a.currentStreak ?? 0) - (b.currentStreak ?? 0);
  });

  return sorted[0] ?? null;
}

/**
 * Build a round for Listening: one "correct" word + 3 random distractors.
 * Returns null if the pool has fewer than 4 words.
 *
 * This is the same logic that was previously inlined in ListeningReview.jsx.
 *
 * @param {object[]} pool
 * @param {string | null} previousId  - ID of the last correct word (excluded from being picked again)
 * @returns {{ correct: object, cards: object[] } | null}
 */
export function buildListeningRound(pool, previousId) {
  if (pool.length < 4) return null;

  // Re-use pickNextWord with a one-element set so we exclude only the previous word
  const recentSet = previousId ? new Set([previousId]) : new Set();
  const correct   = pickNextWord(pool, recentSet);
  if (!correct) return null;

  const others = shuffle(pool.filter(w => w.id !== correct.id)).slice(0, 3);
  const cards  = shuffle([correct, ...others]);

  return { correct, cards };
}
