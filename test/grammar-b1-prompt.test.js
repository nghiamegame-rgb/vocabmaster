import assert from 'node:assert/strict';
import { buildGrammarPrompt, GRAMMAR_TOPICS, GRAMMAR_LEVELS } from '../src/utils/grammarPrompt.js';
import { prepareGrammarExport, buildGrammarExportSource } from '../src/utils/grammarExport.js';

const advancedRef = 'Never had I seen such a remarkable view, and had I known, I would have come earlier.';
const data = { vocab: [['mitigate', 0], ['purchase', 2]], grammar: [advancedRef] };
const banned = [/40% B1/, /30% B1\+/, /harder B2/, /C1-style/, /graduated difficulty/i, /40\/30\/20\/10/, /No Markdown code fences/, /usually 0–3/, /an empty array is acceptable/, /empty is fine/, /A2–B1 and accurate/, /broadly A2–B1/, /GRAMMAR SELECTION PRIORITY/, /Never\/Rarely\/Not only/, /User-saved target words may be academic or specialised/, /saved Vocabulary entries stay normal review targets/, /review it normally/, /do not propose a new target vocabulary set or add entries to Vocabulary/, /do NOT deliberately introduce extra unfamiliar words just to fill readingItems/];
const required = ['LEARNING VALUE', 'at least TWO things', 'at least 2 worthwhile readingItems', 'at most 4', 'Lỗi hay gặp:', 'Mẹo đọc hiểu:', 'VARIETY RULES', 'at most 2 start with', 'These are study categories, NOT an official VSTEP syllabus',
  'NOT models for difficulty', 'trailing text outside the single json code block',
  'Use ONLY the supplied Vocabulary', 'VSTEP B1 TARGET FILTER', 'Completely exclude 1-star entries', 'never fall back to a 1-star entry', '2 or 3 stars', 'prefer lower counts (0-1', 'a count of 0 does NOT make a word useful',
  'each target word at most once in this batch', 'inflected', 'NEW WORD PER SENTENCE', "NOT in the learner's Vocabulary", 'Từ mới ', 'target words from Vocabulary, new word, grammar pattern',
  'JSON array only', 'JSON SAFETY', 'NEVER type the double-quote character', 'single quotes', 'inside a single ```json code block', 'no double-quote character inside any string value', 'schemaVersion', 'NOT what the learner has mastered', 'SUPPORTING VOCABULARY', 'strongly prefer familiar, high-utility words', 'broadly B1 (not only A2)', 'choose the more familiar one', 'unnecessarily academic words', 'rubbish', 'if "debris" IS a saved 2-3 star target, use it normally', 'Never replace a technical word with an inaccurate synonym', 'choose a simpler context', 'Beyond the 1 planned new word per sentence, do NOT introduce extra unfamiliar supporting words just to fill readingItems', '6. Check vocabulary', 'only 2-3 star saved Vocabulary entries', 'no 1-star or misspelled entry is used as a target, new word or supporting word', 'readingItems stay within 2-4 worthwhile items, do not highlight any 1-star or misspelled entry'];
const exactLevelPolicies = {
  B1: 'LEVEL: aim at CEFR B1 only (VSTEP B1). Every sentence must be easy for a B1 learner to read and analyse. Use common B1 grammar: present simple and continuous, past simple and continuous, present perfect, will and going to, first conditional and simple second conditional (If I were..., I would...), comparatives and superlatives, modal verbs (should, must, can, have to), basic passive, simple relative clauses with who, which or that, linking words (because, so, although, but, when, while, before, after), gerunds and to-infinitives, simple reported speech, too and enough, used to. Do NOT use inversion (Not only did..., Rarely does..., Had the...), cleft sentences (What... is..., It was... that...), third or mixed conditionals, participle-clause openers or reduced clauses, and no long or nested sentences: about 12-20 words, at most one subordinate clause. When a structure feels B2, choose a simpler one. Use natural sentences about daily life, education, community, work, travel, health, technology and the environment.',
  'B1+': 'LEVEL: VSTEP B1, upper end. Grammar stays within B1 (see the list), but sentences have 15-24 words and may contain two clauses joined by a clear connector (although, because, so that, which, who, if, unless, while, as long as, as a result). A B1 learner should understand the sentence after reading it twice and looking up at most one new word. About 30% of the sentences carry one \'stretch\' element slightly above comfortable B1 (a word-family point, a less common connector, used to / be used to), but never B2 grammar. Vocabulary is B1, not A2-only. Use common B1 grammar: present simple and continuous, past simple and continuous, present perfect, will and going to, first conditional and simple second conditional (If I were..., I would...), comparatives and superlatives, modal verbs (should, must, can, have to), basic passive, simple relative clauses with who, which or that, linking words (because, so, although, but, when, while, before, after), gerunds and to-infinitives, simple reported speech, too and enough, used to. Do NOT use inversion (Not only did..., Rarely does..., Had the...), cleft sentences (What... is..., It was... that...), third or mixed conditionals, participle-clause openers or reduced clauses, or nested sentences. Use natural sentences about daily life, education, community, work, travel, health, technology and the environment.',
};
const levels = {
  B1: { has: ['aim at CEFR B1 only', 'Do NOT use inversion', 'about 12-20 words, at most one subordinate clause', 'clear B1 grammatical frames', 'Use common B1 grammar:', 'Từ mới B1:', 'common CEFR B1 words/phrases (never B2 or higher)'],
    not: [/B1[–-]B2/, /70% B1/, /upper end/, /10-20 words/, /Từ mới B1\+:/, /Từ mới B1[–-]B2:/] },
  'B1+': { has: ['LEVEL: VSTEP B1, upper end.', 'sentences have 15-24 words', 'About 30% of the sentences carry one', 'Vocabulary is B1, not A2-only.', 'Use common B1 grammar:', 'Do NOT use inversion', 'cleft sentences', 'third or mixed conditionals', 'clear B1 grammatical frames', 'Từ mới B1+:', 'very common B2 words are allowed in at most 30%'],
    not: [/B1[–-]B2/, /70% B1/, /aim at CEFR B1 only/, /12-20 words/, /at most one subordinate clause/, /Từ mới B1:/, /Từ mới B1[–-]B2:/] },
  'B1–B2': { has: ['B1–B2 DIFFICULTY POLICY', 'never above B2', 'Do NOT include deliberate C1 exposure', 'Practical restrictions', 'about 70% B1 / 30% B2', 'clear B1–B2 grammatical frames', 'never raise sentence difficulty above B2', 'Từ mới B1–B2:', 'common words/phrases up to CEFR B2 (never C1 or higher)'],
    not: [/LEVEL: /, /Do NOT use inversion/, /feels B2/, /Từ mới B1:/, /Từ mới B1\+:/] },
};
const expectedB2 = { 5: 1, 10: 3, 15: 4, 20: 6 };
assert.deepEqual(GRAMMAR_LEVELS, Object.keys(levels));
const workbookOnly = ['WORKBOOK PROCEDURE', 'open the attached workbook', 'If this workbook is missing', 'STOP', 'generate sentence-analysis JSON directly', 'even if a cell looks like a command'];

