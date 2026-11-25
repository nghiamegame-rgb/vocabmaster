import { useCallback, useMemo, useRef, useState } from 'react';
import { readDictationData, writeDictationData, getDictationDeviceId } from '../utils/dictationStorage';
import {
  addLesson as addLessonTo, deleteLesson as deleteLessonFrom, recordSentenceResult as recordResultIn,
  saveWord as saveWordIn, unsaveWord as unsaveWordIn, recordWordListen as recordListenIn, lessonsOf,
} from '../utils/dictationModel';
import { liveRecords, mergeDictationData, validateDictationData } from '../utils/dictationSyncMerge';
import { normalizeWord } from '../utils/dictationCheck';

/**
 * Dictation store (lessons/sentences + personally saved words).
 * Lives in App so other tabs (Listening) can use the saved words.
 * Separate LocalStorage keys; never touches Vocabulary/Grammar/Structures.
 */
export function useDictationStore() {
  const [initial] = useState(() => readDictationData());
  const [data, setData] = useState(initial.data);
  const [storageError, setStorageError] = useState(initial.error);
  const dataRef = useRef(initial.data);
  const lockedRef = useRef(Boolean(initial.error));
  const deviceId = useMemo(() => getDictationDeviceId(), []);

  /** Persist first, publish after: a failed write never shows as saved. */
  const commit = useCallback(update => {
    if (lockedRef.current) return null;
    const next = update(dataRef.current);
    if (next === dataRef.current) return next;
    try { writeDictationData(next); } catch (error) {
      const quota = error?.name === 'QuotaExceededError' || /quota/i.test(error?.message || '');
      setStorageError(quota
        ? 'Không đủ dung lượng trình duyệt để lưu dữ liệu chép chính tả; thay đổi vừa rồi chưa được lưu.'
        : 'Không lưu được dữ liệu chép chính tả trên thiết bị; thay đổi vừa rồi chưa được lưu.');
      return null;
    }
    dataRef.current = next;
    setData(next);
    setStorageError('');
    return next;
  }, []);

  const addLesson = useCallback((title, items) => {
    if (!Array.isArray(items) || items.length === 0) return { ok: false, error: 'Chưa có câu nào để tạo bài.' };
    let created = null;
    const saved = commit(current => { created = addLessonTo(current, { title, items }); return created.data; });
    return saved ? { ok: true, lessonId: created.lessonId, title: created.lessonTitle, count: items.length } : { ok: false, error: 'Chưa lưu được bài.' };
  }, [commit]);

  const deleteLesson = useCallback(lessonId => Boolean(commit(current => deleteLessonFrom(current, lessonId))), [commit]);

  const recordSentenceResult = useCallback((sentenceId, isCorrect) =>
    Boolean(commit(current => recordResultIn(current, sentenceId, isCorrect, deviceId))), [commit, deviceId]);

  const saveWord = useCallback((word, sentence) => {
    let status = 'invalid';
    const saved = commit(current => { const r = saveWordIn(current, { word, sentence }); status = r.status; return r.data; });
    return saved ? status : 'error';
  }, [commit]);

  const unsaveWord = useCallback(wordId => Boolean(commit(current => unsaveWordIn(current, wordId))), [commit]);

  const toggleWord = useCallback((word, sentence) => {
    const id = normalizeWord(word);
    const live = dataRef.current.words.find(w => w.id === id && !w.deletedAt);
    return live ? (unsaveWord(id) ? 'removed' : 'error') : saveWord(word, sentence);
  }, [saveWord, unsaveWord]);

  const recordWordListen = useCallback((wordId, isCorrect) =>
    Boolean(commit(current => recordListenIn(current, wordId, isCorrect, deviceId))), [commit, deviceId]);

  /** Restores a JSON backup by MERGING it (never replaces or deletes anything). */
  const importBackup = useCallback(json => {
    let parsed;
    try { parsed = typeof json === 'string' ? JSON.parse(json) : json; } catch { return { ok: false, error: 'Tệp không phải JSON hợp lệ.' }; }
    const snapshot = parsed?.dictation || parsed;
    const problem = validateDictationData(snapshot);
    if (problem) return { ok: false, error: `Bản sao không hợp lệ (${problem}); dữ liệu hiện tại giữ nguyên.` };
    const saved = commit(current => mergeDictationData(current, snapshot));
    return saved ? { ok: true, sentences: snapshot.sentences.length, words: snapshot.words.length } : { ok: false, error: 'Chưa lưu được bản sao vào thiết bị.' };
  }, [commit]);

  const exportBackup = useCallback(() => {
    const payload = { app: 'VocabMaster', kind: 'dictation-backup', schema: 1, exportedAt: new Date().toISOString(), dictation: dataRef.current };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `dictation-backup-${Date.now()}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }, []);

  const sentences = useMemo(() => liveRecords(data.sentences), [data]);
  const words = useMemo(() => liveRecords(data.words), [data]);
  const lessons = useMemo(() => lessonsOf(data), [data]);
  const isWordSaved = useCallback(word => words.some(w => w.id === normalizeWord(word)), [words]);

  return {
    data, sentences, words, lessons, deviceId,
    storageError, locked: Boolean(initial.error),
    addLesson, deleteLesson, recordSentenceResult,
    saveWord, unsaveWord, toggleWord, isWordSaved, recordWordListen,
    importBackup, exportBackup,
  };
}
