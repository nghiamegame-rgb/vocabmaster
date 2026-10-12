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

export const TOPIC_LABELS = {
  'Mixed': 'Tổng hợp',
  'Word Forms': 'Loại từ',
  'Tenses': 'Các thì',
  'Prepositions': 'Giới từ',
  'Conjunctions': 'Liên từ',
  'Relative Clauses': 'Mệnh đề quan hệ',
  'Conditionals': 'Câu điều kiện',
  'Passive Voice': 'Câu bị động',
  'Articles & Determiners': 'Mạo từ và từ hạn định',
  'Subject-Verb Agreement': 'Sự hòa hợp chủ ngữ - động từ',
  'Comparatives & Superlatives': 'So sánh hơn và so sánh nhất',
  'Modal Verbs': 'Động từ khuyết thiếu',
  'Gerunds & Infinitives': 'Danh động từ và động từ nguyên mẫu',
  'Reported Speech': 'Câu tường thuật',
  'Noun Clauses': 'Mệnh đề danh từ',
};

export function getTopicLabel(topic) {
  return TOPIC_LABELS[topic] || topic || 'Tổng hợp';
}

/** Legacy export for backward compatibility */
export const GRAMMAR_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

export const GRAMMAR_COUNTS = [5, 10, 15, 20];

/**
 * Build an AI prompt that generates TOEIC Part 5 grammar questions in JSON.
 * Explanations are strictly in natural, accurate Vietnamese.
 * Questions are calibrated for TOEIC 550 target with exposure to 700-750.
 * @param {{ count?: number, topic?: string, difficulty?: string }} config
 * @returns {string}
 */