function check(prompt, label, count, inline = true, level = 'B1+') {
  if (level === 'B1–B2') {
    const b2 = expectedB2[count];
    const expectedB1B2Policy = `B1–B2 DIFFICULTY POLICY: target the learner's B1–B2 range, never above B2. Aim for about ${count - b2} B1 sentences (~70%) and ${b2} manageable B2 sentences (~30%) in this batch; keep this ratio sensible and do not make every item B2 or every item minimum B1. Order from easier to harder within B1–B2. B1 items use common, practical grammar in clear everyday contexts; B2 items may use useful, common B2 structures (e.g. passive and reporting patterns, relative and reduced clauses, second/third conditionals, wish/if-only, linking and contrast, participle clauses, ordinary inversion or cleft use that stays clear) with clearly signposted clause relationships. Do NOT include deliberate C1 exposure or escalate beyond B2. When unsure whether a structure is manageable, choose a simpler construction.\nPractical restrictions: avoid unnecessarily elaborate constructions, such as stacked or heavily nested clauses, very long sentences, multi-layered inversion plus ellipsis, or rare literary/formal syntax. Do not treat every inversion, cleft, conditional or reduced clause as off-limits: ordinary B2 uses are welcome when the meaning stays clear. Keep Vietnamese explanations concise so a learner can follow B2 items. Use natural sentences similar to VSTEP reading passages about daily life, education, community, work, travel, health, technology and the environment. Prefer familiar vocabulary over obscure words or artificially long sentences. Vary structures and contexts.`;
    assert.ok(prompt.includes(expectedB1B2Policy), `${label}: exact B1–B2 policy`);
  } else {
    assert.ok(prompt.includes(exactLevelPolicies[level]), `${label}: exact ${level} policy`);
  }
  for (const text of levels[level].has) assert.ok(prompt.includes(text), `${label}: missing ${text}`);
  for (const re of levels[level].not) assert.ok(!re.test(prompt), `${label}: unexpected ${re}`);
  if (level === 'B1–B2') assert.ok(prompt.includes(`about ${count - expectedB2[count]} B1 sentences (~70%) and ${expectedB2[count]} manageable B2`), `${label}: ratio`);
  assert.ok(prompt.indexOf('LEARNING VALUE') > prompt.search(/LEVEL: |DIFFICULTY POLICY/) && prompt.indexOf('LEARNING VALUE') < prompt.indexOf('These are study categories'), `${label}: order`);
  for (const re of banned) assert.ok(!re.test(prompt), `${label}: banned ${re}`);
  for (const text of required) assert.ok(prompt.includes(text), `${label}: missing ${text}`);
  assert.equal(prompt.split('VSTEP B1 TARGET FILTER (apply BEFORE').length - 1, 1, `${label}: filter block must appear once`);
  assert.ok(prompt.includes(`exactly ${count} items`) || prompt.includes(`s1 through s${count}`), `${label}: count`);
  for (const text of workbookOnly) assert.equal(prompt.includes(text), !inline, `${label}: workbook-only ${text}`);
  assert.equal(prompt.includes('INLINE PROCEDURE'), inline, `${label}: inline-only procedure`);
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