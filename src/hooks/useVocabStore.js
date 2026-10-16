import { useState, useEffect, useRef, useCallback } from 'react';
import { getWords, saveWords, clearWords, getStats, saveStats } from '../utils/storage';
import { pushToCloud, fetchFromCloud, verifyPush } from '../utils/cloud';

/**
 * Merge cloud words with local words safely.
 *
 * Strategy (cloud-first, preserve local-only):
 *  - Cloud is the source of truth for any word that exists there.
 *  - Local-only words (not in cloud by id OR english) are kept.
 *  - Cloud order is preserved; local-only words are appended at the end.
 *
 * This prevents two failure modes:
 *  1. Mobile with 95 words overwrites cloud's 100 words on push.
 *  2. Hard-sync wipes words added locally but not yet pushed.
 *
 * @param {object[]} cloudWords  - words returned by fetchFromCloud()
 * @param {object[]} localWords  - words currently in LocalStorage / React state
 * @returns {object[]} merged list
 */
export function mergeVocabWords(cloudWords, localWords) {
  // Build lookup sets for fast membership checks
  const cloudIds     = new Set(cloudWords.map(w => w.id));
  const cloudEngLc   = new Set(cloudWords.map(w => w.english.toLowerCase()));

  // Keep local-only words: not found in cloud by id and not by english
  const localOnly = localWords.filter(
    w => !cloudIds.has(w.id) && !cloudEngLc.has(w.english.toLowerCase())
  );

  // Cloud words are authoritative; append any purely-local additions
  return [...cloudWords, ...localOnly];
}

/**
 * Spaced-repetition thresholds: consecutive correct answers needed
 * to advance from level N to level N+1.
 * L1→L2: 2, L2→L3: 4, L3→L4: 8, L4→L5: 15
 */
const LEVEL_UP_THRESHOLD = { 1: 2, 2: 4, 3: 8, 4: 15 };

/**
 * Forgetting-curve review intervals (days) per mastery level.
 * A word at a given level should be reviewed again after this many days.
 * L1: 1 day, L2: 3 days, L3: 7 days, L4: 14 days, L5: 30 days
 */
export const REVIEW_INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };

/**
 * Returns true when a word is due for review today.
 * A word is "due" if:
 *   - it has never been reviewed (no lastReviewedDate), OR
 *   - the time since its last review >= its interval for the current level.
 */
export function isDueForReview(word) {
  if (!word.lastReviewedDate) return true;
  const intervalMs = (REVIEW_INTERVALS[word.level] ?? 1) * 24 * 60 * 60 * 1000;
  return Date.now() - word.lastReviewedDate >= intervalMs;
}

/** Debounce delay (ms) before pushing to the cloud after a local change. */
const PUSH_DEBOUNCE_MS = 2000;

/**
 * How long (ms) to wait after a POST before doing the verification GET.
 * Gives Apps Script time to commit the write before we re-read.
 * Must be long enough for Apps Script to finish, but not so long that the
 * user is left waiting. 3 s is a reasonable compromise.
 */
const VERIFY_DELAY_MS = 3000;

