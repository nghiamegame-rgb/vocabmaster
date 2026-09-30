import { useState, useEffect, useRef, useCallback } from 'react';
import { getWords, saveWords, getStats, saveStats } from '../utils/storage';
import { pushToCloud, fetchFromCloud } from '../utils/cloud';

/**
 * Spaced-repetition thresholds: consecutive correct answers needed
 * to advance from level N to level N+1.
 * L1→L2: 2, L2→L3: 4, L3→L4: 8, L4→L5: 15
 */
const LEVEL_UP_THRESHOLD = { 1: 2, 2: 4, 3: 8, 4: 15 };

/** Debounce delay (ms) before pushing to the cloud after a local change. */
const PUSH_DEBOUNCE_MS = 1500;

/**
 * Central state hook for VocabMaster.
 * Syncs words and stats from LocalStorage on mount and whenever they change.
 * Also handles cloud push (debounced POST) and cloud fetch (GET).
 */
export function useVocabStore() {
  const [words, setWords] = useState(() => getWords());
  const [stats, setStats] = useState(() => getStats());

  // Cloud sync state — exposed so the Navbar Sync button can reflect it
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'ok' | 'error'

  // Debounce timer ref for cloud push
  const pushTimerRef = useRef(null);

  // ── Persist words to LocalStorage + debounced push to cloud ──────────────
  useEffect(() => {
    saveWords(words);

    // Skip pushing an empty list (avoid overwriting cloud data on a fresh device)
    if (words.length === 0) return;

    clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      pushToCloud(words); // fire-and-forget; failures are silent
    }, PUSH_DEBOUNCE_MS);

    return () => clearTimeout(pushTimerRef.current);
  }, [words]);

  // ── Persist stats ─────────────────────────────────────────────────────────
  useEffect(() => {
    saveStats(stats);
  }, [stats]);

  // ── Auto-fetch from cloud when LocalStorage is empty on first load ────────
  useEffect(() => {
    if (getWords().length === 0) {
      // Don't await — run in background and hydrate state when done
      _doFetch('auto');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount

  // ── Internal fetch implementation ─────────────────────────────────────────
  async function _doFetch(trigger) {
    setSyncStatus('syncing');
    try {
      const cloudWords = await fetchFromCloud();

      // fetchFromCloud returns null for: unconfigured URL, network error,
      // empty sheet (0 rows), or malformed response.
      // In ALL those cases we must NOT overwrite local data.
      if (!cloudWords || cloudWords.length === 0) {
        setSyncStatus(trigger === 'manual' ? 'error' : 'idle');
        return;
      }

      // Cloud returned real data — safe to overwrite local store
      setWords(cloudWords);
      setSyncStatus('ok');

      // Reset the "ok" indicator after 3 s so it doesn't linger
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 4000);
    }
  }

  /**
   * Manually pull the latest data from the cloud.
   * Exposed so the Sync button in the Navbar can call it.
   */
  const syncFromCloud = useCallback(() => _doFetch('manual'), []);

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
   * - Wrong:   reset streak to 0 and drop ALL THE WAY back to L1 (strict reset)
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
            return { ...w, level: Math.min(5, w.level + 1), currentStreak: 0 };
          }
          return { ...w, currentStreak: newStreak };
        } else {
          return { ...w, level: 1, currentStreak: 0 };
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
