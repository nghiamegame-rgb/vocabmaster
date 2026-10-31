import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getSavedQuestions, saveSavedQuestions,
  getGrammarStats, saveGrammarStats,
  getReviewProgress, saveReviewProgress,
  getGrammarRevision, saveGrammarRevision,
  getGrammarCloudUrl, hasGrammarPending, setGrammarPending,
  isGrammarDueForReview, calcNextReviewAt, GRAMMAR_REVIEW_INTERVALS,
} from '../utils/grammarStorage';
import { pushGrammarToCloud, fetchGrammarFromCloud } from '../utils/grammarCloud';
import { mergeSavedQuestions, mergeReviewProgress } from '../utils/grammarSyncMerge';

const PUSH_DEBOUNCE_MS = 2500;

export function useGrammarStore() {
  const [savedQuestions, setSavedQuestions] = useState(() => getSavedQuestions());
  const [reviewProgress, setReviewProgress] = useState(() => getReviewProgress());
  const [grammarStats, setGrammarStats] = useState(() => getGrammarStats());
  const [syncStatus, setSyncStatus] = useState('syncing');
  const [hasPending, setHasPending] = useState(() => hasGrammarPending());
  const [endpoint, setEndpoint] = useState(() => getGrammarCloudUrl());
  const cloudConfigured = Boolean(endpoint);

  const savedQuestionsRef = useRef(savedQuestions);
  const reviewProgressRef = useRef(reviewProgress);
  const pendingRef = useRef(hasPending);
  const changeVersionRef = useRef(0);
  const sessionRef = useRef(0);
  const readyRef = useRef(false);
  const isSyncingRef = useRef(false);
  const pushTimerRef = useRef(null);
  const pushRef = useRef(null);
  const editsDuringSyncRef = useRef([]);
  // Only an explicit removal after hydration can authorize an empty write.
  const emptyDeletionRef = useRef(false);

  const persistData = useCallback((questions, review) => {
    savedQuestionsRef.current = questions;
    reviewProgressRef.current = review;
    saveSavedQuestions(questions);
    saveReviewProgress(review);
    setSavedQuestions(questions);
    setReviewProgress(review);
  }, []);

  const markPending = useCallback(value => {
    pendingRef.current = value;
    setGrammarPending(value);
    setHasPending(value);
  }, []);

  useEffect(() => { saveGrammarStats(grammarStats); }, [grammarStats]);

  const queuePush = useCallback(() => {
    clearTimeout(pushTimerRef.current);
    if (readyRef.current && !isSyncingRef.current && pendingRef.current) {
      pushTimerRef.current = setTimeout(() => pushRef.current(), PUSH_DEBOUNCE_MS);
    }
  }, []);

  // Retain Smart Merge, then replay edits made during the request. This also
  // preserves clearing notes, unmarking stars, deleting and lowering levels.
  const mergeCloud = useCallback(cloud => {
    let data = {
      questions: mergeSavedQuestions(savedQuestionsRef.current, cloud.savedQuestions),
      review: mergeReviewProgress(reviewProgressRef.current, cloud.reviewProgress),
    };
    for (const edit of editsDuringSyncRef.current) data = edit(data);
    editsDuringSyncRef.current = [];
    persistData(data.questions, data.review);
  }, [persistData]);

  const executePush = useCallback(async () => {
    if (!readyRef.current || isSyncingRef.current || !pendingRef.current) return;
    const session = sessionRef.current;
    const active = () => session === sessionRef.current && endpoint === getGrammarCloudUrl();
    if (!active()) return;
    clearTimeout(pushTimerRef.current);
    isSyncingRef.current = true;
    editsDuringSyncRef.current = [];
    setSyncStatus('syncing');
    let succeeded = false;
    try {
      // One conflict fetch/merge and one CAS retry, as before.
      for (let attempt = 0; attempt < 2; attempt++) {
        const version = changeVersionRef.current;
        const questions = savedQuestionsRef.current;
        if (questions.length === 0 && !emptyDeletionRef.current) {
          setSyncStatus('error');
          return;
        }
        const result = await pushGrammarToCloud({
          url: endpoint,
          savedQuestions: questions,
          reviewProgress: reviewProgressRef.current,
          expectedRevision: getGrammarRevision(),
          confirmEmpty: questions.length === 0 && emptyDeletionRef.current,
        });
        if (!active()) return;
        if (result.ok) {
          saveGrammarRevision(result.revision);
          // A newer local edit is not acknowledged by this response.
          markPending(changeVersionRef.current !== version);
          setSyncStatus(pendingRef.current ? 'syncing' : 'ok');
          succeeded = true;
          return;
        }
        if (result.error !== 'conflict' || attempt === 1) break;
        setSyncStatus('conflict');
        readyRef.current = false;
        const cloud = await fetchGrammarFromCloud(endpoint);
        if (!active()) return;
        if (!cloud) break;
        mergeCloud(cloud);
        saveGrammarRevision(cloud.serverRevision);
        readyRef.current = true;
        if (savedQuestionsRef.current.length > 0) emptyDeletionRef.current = false;
      }
      setSyncStatus('error');
    } catch {
      if (active()) setSyncStatus('error');
    } finally {
      if (active()) {
        isSyncingRef.current = false;
        if (succeeded) queuePush();
      }
    }
  }, [endpoint, markPending, mergeCloud, queuePush]);

  useEffect(() => { pushRef.current = executePush; }, [executePush]);

  const syncFromCloud = useCallback(async () => {
    if (isSyncingRef.current) return;
    const session = sessionRef.current;
    const active = () => session === sessionRef.current && endpoint === getGrammarCloudUrl();
    if (!active()) return;
    clearTimeout(pushTimerRef.current);
    readyRef.current = false;
    isSyncingRef.current = true;
    editsDuringSyncRef.current = [];
    setSyncStatus('syncing');
    try {
      const cloud = await fetchGrammarFromCloud(endpoint);
      if (!active()) return;
      if (!cloud) { setSyncStatus('error'); return; }
      // Legacy caches may contain useful data without a pending flag.
      // Merge before adopting the cloud revision and using the existing CAS push.
      const preserveLocal = savedQuestionsRef.current.length > 0
        || Object.keys(reviewProgressRef.current).length > 0;
      if (pendingRef.current || preserveLocal) {
        mergeCloud(cloud);
        // An already-empty cloud needs no empty POST from an empty cache.
        markPending(savedQuestionsRef.current.length > 0 || Object.keys(reviewProgressRef.current).length > 0);
      } else {
        persistData(cloud.savedQuestions, cloud.reviewProgress);
      }
      saveGrammarRevision(cloud.serverRevision);
      readyRef.current = true;
      setSyncStatus(pendingRef.current ? 'syncing' : 'ok');
    } catch {
      if (active()) setSyncStatus('error');
    } finally {
      if (active()) {
        isSyncingRef.current = false;
        queuePush();
      }
    }
  }, [endpoint, markPending, mergeCloud, persistData, queuePush]);

  // Handle URL A -> URL B even though both are configured.
  const setCloudConfigured = useCallback(() => {
    if (getGrammarCloudUrl() === endpoint) { syncFromCloud(); return; }
    sessionRef.current++;
    readyRef.current = false;
    isSyncingRef.current = false;
    emptyDeletionRef.current = false;
    clearTimeout(pushTimerRef.current);
    setSyncStatus('syncing');
    setEndpoint(getGrammarCloudUrl());
  }, [endpoint, syncFromCloud]);

  useEffect(() => {
    readyRef.current = false;
    isSyncingRef.current = false;
    emptyDeletionRef.current = false;
    syncFromCloud();
    const retry = () => syncFromCloud();
    window.addEventListener('online', retry);
    return () => {
      sessionRef.current++;
      readyRef.current = false;
      clearTimeout(pushTimerRef.current);
      window.removeEventListener('online', retry);
    };
  }, [syncFromCloud]);

  function commitEdit(edit) {
    const data = edit({ questions: savedQuestionsRef.current, review: reviewProgressRef.current });
    changeVersionRef.current++;
    if (isSyncingRef.current) editsDuringSyncRef.current.push(edit);
    // Persist synchronously so switching tabs cannot leave pending without data.
    persistData(data.questions, data.review);
    markPending(true);
    if (data.questions.length > 0) emptyDeletionRef.current = false;
    queuePush();
  }

  function saveQuestion(question) {
    if (savedQuestionsRef.current.some(q =>
      q.sentence?.trim().toLowerCase() === question.sentence?.trim().toLowerCase()
    )) return 'duplicate';
    const newQ = {
      ...question,
      savedId: `gq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      savedAt: Date.now(), hardMarked: false, userNotes: '',
    };
    commitEdit(data => ({ ...data, questions: [newQ, ...data.questions.filter(q => q.savedId !== newQ.savedId)] }));
    return 'saved';
  }

  function unsaveQuestion(savedId) {
    const explicitEmpty = readyRef.current && savedQuestionsRef.current.length === 1
      && savedQuestionsRef.current[0].savedId === savedId;
    commitEdit(data => {
      const review = { ...data.review };
      delete review[savedId];
      return { questions: data.questions.filter(q => q.savedId !== savedId), review };
    });
    if (explicitEmpty) emptyDeletionRef.current = true;
  }

  function isQuestionSaved(sentence) {
    return savedQuestionsRef.current.some(q => q.sentence?.trim().toLowerCase() === sentence?.trim().toLowerCase());
  }

  function toggleHardMark(savedId) {
    const hardMarked = !savedQuestionsRef.current.find(q => q.savedId === savedId)?.hardMarked;
    commitEdit(data => ({ ...data, questions: data.questions.map(q => q.savedId === savedId ? { ...q, hardMarked } : q) }));
  }

  function updateNotes(savedId, userNotes) {
    commitEdit(data => ({ ...data, questions: data.questions.map(q => q.savedId === savedId ? { ...q, userNotes } : q) }));
  }

  function recordReview(savedId, isCorrect) {
    const rec = reviewProgressRef.current[savedId] ?? { level: 1, wrongCount: 0, totalReviews: 0 };
    const previousLevel = Math.min(5, Math.max(1, Number(rec.level) || 1));
    const level = isCorrect ? Math.min(5, previousLevel + 1) : Math.max(1, previousLevel - 1);
    const next = {
      ...rec,
      level, wrongCount: (Number(rec.wrongCount) || 0) + (isCorrect ? 0 : 1),
      totalReviews: (Number(rec.totalReviews) || 0) + 1, lastReviewAt: Date.now(), nextReviewAt: calcNextReviewAt(level),
    };
    commitEdit(data => ({ ...data, review: { ...data.review, [savedId]: next } }));
    recordGrammarSession({
      mode: 'sentence-analysis', activity: 'review', total: 1,
      understood: isCorrect ? 1 : 0,
      topic: savedQuestionsRef.current.find(q => q.savedId === savedId)?.topic || 'Mixed',
    });
  }

  function recordGrammarSession(result) {
    setGrammarStats(prev => {
      // Separate self-assessment/activity from historical TOEIC accuracy.
      if (result.mode === 'sentence-analysis') {
        if (!result.total) return prev;
        const activity = prev.sentenceActivity || {};
        const review = result.activity === 'review';
        const topic = result.topic || 'Mixed';
        const byTopic = { ...activity.byTopic };
        const old = byTopic[topic] || {};
        byTopic[topic] = {
          analyzed: (old.analyzed || 0) + (review ? 0 : result.total),
          reviewed: (old.reviewed || 0) + (review ? result.total : 0),
          understood: (old.understood || 0) + (result.understood || 0),
        };
        return { ...prev, sentenceActivity: {
          ...activity,
          analyzed: (activity.analyzed || 0) + (review ? 0 : result.total),
          reviewed: (activity.reviewed || 0) + (review ? result.total : 0),
          understood: (activity.understood || 0) + (result.understood || 0),
          byTopic,
          sessions: [{ ...result, date: Date.now() }, ...(activity.sessions || []).slice(0, 19)],
        } };
      }
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
