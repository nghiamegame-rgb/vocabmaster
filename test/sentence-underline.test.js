/**
 * test/sentence-underline.test.js
 * Tests for underline logic, in-memory storage, and static component rendering.
 * No browser session, real LocalStorage, or production endpoint is used.
 *
 * Run: node test/sentence-underline.test.js
 */

// Minimal shim for Array.from (already global in Node)
// and String iteration by codepoint (already works in Node)

// ── Import under test ────────────────────────────────────────────────────────
import {
  UNDERLINE_COLORS,
  textKey,
  toCodepoints,
  cpLength,
  validateSegment,
  normalize,
  applyUnderline,
  mergeSegments,
  buildSpans,
} from '../src/utils/sentenceUnderline.js';
import {
  LS_GRAMMAR_UNDERLINES, getUnderlinesForKey, saveUnderlinesForKey, migrateUnderlineKey,
} from '../src/utils/grammarStorage.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let pass = 0;
let fail = 0;

function assert(condition, msg) {
  if (condition) { pass++; }
  else { fail++; console.error(`  FAIL: ${msg}`); }
}

function assertDeepEqual(a, b, msg) {
  const as = JSON.stringify(a);
  const bs = JSON.stringify(b);
  if (as === bs) { pass++; }
  else { fail++; console.error(`  FAIL: ${msg}\n    got:      ${as}\n    expected: ${bs}`); }
}

// ── 1. textKey ────────────────────────────────────────────────────────────────
console.log('1. textKey');
assert(textKey('Hello world') === 'text:Hello world', 'basic');
assert(textKey('  trim me  ') === 'text:trim me',     'trims whitespace');
assert(textKey('')            === 'text:',             'empty');
assert(textKey(null)          === 'text:',             'null');

// ── 2. toCodepoints / cpLength ────────────────────────────────────────────────
console.log('2. codepoints');
assertDeepEqual(toCodepoints('abc'), ['a','b','c'], 'BMP');
// Emoji: 🎉 is U+1F389 (supplementary, 2 UTF-16 units but 1 codepoint)
assert(cpLength('🎉abc') === 4, 'emoji counts as 1 codepoint');
assert(cpLength('') === 0, 'empty');

// ── 3. validateSegment ────────────────────────────────────────────────────────
console.log('3. validateSegment');
const len = 10;
assertDeepEqual(validateSegment({ start: 2, end: 5, color: 'yellow' }, len),
  { start: 2, end: 5, color: 'yellow' }, 'valid');
assert(validateSegment({ start: 5, end: 5, color: 'yellow' }, len) === null, 'empty range');
assert(validateSegment({ start: 5, end: 3, color: 'yellow' }, len) === null, 'reversed');
assert(validateSegment({ start: 0, end: 5, color: 'invalid' }, len) === null, 'bad color');
assert(validateSegment(null, len) === null, 'null');
// Clamp
assertDeepEqual(validateSegment({ start: -1, end: 15, color: 'blue' }, len),
  { start: 0, end: 10, color: 'blue' }, 'clamped');

// ── 4. normalize ─────────────────────────────────────────────────────────────
console.log('4. normalize');
// Adjacent same-color merge
assertDeepEqual(
  normalize([{ start:0, end:3, color:'yellow' }, { start:3, end:6, color:'yellow' }], 10),
  [{ start:0, end:6, color:'yellow' }],
  'merge adjacent same color'
);
// Different colors not merged
assert(
  normalize([{ start:0, end:3, color:'yellow' }, { start:3, end:6, color:'blue' }], 10).length === 2,
  'different colors not merged'
);
// Overlapping same-color merged
assertDeepEqual(
  normalize([{ start:0, end:5, color:'pink' }, { start:3, end:8, color:'pink' }], 10),
  [{ start:0, end:8, color:'pink' }],
  'overlapping same color merged'
);

// ── 5. applyUnderline ─────────────────────────────────────────────────────────
console.log('5. applyUnderline');
const sentence = 'The quick brown fox'; // 19 chars BMP
const sLen = cpLength(sentence);

// Apply to empty
assertDeepEqual(
  applyUnderline([], 4, 9, 'yellow', sLen),
  [{ start:4, end:9, color:'yellow' }],
  'apply to empty'
);

// Erase partial
let segs = applyUnderline([], 0, 10, 'blue', sLen);
segs = applyUnderline(segs, 3, 7, null, sLen);
assertDeepEqual(segs, [
  { start:0, end:3, color:'blue' },
  { start:7, end:10, color:'blue' },
], 'erase middle, keep sides');

