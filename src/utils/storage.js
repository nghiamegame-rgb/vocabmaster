// LocalStorage keys
export const LS_WORDS = 'vocabmaster_words';
export const LS_STATS = 'vocabmaster_stats';

// ---------- Words ----------
export function getWords() {
  try {
    return JSON.parse(localStorage.getItem(LS_WORDS) || '[]');
  } catch {
    return [];
  }
}
export function saveWords(words) {
  localStorage.setItem(LS_WORDS, JSON.stringify(words));
}
/** Wipe the words key entirely (used before a hard-sync) */
export function clearWords() {
  localStorage.removeItem(LS_WORDS);
}

// ---------- Stats ----------
export function getStats() {
  try {
    return JSON.parse(
      localStorage.getItem(LS_STATS) || '{"totalQuestions":0,"correctAnswers":0}'
    );
  } catch {
    return { totalQuestions: 0, correctAnswers: 0 };
  }
}
export function saveStats(stats) {
  localStorage.setItem(LS_STATS, JSON.stringify(stats));
}
