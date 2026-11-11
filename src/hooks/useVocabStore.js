import { useState, useEffect, useCallback, useRef } from 'react';
import { getStats, saveStats } from '../utils/storage';
import { pushToCloud, fetchFromCloud } from '../utils/cloud';
import { createVocabBackupStore, storageMessage } from '../utils/vocabBackup';
import { VocabSync, BACKUP_PREFIX, STATE_KEY, PAUSE_KEY } from '../utils/vocabSync';

const LEVEL_UP_THRESHOLD = { 1: 2, 2: 4, 3: 8, 4: 15 };
export const REVIEW_INTERVALS = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
export function isDueForReview(word) {
  if (!word.lastReviewedDate) return true;
  return Date.now() - word.lastReviewedDate >= (REVIEW_INTERVALS[word.level] ?? 1) * 86400000;
}
export function useVocabStore() {
  const [, render] = useState(0);
  const [initial] = useState(() => {
    try { return { engine: new VocabSync({ storage: localStorage,
      transport: { read: fetchFromCloud, write: pushToCloud } }), error: '' }; }
    catch (error) { return { engine: null, error: 'Không đọc/lưu được Vocabulary: ' + error.message }; }
  });
  const engine = initial.engine, loadError = engine?.loadError || initial.error;
  const [exportError, setExportError] = useState('');
  const [stats, setStats] = useState(getStats);
  const statsRef = useRef(stats);
  const [statsError, setStatsError] = useState('');
  const words = engine?.state?.words || [];
  const setWords = useCallback(async update => {
    if (!engine) return false;
    try { await engine.edit(update); return true; }
    catch (error) { engine.reportError(error); return false; }
  }, [engine]);
  useEffect(() => {
    if (!engine) return;
    engine.subscribe(() => render(n => n + 1));
    const online = () => engine.schedule(0);
    const storage = event => engine.storageChanged(event.key);
    engine.start();
    window.addEventListener('online', online);
    window.addEventListener('focus', online);
    window.addEventListener('storage', storage);
    return () => { engine.stop(); engine.subscribe(() => {}); window.removeEventListener('online', online); window.removeEventListener('focus', online); window.removeEventListener('storage', storage); };
  }, [engine]);
  const syncFromCloud = useCallback(() => {
    if (statsError) {
      try { saveStats(stats); setStatsError(''); }
      catch (error) { setStatsError('Thống kê: ' + storageMessage(error)); }
    }
    engine?.schedule(0);
  }, [engine, stats, statsError]);
  const syncStatus = engine?.status === 'pushing' ? 'syncing' : engine?.status || 'error';
  const pushStatus = ['pushing', 'error'].includes(engine?.status) ? engine.status : 'idle';
  const cloudReadStatus = engine?.readStatus || 'error';
  const syncMode = 'soft';
  async function exportSyncBackup() {
    const data = {};
    try {
      data.indexedDBBackups = await (engine?.backups || createVocabBackupStore()).entries();
    } catch (error) {
      data.backupReadError = error.message;
      setExportError(storageMessage(error) + ' Tệp tải xuống chỉ là bản sao một phần; chưa xuất được IndexedDB.');
    }
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(BACKUP_PREFIX) || [STATE_KEY, PAUSE_KEY, 'vocabmaster_words', 'vocabmaster_stats'].includes(key)) data[key] = localStorage.getItem(key);
      }
      if (engine?.pendingEdit) data.pendingEdit = engine.pendingEdit;
      if (engine?.state) data.displayedState = engine.state;
      if (statsError) data.pendingStats = statsRef.current;
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'vocabulary-recovery-backup-' + Date.now() + '.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (!data.backupReadError) setExportError('');
    } catch (error) { setExportError(storageMessage(error)); }
  }

  /** Add a new word (returns false if duplicate) */
  const addWord = useCallback(async (wordObj) => {
    if (!engine || loadError) return false;
    const exists = (engine.pendingEdit || engine.state).words.some(
      w => w.english.toLowerCase() === wordObj.english.toLowerCase()
    );
    if (exists) return false;
    const newWord = {
      id:            crypto.randomUUID(),
      english:       wordObj.english.trim(),
      annotation:    typeof wordObj.annotation === 'string' ? wordObj.annotation.trim() : '',
      vietnamese:    wordObj.vietnamese.trim(),
      imageUrl:      wordObj.imageUrl?.trim() || '',
      wordType:      wordObj.wordType || 'Word',
      level:         wordObj.level         ?? 1,
      currentStreak: wordObj.currentStreak ?? 0,
      createdAt:     wordObj.createdAt     ?? Date.now(),
      ...(wordObj.lastReviewedDate != null ? { lastReviewedDate: wordObj.lastReviewedDate } : {}),
      ...(wordObj.hardMarked ? { hardMarked: true } : {}),
    };
    return setWords(prev => {
      if (prev.some(w => w.english.toLowerCase() === newWord.english.toLowerCase())) throw new Error('duplicate_word');
      return [newWord, ...prev];
    });
  }, [engine, loadError, setWords]);

  /** Delete a word by id */
  const deleteWord = useCallback((id) => {
    return setWords(prev => prev.filter(w => w.id !== id));
  }, [setWords]);

  /** Update word fields (annotation and hardMarked are preserved across updates) */
  const updateWord = useCallback((id, fields) => {
    return setWords(prev =>
      prev.map(w => {
        if (w.id !== id) return w;
        const updated = { ...w, ...fields };
        // Always ensure annotation field is a string
        if (typeof updated.annotation !== 'string') updated.annotation = '';
        if ('hardMarked' in updated) {
          if (updated.hardMarked) updated.hardMarked = true;
          else delete updated.hardMarked;
        }
        return updated;
      })
    );
  }, [setWords]);

  /** Toggle independent difficult-word star flag without affecting progress/stats */
  const toggleWordHard = useCallback((id) => {
    return setWords(prev =>
      prev.map(w => {
        if (w.id !== id) return w;
        const next = { ...w };
        if (next.hardMarked) delete next.hardMarked;
        else next.hardMarked = true;
        return next;
      })
    );
  }, [setWords]);

  /**
   * Promote or demote word level after quiz using streak-based spaced repetition.
   * - Correct: increment streak; if streak >= threshold for current level → level up, reset streak
   * - Wrong:   reset streak to 0 and drop back one level (capped at L1)
   */
  function updateWordLevel(wordEnglish, isCorrect) {
    return setWords(prev =>
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
  const bulkUpdateLevel = useCallback((ids, newLevel) => {
    return setWords(prev =>
      prev.map(w =>
        ids.has(w.id)
          ? { ...w, level: newLevel, currentStreak: 0 }
          : w
      )
    );
  }, [setWords]);

  /** Record quiz results */
  function recordQuizResult(correct, total) {
    const next = {
      totalQuestions: statsRef.current.totalQuestions + total,
      correctAnswers: statsRef.current.correctAnswers + correct,
    };
    statsRef.current = next; setStats(next);
    try { saveStats(next); setStatsError(''); }
    catch (error) { setStatsError('Thống kê: ' + storageMessage(error)); }
  }

  /** Additive import only. Whole-library replacement requires server generation change. */
  async function importWords(wordList) {
    for (const word of wordList) await addWord(word);
  }

  return {
    words,
    dataLoadError: loadError,
    syncNotice: [engine?.message || loadError, statsError, exportError].filter(Boolean).join(' '),
    hasReadableWords: engine?.hasReadableWords || false,
    syncPaused: !engine || engine.paused(),
    pauseSync: () => engine?.pause(true),
    resumeSync: () => engine?.pause(false),
    exportSyncBackup,
    cloudReadStatus,
    stats,
    syncStatus,
    syncMode,
    pushStatus,
    addWord,
    deleteWord,
    updateWord,
    toggleWordHard,
    updateWordLevel,
    bulkUpdateLevel,
    recordQuizResult,
    importWords,
    syncFromCloud,
  };
}
