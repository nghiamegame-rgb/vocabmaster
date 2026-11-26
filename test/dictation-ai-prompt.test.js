// The AI prompt copied from Dictation → Thư viện bài. Run: node test/dictation-ai-prompt.test.js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DICTATION_LEVELS,
  DEFAULT_DICTATION_LEVEL,
  DICTATION_AI_PROMPT,
  buildDictationAiPrompt,
} from '../src/utils/dictationAiPrompt.js';
import { parseLessonInput } from '../src/utils/dictationParse.js';

test('defines 4 distinct levels A1–B2 with A2 as default', () => {
  assert.deepEqual(DICTATION_LEVELS.map(l => l.id), ['A1', 'A2', 'B1', 'B2']);
  assert.equal(DEFAULT_DICTATION_LEVEL, 'A2');
  for (const level of DICTATION_LEVELS) {
    assert.ok(level.label && level.description);
  }
  assert.equal(DICTATION_AI_PROMPT, buildDictationAiPrompt('A2'));
});

test('all 4 levels produce distinct, well-formed prompts keeping core rules and format', () => {
  const prompts = DICTATION_LEVELS.map(l => buildDictationAiPrompt(l.id));
  assert.equal(new Set(prompts).size, 4);

  const expectedWordRanges = {
    A1: '4–8 từ',
    A2: '6–11 từ',
    B1: '8–15 từ',
    B2: '12–20 từ',
  };

  for (const level of DICTATION_LEVELS) {
    const prompt = buildDictationAiPrompt(level.id);
    assert.ok(prompt.trim().length > 500, `${level.id} prompt too short`);
    assert.ok(prompt.includes(`mức CEFR ${level.id}`), `${level.id} mentions CEFR level`);
    assert.ok(prompt.includes(expectedWordRanges[level.id]), `${level.id} mentions word range`);
    assert.ok(prompt.includes('40 câu MỚI'));
    assert.ok(prompt.includes('English sentence | Bản dịch tiếng Việt'));
    assert.ok(!prompt.includes('---'));
    assert.ok(!prompt.includes('\r'));
    assert.equal(prompt, prompt.trim());
    const lines = prompt.split('\n');
    assert.equal(lines.length, 16);
    assert.ok(lines[0].startsWith('Bạn là giáo viên luyện nghe tiếng Anh.'));
    assert.equal(lines.at(-1), '- Không đánh số, không tiêu đề, không giải thích thêm, không chèn dòng trống.');
  }
});

test('unknown or invalid level ids fall back to default A2', () => {
  for (const bad of ['C1', 'C2', '', null, undefined, 'a1', 123]) {
    assert.equal(buildDictationAiPrompt(bad), DICTATION_AI_PROMPT);
  }
});

test('an answer in the requested format loads as sentences with translations', () => {
  const answer = 'The train leaves at 7:15. | Tàu rời lúc 7 giờ 15.\nCan you help me? | Bạn giúp tôi được không?';
  assert.deepEqual(parseLessonInput(answer), {
    items: [
      { english: 'The train leaves at 7:15.', vietnamese: 'Tàu rời lúc 7 giờ 15.' },
      { english: 'Can you help me?', vietnamese: 'Bạn giúp tôi được không?' },
    ],
    errors: [],
  });
});
