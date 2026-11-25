// Lesson parsing / sentence splitting. Run: node test/dictation-parse.test.js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitSentences, parseLessonInput, MAX_LESSON_SENTENCES } from '../src/utils/dictationParse.js';

test('splits running text at . ? ! …', () => {
  assert.deepEqual(splitSentences('Hello there. How are you? I am fine! Thanks… Bye.'),
    ['Hello there.', 'How are you?', 'I am fine!', 'Thanks…', 'Bye.']);
});

test('does not split abbreviations, initials or decimals', () => {
  assert.deepEqual(splitSentences('Mr. Smith met Dr. Brown in the U.S. last year. It cost 3.5 dollars.'),
    ['Mr. Smith met Dr. Brown in the U.S. last year.', 'It cost 3.5 dollars.']);
  assert.deepEqual(splitSentences('We need pens, paper, etc. and some glue. Done.'),
    ['We need pens, paper, etc. and some glue.', 'Done.']);
  assert.deepEqual(splitSentences('J. K. Rowling wrote it. e.g. this one.'), ['J. K. Rowling wrote it. e.g. this one.']);
  assert.deepEqual(splitSentences('The meeting starts at 9 a.m. Please be on time.'),
    ['The meeting starts at 9 a.m. Please be on time.']);
});

test('keeps closing quotes with their sentence', () => {
  assert.deepEqual(splitSentences('He said "Stop." Then he left.'), ['He said "Stop."', 'Then he left.']);
  assert.deepEqual(splitSentences('It was I. Nobody else.'), ['It was I.', 'Nobody else.']);
});

test('one line = one sentence, optional "English | Tiếng Việt"', () => {
  const r = parseLessonInput('I like tea. | Tôi thích trà.\n\n  She runs every day  \nWhere is it? | Nó ở đâu? | (hỏi)');
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.items, [
    { english: 'I like tea.', vietnamese: 'Tôi thích trà.' },
    { english: 'She runs every day', vietnamese: '' },
    { english: 'Where is it?', vietnamese: 'Nó ở đâu? | (hỏi)' },
  ]);
});

test('a pasted paragraph on one line is split into sentences', () => {
  const r = parseLessonInput('First one. Second one? Third!');
  assert.deepEqual(r.items.map(i => i.english), ['First one.', 'Second one?', 'Third!']);
});

test('reports problems instead of silently dropping input', () => {
  assert.match(parseLessonInput(' | chỉ có tiếng Việt').errors[0], /thiếu câu tiếng Anh/);
  assert.match(parseLessonInput('...').errors[0], /không có chữ/);
  const many = Array.from({ length: MAX_LESSON_SENTENCES + 1 }, (_, i) => `Line ${i}`).join('\n');
  assert.ok(parseLessonInput(many).errors.some(e => /tối đa/.test(e)));
  assert.deepEqual(parseLessonInput('   \n  ').items, []);
});
