// Per-device voice settings (chosen voice, speed, exam mode), in the style of
// listeningPrefs.js. Stored only in this browser's LocalStorage: every device has
// its own voice list, so this is NEVER synced to the cloud or put in backups.
import { VOICE_RATE_DEFAULT, VOICE_RATE_MAX, VOICE_RATE_MIN } from './voiceSelection.js';

export const VOICE_PREFS_KEY = 'vocabmaster_voice_prefs';

export const DEFAULT_VOICE_PREFS = Object.freeze({
  voiceURI: '', name: '', rate: VOICE_RATE_DEFAULT, examMode: false,
});

/** Any input (missing, wrong types, out of range) → a complete, valid settings object. */
export function normalizeVoicePrefs(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const text = value => (typeof value === 'string' && value.length <= 300 ? value : '');
  const rate = typeof source.rate === 'number' && Number.isFinite(source.rate)
    ? Math.round(Math.min(VOICE_RATE_MAX, Math.max(VOICE_RATE_MIN, source.rate)) * 100) / 100
    : VOICE_RATE_DEFAULT;
  return { voiceURI: text(source.voiceURI), name: text(source.name), rate, examMode: source.examMode === true };
}

/** Defaults when nothing is saved, the value is broken, or storage cannot be read. */
export function readVoicePrefs(storage) {
  try { return normalizeVoicePrefs(JSON.parse(storage?.getItem(VOICE_PREFS_KEY) || 'null')); }
  catch { return { ...DEFAULT_VOICE_PREFS }; }
}

/** Returns false (without throwing) when the settings could not be saved. */
export function writeVoicePrefs(storage, prefs) {
  try {
    if (!storage) return false;
    storage.setItem(VOICE_PREFS_KEY, JSON.stringify(normalizeVoicePrefs(prefs)));
    return true;
  } catch { return false; }
}
