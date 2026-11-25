// Dictation grading — pure functions (tested in Node).
// Rules: case-insensitive, punctuation and extra spaces ignored, ’ ‘ ʼ ` ´ count as '.

const APOSTROPHES = /[‘’ʼ`´′]/g;

/** Normalised comparison key of one word ('' for pure punctuation such as "—"). */
export function normalizeWord(word) {
  return String(word ?? '')
    .normalize('NFC')
    .replace(APOSTROPHES, "'")
    .toLowerCase()
    // Keep letters, digits, apostrophes and hyphens; drop every other mark
    // (so "U.S." → "us", "1,000" → "1000", "3.5" → "35" on both sides alike).
    .replace(/[^\p{L}\p{M}\p{N}'-]+/gu, '')
    .replace(/^['-]+|['-]+$/g, '');
}

/** Visible form of a word for saving: original text without surrounding punctuation. */
export function displayWord(token) {
  return String(token ?? '')
    .normalize('NFC')
    .replace(APOSTROPHES, "'")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/**
 * Splits a sentence into word tokens. Pure punctuation tokens ("—", "-") are
 * not words and are dropped.
 * @returns {{ text: string, key: string }[]}
 */
export function tokenizeSentence(sentence) {
  return String(sentence ?? '')
    .split(/\s+/u)
    .map(text => ({ text, key: normalizeWord(text) }))
    .filter(token => token.key);
}

/** Longest common subsequence of two key arrays → matched index pairs [i, j]. */
function lcsPairs(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pairs = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { pairs.push([i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

/**
 * Compares the typed answer with the expected sentence word by word.
 * Items (in reading order):
 *   { type: 'correct', expected, typed } — same word
 *   { type: 'wrong',   expected, typed } — a different word typed in its place
 *   { type: 'missing', expected }        — word not typed
 *   { type: 'extra',   typed }           — word typed that is not in the sentence
 */
export function compareDictation(expectedSentence, typedText) {
  const expected = tokenizeSentence(expectedSentence);
  const typed = tokenizeSentence(typedText);
  const pairs = lcsPairs(expected.map(t => t.key), typed.map(t => t.key));
  const items = [];
  let i = 0, j = 0;
  const flushGap = (iEnd, jEnd) => {
    while (i < iEnd && j < jEnd) items.push({ type: 'wrong', expected: expected[i++].text, typed: typed[j++].text });
    while (i < iEnd) items.push({ type: 'missing', expected: expected[i++].text });
    while (j < jEnd) items.push({ type: 'extra', typed: typed[j++].text });
  };
  for (const [pi, pj] of pairs) {
    flushGap(pi, pj);
    items.push({ type: 'correct', expected: expected[i++].text, typed: typed[j++].text });
  }
  flushGap(expected.length, typed.length);
  const correct = items.filter(item => item.type === 'correct').length;
  return {
    items,
    correct,
    total: expected.length,
    isCorrect: expected.length > 0 && correct === expected.length && typed.length === expected.length,
  };
}

/** Indexes of the expected words that the typed text already contains in order. */
export function matchedWordIndexes(expectedSentence, typedText) {
  const expected = tokenizeSentence(expectedSentence).map(t => t.key);
  const typed = tokenizeSentence(typedText).map(t => t.key);
  return lcsPairs(expected, typed).map(([i]) => i);
}
