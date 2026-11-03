// LocalStorage keys
export const LS_WORDS = 'vocabmaster_words';
export const LS_STATS = 'vocabmaster_stats';

// ---------- Words ----------
export function getWords({ withStatus = false } = {}) {
  let data = [], error = '';
  try {
    data = JSON.parse(localStorage.getItem(LS_WORDS) || '[]');
    if (!Array.isArray(data) || data.some(word => !word || typeof word !== 'object' || typeof word.english !== 'string')) throw new Error('Invalid vocabulary list');
  } catch {
    data = [];
    error = 'Không đọc được kho Vocabulary trên thiết bị; không coi đây là kho trống.';
  }
  return withStatus ? { data, error } : data;
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
