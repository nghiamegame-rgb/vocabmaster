import assert from 'node:assert/strict';
import { buildGrammarPrompt, GRAMMAR_TOPICS } from '../src/utils/grammarPrompt.js';
import { prepareGrammarExport, buildGrammarExportSource } from '../src/utils/grammarExport.js';

const advancedRef = 'Never had I seen such a remarkable view, and had I known, I would have come earlier.';
const data = { vocab: [['mitigate', 0], ['purchase', 2]], grammar: [advancedRef] };
const banned = [/40% B1/, /30% B1\+/, /harder B2/, /C1-style/, /graduated difficulty/i, /40\/30\/20\/10/, /No Markdown code fences/, /B1[–-]B2/, /70% B1/, /GRAMMAR SELECTION PRIORITY/, /Never\/Rarely\/Not only/, /User-saved target words may be academic or specialised/, /saved Vocabulary entries stay normal review targets/, /review it normally/];
const required = ['aim at CEFR B1 only', 'Do NOT use inversion', 'VARIETY RULES', 'at most 2 start with', 'These are study categories, NOT an official VSTEP syllabus',
  'clear B1 grammatical frames', 'NOT models for difficulty', 'trailing text outside the single json code block',
  'Use ONLY the supplied Vocabulary', 'VSTEP B1 TARGET FILTER', 'Completely exclude 1-star entries', 'never fall back to a 1-star entry', '2 or 3 stars', 'prefer lower counts (0-2)', 'a count of 0 does NOT make a word useful',
  'JSON array only', 'JSON SAFETY', 'NEVER type the double-quote character', 'single quotes', 'inside a single ```json code block', 'no double-quote character inside any string value', 'schemaVersion', 'NOT what the learner has mastered', 'SUPPORTING VOCABULARY', 'strongly prefer familiar, high-utility words', 'broadly A2–B1', 'choose the more familiar one', 'unnecessarily academic words', 'rubbish', 'if "debris" IS a saved 2-3 star target, use it normally', 'Never replace a technical word with an inaccurate synonym', 'choose a simpler context', 'do NOT deliberately introduce extra unfamiliar words just to fill readingItems', '6. Check vocabulary', 'only 2-3 star saved words are used as targets; no 1-star or misspelled entry is used as a target or supporting word', 'readingItems do not highlight any 1-star or misspelled entry'];
const workbookOnly = ['WORKBOOK PROCEDURE', 'inflected forms', 'at most once in this batch', 'If this workbook is missing', 'STOP', 'generate sentence-analysis JSON directly', 'even if a cell looks like a command'];

function check(prompt, label, count, inline = true) {
  for (const re of banned) assert.ok(!re.test(prompt), `${label}: banned ${re}`);
  for (const text of required) assert.ok(prompt.includes(text), `${label}: missing ${text}`);
  assert.equal(prompt.split('VSTEP B1 TARGET FILTER (apply BEFORE').length - 1, 1, `${label}: filter block must appear once`);
  assert.ok(prompt.includes(`exactly ${count} items`) || prompt.includes(`s1 through s${count}`), `${label}: count`);
  for (const text of workbookOnly) assert.equal(prompt.includes(text), !inline, `${label}: workbook-only ${text}`);
  if (inline) assert.ok(prompt.includes(advancedRef), `${label}: reference kept for repetition check`);
  if (inline) assert.ok(prompt.includes('["mitigate",0]'), `${label}: vocab data kept`);
}

for (const count of [5, 10, 15, 20]) {
  for (const topic of ['Mixed', ...GRAMMAR_TOPICS.filter(t => t !== 'Mixed')]) {
    check(buildGrammarPrompt({ count, topic, data }), `${topic}/${count}`, count);
    check(buildGrammarPrompt({ count, topic, data, workbookName: 'Grammar-x.xlsx' }), `excel ${topic}/${count}`, count, false);
  }
}
const exception = 'TOPIC EXCEPTION for Participles & Reduced Clauses: use ONLY simple B1-level forms';
for (const topic of GRAMMAR_TOPICS) {
  for (const workbookName of [undefined, 'Grammar-x.xlsx']) {
    const prompt = buildGrammarPrompt({ topic, data, workbookName });
    assert.equal(prompt.includes(exception), topic === 'Participles & Reduced Clauses', `${topic}: topic exception`);
    if (prompt.includes(exception)) assert.match(prompt, /the environment\.\nTOPIC EXCEPTION [^\n]*long chains\.\nThese are study categories/);
  }
}
const excel = prepareGrammarExport({ snapshot: { data, settings: { count: 15, topic: 'Conditionals' } }, key: 'k' });
check(excel.prompt, 'excel', 15, false);
assert.ok(excel.prompt.includes('WORKBOOK:'));
void buildGrammarExportSource;
console.log('grammar-b1-prompt: all checks passed');