// Replace middle with new color
let segs2 = applyUnderline([], 0, 10, 'green', sLen);
segs2 = applyUnderline(segs2, 3, 7, 'pink', sLen);
assertDeepEqual(segs2, [
  { start:0, end:3, color:'green' },
  { start:3, end:7, color:'pink' },
  { start:7, end:10, color:'green' },
], 'replace middle with different color');

// Two identical substrings — selection by position, not text search
// "the" appears twice-ish here; test that we respect explicit [0,3) vs [16,19)
const s2 = 'fox fox fox';
const s2len = cpLength(s2);
let segsA = applyUnderline([], 0, 3, 'yellow', s2len);
let segsB = applyUnderline(segsA, 8, 11, 'blue', s2len);
assertDeepEqual(segsB, [
  { start:0, end:3, color:'yellow' },
  { start:8, end:11, color:'blue' },
], 'independent positions for repeated substrings');

// ── 6. mergeSegments ─────────────────────────────────────────────────────────
console.log('6. mergeSegments');
const a = [{ start:0, end:5, color:'yellow' }];
const b = [{ start:3, end:8, color:'blue' }];
// b overwrites a in [3,5), a keeps [0,3)
assertDeepEqual(
  mergeSegments(a, b, 10),
  [{ start:0, end:3, color:'yellow' }, { start:3, end:8, color:'blue' }],
  'merge: b overwrites a in overlap'
);

// ── 7. buildSpans ─────────────────────────────────────────────────────────────
console.log('7. buildSpans');
const sent = 'Hello world';
const spans1 = buildSpans(sent, []);
assertDeepEqual(spans1, [{ text:'Hello world', color:null }], 'no underlines → single span');

const spans2 = buildSpans(sent, [{ start:6, end:11, color:'pink' }]);
assertDeepEqual(spans2, [
  { text:'Hello ', color:null },
  { text:'world', color: UNDERLINE_COLORS.pink.hex },
], 'underline last word');

const spans3 = buildSpans(sent, [
  { start:0, end:5, color:'yellow' },
  { start:6, end:11, color:'blue' },
]);
assertDeepEqual(spans3, [
  { text:'Hello', color: UNDERLINE_COLORS.yellow.hex },
  { text:' ', color:null },
  { text:'world', color: UNDERLINE_COLORS.blue.hex },
], 'two underlines with gap');

// Out-of-range segments silently skipped
const spans4 = buildSpans('Hi', [{ start:50, end:60, color:'green' }]);
assertDeepEqual(spans4, [{ text:'Hi', color:null }], 'out-of-range segment skipped');

// ── 8. Round-trip: apply then build ──────────────────────────────────────────
console.log('8. Round-trip');
const rt = 'Grammar is important for language learning.';
const rtLen = cpLength(rt);
let rtSegs = [];
rtSegs = applyUnderline(rtSegs, 8, 10, 'blue', rtLen);   // "is"
rtSegs = applyUnderline(rtSegs, 11, 20, 'yellow', rtLen); // "important"
rtSegs = applyUnderline(rtSegs, 8, 20, null, rtLen);      // erase both
assert(rtSegs.length === 0, 'erase entire range leaves empty');

rtSegs = applyUnderline([], 0, 7, 'green', rtLen);        // "Grammar"
rtSegs = applyUnderline(rtSegs, 4, 7, 'pink', rtLen);     // "mar" overridden
const rtSpans = buildSpans(rt, rtSegs);
// Expect: "Gram" green, "mar" pink, rest plain
assert(rtSpans[0].color === UNDERLINE_COLORS.green.hex, 'round-trip: first part keeps original color');
assert(rtSpans[1].color === UNDERLINE_COLORS.pink.hex,  'round-trip: overridden part is new color');
assert(rtSpans[2].color === null,                        'round-trip: remainder is plain');

// ── 9. White uses the existing validation and overlap rules ───────────────────
console.log('9. white underlines');
assertDeepEqual(Object.keys(UNDERLINE_COLORS), ['yellow', 'blue', 'green', 'pink', 'white'], 'white follows the original four colors');
assertDeepEqual(UNDERLINE_COLORS.white, { hex: '#FFFFFF', label: 'Trắng — Đánh dấu chung' }, 'white color and label');
const white = { start: 6, end: 11, color: 'white' };
assertDeepEqual(validateSegment(white, cpLength(sent)), white, 'white passes segment validation');
const whiteOverlap = applyUnderline([{ start: 0, end: 11, color: 'blue' }], 6, 11, 'white', cpLength(sent));
assertDeepEqual(whiteOverlap, [{ start: 0, end: 6, color: 'blue' }, white], 'white replaces only the selected range');
assertDeepEqual(buildSpans(sent, whiteOverlap), [
  { text: 'Hello ', color: UNDERLINE_COLORS.blue.hex },
  { text: 'world', color: '#FFFFFF' },
], 'white renders without changing the sentence text');
assertDeepEqual(applyUnderline(whiteOverlap, 6, 11, null, cpLength(sent)), [{ start: 0, end: 6, color: 'blue' }], 'removing white preserves the neighboring color');
assertDeepEqual(applyUnderline([white], 6, 8, 'pink', cpLength(sent)), [
  { start: 6, end: 8, color: 'pink' }, { start: 8, end: 11, color: 'white' },
], 'an existing color can replace part of a white underline');

