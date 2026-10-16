/**
 * word-selection.test.js
 *
 * Unit tests for src/utils/wordSelection.js
 *
 * Covers:
 *  1. shuffle — Fisher-Yates: all elements present, nothing duplicated.
 *  2. pickNextWord — returns null on empty pool.
 *  3. pickNextWord — lowest-level word is prioritised.
 *  4. pickNextWord — tie on level: lowest streak wins.
 *  5. pickNextWord — excludes recently-seen words when alternatives exist.
 *  6. pickNextWord — falls back to full pool when all are in recentIds.
 *  7. pickNextWord — window size capped at pool.length - 1 (no infinite exclusion).
 *  8. advanceRecent window — oldest entry evicted when window is full.
 *  9. No immediate repetition across N sequential picks (the main bug scenario).
 * 10. buildListeningRound — returns null when pool < 4.
 * 11. buildListeningRound — correct word not the same as previousId.
 * 12. buildListeningRound — cards contain exactly 4 unique words.
 *
 * Run with: node test/word-selection.test.js
 */

import assert from 'node:assert/strict';
import { shuffle, pickNextWord, buildListeningRound } from '../src/utils/wordSelection.js';

// ─── advanceRecent (inlined — matches Flashcard.jsx) ────────────────────────
function advanceRecent(recentArr, newId, maxSize) {
  const next = [...recentArr, newId];
  return next.length > maxSize ? next.slice(next.length - maxSize) : next;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function makeWord(overrides = {}) {
  return {
    id:            overrides.id            ?? String(Math.random()),
    english:       overrides.english       ?? 'word',
    vietnamese:    overrides.vietnamese    ?? 'nghĩa',
    level:         overrides.level         ?? 1,
    currentStreak: overrides.currentStreak ?? 0,
    wordType:      overrides.wordType      ?? 'Word',
    createdAt:     overrides.createdAt     ?? Date.now(),
    ...overrides,
  };
}

function makeWords(n, prefix = 'w', levelFn = () => 1, streakFn = () => 0) {
  return Array.from({ length: n }, (_, i) =>
    makeWord({ id: `${prefix}-${i}`, english: `${prefix}${i}`, level: levelFn(i), currentStreak: streakFn(i) })
  );
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

console.log('\nWord Selection — Unit Tests\n');

// ── Test 1: shuffle contains all original elements ───────────────────────────
test('shuffle: result contains all original elements, no duplicates', () => {
  const original = makeWords(20, 'sh');
  const shuffled = shuffle(original);

  assert.equal(shuffled.length, original.length, 'Length must be preserved');

  const origIds = new Set(original.map(w => w.id));
  for (const w of shuffled) {
    assert.ok(origIds.has(w.id), `ID ${w.id} not found in original`);
    origIds.delete(w.id);
  }
  assert.equal(origIds.size, 0, 'All original IDs must appear exactly once');
});

// ── Test 2: pickNextWord on empty pool ────────────────────────────────────────
test('pickNextWord: returns null for empty pool', () => {
  const result = pickNextWord([], new Set());
  assert.equal(result, null);
});

// ── Test 3: pickNextWord prioritises lowest level ────────────────────────────
test('pickNextWord: lowest-level word is picked first', () => {
  const pool = [
    makeWord({ id: 'hi', level: 5, currentStreak: 0 }),
    makeWord({ id: 'lo', level: 1, currentStreak: 10 }),
    makeWord({ id: 'mid', level: 3, currentStreak: 0 }),
  ];

  const result = pickNextWord(pool, new Set());
  assert.equal(result.id, 'lo', `Expected level-1 word, got level-${result.level}`);
});

// ── Test 4: pickNextWord tie-breaks by lowest streak ─────────────────────────
test('pickNextWord: on same level, lowest streak wins', () => {
  const pool = [
    makeWord({ id: 'a', level: 2, currentStreak: 5 }),
    makeWord({ id: 'b', level: 2, currentStreak: 0 }),
    makeWord({ id: 'c', level: 2, currentStreak: 3 }),
  ];

  const result = pickNextWord(pool, new Set());
  assert.equal(result.id, 'b', 'Word with streak=0 should be picked');
});

// ── Test 5: pickNextWord excludes recently-seen words ────────────────────────
test('pickNextWord: excludes recentIds when alternatives exist', () => {
  const pool = [
    makeWord({ id: 'r1', level: 1, currentStreak: 0 }), // would normally win
    makeWord({ id: 'r2', level: 1, currentStreak: 1 }),
    makeWord({ id: 'r3', level: 2, currentStreak: 0 }),
  ];

  // Mark the best two as recent — only r3 remains
  const recentIds = new Set(['r1', 'r2']);
  const result = pickNextWord(pool, recentIds);
  assert.equal(result.id, 'r3', 'Should skip recent words and pick r3');
});

// ── Test 6: pickNextWord falls back when all are in recentIds ────────────────
test('pickNextWord: falls back to full pool when all words are recent', () => {
  const pool = [
    makeWord({ id: 'only', level: 1, currentStreak: 0 }),
  ];

  // Pool has 1 word; recentIds has that same word — must still return something
  const recentIds = new Set(['only']);
  const result = pickNextWord(pool, recentIds);
  assert.ok(result !== null, 'Must not return null when only one word exists');
  assert.equal(result.id, 'only', 'Should fall back to the only available word');
});

// ── Test 7: window capped at pool.length - 1 ─────────────────────────────────
test('pickNextWord: window effectively capped so no dead-lock with small pool', () => {
  // 3 words; we pretend all 3 are recent, but window should cap at 2
  const pool = [
    makeWord({ id: 'x1', level: 1, currentStreak: 2 }),
    makeWord({ id: 'x2', level: 1, currentStreak: 0 }),  // lowest streak
    makeWord({ id: 'x3', level: 1, currentStreak: 1 }),
  ];

  // If we cap the window at pool.length - 1 = 2, only 2 IDs are excluded
  const windowSize = Math.min(pool.length - 1, 8); // = 2
  const recentArr  = ['x1', 'x3']; // the 2 most recent
  const recentSet  = new Set(recentArr.slice(-windowSize));
  const result     = pickNextWord(pool, recentSet);

  // x1 and x3 excluded → x2 is the only candidate (and it has lowest streak)
  assert.equal(result.id, 'x2', 'x2 should be picked as only non-recent candidate');
});

// ── Test 8: advanceRecent evicts oldest entry ─────────────────────────────────
test('advanceRecent: oldest entry evicted when window is full', () => {
  const maxSize = 3;
  let recent = [];

  recent = advanceRecent(recent, 'a', maxSize); // ['a']
  recent = advanceRecent(recent, 'b', maxSize); // ['a','b']
  recent = advanceRecent(recent, 'c', maxSize); // ['a','b','c']
  recent = advanceRecent(recent, 'd', maxSize); // should evict 'a' → ['b','c','d']

  assert.equal(recent.length, 3, `Expected length 3, got ${recent.length}`);
  assert.ok(!recent.includes('a'), `'a' should have been evicted`);
  assert.ok(recent.includes('d'), `'d' should be present`);
});

// ── Test 9: No immediate repetition across sequential picks ───────────────────
test('No immediate repetition: same word never appears in back-to-back picks (pool >= 2)', () => {
  const pool = makeWords(10, 'seq', i => (i % 3) + 1, i => i % 5);
  const maxSize = Math.min(pool.length - 1, 8);

  let recentArr = [];
  let lastId    = null;

  for (let pick = 0; pick < 50; pick++) {
    const recentSet = new Set(recentArr.slice(-maxSize));
    const word      = pickNextWord(pool, recentSet);

    assert.ok(word !== null, `Pick ${pick}: got null unexpectedly`);

    if (lastId !== null) {
      assert.notEqual(word.id, lastId,
        `Immediate repetition detected at pick ${pick}: "${word.english}" appeared twice in a row`);
    }

    recentArr = advanceRecent(recentArr, word.id, maxSize);
    lastId    = word.id;
  }
});

// ── Test 10: buildListeningRound returns null for pool < 4 ───────────────────
test('buildListeningRound: returns null when pool has fewer than 4 words', () => {
  const pool = makeWords(3, 'lr');
  const result = buildListeningRound(pool, null);
  assert.equal(result, null, 'Should return null for pool < 4');
});

// ── Test 11: buildListeningRound avoids previousId ───────────────────────────
test('buildListeningRound: correct word is not the same as previousId (when alternatives exist)', () => {
  const pool = makeWords(10, 'lr');
  const prevId = pool[0].id;

  // Run 20 times to account for randomness
  for (let i = 0; i < 20; i++) {
    const round = buildListeningRound(pool, prevId);
    assert.ok(round !== null);
    assert.notEqual(round.correct.id, prevId,
      `Correct word should not be the same as previousId`);
  }
});

// ── Test 12: buildListeningRound produces 4 unique cards ─────────────────────
test('buildListeningRound: cards array has exactly 4 unique words', () => {
  const pool = makeWords(10, 'lr');
  const round = buildListeningRound(pool, null);

  assert.ok(round !== null);
  assert.equal(round.cards.length, 4, 'Should have exactly 4 cards');

  const ids = new Set(round.cards.map(w => w.id));
  assert.equal(ids.size, 4, 'All 4 cards must be distinct words');

  // The correct word must be among the cards
  assert.ok(ids.has(round.correct.id), 'Correct word must be in the cards');
});

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.exitCode = 1;
}
