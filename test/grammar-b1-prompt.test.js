import assert from 'node:assert/strict';
import { buildGrammarPrompt, GRAMMAR_TOPICS } from '../src/utils/grammarPrompt.js';
import { prepareGrammarExport, buildGrammarExportSource } from '../src/utils/grammarExport.js';

const advancedRef = 'Never had I seen such a remarkable view, and had I known, I would have come earlier.';
const data = { vocab: [['mitigate', 0], ['purchase', 2]], grammar: [advancedRef] };
const banned = [/40% B1/, /30% B1\+/, /harder B2/, /C1-style/, /graduated difficulty/i, /40\/30\/20\/10/, /B1-ONLY/, /B1 only/, /do NOT escalate to B2/i, /Never\/Rarely\/Not only/];
const required = ['B1–B2 DIFFICULTY POLICY', 'never above B2', 'Do NOT include deliberate C1 exposure', 'choose a simpler construction',
  'heavily nested', 'Do not treat every inversion, cleft, conditional or reduced clause as off-limits', 'Keep Vietnamese explanations concise',
  'clear B1–B2 grammatical frames', 'NOT models for difficulty', 'about 70% B1 / 30% B2', 'nothing above B2',
  'Use ONLY the supplied Vocabulary', 'JSON array only', 'schemaVersion', 'GRAMMAR SELECTION PRIORITY', 'familiarity and usefulness come BEFORE novelty', 'NOT thereby common', 'do not claim any statistical frequency', 'Purposeful repetition is welcome', 'do not impose a quota of unseen structures', 'Only AMONG common, practical B1', 'never hunt for obscure subpatterns', 'write fresh examples of them', 'NOT what the learner has mastered', 'Check that common, practical B1', 'SUPPORTING VOCABULARY', 'strongly prefer familiar, high-utility words', 'broadly A2–B1', 'B2 grammar does not need difficult supporting words', 'choose the more familiar one', 'unnecessarily academic words', 'rubbish', 'review it normally', 'Never replace a technical word with an inaccurate synonym', 'choose a simpler context', 'do NOT deliberately introduce extra unfamiliar words just to fill readingItems', '6. Check vocabulary', 'Prioritize zero-count and then low-count entries'];
const expectedB2 = { 5: 1, 10: 3, 15: 4, 20: 6 };

function check(prompt, label, count, inline = true) {
  for (const re of banned) assert.ok(!re.test(prompt), `${label}: banned ${re}`);
  for (const text of required) assert.ok(prompt.includes(text), `${label}: missing ${text}`);
  assert.ok(prompt.includes(`exactly ${count} items`) || prompt.includes(`s1 through s${count}`), `${label}: count`);
  assert.ok(prompt.includes(`about ${count - expectedB2[count]} B1 sentences (~70%) and ${expectedB2[count]} manageable B2`), `${count}: ratio`);
  if (inline) assert.ok(prompt.includes(advancedRef), `${label}: reference kept for repetition check`);
  if (inline) assert.ok(prompt.includes('["mitigate",0]'), `${label}: vocab data kept`);
}

for (const count of [5, 10, 15, 20]) {
  for (const topic of ['Mixed', ...GRAMMAR_TOPICS.filter(t => t !== 'Mixed')]) {
    check(buildGrammarPrompt({ count, topic, data }), `${topic}/${count}`, count);
  }
}
const excel = prepareGrammarExport({ snapshot: { data, settings: { count: 15, topic: 'Conditionals' } }, key: 'k' });
check(excel.prompt, 'excel', 15, false);
assert.ok(excel.prompt.includes('WORKBOOK:'));
void buildGrammarExportSource;
console.log('grammar-b1-prompt: all checks passed');