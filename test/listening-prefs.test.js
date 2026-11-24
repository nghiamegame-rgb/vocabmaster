// Unit tests for src/utils/listeningPrefs.js (per-device "auto-open keyboard" setting).
// Run with: node test/listening-prefs.test.js
import assert from 'node:assert/strict';
import {
  LISTENING_AUTOFOCUS_KEY,
  defaultListeningAutofocus,
  parseListeningAutofocus,
  readListeningAutofocus,
  writeListeningAutofocus,
  safeLocalStorage,
} from '../src/utils/listeningPrefs.js';

const touch = { matchMedia: q => ({ matches: q === '(pointer: coarse)' }) };
const desktop = { matchMedia: () => ({ matches: false }) };

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
    dump: () => Object.fromEntries(map),
  };
}
const brokenStorage = {
  getItem() { throw new DOMException('denied', 'SecurityError'); },
  setItem() { throw new DOMException('full', 'QuotaExceededError'); },
};

let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`  ✓ ${name}`); }

assert.equal(LISTENING_AUTOFOCUS_KEY, 'vocabmaster_listening_autofocus');

test('device default: touch screen OFF, desktop ON', () => {
  assert.equal(defaultListeningAutofocus(touch), false);
  assert.equal(defaultListeningAutofocus(desktop), true);
});

test('device default: no window / no matchMedia / throwing matchMedia → ON', () => {
  assert.equal(defaultListeningAutofocus(undefined), true);
  assert.equal(defaultListeningAutofocus({}), true);
  assert.equal(defaultListeningAutofocus({ matchMedia() { throw new Error('boom'); } }), true);
});

test('parse accepts only on/off', () => {
  assert.equal(parseListeningAutofocus('on'), true);
  assert.equal(parseListeningAutofocus('off'), false);
  for (const junk of [null, undefined, '', 'ON', 'true', '1', 'yes', '{"x":1}']) {
    assert.equal(parseListeningAutofocus(junk), null, String(junk));
  }
});

test('saved value wins over the device default', () => {
  assert.equal(readListeningAutofocus(memoryStorage({ [LISTENING_AUTOFOCUS_KEY]: 'on' }), touch), true);
  assert.equal(readListeningAutofocus(memoryStorage({ [LISTENING_AUTOFOCUS_KEY]: 'off' }), desktop), false);
});

test('nothing saved → device default', () => {
  assert.equal(readListeningAutofocus(memoryStorage(), touch), false);
  assert.equal(readListeningAutofocus(memoryStorage(), desktop), true);
});

test('garbage value → device default', () => {
  assert.equal(readListeningAutofocus(memoryStorage({ [LISTENING_AUTOFOCUS_KEY]: 'maybe' }), touch), false);
  assert.equal(readListeningAutofocus(memoryStorage({ [LISTENING_AUTOFOCUS_KEY]: 'true' }), desktop), true);
});

test('storage that throws or is missing → device default, no exception', () => {
  assert.equal(readListeningAutofocus(brokenStorage, touch), false);
  assert.equal(readListeningAutofocus(brokenStorage, desktop), true);
  assert.equal(readListeningAutofocus(null, touch), false);
});

test('write stores on/off under its own key only', () => {
  const s = memoryStorage({ vocabmaster_words: '[1]' });
  assert.equal(writeListeningAutofocus(s, false), true);
  assert.deepEqual(s.dump(), { vocabmaster_words: '[1]', [LISTENING_AUTOFOCUS_KEY]: 'off' });
  assert.equal(writeListeningAutofocus(s, true), true);
  assert.equal(s.dump()[LISTENING_AUTOFOCUS_KEY], 'on');
  assert.equal(readListeningAutofocus(s, touch), true);
});

test('write failure returns false without throwing', () => {
  assert.equal(writeListeningAutofocus(brokenStorage, true), false);
  assert.equal(writeListeningAutofocus(null, true), false);
});

test('safeLocalStorage survives a throwing localStorage getter', () => {
  const win = {};
  Object.defineProperty(win, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } });
  assert.equal(safeLocalStorage(win), null);
  const s = memoryStorage();
  assert.equal(safeLocalStorage({ localStorage: s }), s);
  assert.equal(safeLocalStorage(undefined), null);
});

console.log(`\nlistening-prefs: ${passed} tests passed`);
