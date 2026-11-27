import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  repairLooseJson,
  parseGrammarInput,
  prepareGrammarImport,
  completeGrammarImport,
} from '../src/utils/grammarImport.js';

const validItem = (extra = {}) => ({
  schemaVersion: 2,
  type: 'sentence-analysis',
  id: 's1',
  sentence: 'She left early so that she could catch the first train.',
  vietnameseSentence: 'Cô ấy rời đi sớm để có thể bắt chuyến tàu đầu tiên.',
  topic: 'Conjunctions',
  grammarPoints: [
    {
      category: 'Conjunctions',
      phrase: 'so that',
      explanation: 'Cụm "so that" nối hai vế để diễn tả mục đích.',
    },
  ],
  readingItems: [
    {
      category: 'phrase',
      text: 'catch the first train',
      explanation: 'Bắt chuyến tàu đầu tiên.',
      meaning: 'bắt chuyến tàu đầu tiên',
    },
  ],
  ...extra,
});

const config = { count: 1, topic: 'Conjunctions' };

test('repairs unescaped double quotes inside Vietnamese explanation and records gentle notice', () => {
  const broken = `[
  {
    "schemaVersion": 2,
    "type": "sentence-analysis",
    "id": "s1",
    "sentence": "She left early so that she could catch the first train.",
    "vietnameseSentence": "Cô ấy rời đi sớm để có thể bắt chuyến tàu đầu tiên.",
    "topic": "Conjunctions",
    "grammarPoints": [
      {
        "category": "Conjunctions",
        "phrase": "so that",
        "explanation": "Cụm "so that" nối hai vế để diễn tả mục đích."
      }
    ],
    "readingItems": []
  }
]`;
  assert.throws(() => JSON.parse(broken));
  const repaired = repairLooseJson(broken);
  const parsedDirect = JSON.parse(repaired);
  assert.equal(parsedDirect[0].grammarPoints[0].explanation, 'Cụm "so that" nối hai vế để diễn tả mục đích.');

  const result = prepareGrammarImport(broken, config);
  assert.deepEqual(result.errors, []);
  assert.ok(result.normalizations.some(n => n.reason === 'Đã tự sửa dấu nháy/dấu phẩy trong JSON'));
  const complete = completeGrammarImport(result);
  assert.equal(complete.valid, true);
  assert.equal(complete.questions[0].sentence, 'She left early so that she could catch the first train.');
  assert.equal(complete.questions[0].grammarPoints[0].explanation, 'Cụm "so that" nối hai vế để diễn tả mục đích.');
});

test('repairs curly double quotes in delimiters and inside strings', () => {
  const broken = `Here is the JSON:
[
  {
    “schemaVersion”: 2,
    “type”: “sentence-analysis”,
    “id”: “s1”,
    “sentence”: “She left early so that she could catch the first train.”,
    “vietnameseSentence”: “Cô ấy rời đi sớm để có thể bắt chuyến tàu đầu tiên.”,
    “topic”: “Conjunctions”,
    “grammarPoints”: [
      {
        “category”: “Conjunctions”,
        “phrase”: “so that”,
        “explanation”: “Cụm “so that” nối hai vế để diễn tả mục đích.”
      }
    ],
    “readingItems”: []
  }
]
Done!`;
  const result = prepareGrammarImport(broken, config);
  assert.deepEqual(result.errors, []);
  assert.ok(result.normalizations.some(n => n.reason === 'Đã tự sửa dấu nháy/dấu phẩy trong JSON'));
  assert.equal(result.questions[0].grammarPoints[0].explanation, 'Cụm "so that" nối hai vế để diễn tả mục đích.');
});

