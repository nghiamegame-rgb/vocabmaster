/**
 * Smart Quiz JSON parsing: answer index must be an integer inside the options,
 * a missing answer is an error (never an implicit option 0), fewer questions
 * than requested are reported, and the JSON array is located with the shared
 * bracket scanner instead of a greedy regex. Run: node test/quiz-parse.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseResponse, quizCountIssue } from '../src/utils/quizParse.js';
import { parseGrammarInput } from '../src/utils/grammarImport.js';

const q = (extra = {}) => ({ question: 'Please [_____] the form.', options: ['sign', 'sing', 'sigh', 'side'], answerIndex: 0, explanation: 'e', wordEnglish: 'sign', ...extra });
const json = items => JSON.stringify(items);

test('valid answerIndex and correctIndex are accepted', () => {
  assert.equal(parseResponse(json([q({ answerIndex: 3 })]))[0].correctIndex, 3);
  const alias = q({ correctIndex: 2 });
  delete alias.answerIndex;
  assert.equal(parseResponse(json([alias]))[0].correctIndex, 2);
});

test('a missing answer is an explicit error instead of silently choosing option 0', () => {
  const missing = q();
  delete missing.answerIndex;
  assert.throws(() => parseResponse(json([missing])), /Câu #1.*thiếu đáp án/);
});

test('answer index must be an integer inside the options', () => {
  for (const bad of [4, -1, 1.5, '2', null, Number.NaN]) {
    assert.throws(() => parseResponse(json([q({ answerIndex: bad })])), /Câu #1/, String(bad));
  }
  assert.throws(() => parseResponse(json([q({ options: ['a', 'b'], answerIndex: 2 })])), /0 đến 1/);
});

test('fenced output and prose around the array are handled', () => {
  const fenced = 'Here is your quiz:\n```json\n' + json([q()]) + '\n```\nGood luck!';
  assert.equal(parseResponse(fenced).length, 1);
  // A greedy /\[.*\]/ would start at "[10]" and fail; the scanner picks the question array.
  const prose = 'Here are [10] questions:\n' + json([q(), q({ answerIndex: 1 })]) + '\nDone [ok].';
  assert.equal(parseResponse(prose).length, 2);
  assert.throws(() => parseResponse('no json here'), /No JSON array/);
  assert.throws(() => parseResponse(json([q()]) + '\n' + json([q()])), /nhiều mảng/);
});

test('fewer questions than requested is reported; equal or more is fine', () => {
  assert.match(quizCountIssue(8, 10), /8\/10/);
  assert.equal(quizCountIssue(10, 10), null);
  assert.equal(quizCountIssue(12, 10), null);
});

test('Grammar import keeps its strict behaviour after sharing the scanner', () => {
  assert.equal(parseGrammarInput('Intro\n[{"a":1}]\nOutro').length, 1);
  assert.throws(() => parseGrammarInput('[{"a":1}] [{"b":2}]'), /nhiều khối JSON/);
  assert.throws(() => parseGrammarInput('[{"a":1}'), /chưa đóng đủ/);
});

test('Quiz.jsx uses the shared parser and shows the short-count notice', () => {
  const source = readFileSync(new URL('../src/components/Quiz.jsx', import.meta.url), 'utf8');
  assert.match(source, /from '\.\.\/utils\/quizParse'/);
  assert.ok(!/function parseResponse/.test(source));
  assert.match(source, /quizCountIssue\(/);
});

test('Smart Quiz word pool uses the unbiased Fisher-Yates shuffle from wordSelection.js', () => {
  const source = readFileSync(new URL('../src/components/Quiz.jsx', import.meta.url), 'utf8');
  assert.ok(!/sort\(\(\) => Math\.random\(\) - 0\.5\)/.test(source), 'biased sort-based shuffle must be gone');
  assert.match(source, /import \{ shuffle \} from '\.\.\/utils\/wordSelection'/);
  assert.match(source, /function buildPool[\s\S]*?shuffle\(pool\)/);
});
