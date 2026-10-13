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
 * Explanations are in natural, intuitive Vietnamese.
 * Questions are calibrated for TOEIC 550 target with exposure to 700-750.
 * @param {{ count?: number, topic?: string }} config
 * @returns {string}
 */
export function buildGrammarPrompt({ count = 10, topic = 'Mixed' } = {}) {
  const topicLabel = getTopicLabel(topic);
  const topicInstruction = topic === 'Mixed'
    ? 'Mix a diverse range of realistic TOEIC Part 5 grammar topics (Word Forms, Tenses, Prepositions, Conjunctions, Relative Clauses, Conditionals, Passive Voice, Subject-Verb Agreement, Gerunds & Infinitives, Modal Verbs, etc.).'
    : `Focus specifically on the grammar topic: **${topic}** (${topicLabel}). Ensure all ${count} questions test core and intermediate aspects of this topic.`;

  const exampleTopic = topic === 'Mixed' ? 'Modal Verbs' : topic;

  return `You are an expert TOEIC test creator and English instructor for Vietnamese learners.
Generate exactly ${count} TOEIC Part 5 (sentence completion) grammar questions in the JSON format specified below.

[1] DIFFICULTY DISTRIBUTION (TOEIC 550 target, exposure to 700-750)
~40% foundational (500-550 level): core word forms, basic tenses, common prepositions, subject-verb agreement.
~40% intermediate (600-650 level): conjunctions vs prepositions, passive voice, relative clauses, gerunds vs infinitives.
~20% moderately challenging (700-750 level): subtle word forms, tricky collocations, conditional inversions, reduced relative clauses.
Randomize question order. Do NOT label difficulty or group questions by level.

[2] BUSINESS CONTEXTS
Use realistic TOEIC workplace settings: emails, memos, HR, customer service, contracts, meetings, travel, financial reports.
Sentences must be natural and representative of modern workplace English. Avoid ambiguous wording or overly academic vocabulary.

[3] GRAMMAR FOCUS
${topicInstruction}
Each question must have exactly ONE clearly correct answer. Distractors must be plausible but grammatically or contextually wrong.

[4] PART-OF-SPEECH LABELS — "optionLabels" field
Include "optionLabels": an object with a short POS label for each option (A-D).
Standard abbreviations: n, v, adj, adv, prep, conj, pron, det.
For verb forms: v-inf (bare infinitive), v-ing, v-ed (past/past participle). Compound labels allowed: "n/v", "adj/v-ed".
Omit a key only when classification is genuinely ambiguous.
Examples: "carefully"->"adv", "careful"->"adj", "care"->"n/v", "employee"->"n", "whether"->"conj", "during"->"prep", "reviewed"->"v-ed".

[5] EXPLANATIONS — INTUITIVE VIETNAMESE
Sentences and options (A-D) must remain in ENGLISH. All explanations in natural, conversational VIETNAMESE.

Style rules:
- Explain through the sentence's ACTUAL MEANING AND CONTEXT, not through abstract formulas (avoid "S+V+O+Adv" style).
- Identify the specific clue words or phrases in the sentence that point to the correct answer.
- Explain what kind of word fits the blank and WHY, based on what the sentence is saying.
- For wrong options: state the EXACT mismatch — wrong word class, wrong meaning, or wrong grammatical form. Never just say "sai ngu phap".
- Mention grammar formulas only when they genuinely help, and explain each part in plain language.
- Keep explanations concise and practical. Do not pad.

Fields:
- "vietnameseSentence": Natural Vietnamese translation with the correct answer filled in.
- "shortExplanation": 1-2 sentences explaining why the correct answer fits, based on context/meaning.
- "detailedExplanation.whyCorrect": Why the correct option fits — cite the actual sentence context.
- "detailedExplanation.whyWrongA/B/C/D": Exact reason each distractor fails.
- "detailedExplanation.grammarRules": Array of 2-4 concise Vietnamese bullet points summarizing rules applied.
- "detailedExplanation.keyVocabulary": Array of 2-4 entries — see [6] below.

[6] KEY VOCABULARY — COLLOCATIONS AND USEFUL EXPRESSIONS
Select 2-4 words, phrases, or collocations that actually appear in the question sentence or answer options.
PRIORITIZE expressions that are practically reusable in TOEIC business contexts (550-750 level):
- Verb + noun collocations: meet a deadline, submit a report, conduct a review, place an order
- Verb/adj + preposition: be responsible for, be eligible for, result in, in charge of
- Fixed business expressions: in accordance with, prior to, subject to, on behalf of
- Business noun phrases: customer satisfaction, annual revenue, board of directors, fiscal year
Each entry format: { "word": "...", "meaning": "Vietnamese meaning", "type": "word class or Noun Phrase / Verb Phrase / etc." }
Rules:
- Only include vocabulary that actually appears in the sentence or options.
- Prefer useful collocations over isolated basic words when the sentence contains both.
- Do not invent entries just to reach the count.
- Provide accurate Vietnamese meanings.

[7] JSON OUTPUT FORMAT — STRICT
Return ONLY a valid JSON array. No markdown, no code fences, no text before or after. Start with "[", end with "]".

SCHEMA EXAMPLE:
[
  {
    "id": "q1",
    "sentence": "The marketing director will _____ the new campaign proposals at tomorrow's executive meeting.",
    "options": { "A": "review", "B": "reviewed", "C": "reviewing", "D": "reviews" },
    "optionLabels": { "A": "v-inf", "B": "v-ed", "C": "v-ing", "D": "v" },
    "answer": "A",
    "topic": "${exampleTopic}",
    "vietnameseSentence": "Giám đốc tiếp thị sẽ xem xét các đề xuất chiến dịch mới tại cuộc họp ban điều hành ngày mai.",
    "shortExplanation": "Câu có 'will' ngay trước chỗ trống — sau 'will', động từ luôn ở dạng nguyên mẫu không 'to', nên 'review' là đúng.",
    "detailedExplanation": {
      "whyCorrect": "Từ 'will' trước chỗ trống là modal verb. Quy tắc: sau modal verb, động từ chính phải ở dạng bare infinitive (không chia, không thêm đuôi). 'Review' đúng dạng này và có nghĩa là 'xem xét, đánh giá' — hoàn toàn phù hợp với ngữ cảnh giám đốc chuẩn bị cho cuộc họp.",
      "whyWrongB": "'Reviewed' là dạng quá khứ hoặc quá khứ phân từ. Trong câu chủ động sau 'will', không dùng dạng này — muốn bị động mới cần 'will be reviewed'.",
      "whyWrongC": "'Reviewing' là V-ing. Sau 'will' cần có 'be' để tạo thì tiếp diễn: 'will be reviewing'. Thiếu 'be' nên không dùng được.",
      "whyWrongD": "'Reviews' là dạng hiện tại đơn (he/she/it). Sau modal verb 'will', không thêm -s vào động từ.",
      "grammarRules": [
        "Modal verb (will, can, must, should…) + V-bare: không chia, không thêm -s/-ing/-ed.",
        "Câu bị động tương lai: will + be + V-ed. Câu tiếp diễn tương lai: will + be + V-ing."
      ],
      "keyVocabulary": [
        { "word": "executive meeting", "meaning": "cuộc họp ban điều hành", "type": "Noun Phrase" },
        { "word": "campaign proposal", "meaning": "đề xuất chiến dịch", "type": "Noun Phrase" }
      ]
    }
  }
]

FINAL RULES:
1. Exactly ONE blank per sentence, marked "_____" (5 underscores).
2. "answer" must be "A", "B", "C", or "D".
3. "topic" must be one of: Mixed, Word Forms, Tenses, Prepositions, Conjunctions, Relative Clauses, Conditionals, Passive Voice, Articles & Determiners, Subject-Verb Agreement, Comparatives & Superlatives, Modal Verbs, Gerunds & Infinitives, Reported Speech, Noun Clauses.
4. Generate EXACTLY ${count} questions, ids q1 through q${count}.
5. ALL explanations in natural VIETNAMESE.
6. Include "optionLabels" for every option where POS classification is clear.

OUTPUT: JSON array only. Start "[", end "]".`;
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
    // optionLabels is optional for backward compatibility — no error if missing
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
    id:           q.id || `q${i + 1}`,
    topic:        q.topic || 'Mixed',
    // optionLabels: passed through as-is; null for old questions without POS labels
    optionLabels: q.optionLabels || null,
    // Runtime fields (not from AI)
    _userAnswer:  null,
    _isCorrect:   null,
    _answeredAt:  null,
  }));
}
