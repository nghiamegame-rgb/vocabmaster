import { scanJsonContainers } from './grammarImport.js';

const isQuestionArray = value => Array.isArray(value) && value.length > 0
  && value.every(item => item && typeof item === 'object' && !Array.isArray(item));

// Locate the question array: whole input, a ```json fence, or the single
// top-level array of objects found by the shared bracket scanner.
function findQuestionArray(text) {
  let src = text.trim();
  const fenced = src.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) src = fenced[1].trim();
  try {
    const whole = JSON.parse(src);
    if (Array.isArray(whole)) return whole;
  } catch { /* fall back to scanning */ }
  let containers;
  try { containers = scanJsonContainers(src); }
  catch (error) { throw new Error(`JSON is malformed — ${error.message}`); }
  if (!containers.length) throw new Error('No JSON array found. Copy the full AI response and try again.');
  const arrays = containers.map(chunk => {
    try { return JSON.parse(chunk); } catch { return null; }
  }).filter(isQuestionArray);
  if (arrays.length === 1) return arrays[0];
  if (arrays.length > 1) throw new Error('Có nhiều mảng JSON câu hỏi; hãy chỉ dán một mảng.');
  throw new Error('JSON is malformed — missing comma, bracket, or quote. Fix and retry.');
}

/**
 * Parse the AI response and normalise answerIndex / correctIndex → correctIndex.
 * The answer must be an integer inside the options; it is never guessed.
 */
export function parseResponse(text) {
  if (!text || !text.trim()) throw new Error('The paste area is empty.');
  const raw = findQuestionArray(text);
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('Parsed result is not a valid array of questions.');
  }
  return raw.map((q, i) => {
    if (!q || typeof q !== 'object') throw new Error(`Invalid question #${i + 1}.`);
    if (!q.question) throw new Error(`Question #${i + 1} is missing the "question" field.`);
    if (!Array.isArray(q.options) || q.options.length < 2) {
      throw new Error(`Question #${i + 1} needs an "options" array with at least 2 items.`);
    }
    const answer = q.answerIndex !== undefined ? q.answerIndex : q.correctIndex;
    if (answer === undefined) {
      throw new Error(`Câu #${i + 1} thiếu đáp án ("answerIndex"). Hãy nhờ AI bổ sung answerIndex cho từng câu.`);
    }
    if (!Number.isInteger(answer) || answer < 0 || answer >= q.options.length) {
      throw new Error(`Câu #${i + 1} có answerIndex không hợp lệ (${JSON.stringify(answer)}); cần số nguyên từ 0 đến ${q.options.length - 1}.`);
    }
    return {
      question:    q.question,
      options:     q.options,
      correctIndex: answer,
      explanation: q.explanation || '',
      wordEnglish: q.wordEnglish || q.options[answer] || '',
      structureId: q.structureId || q.structure_id || '',
      trapPoint: q.trapPoint || '',
    };
  });
}

/** Message when the AI returned fewer questions than requested, otherwise null. */
export function quizCountIssue(received, requested) {
  return received < requested
    ? `AI chỉ trả về ${received}/${requested} câu. Bấm "Start Quiz" lần nữa để làm ${received} câu, hoặc nhờ AI tạo đủ ${requested} câu.`
    : null;
}
