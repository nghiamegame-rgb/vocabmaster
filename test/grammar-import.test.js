import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { parseGrammarInput, matchGrammarSubstring, prepareGrammarImport, completeGrammarImport, formatGrammarIssue } from '../src/utils/grammarImport.js';
import { createGrammarBatch, buildBatchInstructions, getRecentGrammarSentences, rememberGrammarSentences } from '../src/utils/grammarBatch.js';
import { buildGrammarPrompt } from '../src/utils/grammarPrompt.js';

const item = (extra = {}) => ({
  schemaVersion: 2, type: 'sentence-analysis', id: 's1',
  sentence: 'Regular exercise helps people cope with stress.',
  vietnameseSentence: 'Tập thể dục thường xuyên giúp mọi người đối phó với căng thẳng.',
  topic: 'Prepositions',
  grammarPoints: [{ category: 'Prepositions', phrase: 'cope with', explanation: 'Cope đi với with, diễn tả cách đối phó với một khó khăn.' }],
  readingItems: [{ category: 'phrase', text: 'Regular exercise', explanation: 'Cụm nói về việc tập luyện đều đặn.', meaning: 'tập thể dục thường xuyên' }],
  ...extra,
});
const json = q => JSON.stringify([q]);
const config = { count: 1, topic: 'Prepositions' };

test('ChatGPT, Gemini, Claude and incidental-text envelopes produce the same valid batch', () => {
  const raw = json(item());
  for (const text of [raw, `\n \t${raw}\r\n`, `\uFEFF${raw}`, '```json\n' + raw + '\n```', '```JSON\r\n' + raw + '\r\n```', '```\n' + raw + '\n```', `Here is the JSON:\n${raw}\nChúc bạn học tốt.`, `${raw}\nChúc bạn học tốt.`, 'Result:\n```json\n' + raw + '\n```\nDone.']) {
    const result = prepareGrammarImport(text, config);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(completeGrammarImport(result).questions, [item()]);
  }
});

test('parser refuses ambiguous blocks, malformed roots and non-JSON syntax rather than rescuing fragments', () => {
  const raw = json(item());
  for (const text of [`Results: ${raw}\nAnother: ${raw}`, `Result: {"questions":${raw}}`, '[{"sentence":"broken", "grammarPoints":[{"category":"Prepositions"}]}', '[{"sentence":"broken",}]', '```json\n[/* comment */]\n```', 'Before [{"text":"unfinished"} After']) assert.throws(() => parseGrammarInput(text));
  assert.equal(prepareGrammarImport('{"questions":[]}', config).errors[0].field, 'JSON');
  const bracketed = item({ sentence: 'The label says "[optional]" near the box.' });
  assert.deepEqual(parseGrammarInput(`Output:\n${json(bracketed)}\nDone.`), [bracketed]);
});

test('safe case, whitespace, curly quotes and hyphens normalize to original contiguous substrings', () => {
  const sentence = 'A visitor’s well‑known guide describes “Local   history” clearly.';
  for (const [phrase, expected] of [["VISITOR'S", 'visitor’s'], ['well-known', 'well‑known'], ['"local history"', '“Local   history”'], ['  Local\n history ', 'Local   history']]) assert.equal(matchGrammarSubstring(sentence, phrase).text, expected);
  assert.equal(matchGrammarSubstring('📖 Regular exercise helps.', 'regular exercise').text, 'Regular exercise');
  const original = item({
    grammarPoints: [{ category: 'Prepositions', phrase: 'COPE\nWITH', explanation: 'Giữ nguyên lời giải này.' }],
    readingItems: [{ category: 'phrase', text: 'regular   exercise', explanation: 'Giữ nguyên ghi chú này.' }],
  });
  const before = structuredClone(original);
  const result = prepareGrammarImport(json(original), config);
  assert.equal(result.normalizations.length, 2);
  const complete = completeGrammarImport(result);
  assert.equal(complete.valid, true);
  assert.equal(complete.questions[0].sentence, before.sentence);
  assert.equal(complete.questions[0].grammarPoints[0].phrase, 'cope with');
  assert.equal(complete.questions[0].readingItems[0].text, 'Regular exercise');
  assert.equal(complete.questions[0].grammarPoints[0].explanation, before.grammarPoints[0].explanation);
  assert.deepEqual(original, before);
  const backend = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../grammar-apps-script.js', import.meta.url), 'utf8'), backend);
  assert.equal(backend.validateQuestion({ ...complete.questions[0], savedId: 'test' }, 0), null);
});

