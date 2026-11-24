import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getSavedQuestions, saveSavedQuestions,
  getGrammarStats, saveGrammarStats,
  getReviewProgress, saveReviewProgress, saveGrammarReviewResult,
  getGrammarRevision, saveGrammarRevision,
  getGrammarCloudUrl, hasGrammarPending, setGrammarPending,
  isGrammarDueForReview, calcNextReviewAt, GRAMMAR_REVIEW_INTERVALS,
} from '../utils/grammarStorage';
import { pushGrammarToCloud, fetchGrammarFromCloud } from '../utils/grammarCloud';
import { mergeSavedQuestions, mergeReviewProgress } from '../utils/grammarSyncMerge';
import { getAllUnderlines, getUnderlinesForKey, saveUnderlinesForKey, migrateUnderlineKey } from '../utils/grammarStorage';
import { applyUnderline } from '../utils/sentenceUnderline';
import { editSentenceNote, moveSentenceNotes, readSentenceNotes, writeSentenceNotes } from '../utils/sentenceNotes';
import { getGrammarSentence } from '../utils/grammarSentence';

const PUSH_DEBOUNCE_MS = 2500;

export function useGrammarStore() {
  const [initialRead] = useState(() => getSavedQuestions({ withStatus: true }));
  const [savedQuestions, setSavedQuestions] = useState(() => initialRead.data);
  const [reviewProgress, setReviewProgress] = useState(() => getReviewProgress());
  const [grammarStats, setGrammarStats] = useState(() => getGrammarStats());
  const [underlines, setUnderlines] = useState(() => getAllUnderlines());
  const [sentenceNotes, setSentenceNotes] = useState(() => readSentenceNotes());
  const [syncStatus, setSyncStatus] = useState('syncing');
  const [hasPending, setHasPending] = useState(() => hasGrammarPending());
  const [endpoint, setEndpoint] = useState(() => getGrammarCloudUrl());
  const cloudConfigured = Boolean(endpoint);

  const savedQuestionsRef = useRef(savedQuestions);
  // Deleted sentences stay in storage/cloud as tombstones ({ deletedAt }) so
  // other devices cannot revive them; every reader uses only live records.
  const liveOf = questions => questions.filter(q => !q.deletedAt);
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

  const [storageError, setStorageError] = useState('');

  // Publish refs/state only after both LocalStorage writes succeed. If the
  // second write fails, restore the first so disk, refs and UI stay identical.
  const persistData = useCallback((questions, review) => {
    const previousQuestions = savedQuestionsRef.current;
    try {
      saveSavedQuestions(questions);
      try { saveReviewProgress(review); }
      catch (error) {
        try { saveSavedQuestions(previousQuestions); } catch { /* keep the first error */ }
        throw error;
      }
    } catch (error) {
      const quota = error?.name === 'QuotaExceededError' || /quota/i.test(error?.message || '');
      setStorageError(quota
        ? 'Không đủ dung lượng lưu Grammar trên trình duyệt; thay đổi vừa rồi chưa được lưu. Dữ liệu cũ vẫn giữ nguyên.'
        : 'Không lưu được Grammar trên thiết bị; thay đổi vừa rồi chưa được lưu. Dữ liệu cũ vẫn giữ nguyên.');
      return false;
    }
    savedQuestionsRef.current = questions;
    reviewProgressRef.current = review;
    setSavedQuestions(questions);
    setReviewProgress(review);
    setStorageError('');
    return true;
  }, []);

  const markPending = useCallback(value => {
    pendingRef.current = value;
    setGrammarPending(value);
    setHasPending(value);
  }, []);

  useEffect(() => {
    // A full or blocked storage must not crash the app from inside an effect.
    try { saveGrammarStats(grammarStats); }
    catch (error) { console.error('Grammar stats storage', error?.name || 'Error'); }
  }, [grammarStats]);

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
    // Progress of tombstoned sentences is not kept (as when deleting locally).
    const dead = data.questions.filter(q => q.deletedAt).map(q => q.savedId);
    if (dead.some(id => id in data.review)) {
      data = { ...data, review: { ...data.review } };
      for (const id of dead) delete data.review[id];
    }
    return persistData(data.questions, data.review);
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
        // Never adopt the cloud revision without its data being stored locally.
        if (!mergeCloud(cloud)) break;
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
        if (!mergeCloud(cloud)) { setSyncStatus('error'); return; }
        // An already-empty cloud needs no empty POST from an empty cache.
        markPending(savedQuestionsRef.current.length > 0 || Object.keys(reviewProgressRef.current).length > 0);
      } else if (!persistData(cloud.savedQuestions, cloud.reviewProgress)) {
        setSyncStatus('error');
        return;
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
    // Persist synchronously so switching tabs cannot leave pending without data.
    // A failed write leaves the previous state untouched and is not replayed.
    if (!persistData(data.questions, data.review)) return false;
    changeVersionRef.current++;
    if (isSyncingRef.current) editsDuringSyncRef.current.push(edit);
    markPending(true);
    if (data.questions.length > 0) emptyDeletionRef.current = false;
    queuePush();
    return true;
  }

  function saveQuestion(question) {
    if (liveOf(savedQuestionsRef.current).some(q =>
      q.sentence?.trim().toLowerCase() === question.sentence?.trim().toLowerCase()
    )) return 'duplicate';
    const newQ = {
      ...question,
      savedId: `gq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      savedAt: Date.now(), hardMarked: false, userNotes: '',
    };
    if (!commitEdit(data => ({ ...data, questions: [newQ, ...data.questions.filter(q => q.savedId !== newQ.savedId)] }))) return 'error';
    migrateUnderlineKey(question.sentence, newQ.savedId);
    setUnderlines(getAllUnderlines());
    const notes = readSentenceNotes();
    const moved = moveSentenceNotes(notes, getGrammarSentence(question), newQ.savedId);
    if (moved !== notes && writeSentenceNotes(moved)) setSentenceNotes(moved);
    return 'saved';
  }

  function unsaveQuestion(savedId) {
    const explicitEmpty = readyRef.current && savedQuestionsRef.current.length === 1
      && savedQuestionsRef.current[0].savedId === savedId;
    const deletedAt = Date.now();
    const saved = commitEdit(data => {
      const review = { ...data.review };
      delete review[savedId];
      // Keep a tombstone instead of removing the record.
      return { questions: data.questions.map(q => q.savedId === savedId ? { ...q, deletedAt: q.deletedAt || deletedAt } : q), review };
    });
    if (saved && explicitEmpty) emptyDeletionRef.current = true;
  }

  function isQuestionSaved(sentence) {
    return liveOf(savedQuestionsRef.current).some(q => q.sentence?.trim().toLowerCase() === sentence?.trim().toLowerCase());
  }

  function toggleHardMark(savedId) {
    const hardMarked = !savedQuestionsRef.current.find(q => q.savedId === savedId)?.hardMarked;
    commitEdit(data => ({ ...data, questions: data.questions.map(q => q.savedId === savedId ? { ...q, hardMarked } : q) }));
  }

  function updateNotes(savedId, userNotes) {
    commitEdit(data => ({ ...data, questions: data.questions.map(q => q.savedId === savedId ? { ...q, userNotes } : q) }));
  }

  // -- Underline actions (local-only, not synced to cloud) ---
  function updateUnderlines(key, start, end, color) {
    if (!key) return [];
    const existing = getUnderlinesForKey(key);
    const updated  = applyUnderline(existing, start, end, color, Infinity);
    saveUnderlinesForKey(key, updated);
    // Same-page storage writes do not notify React. Publish the persisted snapshot
    // so every mounted sentence receives fresh marks without changing session state.
    setUnderlines(getAllUnderlines());
    return updated;
  }

  function updateSentenceNote(key, sentence, draft) {
    // Fresh read per edit avoids stale closures dropping a newer note edit.
    const current = readSentenceNotes();
    const next = editSentenceNote(current, { ...draft, key, sentence });
    if (next === current || !writeSentenceNotes(next)) return { ok: false };
    setSentenceNotes(next);
    return { ok: true };
  }

  function recordReview(savedId, isCorrect) {
    const question = liveOf(savedQuestionsRef.current).find(q => q.savedId === savedId);
    if (!question || typeof isCorrect !== 'boolean') return { ok: false, message: 'Không thể đánh giá: câu không còn trong kho hoặc lựa chọn không hợp lệ.' };
    const rec = reviewProgressRef.current[savedId] ?? { level: 1, wrongCount: 0, totalReviews: 0 };
    const previousLevel = Math.min(5, Math.max(1, Number(rec.level) || 1));
    const level = isCorrect ? Math.min(5, previousLevel + 1) : Math.max(1, previousLevel - 1);
    const next = {
      ...rec,
      level, wrongCount: (Number(rec.wrongCount) || 0) + (isCorrect ? 0 : 1),
      totalReviews: (Number(rec.totalReviews) || 0) + 1, lastReviewAt: Date.now(), nextReviewAt: calcNextReviewAt(level),
    };
    const result = {
      mode: 'sentence-analysis', activity: 'review', total: 1,
      understood: isCorrect ? 1 : 0,
      topic: question.topic || 'Mixed',
    };
    // Use the last acknowledged state: disk stats may contain a partial write
    // when both saving review and rolling back stats failed. Retry must not add twice.
    const previousStats = grammarStats;
    const activity = previousStats.sentenceActivity || {};
    const oldTopic = activity.byTopic?.[result.topic] || {};
    const stats = { ...previousStats, sentenceActivity: {
      ...activity,
      analyzed: activity.analyzed || 0,
      reviewed: (activity.reviewed || 0) + 1,
      understood: (activity.understood || 0) + result.understood,
      byTopic: { ...activity.byTopic, [result.topic]: {
        analyzed: oldTopic.analyzed || 0,
        reviewed: (oldTopic.reviewed || 0) + 1,
        understood: (oldTopic.understood || 0) + result.understood,
      } },
      sessions: [{ ...result, date: Date.now() }, ...(activity.sessions || []).slice(0, 19)],
    } };
    const edit = data => ({ ...data, review: { ...data.review, [savedId]: next } });
    const review = edit({ review: reviewProgressRef.current }).review;
    // Publish state/replay/sync only after local progress, stats and pending save.
    try { saveGrammarReviewResult(review, stats); } catch (error) {
      return { ok: false, diagnostics: error.diagnostics };
    }
    reviewProgressRef.current = review;
    pendingRef.current = true;
    changeVersionRef.current++;
    if (isSyncingRef.current) editsDuringSyncRef.current.push(edit);
    setReviewProgress(review);
    setGrammarStats(stats);
    setHasPending(true);
    queuePush();
    return { ok: true };
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

  const liveQuestions = liveOf(savedQuestions);
  const dueForReview = liveQuestions.filter(q => {
    const rec = reviewProgress[q.savedId];
    return isGrammarDueForReview(rec);
  });

  const wrongQuestions = liveQuestions.filter(q => {
    const rec = reviewProgress[q.savedId];
    return rec && rec.wrongCount > 0;
  });

  return {
    // State
    dataLoadError: initialRead.error,
    storageError,
    savedQuestions: liveQuestions,
    reviewProgress,
    grammarStats,
    underlines,
    sentenceNotes,
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
    updateUnderlines,
    updateSentenceNote,
    syncFromCloud,
    GRAMMAR_REVIEW_INTERVALS,
  };
}
