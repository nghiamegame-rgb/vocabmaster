// Dictation → "Từ đã lưu" → "Luyện nghe": filters, word choice and answer choices.
// Pure functions (tested in Node). Words are the live saved-word records.
import { normalizeWord } from './dictationCheck.js';
import { listenTotals } from './dictationSyncMerge.js';
import { shuffle } from './wordSelection.js';

export const MAX_CHOICES = 4;
/** Lesson filter values: '' = every lesson, NO_LESSON = words without a lesson name. */
export const ALL_LESSONS = '';
export const NO_LESSON = '-';
const lessonValue = word => (String(word.lessonTitle ?? '').trim() ? `t:${String(word.lessonTitle).trim()}` : NO_LESSON);

const heardWrong = word => listenTotals(word).wrong > 0;
const neverPractised = word => { const t = listenTotals(word); return t.correct + t.wrong === 0; };

/**
 * What the filter panel can offer. A filter with nothing to work on is not offered:
 * `lessons` is empty when no word has a lesson name.
 */
export function practiceFilterOptions(words) {
  const counts = new Map();
  for (const word of words) counts.set(lessonValue(word), (counts.get(lessonValue(word)) || 0) + 1);
  const named = [...counts.keys()].filter(value => value !== NO_LESSON)
    .sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
  const lessons = named.map(value => ({ value, label: value.slice(2), count: counts.get(value) }));
  if (lessons.length && counts.has(NO_LESSON)) lessons.push({ value: NO_LESSON, label: '(Không rõ bài)', count: counts.get(NO_LESSON) });
  return {
    lessons,
    wrongCount: words.filter(heardWrong).length,
    newCount: words.filter(neverPractised).length,
  };
}

/** Words matching every active filter. */
export function filterPracticeWords(words, { lesson = ALL_LESSONS, wrongOnly = false, newOnly = false } = {}) {
  return words.filter(word =>
    (lesson === ALL_LESSONS || lessonValue(word) === lesson)
    && (!wrongOnly || heardWrong(word))
    && (!newOnly || neverPractised(word)));
}

/**
 * Chooses the word to ask: a shuffled bag, so every word of the pool comes once
 * before any repeats, and never the same word twice in a row (pool of 2+).
 * `nextKey()` numbers the rounds.
 */
export function createWordPicker(random = Math.random) {
  let bag = [];
  let rounds = 0;
  const mix = list => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  return {
    next(pool, previousId = null) {
      if (!pool.length) return null;
      const byId = new Map(pool.map(word => [word.id, word]));
      bag = bag.filter(id => byId.has(id));
      if (!bag.length) bag = mix([...byId.keys()]);
      if (bag[0] === previousId && byId.size > 1) {
        // Move the repeat to the back; refill first when it is the only one left.
        if (bag.length === 1) bag.push(...mix([...byId.keys()].filter(id => id !== previousId)));
        bag.push(bag.shift());
      }
      return byId.get(bag.shift());
    },
    nextKey() { rounds += 1; return rounds; },
  };
}

/**
 * One question: the word to hear plus up to 3 other saved words as wrong choices.
 * Wrong choices come from the filtered pool first, then from the other saved words,
 * and never repeat the answer or each other (compared as the grader compares).
 * With fewer than 4 saved words there are fewer cards.
 */
export function buildWordRound({ pool, words, previousId = null, picker, mix = shuffle }) {
  const correct = picker.next(pool, previousId);
  if (!correct) return null;
  const used = new Set([normalizeWord(correct.word)]);
  const others = [];
  const inPool = new Set(pool.map(word => word.id));
  for (const candidate of [...mix(pool), ...mix(words.filter(word => !inPool.has(word.id)))]) {
    if (others.length === MAX_CHOICES - 1) break;
    const key = normalizeWord(candidate.word);
    if (candidate.id === correct.id || !key || used.has(key)) continue;
    used.add(key);
    others.push(candidate);
  }
  return { correct, cards: mix([correct, ...others]), key: picker.nextKey() };
}

/** Typed answer: same rule as sentence dictation (case, punctuation, apostrophes ignored). */
export const isTypedWord = (typed, word) => Boolean(normalizeWord(typed)) && normalizeWord(typed) === normalizeWord(word.word);