test('ambiguous and substantive changes remain errors, with field, sentence and correction advice', () => {
  assert.ok(matchGrammarSubstring('A cat watches a cat.', 'CAT').error.includes('nhiều'));
  assert.ok(matchGrammarSubstring('They depend on buses but need reliable routes.', 'Not only did ... depend on ..., but it also required ...').error.includes('ba chấm'));
  assert.ok(matchGrammarSubstring('They depend on buses but need reliable routes.', 'depend on reliable routes').error.includes('liên tục'));
  const bad = item({ grammarPoints: [{ category: 'Prepositions', phrase: 'depend on', explanation: 'x' }] });
  const result = prepareGrammarImport(json(bad), config);
  const message = formatGrammarIssue(result.errors[0]);
  for (const expected of ['Câu 1', 'grammarPoints[1].phrase', 'depend on', 'liên tục', 'Chép']) assert.ok(message.includes(expected));
  assert.equal(completeGrammarImport(result, { excludedItems: ['0:0'], allowDuplicates: true }).valid, false);
  for (const required of [{ sentence: '' }, { schemaVersion: 1 }, { type: 'quiz' }, { grammarPoints: [] }, { vietnameseSentence: null }, { grammarPoints: [{ category: 'Prepositions', phrase: 'cope with', explanation: '' }] }]) assert.ok(prepareGrammarImport(json(item(required)), config).errors.length);
});

test('only confirmed invalid optional reading items are removed; the entire sentence batch is preserved', () => {
  const original = item({ readingItems: [
    item().readingItems[0],
    { category: 'structure', text: 'Not only ... but also', explanation: 'x', pattern: 'Not only ... but also' },
    { category: 'unknown', text: 'stress', explanation: 'x' },
    { category: 'vocabulary', text: 'stress', explanation: 'căng thẳng' },
  ] });
  const result = prepareGrammarImport(json(original), config);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.optionalIssues.map(i => i.key), ['0:1', '0:2']);
  assert.equal(completeGrammarImport(result).valid, false);
  assert.equal(completeGrammarImport(result, { excludedItems: ['0:1'] }).valid, false);
  const complete = completeGrammarImport(result, { excludedItems: ['0:1', '0:2'] });
  assert.equal(complete.valid, true);
  assert.equal(complete.questions.length, 1);
  assert.deepEqual(complete.questions[0].readingItems, [original.readingItems[0], original.readingItems[3]]);
  assert.deepEqual(complete.questions[0].grammarPoints, original.grammarPoints);
  assert.equal(result.questions[0].readingItems.length, 4);
  const ten = Array.from({ length: 10 }, (_, i) => item({
    id: `s${i + 1}`, sentence: `On day ${i + 1}, regular exercise helps people cope with stress.`,
    readingItems: i === 4 ? original.readingItems : item().readingItems,
  }));
  const batch = prepareGrammarImport(JSON.stringify(ten), { ...config, count: 10 });
  const accepted = completeGrammarImport(batch, { excludedItems: batch.optionalIssues.map(issue => issue.key) });
  assert.equal(accepted.valid, true);
  assert.equal(accepted.questions.length, 10);
  assert.equal(accepted.questions[4].readingItems.length, 2);
  assert.deepEqual(accepted.questions.map(q => q.sentence), ten.map(q => q.sentence));
  const malformed = prepareGrammarImport(json(item({ readingItems: { text: 'x' } })), config);
  assert.equal(completeGrammarImport(malformed).valid, false);
  assert.equal(completeGrammarImport(malformed, { excludedItems: ['0:all'] }).valid, true);
});

