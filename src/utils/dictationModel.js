// Pure edits on the Dictation snapshot { sentences, words } (tested in Node).
// Every edit returns a new snapshot; records are tombstoned, never removed.
import { normalizeWord, displayWord } from './dictationCheck.js';
import { liveRecords } from './dictationSyncMerge.js';
import { MAX_TITLE_CHARS } from './dictationParse.js';

export const emptyDictationData = () => ({ sentences: [], words: [] });

// A later edit always gets a strictly larger updatedAt than the record it replaces.
const bump = (record, now) => Math.max(now, (record?.updatedAt || 0) + 1);

export function addLesson(data, { title, items, now = Date.now(), lessonId }) {
  const id = lessonId || `dl_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const lessonTitle = String(title || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_CHARS)
    || `Bài ${new Date(now).toLocaleDateString('vi-VN')}`;
  const sentences = items.map((item, order) => ({
    id: `${id}_${order}`, lessonId: id, lessonTitle, order,
    english: item.english, vietnamese: item.vietnamese || '',
    createdAt: now, updatedAt: now,
  }));
  return { data: { ...data, sentences: [...data.sentences, ...sentences] }, lessonId: id, lessonTitle };
}

export function deleteLesson(data, lessonId, now = Date.now()) {
  return {
    ...data,
    sentences: data.sentences.map(s => s.lessonId === lessonId && !s.deletedAt
      ? { ...s, deletedAt: now, updatedAt: bump(s, now) } : s),
  };
}

export function recordSentenceResult(data, sentenceId, isCorrect, deviceId, now = Date.now()) {
  return {
    ...data,
    sentences: data.sentences.map(s => {
      if (s.id !== sentenceId || s.deletedAt) return s;
      const attempts = { ...s.attempts, [deviceId]: (s.attempts?.[deviceId] || 0) + 1 };
      return { ...s, lastResult: isCorrect ? 'correct' : 'wrong', lastResultAt: Math.max(now, (s.lastResultAt || 0) + 1), attempts };
    }),
  };
}

/** Saves a word (identified by its lower-case form). An existing live word is left as is. */
export function saveWord(data, wordInput, now = Date.now()) {
  const rawWord = typeof wordInput === 'string' ? wordInput : wordInput?.word;
  const id = normalizeWord(rawWord);
  const shown = displayWord(rawWord);
  if (!id || !shown) return { data, status: 'invalid' };
  const existing = data.words.find(w => w.id === id);
  if (existing && !existing.deletedAt) return { data, status: 'exists' };
  const record = {
    ...(existing?.listen ? { listen: existing.listen } : {}),
    id, word: shown.slice(0, 100),
    sentenceId: '', sentence: '', lessonTitle: '',
    savedAt: now, updatedAt: bump(existing, now),
  };
  const words = existing ? data.words.map(w => w.id === id ? record : w) : [...data.words, record];
  return { data: { ...data, words }, status: 'saved' };
}

export function unsaveWord(data, wordId, now = Date.now()) {
  return {
    ...data,
    words: data.words.map(w => w.id === wordId && !w.deletedAt ? { ...w, deletedAt: now, updatedAt: bump(w, now) } : w),
  };
}

export function recordWordListen(data, wordId, isCorrect, deviceId) {
  return {
    ...data,
    words: data.words.map(w => {
      if (w.id !== wordId || w.deletedAt) return w;
      const mine = w.listen?.[deviceId] || { correct: 0, wrong: 0 };
      const next = isCorrect ? { ...mine, correct: (mine.correct || 0) + 1 } : { ...mine, wrong: (mine.wrong || 0) + 1 };
      return { ...w, listen: { ...w.listen, [deviceId]: next } };
    }),
  };
}

/** Live lessons, oldest first, each with its live sentences in order. */
export function lessonsOf(data) {
  const byId = new Map();
  for (const s of liveRecords(data.sentences)) {
    if (!byId.has(s.lessonId)) byId.set(s.lessonId, { id: s.lessonId, title: s.lessonTitle, createdAt: s.createdAt, sentences: [] });
    byId.get(s.lessonId).sentences.push(s);
  }
  const lessons = [...byId.values()];
  for (const lesson of lessons) lesson.sentences.sort((a, b) => a.order - b.order);
  return lessons.sort((a, b) => (a.createdAt - b.createdAt) || (a.id < b.id ? -1 : 1));
}

export function lessonProgress(lesson) {
  const correct = lesson.sentences.filter(s => s.lastResult === 'correct').length;
  const wrong = lesson.sentences.filter(s => s.lastResult === 'wrong').length;
  return { correct, wrong, todo: lesson.sentences.length - correct - wrong };
}
