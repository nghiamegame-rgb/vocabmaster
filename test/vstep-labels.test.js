/**
 * Smart Quiz, Structures quiz and app labels target VSTEP B1–B2 (Grammar: B1) instead of
 * TOEIC; only the archived "Lịch sử trắc nghiệm TOEIC cũ" label keeps TOEIC.
 * Run: node test/vstep-labels.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildStructurePrompt } from '../src/utils/structureQuiz.js';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('no TOEIC wording remains in the quiz prompts and labels', () => {
  for (const file of ['src/components/Quiz.jsx', 'src/utils/structureQuiz.js', 'index.html', 'src/components/Dashboard.jsx']) {
    assert.ok(!/TOEIC/i.test(read(file)), file);
  }
  const stats = read('src/components/grammar/GrammarStats.jsx');
  assert.equal((stats.match(/TOEIC/g) || []).length, 1);
  assert.ok(stats.includes('Lịch sử trắc nghiệm TOEIC cũ'));
  assert.ok(stats.includes('ngữ pháp VSTEP B1<'));
});

test('prompts ask for VSTEP B1–B2 level and keep the JSON contract', () => {
  const quiz = read('src/components/Quiz.jsx');
  assert.ok((quiz.match(/VSTEP B1–B2/g) || []).length >= 4);
  for (const field of ['"question"', '"options"', '"answerIndex"', '"explanation"', '"wordEnglish"', '[_____]']) assert.ok(quiz.includes(field), field);
  const prompt = buildStructurePrompt([{ id: 's1', english: 'despite + noun', vietnamese: 'mặc dù' }], 5, 'Medium');
  assert.match(prompt, /VSTEP/);
  assert.match(prompt, /B1–B2/);
  assert.ok(!/TOEIC|business/i.test(prompt));
  assert.ok(prompt.includes('"structureId"') && prompt.includes('"trapPoint"') && prompt.includes('[_____]'));
  assert.match(read('index.html'), /VSTEP B1–B2/);
});