test('repairs trailing commas before } and ] without touching commas inside strings', () => {
  const broken = `[
  {
    "schemaVersion": 2,
    "type": "sentence-analysis",
    "id": "s1",
    "sentence": "She left early so that she could catch the first train.",
    "vietnameseSentence": "Cô ấy rời đi sớm, để kịp chuyến tàu đầu tiên.",
    "topic": "Conjunctions",
    "grammarPoints": [
      {
        "category": "Conjunctions",
        "phrase": "so that",
        "explanation": "Cụm so that nối hai vế, không bỏ dấu phẩy trước }",
      },
    ],
    "readingItems": [],
  },
]`;
  const result = prepareGrammarImport(broken, config);
  assert.deepEqual(result.errors, []);
  assert.ok(result.normalizations.some(n => n.reason === 'Đã tự sửa dấu nháy/dấu phẩy trong JSON'));
  assert.equal(result.questions[0].grammarPoints[0].explanation, 'Cụm so that nối hai vế, không bỏ dấu phẩy trước }');
});

test('repairs raw newlines and tabs inside string values', () => {
  const broken = `[
  {
    "schemaVersion": 2,
    "type": "sentence-analysis",
    "id": "s1",
    "sentence": "She left early so that she could catch the first train.",
    "vietnameseSentence": "Cô ấy rời đi sớm để có thể bắt chuyến tàu đầu tiên.",
    "topic": "Conjunctions",
    "grammarPoints": [
      {
        "category": "Conjunctions",
        "phrase": "so that",
        "explanation": "Dòng 1\nDòng 2\tcó tab."
      }
    ],
    "readingItems": []
  }
]`;
  const result = prepareGrammarImport(broken, config);
  assert.deepEqual(result.errors, []);
  assert.ok(result.normalizations.some(n => n.reason === 'Đã tự sửa dấu nháy/dấu phẩy trong JSON'));
  assert.equal(result.questions[0].grammarPoints[0].explanation, 'Dòng 1\nDòng 2\tcó tab.');
});

test('valid JSON takes the strict JSON.parse path untouched with no repair notice', () => {
  const original = [validItem()];
  const raw = JSON.stringify(original, null, 2);
  const direct = JSON.parse(raw);
  const viaParser = parseGrammarInput(raw);
  assert.deepEqual(viaParser, direct);

  const result = prepareGrammarImport(raw, config);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.normalizations, []);
  assert.deepEqual(completeGrammarImport(result).questions, direct);
});

test('unrepairable JSON reports error with ~60-char context snippet around error position', () => {
  const broken = '[{"schemaVersion": 2, "type": "sentence-analysis", "sentence": "Hello world." "topic": "Tenses"}]';
  let caught;
  try {
    parseGrammarInput(broken);
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, 'should throw on unrepairable JSON');
  assert.match(caught.message, /Lỗi gần: "/);
  assert.ok(caught.message.includes('"Hello world." "topic"'), `expected snippet near error, got: ${caught.message}`);

  const result = prepareGrammarImport(broken, config);
  assert.equal(result.errors[0].field, 'JSON');
  assert.match(result.errors[0].reason, /Lỗi gần: "/);
});

test('invalid phrase is still rejected after JSON repair', () => {
  const brokenWithBadPhrase = `[
  {
    "schemaVersion": 2,
    "type": "sentence-analysis",
    "id": "s1",
    "sentence": "She left early so that she could catch the first train.",
    "vietnameseSentence": "Cô ấy rời đi sớm để có thể bắt chuyến tàu đầu tiên.",
    "topic": "Conjunctions",
    "grammarPoints": [
      {
        "category": "Conjunctions",
        "phrase": "in order that",
        "explanation": "Cụm "in order that" không có trong câu gốc."
      }
    ],
    "readingItems": [],
  }
]`;
  const result = prepareGrammarImport(brokenWithBadPhrase, config);
  assert.ok(result.normalizations.some(n => n.reason === 'Đã tự sửa dấu nháy/dấu phẩy trong JSON'));
  assert.ok(result.errors.some(e => e.field === 'grammarPoints[1].phrase' && e.reason.includes('Không tìm thấy')));
  assert.equal(completeGrammarImport(result).valid, false);
});
