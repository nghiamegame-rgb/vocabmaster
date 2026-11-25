import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readDictationData, writeDictationData, getDictationDeviceId } from '../utils/dictationStorage';
import {
  addLesson as addLessonTo, deleteLesson as deleteLessonFrom, recordSentenceResult as recordResultIn,
  saveWord as saveWordIn, unsaveWord as unsaveWordIn, recordWordListen as recordListenIn, lessonsOf,
} from '../utils/dictationModel';
import { canonicalJson, liveRecords, mergeDictationData, validateDictationData } from '../utils/dictationSyncMerge';
import { DICTATION_SYNC_URL, dictationSyncMessage, fetchDictationFromCloud, pushDictationToCloud } from '../utils/dictationCloud';

const PUSH_DEBOUNCE_MS = 2500;
const FOCUS_MIN_INTERVAL_MS = 30000;
import { normalizeWord } from '../utils/dictationCheck';

/**
 * Dictation store (lessons/sentences + personally saved words).
 * Lives in App so other tabs (Listening) can use the saved words and sync runs
 * while the Dictation tab is closed. Separate LocalStorage keys; never touches
 * Vocabulary/Grammar/Structures.
 *
 * Sync (same pattern as Structures): GET → merge → save locally → if the cloud
 * lacks anything, POST the merged snapshot with CAS on the revision; one retry
 * on conflict. Deletions are tombstones, so merging never revives them.
 */
export function useDictationStore({ url = DICTATION_SYNC_URL } = {}) {
  const [initial] = useState(() => readDictationData());
  const [data, setData] = useState(initial.data);
  const [storageError, setStorageError] = useState(initial.error);
  const dataRef = useRef(initial.data);
  const lockedRef = useRef(Boolean(initial.error));
  const deviceId = useMemo(() => getDictationDeviceId(), []);
  const [sync, setSync] = useState({ status: initial.error ? 'locked' : 'idle', message: '', lastSyncedAt: 0 });
  const busyRef = useRef(false);
  const timerRef = useRef(null);
  const syncRef = useRef(null);
  const sessionRef = useRef(0);
  const lastAttemptRef = useRef(0);

  const schedule = useCallback((delay = PUSH_DEBOUNCE_MS) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => syncRef.current?.(), delay);
  }, []);

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
    // Not set up yet: say so instead of promising an upload that cannot happen.
    setSync(prev => (busyRef.current || prev.status === 'unconfigured' ? prev : { ...prev, status: 'pending', message: '' }));
    schedule();
    return next;
  }, [schedule]);

  /** Writes merged cloud data locally; false when the device storage refuses. */
  const adopt = useCallback(next => {
    if (canonicalJson(next) === canonicalJson(dataRef.current)) return true;
    try { writeDictationData(next); } catch { return false; }
    dataRef.current = next;
    setData(next);
    return true;
  }, []);

  const syncNow = useCallback(async () => {
    if (lockedRef.current || busyRef.current) return;
    const session = sessionRef.current;
    const active = () => session === sessionRef.current;
    busyRef.current = true;
    lastAttemptRef.current = Date.now();
    clearTimeout(timerRef.current);
    setSync(prev => ({ ...prev, status: 'syncing', message: '' }));
    let outcome = { status: 'error', message: dictationSyncMessage('conflict') };
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const cloud = await fetchDictationFromCloud(url);
        if (!active()) return;
        if (!cloud.ok) {
          outcome = { status: cloud.error === 'unconfigured' || cloud.error === 'no_backend' ? 'unconfigured' : 'error', message: dictationSyncMessage(cloud.error) };
          return;
        }
        const merged = mergeDictationData(dataRef.current, cloud);
        if (!adopt(merged)) { outcome = { status: 'error', message: 'Không lưu được dữ liệu tải về trên thiết bị (bộ nhớ đầy?).' }; return; }
        if (canonicalJson(merged) === canonicalJson(mergeDictationData(cloud, {}))) {
          outcome = { status: 'ok', message: '', lastSyncedAt: Date.now() };
          return;
        }
        const result = await pushDictationToCloud(merged, cloud.revision, url);
        if (!active()) return;
        if (result.ok) {
          // Edits made during the POST keep their own fetch/CAS cycle.
          const changed = canonicalJson(dataRef.current) !== canonicalJson(merged);
          outcome = { status: changed ? 'pending' : 'ok', message: '', lastSyncedAt: Date.now() };
          if (changed) schedule();
          return;
        }
        if (result.error !== 'conflict') { outcome = { status: 'error', message: dictationSyncMessage(result.error) }; return; }
      }
    } catch {
      outcome = { status: 'error', message: dictationSyncMessage('network') };
    } finally {
      if (active()) {
        busyRef.current = false;
        setSync(prev => ({ status: outcome.status, message: outcome.message, lastSyncedAt: outcome.lastSyncedAt || prev.lastSyncedAt }));
      }
    }
  }, [adopt, schedule, url]);

  useEffect(() => {
    syncRef.current = syncNow;
    if (lockedRef.current) return undefined;
    syncNow();
    const online = () => syncNow();
    const focus = () => { if (Date.now() - lastAttemptRef.current > FOCUS_MIN_INTERVAL_MS) syncNow(); };
    window.addEventListener('online', online);
    window.addEventListener('focus', focus);
    const session = sessionRef, busy = busyRef, timer = timerRef;
    return () => {
      session.current++; // responses of this effect run are ignored from now on
      busy.current = false;
      clearTimeout(timer.current);
      window.removeEventListener('online', online);
      window.removeEventListener('focus', focus);
    };
  }, [syncNow]);

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
    syncStatus: sync.status, syncMessage: sync.message, lastSyncedAt: sync.lastSyncedAt, syncNow,
    addLesson, deleteLesson, recordSentenceResult,
    saveWord, unsaveWord, toggleWord, isWordSaved, recordWordListen,
    importBackup, exportBackup,
  };
}
