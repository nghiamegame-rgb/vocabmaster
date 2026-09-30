/**
 * audio.js — Shared TTS utility for VocabMaster
 *
 * Priority order:
 *   1. Web Speech API  — browser-native, natural en-US / en-GB voice, rate 0.9
 *   2. Google TTS URL  — fallback when no English voice is available or the
 *                        Web Speech API is not supported. Uses tl=en-US for the
 *                        American accent and encodeURIComponent so phrases with
 *                        spaces (e.g. "take off") don't break the URL.
 *
 * Usage:
 *   import { playAudio } from '../utils/audio';
 *   playAudio('negotiate');        // plays and returns a cancel handle
 *   const handle = playAudio('take off');
 *   handle.cancel();              // stop mid-playback if needed
 */

// ---------------------------------------------------------------------------
// Voice cache
// ---------------------------------------------------------------------------

/** @type {SpeechSynthesisVoice | null} */
let _cachedVoice = null;

/**
 * Warm up the voice cache.  Called once on module load and again via the
 * `onvoiceschanged` event, which fires asynchronously on Chrome/Edge.
 */
function _loadVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return; // not ready yet — onvoiceschanged will retry

  // Preference order: en-US (American) → en-GB (British) → any en-*
  _cachedVoice =
    voices.find(v => v.lang === 'en-US') ||
    voices.find(v => v.lang === 'en-GB') ||
    voices.find(v => v.lang.startsWith('en')) ||
    null;
}

// Attempt immediate load (works in Firefox / Safari where voices are sync)
_loadVoice();

// Chrome / Edge load voices asynchronously; retry when they arrive
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = _loadVoice;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns a no-op cancel handle (used as a uniform return shape when Web
 * Speech API is used, since there is no Audio element to pause).
 */
const _noopHandle = { cancel: () => window.speechSynthesis?.cancel() };

/**
 * Google TTS fallback — American accent, phrase-safe URL encoding.
 *
 * @param {string} text
 * @returns {{ cancel: () => void }}
 */
function _googleTTS(text) {
  const url =
    'https://translate.google.com/translate_tts' +
    '?ie=UTF-8&client=tw-ob&tl=en-US&q=' +
    encodeURIComponent(text);

  const audio = new Audio(url);
  audio.play().catch(() => {/* network blocked — silent failure */});
  return { cancel: () => { audio.pause(); audio.currentTime = 0; } };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Play the given English text using the best available TTS method.
 *
 * @param {string} text  — English word or phrase to speak
 * @returns {{ cancel: () => void }}  — call `.cancel()` to stop playback early
 */
export function playAudio(text) {
  if (!text || !text.trim()) return { cancel: () => {} };

  // ── Primary: Web Speech API ────────────────────────────────────────────────
  if ('speechSynthesis' in window && _cachedVoice) {
    window.speechSynthesis.cancel(); // stop any previous utterance

    const utt = new SpeechSynthesisUtterance(text.trim());
    utt.voice = _cachedVoice;
    utt.lang  = _cachedVoice.lang;  // 'en-US' or 'en-GB'
    utt.rate  = 0.9;                // slightly slower for TOEIC learners

    // If the utterance errors mid-play, fall back silently to Google TTS
    utt.onerror = () => _googleTTS(text);

    window.speechSynthesis.speak(utt);
    return _noopHandle;
  }

  // ── Fallback: Google TTS (en-US) ───────────────────────────────────────────
  // Reached when: Web Speech API unsupported, or no English voice cached yet.
  // For the "no voice yet" case (Chrome on first render), this gives immediate
  // audio while the voice list loads in the background for subsequent calls.
  return _googleTTS(text);
}
