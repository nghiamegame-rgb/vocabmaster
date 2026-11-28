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

// Turn \" back into the raw quote an AI would have typed.
const unescape = value => JSON.stringify(value).replaceAll('\\"', '"');
const pretty = value => JSON.stringify(value, null, 2).replaceAll('\\"', '"');

const proseCases = {
  'quote then comma': 'Cụm "so that", dùng để chỉ mục đích.',
  'quote then colon': 'Xem "so that": liên từ chỉ mục đích.',
  'two quoted phrases then comma': 'Dùng "so that" hoặc "in order that", đều chỉ mục đích.',
  'quote mid-sentence': 'Cụm "so that" nối hai vế.',
  'quote at sentence end': 'Liên từ chỉ mục đích là "so that"',
  'quote before final period': 'Liên từ chỉ mục đích là "so that".',
  'comma-separated quoted list': 'Dùng "so", "such", "too" tùy ngữ cảnh.',
};

for (const [name, explanation] of Object.entries(proseCases)) {
  test(`repairs ${name} (multi-line and one-line)`, () => {
    const expected = [validItem({ grammarPoints: [{ category: 'Conjunctions', phrase: 'so that', explanation }] })];
    for (const broken of [pretty(expected), unescape(expected)]) {
      assert.throws(() => JSON.parse(broken));
      assert.deepEqual(parseGrammarInput(broken), expected);
    }
  });
}

test('repairs quotes inside string array items (structures, readingNotes)', () => {
  const expected = [validItem({
    structures: ['Mẫu "so that" + mệnh đề', 'Xem "can", "could" sau mẫu này', 'Ghi chú thường'],
    readingNotes: ['Ghi chú thường', 'Cụm "so that": chỉ mục đích.', 'Từ cần nhớ là "train"'],
  })];
  for (const broken of [pretty(expected), unescape(expected)]) {
    assert.throws(() => JSON.parse(broken));
    assert.deepEqual(parseGrammarInput(broken), expected);
  }
});

test('one-line JSON keeps trailing-comma repair', () => {
  assert.deepEqual(JSON.parse(repairLooseJson('[{"a":"x "y" z","b":["c",],"d":1,}]')), [{ a: 'x "y" z', b: ['c'], d: 1 }]);
});

test('uncertain quotes are not guessed and report an error with context', () => {
  const cases = {
    'single stray quote': '[{"explanation": "Màn hình 5" rộng.", "meaning": "x"}]',
    'single stray quote before a letter': '[{"explanation": "Từ "so that nối hai vế.", "meaning": "x"}]',
    'missing comma between properties': '[{"sentence": "Hello world." "topic": "Tenses"}]',
    'missing comma between array items': '[{"readingNotes": ["Một" "Hai"]}]',
    'missing colon': '[{"a": "x", "meaning" "y"}]',
    'unquoted value': '[{"a": "x", "b": yes}]',
  };
  for (const [name, broken] of Object.entries(cases)) {
    assert.throws(() => parseGrammarInput(broken), /Lỗi gần: "/, name);
  }
});

test('valid JSON is returned unchanged by the repair function', () => {
  const value = [validItem({ readingNotes: ['a, "b": c', '"d"', 'e}', 'f]'] })];
  for (const raw of [JSON.stringify(value), JSON.stringify(value, null, 2)]) {
    assert.equal(repairLooseJson(raw), raw);
    assert.deepEqual(parseGrammarInput(raw), value);
  }
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
