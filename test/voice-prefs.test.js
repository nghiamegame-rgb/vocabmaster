// Per-device voice settings + the speaking path (fake browser speech, no network).
// Run: node test/voice-prefs.test.js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  VOICE_PREFS_KEY, DEFAULT_VOICE_PREFS, normalizeVoicePrefs, readVoicePrefs, writeVoicePrefs,
} from '../src/utils/voicePrefs.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), map };
}
const broken = {
  getItem() { throw new DOMException('denied', 'SecurityError'); },
  setItem() { throw new DOMException('full', 'QuotaExceededError'); },
};

test('nothing saved → defaults (default voice, 0.9, exam mode off)', () => {
  assert.equal(VOICE_PREFS_KEY, 'vocabmaster_voice_prefs');
  assert.deepEqual(readVoicePrefs(memoryStorage()), { voiceURI: '', name: '', rate: 0.9, examMode: false });
  assert.deepEqual(readVoicePrefs(memoryStorage()), { ...DEFAULT_VOICE_PREFS });
});

test('broken or unreadable settings → defaults, never an exception', () => {
  for (const raw of ['{oops', '"text"', '42', 'null', '[1,2]', '']) {
    assert.deepEqual(readVoicePrefs(memoryStorage({ [VOICE_PREFS_KEY]: raw })), { ...DEFAULT_VOICE_PREFS }, raw);
  }
  assert.deepEqual(readVoicePrefs(broken), { ...DEFAULT_VOICE_PREFS });
  assert.deepEqual(readVoicePrefs(null), { ...DEFAULT_VOICE_PREFS });
});

test('each bad field falls back on its own; speed is clamped to 0.8–1.1', () => {
  assert.deepEqual(normalizeVoicePrefs({ voiceURI: 5, name: {}, rate: 'fast', examMode: 'yes' }), { ...DEFAULT_VOICE_PREFS });
  assert.equal(normalizeVoicePrefs({ rate: 3 }).rate, 1.1);
  assert.equal(normalizeVoicePrefs({ rate: 0.1 }).rate, 0.8);
  assert.equal(normalizeVoicePrefs({ rate: NaN }).rate, 0.9);
  assert.equal(normalizeVoicePrefs({ rate: 1.0500000001 }).rate, 1.05);
  assert.equal(normalizeVoicePrefs({ name: 'x'.repeat(400) }).name, '');
  assert.deepEqual(normalizeVoicePrefs({ voiceURI: 'u', name: 'n', rate: 1, examMode: true, extra: 1 }),
    { voiceURI: 'u', name: 'n', rate: 1, examMode: true });
});

test('saves voiceURI + name (no list position) under its own key only', () => {
  const storage = memoryStorage({ vocabmaster_words: '[1]' });
  assert.equal(writeVoicePrefs(storage, { voiceURI: 'uri-george', name: 'George', rate: 1, examMode: true }), true);
  assert.deepEqual([...storage.map.keys()].sort(), [VOICE_PREFS_KEY, 'vocabmaster_words']);
  assert.deepEqual(JSON.parse(storage.map.get(VOICE_PREFS_KEY)), { voiceURI: 'uri-george', name: 'George', rate: 1, examMode: true });
  assert.equal(storage.map.get('vocabmaster_words'), '[1]');
  assert.equal(writeVoicePrefs(broken, {}), false);
  assert.equal(writeVoicePrefs(null, {}), false);
});

// ── Speaking path with a fake browser (set up BEFORE audio.js is imported) ────
const voices = [
  { name: 'Microsoft Zira - English (United States)', lang: 'en-US', voiceURI: 'zira' },
  { name: 'Microsoft George - English (United Kingdom)', lang: 'en-GB', voiceURI: 'george' },
  { name: 'Google français', lang: 'fr-FR', voiceURI: 'fr' },
];
const spoken = [];
const store = memoryStorage();
let available = voices;
const synth = { getVoices: () => available, speak: u => spoken.push(u), cancel() {} };
globalThis.window = { speechSynthesis: synth, localStorage: store };
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
const audioPlayed = [];
globalThis.Audio = class { constructor(src) { this.src = src; audioPlayed.push(this); } play() { return Promise.resolve(); } pause() {} };