// ── 10. Persistence across fresh reads and practice → saved-key transition ────
console.log('10. white persistence');
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const oldMarks = ['yellow', 'blue', 'green', 'pink'].map((color, i) => ({ start: i, end: i + 1, color }));
let persisted = new Map([
  [LS_GRAMMAR_UNDERLINES, JSON.stringify({ gq_old: oldMarks })],
  ['vocabmaster_grammar_review', '{"gq_old":{"level":4}}'],
]);
const memoryStorage = () => ({
  getItem: key => persisted.get(key) ?? null,
  setItem: (key, value) => persisted.set(key, String(value)),
});
try {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoryStorage() });
  saveUnderlinesForKey(textKey(sent), [white]);
  // Recreate the storage adapter from serialized data, as after a reload.
  persisted = new Map(JSON.parse(JSON.stringify([...persisted])));
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memoryStorage() });
  assertDeepEqual(getUnderlinesForKey(textKey(sent)), [white], 'white survives a fresh storage read');
  migrateUnderlineKey(sent, 'gq_white');
  assertDeepEqual(getUnderlinesForKey('gq_white'), [white], 'white follows the savedId shared by Practice, Saved and Review');
  assertDeepEqual(getUnderlinesForKey(textKey(sent)), [], 'practice text key is moved by the existing save flow');
  assertDeepEqual(getUnderlinesForKey('gq_old'), oldMarks, 'saving white preserves all four existing colors');
  const removed = applyUnderline(getUnderlinesForKey('gq_white'), 6, 11, null, cpLength(sent));
  saveUnderlinesForKey('gq_white', removed);
  assertDeepEqual(getUnderlinesForKey('gq_white'), [], 'removing white persists');
  assertDeepEqual(getUnderlinesForKey('gq_old'), oldMarks, 'removing white preserves other sentences');
  assert(persisted.get('vocabmaster_grammar_review') === '{"gq_old":{"level":4}}', 'underline changes leave review data untouched');
} finally {
  if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
  else delete globalThis.localStorage;
}

// ── 11. Render actual shared components without running a browser ─────────────
console.log('11. white toolbar and sentence rendering');
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { innerHeight: 800, innerWidth: 1024 } });
  const { default: Toolbar } = await server.ssrLoadModule('/src/components/grammar/UnderlineToolbar.jsx');
  const { default: Sentence } = await server.ssrLoadModule('/src/components/grammar/UnderlinedSentence.jsx');
  const toolbar = renderToStaticMarkup(createElement(Toolbar, { position: { top: 40, left: 40 }, onColor() {}, onClose() {} }));
  const labels = [...toolbar.matchAll(/<button\b[^>]*aria-label="([^"]+)"/g)].map(match => match[1]);
  assertDeepEqual(labels, ['Vàng', 'Xanh da trời', 'Xanh lá', 'Hồng', 'Trắng — Đánh dấu chung', 'Bỏ gạch chân'], 'white button appears before the unchanged remove action');
  assert(toolbar.includes('title="Trắng — Đánh dấu chung"'), 'white tooltip uses the requested Vietnamese label');
  const html = renderToStaticMarkup(createElement(Sentence, { sentence: sent, segments: [white], className: 'text-slate-300' }));
  assert(html.includes('text-decoration-color:#FFFFFF'), 'the shared sentence component renders a white underline');
  assert(html.includes('text-decoration-thickness:2.5px') && html.includes('text-underline-offset:4px'), 'white keeps existing underline thickness and offset');
  assert(html.includes('class="text-slate-300"') && !/style="(?:[^"]*;)?color:/.test(html), 'white does not override sentence text color');
  const erasedHtml = renderToStaticMarkup(createElement(Sentence, { sentence: sent, segments: [], className: 'text-slate-300' }));
  assert(!erasedHtml.includes('text-decoration-line'), 'removing the underline renders plain text again');
} finally {
  await server.close();
  if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
  else delete globalThis.window;
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\nResults: ${pass} passed, ${fail} failed.`);
if (fail > 0) process.exit(1);

