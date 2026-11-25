// The AI prompt copied from Dictation → Thư viện bài. Run: node test/dictation-ai-prompt.test.js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DICTATION_AI_PROMPT } from '../src/utils/dictationAiPrompt.js';
import { parseLessonInput } from '../src/utils/dictationParse.js';

test('prompt is present, mentions the VSTEP level and the paste-back format', () => {
  assert.ok(DICTATION_AI_PROMPT.trim().length > 500);
  assert.match(DICTATION_AI_PROMPT, /VSTEP Listening từ 5 điểm trở xuống \(khoảng A2–B1\)/);
  assert.ok(DICTATION_AI_PROMPT.includes('English sentence | Bản dịch tiếng Việt'));
  assert.ok(DICTATION_AI_PROMPT.includes('40 câu MỚI'));
});

test('the "---" markers are not part of the prompt; line breaks are kept', () => {
  assert.ok(!DICTATION_AI_PROMPT.includes('---'));
  assert.ok(!DICTATION_AI_PROMPT.includes('\r'));
  assert.equal(DICTATION_AI_PROMPT, DICTATION_AI_PROMPT.trim());
  const lines = DICTATION_AI_PROMPT.split('\n');
  assert.equal(lines.length, 16);
  assert.ok(lines[0].startsWith('Bạn là giáo viên luyện nghe tiếng Anh.'));
  assert.equal(lines.at(-1), '- Không đánh số, không tiêu đề, không giải thích thêm, không chèn dòng trống.');
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
