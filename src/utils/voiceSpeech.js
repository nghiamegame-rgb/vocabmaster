// Speaking with the per-device voice settings (Dictation + Listening).
// Other screens keep calling playAudio() directly and sound as before.
import { playAudio, listSystemVoices } from './audio.js';
import { safeLocalStorage } from './listeningPrefs.js';
import { readVoicePrefs, writeVoicePrefs, normalizeVoicePrefs } from './voicePrefs.js';
import { createExamRotation, planSpeech, resolveSelectedVoice } from './voiceSelection.js';

export const SAMPLE_SENTENCE = 'Attention, please. The next train to London will leave at half past nine.';

const rotation = createExamRotation();
const interruptListeners = new Set();
let unsaved = null; // settings that could not be saved are kept for this session

export function loadVoiceSettings() {
  return unsaved ?? readVoicePrefs(safeLocalStorage());
}

/** Returns false when the settings could not be saved (they still apply until reload). */
export function saveVoiceSettings(next) {
  const settings = normalizeVoicePrefs(next);
  const ok = writeVoicePrefs(safeLocalStorage(), settings);
  unsaved = ok ? null : settings;
  return ok;
}

/**
 * Speak `text` with the chosen voice and speed.
 * `itemKey` identifies the sentence/word being practised: in exam mode the same
 * key keeps its voice (replay), a new key gets another voice.
 * `speed` multiplies the chosen rate (Dictation's 0.75× / 1× / 1.25×).
 */
export function speakWithSettings(text, { itemKey, speed = 1, onEnd } = {}) {
  const { voice, rate } = planSpeech({ voices: listSystemVoices(), prefs: loadVoiceSettings(), itemKey, rotation });
  return playAudio(text, { onEnd, rate: rate * speed, voice });
}

/** "Nghe thử": the selected voice (not a random exam voice). */
export function previewVoice() {
  interruptListeners.forEach(listener => listener()); // stop loops before talking over them
  const settings = loadVoiceSettings();
  return playAudio(SAMPLE_SENTENCE, { rate: settings.rate, voice: resolveSelectedVoice(listSystemVoices(), settings) });
}

export function onSpeechInterrupt(listener) {
  interruptListeners.add(listener);
  return () => interruptListeners.delete(listener);
}
