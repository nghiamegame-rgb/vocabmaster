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
 *
 * Screens with voice settings (Dictation, Listening) use speakWithSettings()
 * in voiceSpeech.js, which passes the chosen `voice` and `rate` to playAudio.
 * Callers that pass neither keep the default English voice at rate 0.9.
 */

import { pickDefaultVoice } from './voiceSelection.js';

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
  _cachedVoice = pickDefaultVoice(voices);
}

const _voiceListeners = new Set();

function _onVoicesChanged() {
  _loadVoice();
  for (const listener of _voiceListeners) listener();
}

// Attempt immediate load (works in Firefox / Safari where voices are sync)
_loadVoice();

// Chrome / Edge load voices asynchronously; retry when they arrive
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = _onVoicesChanged;
}

// ---------------------------------------------------------------------------
// Which engine spoke last: 'browser' voices or the single-voice Google fallback
// ---------------------------------------------------------------------------

let _lastEngine = null;
const _engineListeners = new Set();

function _reportEngine(engine) {
  if (engine === _lastEngine) return;
  _lastEngine = engine;
  for (const listener of _engineListeners) listener(engine);
}

/** All voices the browser reports right now (may be empty while still loading). */
export function listSystemVoices() {
  try { return window.speechSynthesis?.getVoices?.() || []; } catch { return []; }
}

/** Called whenever the browser's voice list changes. Returns an unsubscribe function. */
export function subscribeVoices(listener) {
  _voiceListeners.add(listener);
  return () => _voiceListeners.delete(listener);
}

export const getLastSpeechEngine = () => _lastEngine;

export function subscribeSpeechEngine(listener) {
  _engineListeners.add(listener);
  return () => _engineListeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Google TTS fallback — American accent, phrase-safe URL encoding.
 *
 * @param {string} text
 * @returns {{ cancel: () => void }}
 */
function _googleTTS(text, onEnd, playbackRate = 1) {
  _reportEngine('google');
  const url =
    'https://translate.google.com/translate_tts' +
    '?ie=UTF-8&client=tw-ob&tl=en-US&q=' +
    encodeURIComponent(text);

  const audio = new Audio(url);
  if (playbackRate !== 1) audio.playbackRate = playbackRate;
  if (onEnd) audio.onended = onEnd;
  audio.play().catch(() => {/* network blocked — silent failure */});
  return {
    cancel: () => {
      audio.onended = null;
      audio.pause();
      audio.currentTime = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Play the given English text using the best available TTS method.
 *
 * @param {string} text  — English word or phrase to speak
 * @param {{ onEnd?: () => void, rate?: number, voice?: SpeechSynthesisVoice | null }} [options]
 *   rate defaults to 0.9 (speech rate); voice defaults to the app's English voice.
 *   Pitch is never changed.
 * @returns {{ cancel: () => void }}  — call `.cancel()` to stop playback early
 */
export function playAudio(text, { onEnd, rate = 0.9, voice = null } = {}) {
  if (!text || !text.trim()) return { cancel: () => {} };

  // ── Primary: Web Speech API ────────────────────────────────────────────────
  const speaker = voice || _cachedVoice;
  if ('speechSynthesis' in window && speaker) {
    window.speechSynthesis.cancel(); // stop any previous utterance

    const utt = new SpeechSynthesisUtterance(text.trim());
    let canceled = false;
    let fallbackHandle = null;
    utt.voice = speaker;
    utt.lang  = speaker.lang;       // e.g. 'en-US' or 'en-GB'
    utt.rate  = rate;               // default 0.9: slightly slower for learners

    // If the utterance errors mid-play, fall back silently to Google TTS.
    // Do not report an end for the canceled utterance; the fallback owns it.
    utt.onerror = (event) => {
      if (canceled || event?.error === 'canceled' || event?.error === 'interrupted') return;
      fallbackHandle = _googleTTS(text, () => {
        if (!canceled) onEnd?.();
      }, rate / 0.9);
    };
    if (onEnd) utt.onend = onEnd;

    _reportEngine('browser');
    window.speechSynthesis.speak(utt);
    return {
      cancel: () => {
        canceled = true;
        window.speechSynthesis.cancel();
        fallbackHandle?.cancel();
      },
    };
  }

  // ── Fallback: Google TTS (en-US) ───────────────────────────────────────────
  // Reached when: Web Speech API unsupported, or no English voice cached yet.
  // For the "no voice yet" case (Chrome on first render), this gives immediate
  // audio while the voice list loads in the background for subsequent calls.
  return _googleTTS(text, onEnd, rate / 0.9);
}