export function buildGrammarPrompt({ count = 10, topic = 'Mixed' } = {}) {
  const topicLabel = getTopicLabel(topic);
  const topicInstruction = topic === 'Mixed'
    ? 'Mix a diverse range of realistic TOEIC Part 5 grammar topics (Word Forms, Tenses, Prepositions, Conjunctions, Relative Clauses, Conditionals, Passive Voice, Subject-Verb Agreement, Gerunds & Infinitives, Modal Verbs, etc.).'
    : `Focus specifically on the grammar topic: **${topic}** (${topicLabel}). Ensure all ${count} questions test core and intermediate aspects of this topic.`;

  return `You are an expert TOEIC test creator and English instructor for Vietnamese learners. Generate exactly ${count} TOEIC Part 5 (sentence completion) grammar questions.

TARGET LEVEL & DIFFICULTY DISTRIBUTION (TOEIC 550 TARGET WITH 700–750 EXPOSURE):
The learner is currently at approximately TOEIC 550 and aiming to advance toward 700–750.
Provide an organic mix of question difficulties across the ${count} questions (flexible guidelines):
- Approximately 40% foundational questions (~500–550 level: core word forms, basic tenses, common prepositions, straightforward agreements).
- Approximately 40% intermediate questions (~600–650 level: conjunctions vs. prepositions, passive voice, relative clauses, gerunds vs. infinitives).
- Approximately 20% moderately challenging questions (~700–750 level: tricky collocations, subtle word forms, conditional inversions, reduced relative clauses).
- Randomize the question order so difficulties are naturally mixed.
- Do NOT group questions by difficulty or include any difficulty indicator in the output.

REALISTIC TOEIC PART 5 BUSINESS CONTEXTS:
- Business emails and internal memos
- Office communication and human resources (recruitment, onboarding, benefits)
- Customer service, warranties, and client relations
- Contracts, negotiations, and purchasing
- Business travel, conferences, and transportation
- Meetings, announcements, and corporate events
- Business operations, manufacturing, and financial reports
Keep sentences realistic, natural, and representative of modern workplace English. Avoid obscure vocabulary, highly academic jargon, or tricky questions relying on ambiguous wording.

GRAMMAR EMPHASIS:
- TOPIC FOCUS: ${topicInstruction}
- Prioritize practical TOEIC grammar: Word Forms (noun/verb/adj/adv), Verb Tenses & Voice, Subject-Verb Agreement, Prepositions, Conjunctions, Relative Clauses, Passive Voice, Gerunds & Infinitives, Modal Verbs.
- Each question must have exactly ONE clearly defensible correct answer.
- Distractors (incorrect options) must be plausible and natural, but grammatically or contextually incorrect.

LANGUAGE & EXPLANATION REQUIREMENTS (STRICT - ALL EXPLANATIONS IN NATURAL VIETNAMESE):
- Question sentences and options A, B, C, D must remain in ENGLISH.
- Keep English grammar structures and collocations in their original form (e.g., "will be + V3/ed", "look forward to + V-ing").
- ALL explanations and learning notes must be written in natural, accurate, learner-friendly VIETNAMESE:
  1. "vietnameseSentence": Natural Vietnamese translation of the entire sentence with the correct answer filled in.
  2. "shortExplanation": A clear, concise explanation (1–2 sentences) in VIETNAMESE explaining why the correct answer is chosen.
  3. "detailedExplanation.whyCorrect": Detailed explanation in VIETNAMESE explaining why the chosen option is correct (cite grammar formula, role in the sentence, clue words).
  4. "detailedExplanation.whyWrongA", "whyWrongB", "whyWrongC", "whyWrongD": Clear explanations in VIETNAMESE for why EACH distractor is incorrect. Never write vague statements like "sai ngữ pháp" — state the exact grammatical reason (e.g., "sai thì", "cần danh từ nhưng đây là tính từ", "sau giới từ cần V-ing chứ không dùng động từ nguyên mẫu").
  5. "detailedExplanation.grammarRules": 2–4 concise bullet points in VIETNAMESE summarizing the core grammar rules / formulas applied in this question.
  6. "detailedExplanation.keyVocabulary": 1–4 important words or business collocations from the sentence with English word, Vietnamese meaning, and word type.

STRICT JSON OUTPUT FORMAT:
Return ONLY a valid JSON array. No markdown, no commentary before or after, no code fences.
Start your response with "[" and end with "]".

JSON SCHEMA EXAMPLE:
[
  {
    "id": "q1",
    "sentence": "The marketing director will _____ the new campaign proposals at tomorrow's executive meeting.",
    "options": {
      "A": "review",
      "B": "reviewed",
      "C": "reviewing",
      "D": "reviews"
    },
    "answer": "A",
    "topic": "${topic === 'Mixed' ? 'Modal Verbs' : topic}",
    "vietnameseSentence": "Giám đốc tiếp thị sẽ xem xét các đề xuất chiến dịch mới tại cuộc họp ban điều hành ngày mai.",
    "shortExplanation": "Sau trợ động từ khuyết thiếu 'will', ta dùng động từ nguyên mẫu không 'to' (bare infinitive) 'review'.",
    "detailedExplanation": {
      "whyCorrect": "A 'review' đúng vì cấu trúc thì tương lai với modal verb: 'will + V-bare' (động từ nguyên mẫu không 'to').",
      "whyWrongB": "B 'reviewed' là dạng quá khứ/quá khứ phân từ, không thể đi trực tiếp sau 'will' trong câu chủ động.",
      "whyWrongC": "C 'reviewing' là hiện tại phân từ (dạng -ing), sau 'will' phải có 'be' nếu muốn tạo thì tương lai tiếp diễn.",
      "whyWrongD": "D 'reviews' là dạng chia thì hiện tại đơn ngôi thứ ba số ít, không kết hợp trực tiếp sau 'will'.",
      "grammarRules": [
        "Modal verb (will / can / must / should) + V-bare (nguyên mẫu không 'to')",
        "Không chia thì hay thêm s/es vào động từ đứng sau trợ động từ khuyết thiếu",
        "Dấu hiệu nhận biết: 'tomorrow' kết hợp với 'will' chỉ hành động tương lai"
      ],
      "keyVocabulary": [
        { "word": "executive meeting", "meaning": "cuộc họp ban điều hành", "type": "Noun Phrase" },
        { "word": "campaign proposal", "meaning": "đề xuất chiến dịch", "type": "Noun Phrase" }
      ]
    }
  }
]

RULES:
1. Each sentence must have exactly ONE blank marked as "_____" (5 underscores).
2. "answer" must be exactly "A", "B", "C", or "D".
3. "topic" must be one of: Mixed, Word Forms, Tenses, Prepositions, Conjunctions, Relative Clauses, Conditionals, Passive Voice, Articles & Determiners, Subject-Verb Agreement, Comparatives & Superlatives, Modal Verbs, Gerunds & Infinitives, Reported Speech, Noun Clauses.
4. Generate EXACTLY ${count} questions, numbered q1 through q${count}.
5. ALL explanations MUST be written in natural VIETNAMESE.

OUTPUT: Return ONLY the JSON array. Start with "[" and end with "]".`;
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
    id:    q.id || `q${i + 1}`,
    topic: q.topic || 'Mixed',
    // Runtime fields (not from AI)
    _userAnswer:  null,
    _isCorrect:   null,
    _answeredAt:  null,
  }));
}
