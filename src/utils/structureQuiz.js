export function buildStructurePrompt(structures, count, difficulty) {
  const structureList = structures.map(item => JSON.stringify({
    structureId: item.id,
    structure: item.english,
    meaning: item.vietnamese,
    ...(item.example ? { example: item.example } : {}),
    ...(item.topic ? { topic: item.topic } : {}),
  })).join(',\n');
  return `You are a TOEIC Part 5 expert. Generate exactly ${count} multiple-choice questions based ONLY on the saved grammar structures below.
Difficulty: ${difficulty}. Use realistic workplace, email, HR, travel, contract, and business contexts.
Each question must contain exactly one blank marked [_____], four English options A-D, one correct answer, a Vietnamese explanation, and a Vietnamese trapPoint explaining the common mistake.
Every question MUST include the exact source structure ID in "structureId". Do not invent or change IDs. Use each selected structure at least once when possible and do not repeat a structure until other selected structures have been used.

Selected structures:
${structureList}

Return ONLY a valid JSON array. Each item must have exactly these fields:
{"structureId":"...","question":"... [_____] ...","options":["A","B","C","D"],"answerIndex":0,"explanation":"Vietnamese explanation","trapPoint":"Vietnamese common trap"}
"answerIndex" is 0-based. Options must be English.`;
}

export function validateStructureQuestions(questions, promptIds, structures, count) {
  const allowed = new Set(promptIds);
  const live = new Set(structures.filter(item => !item.deletedAt).map(item => item.id));
  if (questions.length !== count) throw new Error(`Cần đúng ${count} câu hỏi.`);
  const seen = new Map();
  for (const [index, q] of questions.entries()) {
    if (!allowed.has(q.structureId) || !live.has(q.structureId)) {
      throw new Error(`Câu #${index + 1} có structureId ngoài danh sách đã chọn hoặc đã bị xóa.`);
    }
    if (typeof q.question !== 'string' || (q.question.match(/\[_____\]/g) || []).length !== 1
        || q.options.length !== 4 || q.options.some(option => typeof option !== 'string' || !option.trim())
        || new Set(q.options.map(option => option.trim().toLowerCase())).size !== 4
        || !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3
        || typeof q.explanation !== 'string' || !q.explanation.trim()
        || typeof q.trapPoint !== 'string' || !q.trapPoint.trim()) {
      throw new Error(`Câu #${index + 1} cần một [_____] trống, 4 đáp án khác nhau, answerIndex 0–3, explanation và trapPoint.`);
    }
    seen.set(q.structureId, (seen.get(q.structureId) || 0) + 1);
  }
  // Enforce balanced use, regardless of the order returned by the AI.
  const uses = promptIds.map(id => seen.get(id) || 0);
  if (uses.length && Math.max(...uses) - Math.min(...uses) > 1) {
    throw new Error('Các cấu trúc bị lặp không đều. Hãy yêu cầu AI dùng đủ các ID đã chọn trước khi lặp lại.');
  }
}

