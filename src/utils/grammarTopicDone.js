// Per-device list of grammar topics the user has manually ticked as "enough sentences".
// Stored only in this browser's LocalStorage: not part of the Grammar store, never synced
// to the cloud and never included in backups (same approach as listeningPrefs.js).

export const GRAMMAR_TOPICS_DONE_KEY = 'vocabmaster_grammar_topics_done';

/** LocalStorage, or null when the browser blocks access (private mode, sandbox…). */
export function safeTopicDoneStorage(win = globalThis.window) {
  try { return win?.localStorage ?? null; } catch { return null; }
}

/** Parses the stored JSON into a clean array of unique, non-empty topic keys. Garbage → []. */
export function parseTopicsDone(raw) {
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter(item => typeof item === 'string' && item && item !== 'Mixed'))];
  } catch { return []; }
}

export function readTopicsDone(storage) {
  try { return parseTopicsDone(storage?.getItem(GRAMMAR_TOPICS_DONE_KEY)); } catch { return []; }
}

/** Returns false (without throwing) when the value could not be saved, e.g. storage full. */
export function writeTopicsDone(storage, topics) {
  try {
    if (!storage) return false;
    storage.setItem(GRAMMAR_TOPICS_DONE_KEY, JSON.stringify(parseTopicsDone(JSON.stringify(topics))));
    return true;
  } catch { return false; }
}

/** Pure toggle: returns a new array with `topic` added when `done` is true, removed otherwise. */
export function setTopicDone(topics, topic, done) {
  const rest = (Array.isArray(topics) ? topics : []).filter(item => item !== topic);
  return done && topic && topic !== 'Mixed' ? [...rest, topic] : rest;
}