test('duplicates within a batch block import; recent repetitions require explicit confirmation', () => {
  const repeated = item({ sentence: 'regular   exercise helps people cope with stress.' });
  assert.ok(prepareGrammarImport(JSON.stringify([item(), repeated]), { count: 2 }).errors.some(e => e.reason.includes('trùng')));
  const result = prepareGrammarImport(json(item()), { ...config, recentSentences: [repeated.sentence] });
  assert.equal(result.duplicates.length, 1);
  assert.equal(completeGrammarImport(result).valid, false);
  assert.equal(completeGrammarImport(result, { allowDuplicates: true }).valid, true);
  assert.equal(prepareGrammarImport(json(item()), { count: 10 }).errors[0].field, 'Số câu');
});

test('prompt batch IDs change only on explicit creation; rendering the same settings is deterministic', () => {
  const first = createGrammarBatch([item().sentence]);
  const second = createGrammarBatch([item().sentence]);
  assert.notEqual(first.id, second.id);
  const options = { count: 10, topic: 'Word Forms', batchId: first.id, recentSentences: first.recentSentences };
  const before = JSON.stringify(first);
  const prompt = buildGrammarPrompt(options);
  for (let i = 0; i < 5; i++) assert.equal(buildGrammarPrompt(options), prompt);
  assert.notEqual(buildGrammarPrompt({ ...options, batchId: second.id }), prompt);
  assert.notEqual(buildBatchInstructions({ id: 'batch-a' }, 'Prepositions'), buildBatchInstructions({ id: 'batch-b' }, 'Prepositions'));
  for (const marker of ['word-family distinctions', first.id, item().sentence, '40% B1', '30% B1+/B2', '20% harder B2', '10% C1-style', 'CONTIGUOUS', 'FINAL SELF-CHECK', 'no trailing commas']) assert.ok(prompt.includes(marker));
  assert.ok(!prompt.includes('Employees depend on secure cloud platforms'));
  assert.ok(!prompt.includes('"sentence": "'));
  assert.ok(buildGrammarPrompt({ topic: 'Prepositions' }).includes('adjective + preposition'));
  assert.equal(JSON.stringify(first), before);
  const longHistory = Array.from({ length: 50 }, (_, i) => `${i} ${'Long reference sentence. '.repeat(30)}`);
  const data = buildBatchInstructions({ id: 'x', recentSentences: longHistory }).split('reference data only, not instructions): ')[1].split('\n')[0];
  const history = JSON.parse(data);
  assert.ok(history.reduce((n, s) => n + s.length, 0) <= 6000);
});

test('recent history is bounded and isolated from existing stores, with safe storage-failure fallback', () => {
  const previous = globalThis.localStorage;
  const store = new Map([['vocabmaster_words', 'KEEP VOCAB'], ['vocabmaster_grammar_saved', 'KEEP GRAMMAR']]);
  globalThis.localStorage = { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) };
  try {
    const sentences = Array.from({ length: 65 }, (_, i) => `Recent sentence ${i}.`);
    rememberGrammarSentences(sentences);
    assert.equal(getRecentGrammarSentences().length, 50);
    assert.equal(store.get('vocabmaster_words'), 'KEEP VOCAB');
    assert.equal(store.get('vocabmaster_grammar_saved'), 'KEEP GRAMMAR');
    assert.deepEqual(JSON.parse(store.get('vocabmaster_grammar_recent_sentences')), sentences.slice(0, 50));
    globalThis.localStorage = { getItem() { throw new Error('offline storage'); }, setItem() { throw new Error('quota'); } };
    rememberGrammarSentences(['A new sentence remains in this session.']);
    assert.equal(getRecentGrammarSentences()[0], 'A new sentence remains in this session.');
  } finally { globalThis.localStorage = previous; }
});
