// Voice picking and exam-mode rotation (pure functions). Run: node test/voice-selection.test.js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isEnglishVoice, voiceRegion, isNaturalVoice, isUnnaturalVoice, listEnglishVoices, voiceLabel, voiceLabels,
  pickDefaultVoice, findSavedVoice, resolveSelectedVoice, examVoicePool, createExamRotation, planSpeech, voiceKey,
  VOICE_RATE_MIN, VOICE_RATE_MAX, EXAM_RATE_JITTER,
} from '../src/utils/voiceSelection.js';

const v = (name, lang, voiceURI = name) => ({ name, lang, voiceURI });
const david = v('Microsoft David - English (United States)', 'en-US');
const zira = v('Microsoft Zira - English (United States)', 'en-US');
const george = v('Microsoft George - English (United Kingdom)', 'en-GB');
const aria = v('Microsoft Aria Online (Natural) - English (United States)', 'en-US');
const natasha = v('Microsoft Natasha Online (Natural) - English (Australia)', 'en-AU');
const heera = v('Microsoft Heera - English (India)', 'en-IN');
const irish = v('Moira', 'en-IE');
const hoaiMy = v('Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)', 'vi-VN');
const zarvox = v('Zarvox', 'en-US');
const eddy = v('Eddy (English (US))', 'en-US', 'com.apple.eloquence.en-US.Eddy');
const french = v('Google français', 'fr-FR');
// Order as a browser might report them.
const ALL = [french, david, zira, hoaiMy, george, zarvox, aria, heera, natasha, irish];
const names = list => list.map(x => x.name);

test('only English voices are listed (underscore tags too), duplicates removed', () => {
  assert.equal(isEnglishVoice(v('x', 'en_US')), true);
  assert.equal(isEnglishVoice(v('x', 'EN-gb')), true);
  assert.equal(isEnglishVoice(v('x', 'en')), true);
  assert.equal(isEnglishVoice(v('x', 'es-US')), false);
  assert.equal(isEnglishVoice(v('x', 'eng')), false);
  assert.equal(isEnglishVoice({}), false);
  const list = listEnglishVoices([...ALL, david]);
  assert.equal(list.length, 8);
  assert.ok(list.every(isEnglishVoice));
  assert.deepEqual(listEnglishVoices(undefined), []);
  assert.equal(voiceRegion(v('x', 'en_US')), 'US');
  assert.equal(voiceRegion(v('x', 'en-GB-scotland')), 'SCOTLAND');
  assert.equal(voiceRegion(v('x', 'en')), '');
});

test('Natural/Online voices come first, then by accent; novelty voices last', () => {
  assert.equal(isNaturalVoice(aria), true);
  assert.equal(isNaturalVoice(david), false);
  assert.deepEqual(names(listEnglishVoices(ALL)), names([aria, natasha, david, zira, george, heera, irish, zarvox]));
});

test('labels are readable and carry the accent', () => {
  assert.equal(voiceLabel(zira), 'Microsoft Zira (Mỹ)');
  assert.equal(voiceLabel(george), 'Microsoft George (Anh)');
  assert.equal(voiceLabel(aria), 'Microsoft Aria (Mỹ) · Natural');
  assert.equal(voiceLabel(natasha), 'Microsoft Natasha (Úc) · Natural');
  assert.equal(voiceLabel(eddy), 'Eddy (Mỹ)');
  assert.equal(voiceLabel(v('Google UK English Female', 'en-GB')), 'Google UK English Female (Anh)');
  assert.equal(voiceLabel(v('', 'en')), 'Giọng tiếng Anh (tiếng Anh)');
  const android = [v('English United States', 'en_US', 'a'), v('English United States', 'en_US', 'b')];
  assert.deepEqual(voiceLabels(android), ['English United States (Mỹ)', 'English United States (Mỹ) 2']);
});

test('default voice keeps the old rule: en-US, then en-GB, then any English', () => {
  assert.equal(pickDefaultVoice(ALL), david);
  assert.equal(pickDefaultVoice([french, irish, george]), george);
  assert.equal(pickDefaultVoice([french, irish]), irish);
  assert.equal(pickDefaultVoice([french]), null);
  assert.equal(pickDefaultVoice([]), null);
});

test('saved voice is matched by voiceURI + name, or either one', () => {
  assert.equal(findSavedVoice(ALL, { voiceURI: george.voiceURI, name: george.name }), george);
  assert.equal(findSavedVoice(ALL, { voiceURI: george.voiceURI, name: 'renamed' }), george);
  assert.equal(findSavedVoice(ALL, { voiceURI: 'moved', name: george.name }), george);
  assert.equal(findSavedVoice(ALL, { voiceURI: '', name: '' }), null);
  assert.equal(findSavedVoice(ALL, { voiceURI: french.voiceURI, name: french.name }), null, 'never a non-English voice');
  // Two voices with the same name: the exact voiceURI wins.
  const twins = [v('Samantha', 'en-US', 'compact'), v('Samantha', 'en-US', 'enhanced')];
  assert.equal(findSavedVoice(twins, { voiceURI: 'enhanced', name: 'Samantha' }), twins[1]);
});

