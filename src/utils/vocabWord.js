// Normalise a new or imported Vocabulary entry to the constraints enforced by
// google-apps-script.js::vocabValidate. Invalid values move to the nearest valid
// value and are listed in `adjusted`; missing optional fields get defaults
// without being reported. Returns null when there is no English text.
export function normalizeWordInput(input, now = Date.now()) {
  if (!input || typeof input !== 'object' || typeof input.english !== 'string' || !input.english.trim()) return null;
  const adjusted = [];
  const text = (key, fallback = '') => {
    const value = input[key];
    if (value == null) return fallback;
    if (typeof value === 'string') return value.trim();
    adjusted.push(key);
    return typeof value === 'number' || typeof value === 'boolean' ? String(value).trim() : fallback;
  };
  const integer = (key, fallback, min, max) => {
    const value = input[key];
    if (value == null) return fallback;
    const number = Number(value);
    const result = !Number.isFinite(number) ? fallback
      : Math.min(max, Math.max(min, key === 'level' ? Math.round(number) : Math.floor(number)));
    if (result !== value) adjusted.push(key);
    return result;
  };
  const timestamp = key => {
    const value = input[key];
    if (value == null) return undefined;
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
    adjusted.push(key);
    return undefined;
  };

  const word = {
    english: input.english.trim(),
    vietnamese: text('vietnamese'),
    annotation: text('annotation'),
    imageUrl: text('imageUrl'),
    wordType: 'Word',
    level: integer('level', 1, 1, 5),
    currentStreak: integer('currentStreak', 0, 0, Number.MAX_SAFE_INTEGER),
    createdAt: timestamp('createdAt') ?? now,
  };
  if (typeof input.wordType === 'string' && input.wordType) word.wordType = input.wordType;
  else if (input.wordType != null && input.wordType !== '') adjusted.push('wordType');
  const lastReviewedDate = timestamp('lastReviewedDate');
  if (lastReviewedDate !== undefined) word.lastReviewedDate = lastReviewedDate;
  if (input.hardMarked) {
    word.hardMarked = true;
    if (input.hardMarked !== true) adjusted.push('hardMarked');
  }
  return { word, adjusted };
}