const { playAudio, getLastSpeechEngine, subscribeVoices } = await import('../src/utils/audio.js');
const { speakWithSettings, previewVoice, saveVoiceSettings, loadVoiceSettings, onSpeechInterrupt, SAMPLE_SENTENCE } =
  await import('../src/utils/voiceSpeech.js');
const last = () => spoken.at(-1);

test('old calls are unchanged: default en-US voice, rate 0.9, pitch untouched — whatever is saved', () => {
  store.setItem(VOICE_PREFS_KEY, JSON.stringify({ voiceURI: 'george', name: voices[1].name, rate: 1.1, examMode: true }));
  playAudio('negotiate');
  assert.equal(last().voice, voices[0]);
  assert.equal(last().lang, 'en-US');
  assert.equal(last().rate, 0.9);
  assert.equal(last().pitch, undefined, 'pitch is never set');
  playAudio('negotiate', { rate: 0.7 });
  assert.equal(last().rate, 0.7);
  assert.equal(getLastSpeechEngine(), 'browser');
});

test('settings apply to speakWithSettings and preview; speed multiplies the chosen rate', () => {
  saveVoiceSettings({ voiceURI: 'george', name: voices[1].name, rate: 1, examMode: false });
  speakWithSettings('Hello', { itemKey: 'a' });
  assert.equal(last().voice, voices[1]);
  assert.equal(last().lang, 'en-GB');
  assert.equal(last().rate, 1);
  speakWithSettings('Hello', { itemKey: 'a', speed: 0.75 });
  assert.equal(last().rate, 0.75);
  assert.equal(last().pitch, undefined);
  let interrupted = 0;
  const off = onSpeechInterrupt(() => interrupted++);
  previewVoice();
  assert.equal(last().text, SAMPLE_SENTENCE);
  assert.equal(last().voice, voices[1]);
  assert.equal(last().rate, 1);
  assert.equal(interrupted, 1);
  off();
});

test('exam mode through the real speaking path: new item changes voice, replay keeps it', () => {
  saveVoiceSettings({ ...loadVoiceSettings(), examMode: true });
  let previous = null;
  for (let i = 0; i < 30; i++) {
    speakWithSettings('Sentence', { itemKey: `s${i}` });
    const { voice, rate } = last();
    assert.notEqual(voice, previous);
    assert.ok(voice.lang.startsWith('en'));
    assert.ok(Math.abs(rate - 1) <= 0.05 + 1e-9);
    speakWithSettings('Sentence', { itemKey: `s${i}` });
    assert.equal(last().voice, voice, 'replay keeps the voice');
    assert.equal(last().rate, rate, 'replay keeps the speed');
    previous = voice;
  }
});

test('saved voice missing → default voice, saved choice kept for the other device', () => {
  saveVoiceSettings({ voiceURI: 'samantha', name: 'Samantha', rate: 0.9, examMode: false });
  speakWithSettings('Hi', { itemKey: 'x' });
  assert.equal(last().voice, voices[0]);
  assert.equal(loadVoiceSettings().name, 'Samantha');
});

test('voice list subscribers are told about changes', () => {
  let calls = 0;
  const off = subscribeVoices(() => calls++);
  synth.onvoiceschanged();
  assert.equal(calls, 1);
  off();
  synth.onvoiceschanged();
  assert.equal(calls, 1);
});

test('settings that cannot be saved still apply for this session', () => {
  const realSet = store.setItem;
  store.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
  assert.equal(saveVoiceSettings({ voiceURI: 'george', name: voices[1].name, rate: 0.85, examMode: false }), false);
  speakWithSettings('Hi', { itemKey: 'y' });
  assert.equal(last().voice, voices[1]);
  assert.equal(last().rate, 0.85);
  store.setItem = realSet;
  assert.equal(saveVoiceSettings(loadVoiceSettings()), true);
  assert.equal(JSON.parse(store.getItem(VOICE_PREFS_KEY)).voiceURI, 'george');
});