test('saved voice gone (other device) → default en-US, no error', () => {
  const prefs = { voiceURI: 'iphone-only', name: 'Samantha' };
  assert.equal(resolveSelectedVoice(ALL, prefs), david);
  assert.equal(resolveSelectedVoice([george, irish], prefs), george);
  assert.equal(resolveSelectedVoice([], prefs), null);
  assert.deepEqual(prefs, { voiceURI: 'iphone-only', name: 'Samantha' }, 'the saved choice is not overwritten');
});

test('exam pool: US/GB/AU/CA/IN without novelty voices; widens when fewer than two', () => {
  assert.deepEqual(names(examVoicePool(ALL)), names([aria, natasha, david, zira, george, heera]));
  assert.ok(!examVoicePool(ALL).includes(irish));
  assert.ok(!examVoicePool(ALL).includes(zarvox));
  assert.ok(!examVoicePool([david, george, eddy]).includes(eddy));
  assert.equal(isUnnaturalVoice(eddy), true);
  assert.equal(isUnnaturalVoice(zira), false);
  assert.deepEqual(names(examVoicePool([david, irish])), names([david, irish]), 'only one preferred → all normal English');
  assert.deepEqual(names(examVoicePool([zira])), names([zira]));
  assert.deepEqual(names(examVoicePool([zarvox])), names([zarvox]), 'nothing else at all');
  assert.deepEqual(examVoicePool([french]), []);
});

test('exam rotation: a new item never repeats the previous voice', () => {
  const rotation = createExamRotation();
  const pool = [david, george];
  let previous = null;
  for (let i = 0; i < 2000; i++) {
    const { voice, offset } = rotation.assign(`s${i}`, pool);
    assert.notEqual(voice, previous, `item ${i} repeated the previous voice`);
    assert.ok(Math.abs(offset) <= EXAM_RATE_JITTER + 1e-9);
    previous = voice;
  }
  // Going back to an earlier item is a new listening too.
  const a = rotation.assign('A', pool).voice;
  const b = rotation.assign('B', pool).voice;
  assert.notEqual(rotation.assign('A', pool).voice, b);
  assert.notEqual(a, b);
});

test('exam rotation: every voice of a bigger pool gets used', () => {
  const rotation = createExamRotation();
  const pool = examVoicePool(ALL);
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(rotation.assign(i, pool).voice);
  assert.equal(seen.size, pool.length);
});

test('exam rotation: replaying the same item keeps voice and speed', () => {
  let calls = 0;
  const rotation = createExamRotation(() => { calls++; return Math.random(); });
  const pool = examVoicePool(ALL);
  const first = rotation.assign('sentence:1', pool);
  const used = calls;
  for (let i = 0; i < 20; i++) assert.deepEqual(rotation.assign('sentence:1', pool), first);
  assert.equal(calls, used, 'no new random draw on replay');
  // The voice object was reloaded by the browser (same identity) → still kept.
  const reloaded = pool.map(x => ({ ...x }));
  assert.equal(voiceKey(rotation.assign('sentence:1', reloaded).voice), voiceKey(first.voice));
  // The voice disappeared → another one, no crash.
  const without = pool.filter(x => voiceKey(x) !== voiceKey(first.voice));
  assert.ok(without.includes(rotation.assign('sentence:1', without).voice));
});

test('exam rotation: one voice, empty pool, extreme random values', () => {
  const rotation = createExamRotation(() => 0.999999999);
  assert.equal(rotation.assign('a', [zira]).voice, zira);
  assert.equal(rotation.assign('b', [zira]).voice, zira);
  assert.equal(rotation.assign('c', []), null);
  assert.ok(createExamRotation(() => 1).assign('x', [david, george]).voice, 'random() = 1 stays in range');
});

test('planSpeech: normal mode uses the saved voice and rate', () => {
  const prefs = { voiceURI: george.voiceURI, name: george.name, rate: 1.05, examMode: false };
  assert.deepEqual(planSpeech({ voices: ALL, prefs, itemKey: 'x', rotation: createExamRotation() }), { voice: george, rate: 1.05, examApplied: false });
  const untouched = planSpeech({ voices: ALL, prefs: { voiceURI: '', name: '', rate: 0.9, examMode: false } });
  assert.deepEqual(untouched, { voice: david, rate: 0.9, examApplied: false }, 'untouched settings sound as before');
});

test('planSpeech: exam mode varies speed slightly and stays in range', () => {
  const rotation = createExamRotation();
  for (const base of [VOICE_RATE_MIN, 0.9, VOICE_RATE_MAX]) {
    for (let i = 0; i < 300; i++) {
      const plan = planSpeech({ voices: ALL, prefs: { rate: base, examMode: true }, itemKey: `${base}-${i}`, rotation });
      assert.equal(plan.examApplied, true);
      assert.ok(plan.rate >= VOICE_RATE_MIN - EXAM_RATE_JITTER - 1e-9 && plan.rate <= VOICE_RATE_MAX + 1e-9, String(plan.rate));
      assert.ok(Math.abs(plan.rate - base) <= EXAM_RATE_JITTER + 1e-9, `${plan.rate} vs ${base}`);
      assert.ok(examVoicePool(ALL).includes(plan.voice));
    }
  }
});

test('planSpeech: no English voice (Google fallback) ignores exam mode', () => {
  const plan = planSpeech({ voices: [french], prefs: { rate: 0.95, examMode: true }, itemKey: 'a', rotation: createExamRotation() });
  assert.deepEqual(plan, { voice: null, rate: 0.95, examApplied: false });
});
