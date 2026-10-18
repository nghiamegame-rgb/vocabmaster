/**
 * annotation.js — Utilities for the separate annotation field.
 *
 * Annotations are free-text grammatical notes stored separately from the
 * English word. They are display-only metadata and must NEVER be used for
 * TTS, answer validation, or exercise generation.
 *
 * Migration:
 *   Existing entries may have annotations embedded in the English field,
 *   e.g. "Active (adj)", "Act (v - n)", "Coordinate (v)".
 *   extractAnnotation() detects these patterns and splits them safely.
 */

/**
 * Regex that matches a trailing parenthetical annotation at the end of an
 * English word field.
 *
 * Recognised patterns (all case-insensitive, optional spaces inside parens):
 *   (adj)  (v)  (n)  (adv)  (prep)  (conj)  (pron)
 *   (v - n)  (adj - ing)  (adj-ed)  (v / n)  (adj / adv)
 *   (adj-ing)  (v-n)  (adv-prep)
 *
 * We deliberately keep the pattern narrow so we ONLY strip clearly
 * grammatical annotations and never strip parentheses that are part of the
 * actual English expression (e.g. "account (for)", "look (at)").
 *
 * Rules for a "safe" annotation:
 *   - Must be at the very END of the string.
 *   - Must consist exclusively of: known POS abbreviations (n, v, adj, adv,
 *     prep, conj, pron, det, art, num, ing, ed), plus separators (space,
 *     hyphen, slash, dash).
 *   - Min 1 POS token, max ~4 tokens connected by separators.
 */
const ANNOTATION_RE =
  /\s*\(\s*((?:adj|adv|conj|det|art|num|pron|prep|ing|ed|v|n)(?:\s*[-\/–]\s*(?:adj|adv|conj|det|art|num|pron|prep|ing|ed|v|n))*)\s*\)$/i;

/**
 * Given a raw `english` value that may contain an embedded annotation,
 * return { cleanEnglish, annotation }.
 *
 * - If a trailing annotation is detected, it is separated out.
 * - If no annotation is detected, annotation is ''.
 * - cleanEnglish is always trimmed.
 *
 * @param {string} raw  The raw english field value.
 * @returns {{ cleanEnglish: string, annotation: string }}
 */
export function extractAnnotation(raw) {
  if (!raw || typeof raw !== 'string') return { cleanEnglish: '', annotation: '' };
  const match = raw.trim().match(ANNOTATION_RE);
  if (!match) return { cleanEnglish: raw.trim(), annotation: '' };
  const annotation   = match[1].trim();          // e.g. "v - n"
  const cleanEnglish = raw.trim().slice(0, raw.trim().length - match[0].length).trim();
  // Safety: never return an empty english field
  if (!cleanEnglish) return { cleanEnglish: raw.trim(), annotation: '' };
  return { cleanEnglish, annotation };
}

/**
 * Migrate a single word object to the separate-annotation format.
 *
 * Rules:
 *  - If the word already has a non-empty `annotation` field, do nothing.
 *  - Otherwise, attempt to extract an annotation from the `english` field.
 *  - Preserves all other fields (id, vietnamese, imageUrl, level, etc.).
 *
 * Idempotent — safe to call multiple times on the same word.
 *
 * @param {object} word  A vocabulary word object.
 * @returns {object}     Possibly-mutated copy of the word.
 */
export function migrateWord(word) {
  // Already migrated — annotation field exists and has content, OR english is already clean.
  if (typeof word.annotation === 'string' && word.annotation.trim() !== '') {
    return word; // already has annotation, don't overwrite
  }

  // If annotation is already set (even empty string), don't extract again
  // UNLESS the english field still contains a detectable annotation.
  // (idempotency: after first migration, english is clean)
  if (typeof word.annotation === 'string') {
    // annotation field exists (could be ''), english should already be clean
    return word;
  }

  // No annotation field at all — attempt extraction
  const { cleanEnglish, annotation } = extractAnnotation(word.english || '');
  return { ...word, english: cleanEnglish, annotation };
}

/**
 * Migrate an entire word list. Idempotent.
 *
 * @param {object[]} words
 * @returns {object[]}
 */
export function migrateWordList(words) {
  if (!Array.isArray(words)) return [];
  return words.map(migrateWord);
}

/**
 * Format an English word with its annotation for display.
 * Returns: "Word (annotation)" or "Word" (if no annotation).
 *
 * @param {string} english
 * @param {string} [annotation]
 * @returns {string}
 */
export function formatWithAnnotation(english, annotation) {
  if (!annotation || !annotation.trim()) return english || '';
  return `${english} (${annotation.trim()})`;
}