/**
 * Central state hook for VocabMaster.
 * Syncs words and stats from LocalStorage on mount and whenever they change.
 * Also handles cloud push (debounced POST + verification GET) and cloud fetch (GET).
 *
 * ── Key design decisions ──────────────────────────────────────────────────────
 *
 * 1. ALWAYS fetch on mount (not just when local is empty).
 *    Mobile devices with stale local data would never refresh otherwise.
 *    The cloud-first merge ensures local-only new words are preserved.
 *
 * 2. Push is debounced but VERIFIED.
 *    After a debounced POST we do a follow-up GET to confirm the sheet was
 *    updated. syncStatus='ok' is ONLY set after this verification succeeds.
 *    This prevents the false "Synced!" that occurred when the POST was
 *    fire-and-forget and the status was set after a mere fetch.
 *
 * 3. syncInProgressRef stays true until the React commit has had one full
 *    render cycle to settle, preventing the push-debounce effect from firing
 *    with stale words during a sync.
 *
 * 4. Separate syncStatus vs pushStatus.
 *    syncStatus reflects the manual Sync button (fetch from cloud).
 *    pushStatus reflects the automatic debounced push to cloud.
 *    The Navbar exposes both so the user can see the state of each independently.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function useVocabStore() {
  const [words, setWords] = useState(() => getWords());
  const [stats, setStats] = useState(() => getStats());

  // Cloud sync state — exposed so the Navbar Sync button can reflect it
  // syncStatus: manual Sync button (fetch from cloud)
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle'|'syncing'|'ok'|'error'
  // Distinguishes hard (clear + fetch) from soft (fetch only) for the Navbar
  const [syncMode,   setSyncMode]   = useState('soft'); // 'soft'|'hard'

  // pushStatus: automatic debounced push to cloud
  // 'idle' | 'pushing' | 'verifying' | 'ok' | 'error'
  const [pushStatus, setPushStatus] = useState('idle');

  // Debounce timer ref for cloud push
  const pushTimerRef = useRef(null);

  // Guard: true while a sync fetch is in flight — suppresses auto-push so we
  // never fire pushToCloud(words) with an empty or stale list mid-sync.
  // Also stays true for one extra render cycle after setWords() to let React
  // commit the merged state before push effects can fire (fixes Bug 5 race).
  const syncInProgressRef = useRef(false);

  // Track whether we are currently in a push+verify cycle so we don't
  // start a second verification while one is already running.
  const pushInProgressRef = useRef(false);

  // ── Persist words to LocalStorage + debounced push to cloud ──────────────
  useEffect(() => {
    saveWords(words);

    // Skip pushing an empty list (avoid overwriting cloud data on a fresh device)
    if (words.length === 0) return;

    // Skip pushing while a cloud fetch is in progress — prevents race where
    // setWords([]) during hard-sync schedules a push of an empty list.
    if (syncInProgressRef.current) return;

    clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      _doPush(words);
    }, PUSH_DEBOUNCE_MS);

    return () => clearTimeout(pushTimerRef.current);
  }, [words]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist stats ─────────────────────────────────────────────────────────
  useEffect(() => {
    saveStats(stats);
  }, [stats]);

  // ── Always fetch from cloud on mount ─────────────────────────────────────
  //
  // Bug fix: previously only fetched when local was empty, meaning mobile
  // devices with stale cached data would NEVER get fresh cloud data unless
  // the user manually pressed Sync.
  //
  // Now we ALWAYS do a background fetch on mount. The cloud-first merge
  // preserves any local-only words added since the last push.
  //
  // We use 'auto' mode (silent failure) so an offline first-load doesn't
  // interrupt the user with an error toast.
  useEffect(() => {
    _doFetch('auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount

  // ── Internal push implementation ──────────────────────────────────────────
  /**
   * Push words to cloud and verify the write succeeded.
   *
   * Because POST is no-cors (opaque response), we cannot read the response body.
   * Instead we do a follow-up GET after a short delay and check the row count.
   *
   * pushStatus state transitions:
   *   idle → pushing → verifying → ok | error
   *
   * @param {object[]} wordsToSend  - snapshot of words at push time
   */
  async function _doPush(wordsToSend) {
    // Don't start a second push cycle while one is still verifying
    if (pushInProgressRef.current) return;
    pushInProgressRef.current = true;

    setPushStatus('pushing');

    const dispatched = await pushToCloud(wordsToSend);
    if (!dispatched) {
      // Network-level failure (offline, DNS failure, etc.)
      pushInProgressRef.current = false;
      setPushStatus('error');
      setTimeout(() => setPushStatus('idle'), 5000);
      return;
    }

    // POST was dispatched — now verify the sheet was actually updated
    setPushStatus('verifying');
    const result = await verifyPush(wordsToSend.length, VERIFY_DELAY_MS);

    pushInProgressRef.current = false;

    if (result === 'ok') {
      setPushStatus('ok');
      setTimeout(() => setPushStatus('idle'), 3000);
    } else {
      // 'mismatch' or 'error' — cloud has fewer rows than expected
      setPushStatus('error');
      setTimeout(() => setPushStatus('idle'), 5000);
    }
  }

  // ── Internal fetch implementation ─────────────────────────────────────────
  /**
   * @param {'auto'|'manual'} trigger  - 'manual' shows error on failure; 'auto' is silent
   * @param {boolean} hardClear        - when true, wipes LocalStorage + React state first
   *                                    so the browser cannot serve stale cached data.
   */
  async function _doFetch(trigger, hardClear = false) {
    setSyncMode(hardClear ? 'hard' : 'soft');
    setSyncStatus('syncing');

    // ── GUARD: suppress auto-push while fetch is in progress ──────────────
    // Prevents the debounced push effect from firing with [] or stale data.
    syncInProgressRef.current = true;

    // Cancel any pending push that was queued before sync started.
    clearTimeout(pushTimerRef.current);

    if (hardClear) {
      // Small yield so the browser paints the "clearing" state before we
      // block on fetch. We intentionally do NOT wipe LocalStorage here —
      // we wait until we have confirmed cloud data to avoid a window where
      // both cloud and local are empty simultaneously.
      await new Promise(r => setTimeout(r, 120));
    }

    try {
      const cloudWords = await fetchFromCloud();

      // fetchFromCloud returns null for: unconfigured URL, network error,
      // empty sheet (0 rows), or malformed response.
      // In ALL those cases we must NOT touch local data.
      if (!cloudWords || cloudWords.length === 0) {
        // Release guard: lift AFTER a tick so the setWords() call from a
        // previous render has had time to settle (fixes Bug 5 race condition).
        setTimeout(() => { syncInProgressRef.current = false; }, 0);
        setSyncStatus(trigger === 'manual' ? 'error' : 'idle');
        return;
      }

      // ── SAFE MERGE: cloud-first, preserve local-only additions ────────────
      // Read the CURRENT LocalStorage (not stale React state) so we catch any
      // words added while the fetch was in flight.
      const currentLocal = getWords();
      const merged = mergeVocabWords(cloudWords, currentLocal);

      // Now it is safe to wipe + rewrite LocalStorage with the merged result.
      if (hardClear) {
        clearWords();
      }

      // Update React state. The push effect is still suppressed by the guard
      // so this setWords() won't queue a cloud push immediately.
      setWords(merged);

      // ── GUARD RELEASE: lift AFTER one extra tick ──────────────────────────
      // React's setWords() is asynchronous — it schedules a re-render but
      // does NOT run the useEffect synchronously. If we set the guard to false
      // immediately, the push-debounce effect could fire with the old words
      // from the previous render's closure before the merged words commit.
      // Yielding one tick (setTimeout 0) ensures the React commit runs first.
      setTimeout(() => { syncInProgressRef.current = false; }, 0);

      setSyncStatus('ok');

      // After a successful fetch that found new cloud words, push the merged
      // list back so any local-only additions reach the sheet.
      // We only do this if the merge produced MORE words than what cloud had
      // (meaning there were local-only words that need to be pushed up).
      if (merged.length > cloudWords.length) {
        // Schedule a push after the guard has been lifted (next tick + debounce)
        pushTimerRef.current = setTimeout(() => {
          _doPush(merged);
        }, PUSH_DEBOUNCE_MS + 50);
      }

      // Reset the "ok" indicator after 3 s so it doesn't linger
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch {
      setTimeout(() => { syncInProgressRef.current = false; }, 0);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 4000);
    }
  }

  /**
   * Hard-sync: clear LocalStorage cache first, then pull fresh data from cloud.
   * Exposed so the Sync button in the Navbar can call it.
   */
  const syncFromCloud = useCallback(() => _doFetch('manual', true), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Vocabulary mutations ───────────────────────────────────────────────────

  /** Add a new word (returns false if duplicate) */
  function addWord(wordObj) {
    const exists = words.some(
      w => w.english.toLowerCase() === wordObj.english.toLowerCase()
    );
    if (exists) return false;
    const newWord = {
      id:            Date.now().toString(),
      english:       wordObj.english.trim(),
      vietnamese:    wordObj.vietnamese.trim(),
      imageUrl:      wordObj.imageUrl?.trim() || '',
      wordType:      wordObj.wordType || 'Word',
      level:         1,
      currentStreak: 0,
      createdAt:     Date.now(),
    };
    setWords(prev => [newWord, ...prev]);
    return true;
  }

  /** Delete a word by id */
  function deleteWord(id) {
    setWords(prev => prev.filter(w => w.id !== id));
  }

  /** Update word fields */
  function updateWord(id, fields) {
    setWords(prev =>
      prev.map(w => (w.id === id ? { ...w, ...fields } : w))
    );
  }

  /**
   * Promote or demote word level after quiz using streak-based spaced repetition.
   * - Correct: increment streak; if streak >= threshold for current level → level up, reset streak
   * - Wrong:   reset streak to 0 and drop back one level (capped at L1)
   */
  function updateWordLevel(wordEnglish, isCorrect) {
    setWords(prev =>
      prev.map(w => {
        if (w.english.toLowerCase() !== wordEnglish.toLowerCase()) return w;
        const currentStreak = w.currentStreak ?? 0;
        if (isCorrect) {
          const newStreak = currentStreak + 1;
          const threshold = LEVEL_UP_THRESHOLD[w.level];
          if (threshold && newStreak >= threshold) {
            return {
              ...w,
              level: Math.min(5, w.level + 1),
              currentStreak: 0,
              lastReviewedDate: Date.now(),
            };
          }
          return { ...w, currentStreak: newStreak, lastReviewedDate: Date.now() };
        } else {
          return { ...w, level: Math.max(1, w.level - 1), currentStreak: 0, lastReviewedDate: Date.now() };
        }
      })
    );
  }

  /** Bulk update level for a set of word IDs */
  function bulkUpdateLevel(ids, newLevel) {
    setWords(prev =>
      prev.map(w =>
        ids.has(w.id)
          ? { ...w, level: newLevel, currentStreak: 0 }
          : w
      )
    );
  }

  /** Record quiz results */
  function recordQuizResult(correct, total) {
    setStats(prev => ({
      totalQuestions: prev.totalQuestions + total,
      correctAnswers: prev.correctAnswers + correct,
    }));
  }

  /** Replace all words (for import) */
  function importWords(wordList) {
    setWords(wordList);
  }

  return {
    words,
    stats,
    syncStatus,
    syncMode,
    pushStatus,
    addWord,
    deleteWord,
    updateWord,
    updateWordLevel,
    bulkUpdateLevel,
    recordQuizResult,
    importWords,
    syncFromCloud,
  };
}
