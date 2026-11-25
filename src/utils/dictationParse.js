// Parsing a pasted lesson — pure functions (tested in Node).
// One line = one sentence, optionally "English | Tiếng Việt". A line holding a
// whole paragraph is split at . ? ! … without splitting Mr., Dr., U.S., 3.5 …

export const MAX_LESSON_SENTENCES = 500;
export const MAX_SENTENCE_CHARS = 1000;
export const MAX_TITLE_CHARS = 120;

const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'mt', 'vs', 'etc', 'eg', 'ie', 'cf', 'al',
  'am', 'pm', 'no', 'nos', 'vol', 'fig', 'inc', 'ltd', 'co', 'corp', 'dept', 'est', 'approx',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'gov', 'gen', 'capt', 'lt', 'col',
]);

function isAbbreviation(wordBefore) {
  const bare = wordBefore.replace(/^[("'“‘[]+/, '');
  if (/^[IiAa]$/.test(bare)) return false; // "It was I." ends a sentence
  if (/^(?:\p{L}\.)+$/u.test(bare + '.')) return true; // U.S. / e.g. / J. (initials)
  return ABBREVIATIONS.has(bare.replace(/\./g, '').toLowerCase());
}

/** Splits running text into sentences. */
export function splitSentences(text) {
  const source = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!source) return [];
  const sentences = [];
  let start = 0;
  // A boundary: terminal marks, optional closing quotes/brackets, then a space.
  const boundary = /([.?!…]+)(["'”’)\]]*)(\s+)/gu;
  let match;
  while ((match = boundary.exec(source))) {
    const end = match.index + match[1].length + match[2].length;
    const next = source.slice(match.index + match[0].length);
    const before = source.slice(start, match.index).split(' ').pop() || '';
    const marks = match[1];
    if (marks === '.' && isAbbreviation(before)) continue;
    // Only split before something that can start a sentence (not "etc. and").
    if (/^\p{Ll}/u.test(next)) continue;
    sentences.push(source.slice(start, end).trim());
    start = match.index + match[0].length;
  }
  const rest = source.slice(start).trim();
  if (rest) sentences.push(rest);
  return sentences.filter(Boolean);
}

/**
 * @returns {{ items: { english: string, vietnamese: string }[], errors: string[] }}
 */
export function parseLessonInput(text) {
  const items = [];
  const errors = [];
  const lines = String(text ?? '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  lines.forEach((line, index) => {
    if (line.includes('|')) {
      const [english, ...rest] = line.split('|');
      const en = english.replace(/\s+/g, ' ').trim();
      const vi = rest.join('|').replace(/\s+/g, ' ').trim();
      if (!en) errors.push(`Dòng ${index + 1}: thiếu câu tiếng Anh trước dấu |.`);
      else items.push({ english: en, vietnamese: vi });
      return;
    }
    for (const sentence of splitSentences(line)) items.push({ english: sentence, vietnamese: '' });
  });
  items.forEach((item, index) => {
    if (item.english.length > MAX_SENTENCE_CHARS) errors.push(`Câu ${index + 1} dài quá ${MAX_SENTENCE_CHARS} ký tự.`);
    if (!/[\p{L}\p{N}]/u.test(item.english)) errors.push(`Câu ${index + 1} không có chữ nào để chép.`);
  });
  if (items.length > MAX_LESSON_SENTENCES) errors.push(`Một bài tối đa ${MAX_LESSON_SENTENCES} câu (đang có ${items.length}).`);
  return { items, errors };
}
