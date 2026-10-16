/**
 * vocab-sync.test.js
 *
 * Focused unit-tests for the vocabulary sync merge logic.
 *
 * Scenarios covered:
 *  1. Basic: cloud has more words than local → local-only words are kept.
 *  2. Bug reproduction: mobile has 95 stale words, cloud has 100.
 *     After merge the result must have ≥ 100 words; no cloud word is lost.
 *  3. Cloud word wins over local when same english key exists.
 *  4. Merge is idempotent: merging the same data twice gives the same result.
 *  5. Both inputs empty → empty result.
 *  6. Cloud empty + local has words → all local kept.
 *  7. Progress fields come from cloud.
 *  8. Duplicate english with different id → cloud wins, no duplicates.
 *
 * Run with: node test/vocab-sync.test.js
 * (Self-contained — no test framework, no browser deps.)
 */

import assert from 'node:assert/strict';

// ─── Inline the pure merge function (copy of src/hooks/useVocabStore.js) ────
// We inline it here so the test has zero browser/React dependencies and can
// run with plain Node. Keep in sync with the production implementation.
function mergeVocabWords(cloudWords, localWords) {
  const cloudIds   = new Set(cloudWords.map(w => w.id));
  const cloudEngLc = new Set(cloudWords.map(w => w.english.toLowerCase()));
  const localOnly  = localWords.filter(
    w => !cloudIds.has(w.id) && !cloudEngLc.has(w.english.toLowerCase())
  );
  return [...cloudWords, ...localOnly];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeWord(overrides = {}) {
  const base = {
    id:            overrides.id            ?? String(Math.random()),
    english:       overrides.english       ?? 'word',
    vietnamese:    overrides.vietnamese    ?? 'nghĩa',
    imageUrl:      overrides.imageUrl      ?? '',
    wordType:      overrides.wordType      ?? 'Word',
    level:         overrides.level         ?? 1,
    currentStreak: overrides.currentStreak ?? 0,
    createdAt:     overrides.createdAt     ?? Date.now(),
  };
  return { ...base, ...overrides };
}

/** Generate N unique words with sequential ids and english names. */
function makeWords(n, prefix = 'word', levelFn = () => 1) {
  return Array.from({ length: n }, (_, i) =>
    makeWord({ id: `id-${prefix}-${i}`, english: `${prefix}${i}`, level: levelFn(i) })
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

// ─── Test Suite ─────────────────────────────────────────────────────────────

console.log('\nVocabulary Sync Merge — Unit Tests\n');

// ── Test 1: Bug Scenario — 95 local vs 100 cloud ────────────────────────────
test('BUG SCENARIO: cloud=100, local=95 stale → result ≥ 100, no cloud word lost', () => {
  // Cloud has 100 words
  const cloudWords = makeWords(100, 'cloud', i => (i % 5) + 1);

  // Mobile has 95 of those same words (e.g., the first 95) with possibly
  // different progress data (stale local state).
  const staleLocal95 = cloudWords.slice(0, 95).map(w => ({
    ...w,
    level: 1,          // stale: all reset to L1
    currentStreak: 0,  // stale
  }));

  const merged = mergeVocabWords(cloudWords, staleLocal95);

  // Must have exactly 100 words (no duplicates, no losses)
  assert.equal(merged.length, 100,
    `Expected 100 words, got ${merged.length}`);

  // Every cloud word must be in the result
  const cloudIds = new Set(cloudWords.map(w => w.id));
  for (const w of merged) {
    cloudIds.delete(w.id);
  }
  assert.equal(cloudIds.size, 0,
    `Missing cloud words: ${[...cloudIds].join(', ')}`);

  // Cloud word should win: the last 5 cloud words (indices 95-99) must have
  // their cloud-level, NOT level=1 from stale local
  for (let i = 95; i < 100; i++) {
    const cloudWord = cloudWords[i];
    const inMerge   = merged.find(w => w.id === cloudWord.id);
    assert.ok(inMerge, `Cloud word ${cloudWord.english} missing from merged`);
    assert.equal(inMerge.level, cloudWord.level,
      `Cloud word ${cloudWord.english} level should be ${cloudWord.level}, got ${inMerge.level}`);
  }
});

// ── Test 2: Local-only words are preserved ───────────────────────────────────
test('Local-only words (not in cloud) are preserved in merged result', () => {
  const cloudWords = makeWords(5, 'cloud');
  // 3 local words that do NOT exist in cloud at all
  const localOnly  = makeWords(3, 'local');
  const merged     = mergeVocabWords(cloudWords, [...cloudWords.slice(0, 2), ...localOnly]);

  // Should have 5 cloud + 3 local-only = 8
  assert.equal(merged.length, 8,
    `Expected 8 words, got ${merged.length}`);

  // All local-only words present
  for (const lw of localOnly) {
    assert.ok(merged.some(w => w.id === lw.id),
      `Local-only word "${lw.english}" was dropped from merge`);
  }
});

// ── Test 3: Cloud word wins on same english key ──────────────────────────────
test('Cloud version wins when english matches (cloud is source of truth)', () => {
  const cloudVer = makeWord({ id: 'shared-id', english: 'apple', level: 4, currentStreak: 8 });
  const localVer = makeWord({ id: 'shared-id', english: 'apple', level: 1, currentStreak: 0 });

  const merged = mergeVocabWords([cloudVer], [localVer]);

  assert.equal(merged.length, 1, 'Should not duplicate the word');
  assert.equal(merged[0].level, 4,
    `Cloud level 4 should win over local level 1, got ${merged[0].level}`);
  assert.equal(merged[0].currentStreak, 8,
    `Cloud streak 8 should win over local 0, got ${merged[0].currentStreak}`);
});

// ── Test 4: Duplicate by english (different id) — cloud wins ─────────────────
test('If same english exists with different id, cloud version wins (no duplicates)', () => {
  const cloudWord = makeWord({ id: 'cloud-id', english: 'banana', level: 3 });
  const localWord = makeWord({ id: 'local-id', english: 'banana', level: 1 });

  const merged = mergeVocabWords([cloudWord], [localWord]);

  assert.equal(merged.length, 1, 'Duplicate english word should not appear twice');
  assert.equal(merged[0].id, 'cloud-id',
    `Cloud id should be used, got ${merged[0].id}`);
});

// ── Test 5: Idempotency ───────────────────────────────────────────────────────
test('Merge is idempotent: merging result with itself gives same length', () => {
  const cloud  = makeWords(10, 'c');
  const local  = makeWords(3,  'l');  // 3 local-only
  const merged = mergeVocabWords(cloud, [...cloud.slice(0, 5), ...local]);

  // Merging again with same merged list should not grow it
  const merged2 = mergeVocabWords(cloud, merged);
  assert.equal(merged2.length, merged.length,
    `Second merge produced ${merged2.length}, expected ${merged.length}`);
});

// ── Test 6: Both empty ────────────────────────────────────────────────────────
test('Both cloud and local empty → empty result', () => {
  const merged = mergeVocabWords([], []);
  assert.equal(merged.length, 0);
});

// ── Test 7: Cloud empty, local has words ─────────────────────────────────────
test('Cloud empty + local has words → all local kept (caller guards against null)', () => {
  // mergeVocabWords([], local) should return only local words
  // (in practice fetchFromCloud returns null for empty, but the merge fn itself
  //  should not silently discard locals even if called with [])
  const localWords = makeWords(5, 'local');
  const merged     = mergeVocabWords([], localWords);
  assert.equal(merged.length, 5,
    `Expected 5 local words, got ${merged.length}`);
});

// ── Test 8: Progress fields from cloud are preserved ─────────────────────────
test('Progress fields (level, currentStreak, lastReviewedDate) come from cloud', () => {
  const now = Date.now();
  const cloudWord = makeWord({
    id: 'prog-id', english: 'cherry',
    level: 5, currentStreak: 15,
    lastReviewedDate: now - 1000,
  });
  const localWord = makeWord({
    id: 'prog-id', english: 'cherry',
    level: 2, currentStreak: 3,
    lastReviewedDate: now - 9999999,
  });

  const merged = mergeVocabWords([cloudWord], [localWord]);
  const result = merged[0];

  assert.equal(result.level, 5);
  assert.equal(result.currentStreak, 15);
  assert.equal(result.lastReviewedDate, now - 1000);
});

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.exitCode = 1;
}
