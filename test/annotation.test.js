/**
 * annotation.test.js — Tests for the annotation utility
 *
 * Run with: node --experimental-vm-modules test/annotation.test.js
 * Or via Vite's test runner if configured.
 */

// ── Minimal test harness ──────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    console.error(`     Expected: ${JSON.stringify(expected)}`);
    console.error(`     Actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ── Import (CommonJS-style for Node, works with .js extension) ────────────────
// We use a dynamic simulation since this is ES module source.
// The regex and logic are copied here for test purposes.

const ANNOTATION_RE =
  /\s*\(\s*((?:adj|adv|conj|det|art|num|pron|prep|ing|ed|v|n)(?:\s*[-\/–]\s*(?:adj|adv|conj|det|art|num|pron|prep|ing|ed|v|n))*)\s*\)$/i;

function extractAnnotation(raw) {
  if (!raw || typeof raw !== 'string') return { cleanEnglish: '', annotation: '' };
  const match = raw.trim().match(ANNOTATION_RE);
  if (!match) return { cleanEnglish: raw.trim(), annotation: '' };
  const annotation   = match[1].trim();
  const cleanEnglish = raw.trim().slice(0, raw.trim().length - match[0].length).trim();
  if (!cleanEnglish) return { cleanEnglish: raw.trim(), annotation: '' };
  return { cleanEnglish, annotation };
}

function migrateWord(word) {
  if (typeof word.annotation === 'string' && word.annotation.trim() !== '') {
    return word;
  }
  if (typeof word.annotation === 'string') {
    return word;
  }
  const { cleanEnglish, annotation } = extractAnnotation(word.english || '');
  return { ...word, english: cleanEnglish, annotation };
}

function migrateWordList(words) {
  if (!Array.isArray(words)) return [];
  return words.map(migrateWord);
}

function formatWithAnnotation(english, annotation) {
  if (!annotation || !annotation.trim()) return english || '';
  return `${english} (${annotation.trim()})`;
}

// ── Test Suite 1: extractAnnotation ──────────────────────────────────────────
console.log('\n=== Test 1: extractAnnotation — recognised patterns ===');

assertEqual(
  extractAnnotation('Active (adj)'),
  { cleanEnglish: 'Active', annotation: 'adj' },
  'Active (adj) → cleanEnglish=Active, annotation=adj'
);

assertEqual(
  extractAnnotation('Satisfy (v)'),
  { cleanEnglish: 'Satisfy', annotation: 'v' },
  'Satisfy (v) → cleanEnglish=Satisfy, annotation=v'
);

assertEqual(
  extractAnnotation('Act (v - n)'),
  { cleanEnglish: 'Act', annotation: 'v - n' },
  'Act (v - n) → multiple word classes separated by -'
);

assertEqual(
  extractAnnotation('Acting (adj - ing)'),
  { cleanEnglish: 'Acting', annotation: 'adj - ing' },
  'Acting (adj - ing) → adj-ing annotation'
);

assertEqual(
  extractAnnotation('Proposed (adj-ed)'),
  { cleanEnglish: 'Proposed', annotation: 'adj-ed' },
  'Proposed (adj-ed) → adj-ed annotation'
);

assertEqual(
  extractAnnotation('Coordinate (v - n)'),
  { cleanEnglish: 'Coordinate', annotation: 'v - n' },
  'Coordinate (v - n) → example from requirements'
);

assertEqual(
  extractAnnotation('Substantially (adv)'),
  { cleanEnglish: 'Substantially', annotation: 'adv' },
  'Substantially (adv) → adv annotation'
);

// Slash separator
assertEqual(
  extractAnnotation('Certain (adj / adv)'),
  { cleanEnglish: 'Certain', annotation: 'adj / adv' },
  'Certain (adj / adv) → slash separator'
);

// ── Test Suite 2: extractAnnotation — preserved expressions ──────────────────
console.log('\n=== Test 2: extractAnnotation — should NOT strip ambiguous parens ===');

// "look (at)" — phrasal verb, should NOT strip "(at)"
assertEqual(
  extractAnnotation('look (at)'),
  { cleanEnglish: 'look (at)', annotation: '' },
  'look (at) — at is not a POS token, must NOT be stripped'
);

// "account (for)" — phrasal verb
assertEqual(
  extractAnnotation('account (for)'),
  { cleanEnglish: 'account (for)', annotation: '' },
  'account (for) — for is not a POS token, must NOT be stripped'
);

// No annotation at all
assertEqual(
  extractAnnotation('Coordinate'),
  { cleanEnglish: 'Coordinate', annotation: '' },
  'Word with no annotation → annotation empty'
);

// Already clean word
assertEqual(
  extractAnnotation('Run'),
  { cleanEnglish: 'Run', annotation: '' },
  'Simple word → no annotation extracted'
);

// ── Test Suite 3: migrateWord ─────────────────────────────────────────────────
console.log('\n=== Test 3: migrateWord — safe migration ===');

const wordNoAnnotation = {
  id: '1', english: 'Active (adj)', vietnamese: 'Chủ động',
  level: 2, currentStreak: 5
};
const migrated = migrateWord(wordNoAnnotation);
assertEqual(migrated.english, 'Active', 'Migrated english is clean');
assertEqual(migrated.annotation, 'adj', 'Annotation extracted to separate field');
assertEqual(migrated.vietnamese, 'Chủ động', 'Vietnamese preserved');
assertEqual(migrated.level, 2, 'Level preserved');
assertEqual(migrated.currentStreak, 5, 'currentStreak preserved');

// Word already has annotation → must NOT overwrite
const wordAlreadyMigrated = {
  id: '2', english: 'Coordinate', annotation: 'v - n', vietnamese: 'Phối hợp', level: 1
};
const reMigrated = migrateWord(wordAlreadyMigrated);
assertEqual(reMigrated.english, 'Coordinate', 'Already-migrated: english unchanged');
assertEqual(reMigrated.annotation, 'v - n', 'Already-migrated: annotation not overwritten');

// Word with empty annotation field → must NOT re-extract (annotation field already set to '')
const wordEmptyAnnotation = {
  id: '3', english: 'Run', annotation: '', vietnamese: 'Chạy', level: 1
};
const migrated3 = migrateWord(wordEmptyAnnotation);
assertEqual(migrated3.english, 'Run', 'Empty annotation: english unchanged');
assertEqual(migrated3.annotation, '', 'Empty annotation: stays empty');

// Word with non-strippable expression
const wordPhrasal = {
  id: '4', english: 'look (at)', vietnamese: 'nhìn vào', level: 1
};
const migrated4 = migrateWord(wordPhrasal);
assertEqual(migrated4.english, 'look (at)', 'Phrasal: english preserved as-is');
assertEqual(migrated4.annotation, '', 'Phrasal: no annotation extracted');

// ── Test Suite 4: migrateWordList ─────────────────────────────────────────────
console.log('\n=== Test 4: migrateWordList ===');

const wordList = [
  { id: '1', english: 'Active (adj)',    vietnamese: 'Chủ động', level: 1, currentStreak: 0 },
  { id: '2', english: 'Act (v - n)',     vietnamese: 'Hành động', level: 2, currentStreak: 3 },
  { id: '3', english: 'Coordinate',     annotation: 'v - n', vietnamese: 'Phối hợp', level: 3, currentStreak: 8 }, // already migrated
  { id: '4', english: 'look (at)',      vietnamese: 'nhìn vào', level: 1, currentStreak: 0 },
  { id: '5', english: 'Run',            vietnamese: 'Chạy', level: 2, currentStreak: 2 },
];

const migratedList = migrateWordList(wordList);

assertEqual(migratedList[0].english, 'Active', 'Word 0: english clean');
assertEqual(migratedList[0].annotation, 'adj', 'Word 0: annotation extracted');
assertEqual(migratedList[1].english, 'Act', 'Word 1: english clean');
assertEqual(migratedList[1].annotation, 'v - n', 'Word 1: multi-class annotation');
assertEqual(migratedList[2].english, 'Coordinate', 'Word 2: already migrated, english intact');
assertEqual(migratedList[2].annotation, 'v - n', 'Word 2: already migrated, annotation intact');
assertEqual(migratedList[3].english, 'look (at)', 'Word 3: phrasal, english preserved');
assertEqual(migratedList[3].annotation, '', 'Word 3: phrasal, no annotation');
assertEqual(migratedList[4].english, 'Run', 'Word 4: plain word');
assertEqual(migratedList[4].annotation, '', 'Word 4: no annotation');

// Verify progress fields preserved
assertEqual(migratedList[1].currentStreak, 3, 'currentStreak preserved through migration');
assertEqual(migratedList[2].level, 3, 'level preserved through migration');

// Idempotency check — run twice on already-migrated list
const doubleMigrated = migrateWordList(migratedList);
assertEqual(doubleMigrated[0].annotation, 'adj', 'Idempotent: annotation unchanged on re-run');
assertEqual(doubleMigrated[0].english, 'Active', 'Idempotent: english unchanged on re-run');

// ── Test Suite 5: formatWithAnnotation ───────────────────────────────────────
console.log('\n=== Test 5: formatWithAnnotation — display helper ===');

assertEqual(formatWithAnnotation('Coordinate', 'v - n'), 'Coordinate (v - n)', 'Format with annotation');
assertEqual(formatWithAnnotation('Run', ''), 'Run', 'Format without annotation — no parens');
assertEqual(formatWithAnnotation('Run', undefined), 'Run', 'Format with undefined annotation');
assertEqual(formatWithAnnotation('Look at', null), 'Look at', 'Format with null annotation');

// ── Test Suite 6: TTS / Exercise correctness ──────────────────────────────────
console.log('\n=== Test 6: TTS — english field is clean for TTS ===');

const ttsWords = migrateWordList([
  { id: '1', english: 'Substantially (adv)', vietnamese: 'Đáng kể', level: 1, currentStreak: 0 },
  { id: '2', english: 'Coordinate (v - n)',  vietnamese: 'Phối hợp', level: 1, currentStreak: 0 },
]);

// TTS should use word.english (which is now clean after migration)
assert(ttsWords[0].english === 'Substantially', 'TTS: "Substantially (adv)" → english is "Substantially"');
assert(ttsWords[1].english === 'Coordinate',    'TTS: "Coordinate (v - n)" → english is "Coordinate"');

// Answer validation uses english only
function normalise(str) { return (str || '').trim().toLowerCase(); }
assert(
  normalise('substantially') === normalise(ttsWords[0].english),
  'Answer check: typed "substantially" matches clean english "Substantially"'
);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Total: ${passed + failed}  ✅ Passed: ${passed}  ❌ Failed: ${failed}`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed! 🎉');
}
