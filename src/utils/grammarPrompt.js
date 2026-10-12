/**
 * grammarPrompt.js — Generate AI prompts for TOEIC Grammar questions.
 * Users copy the prompt into ChatGPT/Gemini, then paste the JSON back.
 */

export const GRAMMAR_TOPICS = [
  'Mixed',
  'Word Forms',
  'Tenses',
  'Prepositions',
  'Conjunctions',
  'Relative Clauses',
  'Conditionals',
  'Passive Voice',
  'Articles & Determiners',
  'Subject-Verb Agreement',
  'Comparatives & Superlatives',
  'Modal Verbs',
  'Gerunds & Infinitives',
  'Reported Speech',
  'Noun Clauses',
];

export const GRAMMAR_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

export const GRAMMAR_COUNTS = [5, 10, 15, 20];

/**
 * Build an AI prompt that generates TOEIC Part 5 grammar questions in JSON.
 * @param {{ count: number, difficulty: string, topic: string }} config
 * @returns {string}
 */
export function buildGrammarPrompt({ count = 10, difficulty = 'Medium', topic = 'Mixed' }) {
  const topicInstruction = topic === 'Mixed'
    ? 'Mix a variety of TOEIC grammar topics (word forms, tenses, prepositions, conjunctions, relative clauses, conditionals, passive voice, modal verbs, etc.)'
    : `Focus specifically on the grammar topic: **${topic}**`;

  return `You are a TOEIC exam expert. Generate exactly ${count} TOEIC Part 5 (sentence completion) grammar questions.

TOPIC: ${topicInstruction}
DIFFICULTY: ${difficulty}
- Easy: Common grammar patterns, straightforward sentences
- Medium: Moderate complexity, typical TOEIC exam level (score 500–700)
- Hard: Advanced patterns, complex sentences (score 700–990)

STRICT JSON REQUIREMENTS:
Return ONLY a valid JSON array. No markdown, no explanation outside the JSON, no code blocks.
Each element must have EXACTLY these fields:

[
  {
    "id": "q1",
    "sentence": "The report will be _____ to the board of directors next Monday.",
    "options": {
      "A": "present",
      "B": "presented",
      "C": "presenting",
      "D": "presents"
    },
    "answer": "B",
    "topic": "Passive Voice",
    "difficulty": "${difficulty}",
    "vietnameseSentence": "Báo cáo sẽ được trình bày cho hội đồng quản trị vào thứ Hai tới.",
    "shortExplanation": "Use passive voice (will be + past participle) because the subject 'report' receives the action.",
    "detailedExplanation": {
      "whyCorrect": "B 'presented' is correct because the sentence uses future passive voice structure: 'will be + past participle'. The report (subject) receives the action of being presented.",
      "whyWrongA": "A 'present' is the base form, which cannot follow 'will be' in a passive construction.",
      "whyWrongC": "C 'presenting' is the present participle (active -ing form). After 'will be', we need a past participle for passive voice, not -ing.",
      "whyWrongD": "D 'presents' is the third-person singular simple present, which doesn't fit the future modal structure 'will be'.",
      "grammarRules": [
        "Future Passive Voice = will be + past participle",
        "The subject (report) receives the action → passive required",
        "Modal verbs (will, can, should) + be + past participle = passive modal"
      ],
      "keyVocabulary": [
        { "word": "board of directors", "meaning": "hội đồng quản trị", "type": "Noun Phrase" },
        { "word": "present (v)", "meaning": "trình bày, giới thiệu", "type": "Verb" }
      ]
    }
  }
]

RULES:
1. Each sentence must have exactly ONE blank marked as "_____" (5 underscores).
2. Options A, B, C, D must all be grammatically plausible (not obviously wrong) but only ONE is correct.
3. "answer" must be exactly "A", "B", "C", or "D".
4. "vietnameseSentence" must be a natural Vietnamese translation of the full sentence with the correct answer filled in.
5. "shortExplanation" = 1–2 sentences, in English.
6. "detailedExplanation.whyWrong*" = explain clearly why each wrong option fails.
7. "grammarRules" = 2–4 concise bullet rules relevant to the question.
8. "keyVocabulary" = 1–4 important words or collocations from the sentence.
9. "topic" must be one of: Mixed, Word Forms, Tenses, Prepositions, Conjunctions, Relative Clauses, Conditionals, Passive Voice, Articles & Determiners, Subject-Verb Agreement, Comparatives & Superlatives, Modal Verbs, Gerunds & Infinitives, Reported Speech, Noun Clauses.
10. Generate EXACTLY ${count} questions, numbered q1 through q${count}.

OUTPUT: Return ONLY the JSON array. Start your response with "[" and end with "]".`;
}

/**
 * Validate that a parsed JSON value matches the expected question schema.
 * Returns { valid: true } or { valid: false, errors: string[] }
 */
export function validateGrammarJSON(parsed) {
  const errors = [];

  if (!Array.isArray(parsed)) {
    return { valid: false, errors: ['JSON gốc phải là một mảng (array). Hãy đảm bảo bắt đầu bằng "[" và kết thúc bằng "]".'] };
  }
  if (parsed.length === 0) {
    return { valid: false, errors: ['Mảng JSON rỗng. Cần có ít nhất 1 câu hỏi.'] };
  }

  parsed.forEach((q, i) => {
    const prefix = `Câu ${i + 1}`;
    if (typeof q !== 'object' || q === null) {
      errors.push(`${prefix}: không phải object hợp lệ.`); return;
    }
    if (!q.sentence || typeof q.sentence !== 'string' || !q.sentence.includes('_____')) {
      errors.push(`${prefix}: thiếu "sentence" hoặc không có "_____" (5 gạch dưới).`);
    }
    if (!q.options || !['A','B','C','D'].every(k => typeof q.options[k] === 'string')) {
      errors.push(`${prefix}: "options" phải có đủ A, B, C, D dạng string.`);
    }
    if (!['A','B','C','D'].includes(q.answer)) {
      errors.push(`${prefix}: "answer" phải là "A", "B", "C", hoặc "D".`);
    }
    if (!q.vietnameseSentence) {
      errors.push(`${prefix}: thiếu "vietnameseSentence".`);
    }
    if (!q.shortExplanation) {
      errors.push(`${prefix}: thiếu "shortExplanation".`);
    }
    if (!q.detailedExplanation || typeof q.detailedExplanation !== 'object') {
      errors.push(`${prefix}: thiếu hoặc sai định dạng "detailedExplanation".`);
    }
    if (!q.topic) {
      errors.push(`${prefix}: thiếu "topic".`);
    }
  });

  return errors.length === 0
    ? { valid: true }
    : { valid: false, errors };
}

/**
 * Normalize a parsed question array, adding runtime fields.
 * @param {object[]} questions
 * @returns {object[]}
 */
export function normalizeQuestions(questions) {
  return questions.map((q, i) => ({
    ...q,
    id:         q.id || `q${i + 1}`,
    difficulty: q.difficulty || 'Medium',
    topic:      q.topic || 'Mixed',
    // Runtime fields (not from AI)
    _userAnswer:  null,
    _isCorrect:   null,
    _answeredAt:  null,
  }));
}
