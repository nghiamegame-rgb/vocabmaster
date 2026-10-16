/**
 * vocab-sync.test.js
 *
 * Focused unit-tests for the vocabulary sync merge logic and push-verification
 * result handling.
 *
 * Scenarios covered:
 *  Original 8:
 *   1. Bug reproduction: mobile has 95 stale words, cloud has 100.
 *      After merge the result must have ≥ 100 words; no cloud word is lost.
 *   2. Local-only words are preserved.
 *   3. Cloud word wins over local when same english key exists.
 *   4. Merge is idempotent.
 *   5. Both inputs empty → empty result.
 *   6. Cloud empty + local has words → all local kept.
 *   7. Progress fields come from cloud.
 *   8. Duplicate english with different id → cloud wins, no duplicates.
 *
 *  New (Bug-fix validation):
 *   9.  308-local / 250-cloud scenario: merged result has 308 words, and
 *       all 250 cloud words are present (no cloud word overwritten).
 *       The 58 local-only words must survive.
 *  10.  After fetch that finds local-only words, merged.length > cloudWords.length
 *       so the caller should push the merged list (logic gate test).
 *  11.  verifyPush result interpretation: 'ok' when cloud count >= expected,
 *       'mismatch' when cloud count < expected.
 *  12.  lastReviewedDate is preserved from cloud through mergeVocabWords.
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

// ─── Inline verifyPush interpretation logic ───────────────────────────────────
// This mirrors the logic in src/utils/cloud.js verifyPush().
// We test the decision logic, not the actual network call.
function interpretVerifyResult(cloudCount, expectedCount) {
  if (cloudCount === null) return 'error';
  return cloudCount >= expectedCount ? 'ok' : 'mismatch';
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

// ── NEW Test 9: 308 local / 250 cloud scenario ────────────────────────────────
test('308-local / 250-cloud: all 308 words in result, 250 cloud words intact, 58 local-only preserved', () => {
  // Cloud has 250 words
  const cloudWords = makeWords(250, 'cloud', i => (i % 5) + 1);

  // Laptop has 308 words: 250 matching cloud + 58 new local-only ones
  const localMatching = cloudWords.map(w => ({ ...w, level: 1, currentStreak: 0 })); // stale copies
  const localOnly58   = makeWords(58, 'laptop_new');
  const localWords    = [...localMatching, ...localOnly58];

  assert.equal(localWords.length, 308, `Setup: local should have 308, got ${localWords.length}`);

  const merged = mergeVocabWords(cloudWords, localWords);

  // Result must have exactly 308 words
  assert.equal(merged.length, 308,
    `Expected 308 words after merge, got ${merged.length}`);

  // All 250 cloud words must be present (by id)
  const cloudIds = new Set(cloudWords.map(w => w.id));
  for (const w of merged) cloudIds.delete(w.id);
  assert.equal(cloudIds.size, 0,
    `Missing ${cloudIds.size} cloud words from merged result`);

  // All 58 local-only words must be present
  for (const w of localOnly58) {
    assert.ok(merged.some(m => m.id === w.id),
      `Local-only word "${w.english}" missing from merged result`);
  }

  // Cloud words win: merged words that exist in cloud must have cloud's level,
  // not the stale local level=1
  const cloudMap = new Map(cloudWords.map(w => [w.id, w]));
  for (const mergedWord of merged) {
    const original = cloudMap.get(mergedWord.id);
    if (original) {
      assert.equal(mergedWord.level, original.level,
        `Cloud word "${mergedWord.english}" should have level ${original.level}, got ${mergedWord.level}`);
    }
  }
});

// ── NEW Test 10: Fetch-then-push gate condition ────────────────────────────────
test('After fetch: should push iff merged.length > cloudWords.length (local-only words exist)', () => {
  const cloudWords = makeWords(250, 'cloud');
  const localOnly  = makeWords(58,  'new');
  const localAll   = [...cloudWords.map(w => ({ ...w })), ...localOnly];

  const merged = mergeVocabWords(cloudWords, localAll);

  // The gate: push back if merge has more than cloud (local-only additions exist)
  const shouldPush = merged.length > cloudWords.length;
  assert.ok(shouldPush,
    `Should push because merged (${merged.length}) > cloud (${cloudWords.length})`);

  // Sanity: if local has no extras, should NOT push
  const mergedNoExtras = mergeVocabWords(cloudWords, cloudWords.map(w => ({ ...w })));
  const shouldNotPush  = mergedNoExtras.length > cloudWords.length;
  assert.ok(!shouldNotPush,
    `Should NOT push when merged (${mergedNoExtras.length}) === cloud (${cloudWords.length})`);
});

// ── NEW Test 11: verifyPush result interpretation ────────────────────────────
test('verifyPush: ok when cloud count >= expected; mismatch when fewer; error when null', () => {
  // ok: cloud has same count as expected
  assert.equal(interpretVerifyResult(308, 308), 'ok',
    'Should be ok when cloud count equals expected');

  // ok: cloud has MORE than expected (e.g. race condition added a word between push and verify)
  assert.equal(interpretVerifyResult(310, 308), 'ok',
    'Should be ok when cloud count exceeds expected');

  // mismatch: cloud returned fewer rows (push partially failed or was throttled)
  assert.equal(interpretVerifyResult(250, 308), 'mismatch',
    'Should be mismatch when cloud count < expected');

  // error: fetchFromCloud returned null (network/parse failure)
  assert.equal(interpretVerifyResult(null, 308), 'error',
    'Should be error when cloud returns null');
});

// ── NEW Test 12: lastReviewedDate preserved through merge ────────────────────
test('lastReviewedDate is preserved from cloud; local stale date is not used', () => {
  const now = Date.now();
  const cloudW = makeWord({ id: 'rv-id', english: 'date', lastReviewedDate: now - 500 });
  const localW = makeWord({ id: 'rv-id', english: 'date', lastReviewedDate: now - 99999 });

  const merged = mergeVocabWords([cloudW], [localW]);
  assert.equal(merged.length, 1);
  // Cloud wins — the newer lastReviewedDate from cloud should be used
  assert.equal(merged[0].lastReviewedDate, now - 500,
    `Expected cloud lastReviewedDate (${now - 500}), got ${merged[0].lastReviewedDate}`);
});

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.exitCode = 1;
}
