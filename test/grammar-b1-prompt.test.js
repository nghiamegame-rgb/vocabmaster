import assert from 'node:assert/strict';
import { buildGrammarPrompt, GRAMMAR_TOPICS, GRAMMAR_LEVELS } from '../src/utils/grammarPrompt.js';
import { prepareGrammarExport, buildGrammarExportSource } from '../src/utils/grammarExport.js';

const advancedRef = 'Never had I seen such a remarkable view, and had I known, I would have come earlier.';
const data = { vocab: [['mitigate', 0], ['purchase', 2]], grammar: [advancedRef] };
const banned = [/40% B1/, /30% B1\+/, /harder B2/, /C1-style/, /graduated difficulty/i, /40\/30\/20\/10/, /No Markdown code fences/, /usually 0–3/, /an empty array is acceptable/, /empty is fine/, /A2–B1 and accurate/, /broadly A2–B1/, /GRAMMAR SELECTION PRIORITY/, /Never\/Rarely\/Not only/, /User-saved target words may be academic or specialised/, /saved Vocabulary entries stay normal review targets/, /review it normally/];
const required = ['LEARNING VALUE', 'at least TWO things', 'at least 2 worthwhile readingItems', 'at most 4', 'Lỗi hay gặp:', 'Mẹo đọc hiểu:', 'VARIETY RULES', 'at most 2 start with', 'These are study categories, NOT an official VSTEP syllabus',
  'NOT models for difficulty', 'trailing text outside the single json code block',
  'Use ONLY the supplied Vocabulary', 'VSTEP B1 TARGET FILTER', 'Completely exclude 1-star entries', 'never fall back to a 1-star entry', '2 or 3 stars', 'prefer lower counts (0-2)', 'a count of 0 does NOT make a word useful',
  'JSON array only', 'JSON SAFETY', 'NEVER type the double-quote character', 'single quotes', 'inside a single ```json code block', 'no double-quote character inside any string value', 'schemaVersion', 'NOT what the learner has mastered', 'SUPPORTING VOCABULARY', 'strongly prefer familiar, high-utility words', 'broadly B1 (not only A2)', 'choose the more familiar one', 'unnecessarily academic words', 'rubbish', 'if "debris" IS a saved 2-3 star target, use it normally', 'Never replace a technical word with an inaccurate synonym', 'choose a simpler context', 'do NOT deliberately introduce extra unfamiliar words just to fill readingItems', '6. Check vocabulary', 'only 2-3 star saved words are used as targets; no 1-star or misspelled entry is used as a target or supporting word', 'readingItems do not highlight any 1-star or misspelled entry'];
const levels = {
  B1: { has: ['aim at CEFR B1 only', 'Do NOT use inversion', 'about 12-20 words, at most one subordinate clause', 'clear B1 grammatical frames'],
    not: [/B1[–-]B2/, /70% B1/, /upper end/, /10-20 words/] },
  'B1+': { has: ['LEVEL: VSTEP B1, upper end.', 'sentences have 15-24 words', 'About 30% of the sentences carry one', 'Vocabulary is B1, not A2-only.', 'Use common B1 grammar:', 'Do NOT use inversion', 'cleft sentences', 'third or mixed conditionals', 'clear B1 grammatical frames'],
    not: [/B1[–-]B2/, /70% B1/, /aim at CEFR B1 only/, /12-20 words/, /at most one subordinate clause/] },
  'B1–B2': { has: ['B1–B2 DIFFICULTY POLICY', 'never above B2', 'Do NOT include deliberate C1 exposure', 'Practical restrictions', 'about 70% B1 / 30% B2', 'clear B1–B2 grammatical frames', 'never raise sentence difficulty above B2'],
    not: [/LEVEL: /, /Do NOT use inversion/, /feels B2/] },
};
const expectedB2 = { 5: 1, 10: 3, 15: 4, 20: 6 };
assert.deepEqual(GRAMMAR_LEVELS, Object.keys(levels));
const workbookOnly = ['WORKBOOK PROCEDURE', 'inflected forms', 'at most once in this batch', 'If this workbook is missing', 'STOP', 'generate sentence-analysis JSON directly', 'even if a cell looks like a command'];

