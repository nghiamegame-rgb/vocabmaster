import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getSavedQuestions, saveSavedQuestions,
  getGrammarStats,   saveGrammarStats,
  getReviewProgress, saveReviewProgress,
  getGrammarRevision, saveGrammarRevision,
  hasGrammarPending, setGrammarPending,
  isGrammarDueForReview, calcNextReviewAt,
  GRAMMAR_REVIEW_INTERVALS,
} from '../utils/grammarStorage';
import { pushGrammarToCloud, fetchGrammarFromCloud, isGrammarCloudConfigured } from '../utils/grammarCloud';
import { mergeSavedQuestions, mergeReviewProgress } from '../utils/grammarSyncMerge';

const PUSH_DEBOUNCE_MS = 2500;

/**
 * Central state hook for the Grammar module with robust cloud synchronization.
 *
 * Guarantees:
 * - Strict server-side Compare-and-Swap (CAS).
 * - Automatic conflict resolution with deterministic 3-way merge.
 * - Local pending changes are preserved during network or server failures.
 * - Both saved question mutations and review progress are synchronized.
 */
export function useGrammarStore() {
  const [savedQuestions,  setSavedQuestions]  = useState(() => getSavedQuestions());
  const [reviewProgress,  setReviewProgress]  = useState(() => getReviewProgress());
  const [grammarStats,    setGrammarStats]    = useState(() => getGrammarStats());
  const [syncStatus,      setSyncStatus]      = useState('idle'); // 'idle' | 'syncing' | 'ok' | 'error' | 'conflict'
  const [hasPending,      setHasPending]      = useState(() => hasGrammarPending());
  const [cloudConfigured, setCloudConfigured] = useState(() => isGrammarCloudConfigured());

  // Refs for tracking latest values in asynchronous callbacks
  const savedQuestionsRef = useRef(savedQuestions);
  const reviewProgressRef = useRef(reviewProgress);
  const pushTimerRef      = useRef(null);
  const isSyncingRef      = useRef(false);

  useEffect(() => {
    savedQuestionsRef.current = savedQuestions;
  }, [savedQuestions]);

  useEffect(() => {
    reviewProgressRef.current = reviewProgress;
  }, [reviewProgress]);

  // ── Persist locally immediately on any change ─────────────────────────────
  useEffect(() => {
    saveSavedQuestions(savedQuestions);
  }, [savedQuestions]);

  useEffect(() => {
    saveReviewProgress(reviewProgress);
  }, [reviewProgress]);

  useEffect(() => {
    saveGrammarStats(grammarStats);
  }, [grammarStats]);

  // ── Core Push Function with CAS & Conflict Resolution ──────────────────────

  const executePush = useCallback(async () => {
    if (!isGrammarCloudConfigured() || isSyncingRef.current) return false;
    isSyncingRef.current = true;
    setSyncStatus('syncing');

    try {
      const currentQuestions = savedQuestionsRef.current;
      const currentReview    = reviewProgressRef.current;
      const baseRev          = getGrammarRevision();

      const result = await pushGrammarToCloud({
        savedQuestions:   currentQuestions,
        reviewProgress:   currentReview,
        expectedRevision: baseRev,
        confirmEmpty:     currentQuestions.length === 0,
      });

      if (result.ok) {
        // Confirmed persistence on server
        saveGrammarRevision(result.revision);
        setGrammarPending(false);
        setHasPending(false);
        setSyncStatus('ok');
        setTimeout(() => setSyncStatus('idle'), 3000);
        isSyncingRef.current = false;
        return true;
      }

      if (result.error === 'conflict') {
        // CAS conflict: server revision != expected revision
        setSyncStatus('conflict');

        // Automatic Smart Merge
        const cloudData = await fetchGrammarFromCloud();
        if (cloudData) {
          const mergedQ = mergeSavedQuestions(currentQuestions, cloudData.savedQuestions);
          const mergedR = mergeReviewProgress(currentReview, cloudData.reviewProgress);

          setSavedQuestions(mergedQ);
          setReviewProgress(mergedR);
          savedQuestionsRef.current = mergedQ;
          reviewProgressRef.current = mergedR;

          const targetRev = cloudData.serverRevision;
          saveGrammarRevision(targetRev);

          // Retry push with merged data and updated revision
          const retry = await pushGrammarToCloud({
            savedQuestions:   mergedQ,
            reviewProgress:   mergedR,
            expectedRevision: targetRev,
            confirmEmpty:     mergedQ.length === 0,
          });

          if (retry.ok) {
            saveGrammarRevision(retry.revision);
            setGrammarPending(false);
            setHasPending(false);
            setSyncStatus('ok');
            setTimeout(() => setSyncStatus('idle'), 3000);
            isSyncingRef.current = false;
            return true;
          }
        }
      }

      // If push or retry failed: preserve local pending changes!
      setGrammarPending(true);
      setHasPending(true);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 4000);
      isSyncingRef.current = false;
      return false;

    } catch {
      setGrammarPending(true);
      setHasPending(true);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 4000);
      isSyncingRef.current = false;
      return false;
    }
  }, []);

  // ── Debounced auto-sync trigger ───────────────────────────────────────────

  const schedulePush = useCallback(() => {
    setGrammarPending(true);
    setHasPending(true);
    clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      executePush(false);
    }, PUSH_DEBOUNCE_MS);
  }, [executePush]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => clearTimeout(pushTimerRef.current);
  }, []);

  // ── Manual Sync from Cloud (Sync Button) ──────────────────────────────────

  const syncFromCloud = useCallback(async () => {
    if (!isGrammarCloudConfigured()) return;
    clearTimeout(pushTimerRef.current);

    setSyncStatus('syncing');
    try {
      const cloudData = await fetchGrammarFromCloud();
      if (!cloudData) {
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 4000);
        return;
      }

      const currentQ = savedQuestionsRef.current;
      const currentR = reviewProgressRef.current;
      const isPending = hasGrammarPending();

      if (isPending) {
        // Local has pending changes: merge local with cloud, then push merged state
        const mergedQ = mergeSavedQuestions(currentQ, cloudData.savedQuestions);
        const mergedR = mergeReviewProgress(currentR, cloudData.reviewProgress);

        setSavedQuestions(mergedQ);
        setReviewProgress(mergedR);
        savedQuestionsRef.current = mergedQ;
        reviewProgressRef.current = mergedR;

        const targetRev = cloudData.serverRevision;
        saveGrammarRevision(targetRev);

        const pushRes = await pushGrammarToCloud({
          savedQuestions:   mergedQ,
          reviewProgress:   mergedR,
          expectedRevision: targetRev,
          confirmEmpty:     mergedQ.length === 0,
        });

        if (pushRes.ok) {
          saveGrammarRevision(pushRes.revision);
          setGrammarPending(false);
          setHasPending(false);
          setSyncStatus('ok');
        } else {
          setSyncStatus('error');
        }
      } else {
        // No local pending changes: accept cloud state
        setSavedQuestions(cloudData.savedQuestions);
        setReviewProgress(cloudData.reviewProgress);
        savedQuestionsRef.current = cloudData.savedQuestions;
        reviewProgressRef.current = cloudData.reviewProgress;
        saveGrammarRevision(cloudData.serverRevision);
        setGrammarPending(false);
        setHasPending(false);
        setSyncStatus('ok');
      }

      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 4000);
    }
  }, []);

  // ── Saved Questions Mutations ─────────────────────────────────────────────

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
    schedulePush();
    return 'saved';
  }

  function unsaveQuestion(savedId) {
    setSavedQuestions(prev => prev.filter(q => q.savedId !== savedId));
    setReviewProgress(prev => {
      const next = { ...prev };
      delete next[savedId];
      return next;
    });
    schedulePush();
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
    schedulePush();
  }

  function updateNotes(savedId, notes) {
    setSavedQuestions(prev =>
      prev.map(q => q.savedId === savedId ? { ...q, userNotes: notes } : q)
    );
    schedulePush();
  }

  // ── Review Progress Mutations ─────────────────────────────────────────────

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
    schedulePush();
  }

  // ── Stats Mutations ───────────────────────────────────────────────────────

  function recordGrammarSession(result) {
    setGrammarStats(prev => {
      const byTopic = { ...prev.byTopic };
      const t = result.topic || 'Mixed';
      byTopic[t] = {
        answered: (byTopic[t]?.answered ?? 0) + result.total,
        correct:  (byTopic[t]?.correct  ?? 0) + result.correct,
      };

      const byDiff = { ...prev.byDifficulty };
      if (result.difficulty) {
        const d = result.difficulty;
        byDiff[d] = {
          answered: (byDiff[d]?.answered ?? 0) + result.total,
          correct:  (byDiff[d]?.correct  ?? 0) + result.correct,
        };
      }

      const sessions = [
        {
          date:       Date.now(),
          topic:      t,
          ...(result.difficulty ? { difficulty: result.difficulty } : {}),
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

  // ── Derived Data ──────────────────────────────────────────────────────────

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
    hasPending,
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
