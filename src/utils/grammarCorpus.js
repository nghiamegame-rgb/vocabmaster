import { sentenceKey } from './grammarBatch.js';

const clean = text => text.normalize('NFKC').replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"').replace(/[‐‑]/g, '-').trim().replace(/\s+/gu, ' ');

// Only the record's sentence is a corpus source. Never inspect notes or distractors.
export function corpusSentence(record) {
  if (typeof record?.sentence !== 'string' || !record.sentence.trim()) return null;
  let text = clean(record.sentence);
  const blanks = text.match(/_{2,}|\[(?:blank|gap)\]|\.{3}|…/gi) || [];
  if (blanks.length) {
    // Legacy schema has exactly one _____ and an A/B/C/D answer key.
    const answer = record.options?.[record.answer];
    if (record.schemaVersion === 2 || blanks.length !== 1 || blanks[0] !== '_____' ||
        !['A', 'B', 'C', 'D'].includes(record.answer) || typeof answer !== 'string' || !answer.trim()) return null;
    text = text.replace('_____', () => clean(answer));
    if (/_{2,}|\[(?:blank|gap)\]|\.{3}|…/i.test(text)) return null;
  }
  return text;
}

export function collectGrammarCorpus(records = []) {
  const sentences = new Map();
  let unresolved = 0;
  for (const record of records) {
    const text = corpusSentence(record);
    if (text === null) { unresolved++; continue; }
    const key = sentenceKey(text);
    if (!sentences.has(key)) sentences.set(key, text);
  }
  return { grammar: [...sentences.values()], unresolved };
}

const matchText = text => clean(text).toLowerCase().replace(/(?<![\p{L}\p{M}])'|'(?![\p{L}\p{M}])/gu, ' ');

function wordMatcher(english) {
  const escape = part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Commas/hyphens may separate phrase words; sentence boundaries may not.
  // Apostrophes stay lexical: "can" is not a match inside "can't".
  const phrase = matchText(english).trim().split(/[\s-]+/u).map(escape).join('[\\s,\\-]+');
  return new RegExp(`(?<![\\p{L}\\p{N}\\p{M}'])${phrase}(?![\\p{L}\\p{N}\\p{M}'])`, 'u');
}

export function buildGrammarCorpus(words = [], records = []) {
  const { grammar, unresolved } = collectGrammarCorpus(records);
  const english = new Map();
  let invalidWords = 0;
  for (const word of words) {
    if (typeof word?.english !== 'string' || !word.english.trim()) { invalidWords++; continue; }
    const text = clean(word.english);
    if (!english.has(text.toLowerCase())) english.set(text.toLowerCase(), text);
  }
  const comparable = grammar.map(matchText);
  const vocab = [...english.values()].map(text => {
    const match = wordMatcher(text);
    return [text, comparable.reduce((count, sentence) => count + Number(match.test(sentence)), 0)];
  }).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], 'en'));
  return { data: { vocab, grammar }, unresolved, invalidWords };
}