function check(prompt, label, count, inline = true, level = 'B1+') {
  for (const text of levels[level].has) assert.ok(prompt.includes(text), `${label}: missing ${text}`);
  for (const re of levels[level].not) assert.ok(!re.test(prompt), `${label}: unexpected ${re}`);
  if (level === 'B1–B2') assert.ok(prompt.includes(`about ${count - expectedB2[count]} B1 sentences (~70%) and ${expectedB2[count]} manageable B2`), `${label}: ratio`);
  assert.ok(prompt.indexOf('LEARNING VALUE') > prompt.search(/LEVEL: |DIFFICULTY POLICY/) && prompt.indexOf('LEARNING VALUE') < prompt.indexOf('These are study categories'), `${label}: order`);
  for (const re of banned) assert.ok(!re.test(prompt), `${label}: banned ${re}`);
  for (const text of required) assert.ok(prompt.includes(text), `${label}: missing ${text}`);
  assert.equal(prompt.split('VSTEP B1 TARGET FILTER (apply BEFORE').length - 1, 1, `${label}: filter block must appear once`);
  assert.ok(prompt.includes(`exactly ${count} items`) || prompt.includes(`s1 through s${count}`), `${label}: count`);
  for (const text of workbookOnly) assert.equal(prompt.includes(text), !inline, `${label}: workbook-only ${text}`);
  if (inline) assert.ok(prompt.includes(advancedRef), `${label}: reference kept for repetition check`);
  if (inline) assert.ok(prompt.includes('["mitigate",0]'), `${label}: vocab data kept`);
}

for (const level of GRAMMAR_LEVELS) {
  for (const count of [5, 10, 15, 20]) {
    for (const topic of GRAMMAR_TOPICS) {
      check(buildGrammarPrompt({ count, topic, data, level }), `${level} ${topic}/${count}`, count, true, level);
      check(buildGrammarPrompt({ count, topic, data, level, workbookName: 'Grammar-x.xlsx' }), `excel ${level} ${topic}/${count}`, count, false, level);
    }
  }
}
// Missing or unknown level (older data) falls back to B1+.
for (const level of [undefined, 'C1']) assert.equal(buildGrammarPrompt({ data, level }), buildGrammarPrompt({ data, level: 'B1+' }));
const exception = 'TOPIC EXCEPTION for Participles & Reduced Clauses: use ONLY simple B1-level forms';
for (const topic of GRAMMAR_TOPICS) {
  for (const workbookName of [undefined, 'Grammar-x.xlsx']) {
    const prompt = buildGrammarPrompt({ topic, data, workbookName });
    assert.equal(prompt.includes(exception), topic === 'Participles & Reduced Clauses', `${topic}: topic exception`);
    if (prompt.includes(exception)) assert.match(prompt, /the environment\.\nTOPIC EXCEPTION [^\n]*long chains\.\nLEARNING VALUE/);
  }
}
const excel = prepareGrammarExport({ snapshot: { data, settings: { count: 15, topic: 'Conditionals' } }, key: 'k' });
check(excel.prompt, 'excel', 15, false);
assert.ok(excel.prompt.includes('WORKBOOK:'));
// The level is part of the Excel snapshot key, so changing it makes the package stale.
const keys = [undefined, 'B1', 'B1+', 'B1–B2'].map(level => buildGrammarExportSource([], [], { count: 10, topic: 'Mixed', level }).key);
assert.equal(keys[0], keys[2]);
assert.equal(new Set(keys).size, 3);
const b1Package = prepareGrammarExport(buildGrammarExportSource([], [], { count: 10, topic: 'Mixed', level: 'B1' }));
check(b1Package.prompt, 'excel B1 package', 10, false, 'B1');
console.log('grammar-b1-prompt: all checks passed');