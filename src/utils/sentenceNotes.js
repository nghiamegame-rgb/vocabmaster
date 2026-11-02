import { textKey, toCodepoints } from './sentenceUnderline.js';

export const LS_SENTENCE_NOTES = 'vocabmaster_grammar_sentence_notes';

export function validNote(note, key = note?.sentenceKey, sentence = note?.sentence) {
  if (!note || typeof note !== 'object' || typeof note.id !== 'string' || !note.id || typeof key !== 'string' || !key
      || typeof sentence !== 'string' || note.sentence !== sentence || note.sentenceKey !== key
      || typeof note.text !== 'string' || !note.text.trim()
      || !Number.isInteger(note.start) || !Number.isInteger(note.end)) return false;
  const chars = toCodepoints(sentence);
  return note.start >= 0 && note.end > note.start && note.end <= chars.length
    && chars.slice(note.start, note.end).join('') === note.quote && Boolean(note.quote.trim());
}

export function notesForSentence(map, key, sentence) {
  return (Array.isArray(map?.[key]) ? map[key] : []).filter(note => validNote(note, key, sentence));
}

export function readSentenceNotes() {
  try {
    const map = JSON.parse(localStorage.getItem(LS_SENTENCE_NOTES) || '{}');
    if (!map || typeof map !== 'object' || Array.isArray(map)) return {};
    return Object.fromEntries(Object.entries(map).filter(([, notes]) => Array.isArray(notes))
      .map(([key, notes]) => [key, notes.filter(note => validNote(note, key))]));
  } catch { return {}; }
}

/** Pure edit, using exact codepoint positions, never matching by phrase text alone. */
export function editSentenceNote(map, { key, sentence, start, end, text, id, createdAt }, now = Date.now()) {
  const chars = toCodepoints(sentence);
  if (typeof key !== 'string' || !key || typeof text !== 'string'
      || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > chars.length
      || !chars.slice(start, end).join('').trim()) return map;
  const current = Array.isArray(map[key]) ? map[key] : [];
  const existing = current.find(note => validNote(note, key, sentence)
    && (note.id === id || (note.start === start && note.end === end)));
  const next = current.filter(note => note !== existing);
  if (text.trim()) next.push({
    id: existing?.id || id || globalThis.crypto.randomUUID(), sentenceKey: key, sentence, start, end,
    quote: chars.slice(start, end).join(''), text,
    createdAt: existing?.createdAt ?? createdAt ?? now, updatedAt: now,
  });
  const result = { ...map };
  if (next.length) result[key] = next;
  else delete result[key];
  return result;
}

/** Existing identity transition only; no migration of learning data or underlines. */
export function moveSentenceNotes(map, sentence, savedId) {
  const sourceKey = textKey(sentence);
  const source = notesForSentence(map, sourceKey, sentence);
  if (!source.length) return map;
  let result = map;
  for (const note of source) {
    const target = notesForSentence(result, savedId, sentence)
      .find(item => item.start === note.start && item.end === note.end);
    if (target && target.updatedAt > note.updatedAt) continue;
    result = editSentenceNote(result, { ...note, key: savedId }, note.updatedAt);
  }
  result = { ...result };
  delete result[sourceKey];
  return result;
}

export function writeSentenceNotes(map) {
  try {
    localStorage.setItem(LS_SENTENCE_NOTES, JSON.stringify(map));
    return true;
  } catch { return false; }
}
