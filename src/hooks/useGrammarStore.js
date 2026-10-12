import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getSavedQuestions, saveSavedQuestions,
  getGrammarStats,   saveGrammarStats,
  getReviewProgress, saveReviewProgress,
  isGrammarDueForReview, calcNextReviewAt,
  GRAMMAR_REVIEW_INTERVALS,
} from '../utils/grammarStorage';
import { pushGrammarToCloud, fetchGrammarFromCloud, isGrammarCloudConfigured } from '../utils/grammarCloud';

const PUSH_DEBOUNCE_MS = 2000;

/**
 * Central state hook for the Grammar module.
 * Handles saved questions, review progress, stats, and cloud sync.
 */
export function useGrammarStore() {
  const [savedQuestions, setSavedQuestions] = useState(() => getSavedQuestions());
  const [reviewProgress, setReviewProgress] = useState(() => getReviewProgress());
  const [grammarStats,   setGrammarStats]   = useState(() => getGrammarStats());
  const [syncStatus,     setSyncStatus]     = useState('idle');
  const [cloudConfigured, setCloudConfigured] = useState(() => isGrammarCloudConfigured());

  const pushTimerRef = useRef(null);
  // Revision counter for stale-device conflict prevention
  const localRevision = useRef(getRevision());

  function getRevision() {
    return Number(localStorage.getItem('vocabmaster_grammar_revision') || '0');
  }
  function bumpRevision() {
    const next = getRevision() + 1;
    localStorage.setItem('vocabmaster_grammar_revision', String(next));
    localRevision.current = next;
    return next;
  }

  // ── Persist saved questions ───────────────────────────────────────────────
  useEffect(() => {
    saveSavedQuestions(savedQuestions);
    clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(async () => {
      if (!isGrammarCloudConfigured()) return;
      const rev = bumpRevision();
      await pushGrammarToCloud({ savedQuestions, reviewProgress, revision: rev });
    }, PUSH_DEBOUNCE_MS);
    return () => clearTimeout(pushTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedQuestions]);

  // ── Persist review progress ───────────────────────────────────────────────
  useEffect(() => {
    saveReviewProgress(reviewProgress);
  }, [reviewProgress]);

  // ── Persist stats ─────────────────────────────────────────────────────────
  useEffect(() => {
    saveGrammarStats(grammarStats);
  }, [grammarStats]);

  // ── Cloud sync ─────────────────────────────────────────────────────────────
  const syncFromCloud = useCallback(async () => {
    if (!isGrammarCloudConfigured()) return;
    setSyncStatus('syncing');
    try {
      const data = await fetchGrammarFromCloud();
      if (!data) { setSyncStatus('error'); setTimeout(() => setSyncStatus('idle'), 4000); return; }

      // Conflict prevention: only accept cloud data if server revision >= local
      const serverRev = data.serverRevision ?? 0;
      const localRev  = getRevision();
      if (serverRev < localRev) {
        // Local is newer — push local data instead
        await pushGrammarToCloud({ savedQuestions, reviewProgress, revision: localRev });
        setSyncStatus('ok');
      } else {
        setSavedQuestions(data.savedQuestions);
        setReviewProgress(data.reviewProgress ?? {});
        localRevision.current = serverRev;
        localStorage.setItem('vocabmaster_grammar_revision', String(serverRev));
        setSyncStatus('ok');
      }
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 4000);
    }
  }, [savedQuestions, reviewProgress]);

  // ── Saved Questions mutations ─────────────────────────────────────────────

  /**
   * Save a question. Returns 'saved' | 'duplicate' | 'ok'.
   * Duplicate detection: same sentence text.
   */
  function saveQuestion(question) {
    const isDuplicate = savedQuestions.some(q =>
      q.sentence?.trim().toLowerCase() === question.sentence?.trim().toLowerCase()
    );
    if (isDuplicate) return 'duplicate';

    const newQ = {
      ...question,
      savedId:    `gq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      savedAt:    Date.now(),
      hardMarked: false,
      userNotes:  '',
    };
    setSavedQuestions(prev => [newQ, ...prev]);
    return 'saved';
  }

  function unsaveQuestion(savedId) {
    setSavedQuestions(prev => prev.filter(q => q.savedId !== savedId));
    setReviewProgress(prev => {
      const next = { ...prev };
      delete next[savedId];
      return next;
    });
  }

  function isQuestionSaved(sentence) {
    return savedQuestions.some(q =>
      q.sentence?.trim().toLowerCase() === sentence?.trim().toLowerCase()
    );
  }

  function toggleHardMark(savedId) {
    setSavedQuestions(prev =>
      prev.map(q => q.savedId === savedId ? { ...q, hardMarked: !q.hardMarked } : q)
    );
  }

  function updateNotes(savedId, notes) {
    setSavedQuestions(prev =>
      prev.map(q => q.savedId === savedId ? { ...q, userNotes: notes } : q)
    );
  }

  // ── Review Progress mutations ─────────────────────────────────────────────

  /**
   * Record a review answer.
   * @param {string} savedId
   * @param {boolean} isCorrect
   */
  function recordReview(savedId, isCorrect) {
    setReviewProgress(prev => {
      const rec = prev[savedId] ?? { level: 1, wrongCount: 0, totalReviews: 0 };
      let newLevel = rec.level;
      if (isCorrect) {
        newLevel = Math.min(5, rec.level + 1);
      } else {
        newLevel = Math.max(1, rec.level - 1);
      }
      return {
        ...prev,
        [savedId]: {
          level:        newLevel,
          wrongCount:   isCorrect ? rec.wrongCount : rec.wrongCount + 1,
          totalReviews: rec.totalReviews + 1,
          lastReviewAt: Date.now(),
          nextReviewAt: calcNextReviewAt(newLevel),
        },
      };
    });
  }

  // ── Stats mutations ───────────────────────────────────────────────────────

  /**
   * Record a grammar practice session result.
   * @param {{ topic: string, difficulty: string, correct: number, total: number }} result
   */
  function recordGrammarSession(result) {
    setGrammarStats(prev => {
      const byTopic = { ...prev.byTopic };
      const t = result.topic || 'Mixed';
      byTopic[t] = {
        answered: (byTopic[t]?.answered ?? 0) + result.total,
        correct:  (byTopic[t]?.correct  ?? 0) + result.correct,
      };

      const byDiff = { ...prev.byDifficulty };
      const d = result.difficulty || 'Medium';
      byDiff[d] = {
        answered: (byDiff[d]?.answered ?? 0) + result.total,
        correct:  (byDiff[d]?.correct  ?? 0) + result.correct,
      };

      const sessions = [
        {
          date:       Date.now(),
          topic:      t,
          difficulty: d,
          correct:    result.correct,
          total:      result.total,
        },
        ...prev.sessions.slice(0, 19),
      ];

      return {
        ...prev,
        totalAnswered:  prev.totalAnswered  + result.total,
        correctAnswers: prev.correctAnswers + result.correct,
        byTopic,
        byDifficulty: byDiff,
        sessions,
      };
    });
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const dueForReview = savedQuestions.filter(q => {
    const rec = reviewProgress[q.savedId];
    return isGrammarDueForReview(rec);
  });

  const wrongQuestions = savedQuestions.filter(q => {
    const rec = reviewProgress[q.savedId];
    return rec && rec.wrongCount > 0;
  });

  return {
    // State
    savedQuestions,
    reviewProgress,
    grammarStats,
    syncStatus,
    cloudConfigured,
    setCloudConfigured,
    // Derived
    dueForReview,
    wrongQuestions,
    // Actions
    saveQuestion,
    unsaveQuestion,
    isQuestionSaved,
    toggleHardMark,
    updateNotes,
    recordReview,
    recordGrammarSession,
    syncFromCloud,
    GRAMMAR_REVIEW_INTERVALS,
  };
}
