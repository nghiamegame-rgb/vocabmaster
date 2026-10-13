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
 * @param {{ count?: number, topic?: string }} config
 * @returns {string}
 */
export function buildGrammarPrompt({ count = 10, topic = 'Mixed' } = {}) {
  const topicLabel = getTopicLabel(topic);
  const topicInstruction = topic === 'Mixed'
    ? 'Mix a diverse range of realistic TOEIC Part 5 grammar topics (Word Forms, Tenses, Prepositions, Conjunctions, Relative Clauses, Conditionals, Passive Voice, Subject-Verb Agreement, Gerunds & Infinitives, Modal Verbs, etc.).'
    : `Focus specifically on the grammar topic: **${topic}** (${topicLabel}). Ensure all ${count} questions test core and intermediate aspects of this topic.`;

  const exampleTopic = topic === 'Mixed' ? 'Modal Verbs' : topic;

  return `You are an expert TOEIC test creator and English instructor for Vietnamese learners. Generate exactly ${count} TOEIC Part 5 (sentence completion) grammar questions.

TARGET LEVEL & DIFFICULTY DISTRIBUTION (TOEIC 550 TARGET WITH 700-750 EXPOSURE):
The learner is currently at approximately TOEIC 550 and aiming to advance toward 700-750.
Provide an organic mix of question difficulties across the ${count} questions (flexible guidelines):
- Approximately 40% foundational questions (~500-550 level: core word forms, basic tenses, common prepositions, straightforward agreements).
- Approximately 40% intermediate questions (~600-650 level: conjunctions vs. prepositions, passive voice, relative clauses, gerunds vs. infinitives).
- Approximately 20% moderately challenging questions (~700-750 level: tricky collocations, subtle word forms, conditional inversions, reduced relative clauses).
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

PART-OF-SPEECH LABELS — "optionLabels" field:
For each question, include an "optionLabels" object alongside "options".
For each answer key (A, B, C, D), provide a short grammatical label.
Use these standard abbreviations: n (noun), v (verb), adj (adjective), adv (adverb), prep (preposition), conj (conjunction), pron (pronoun), det (determiner).
For verb forms, be more specific when helpful: v-inf (bare infinitive), v-ing, v-ed (past/past participle).
Compound labels are allowed: "n/v", "adj/v-ed".
Leave the key absent ONLY if the word class is genuinely ambiguous in isolation.
Examples: "carefully" -> "adv", "careful" -> "adj", "care" -> "n/v", "employee" -> "n", "manage" -> "v", "whether" -> "conj", "during" -> "prep", "reviewed" -> "v-ed".

LANGUAGE & EXPLANATION REQUIREMENTS - INTUITIVE VIETNAMESE (STRICT):
- Question sentences and options A, B, C, D must remain in ENGLISH.
- Keep English grammar structures and collocations in their original form.
- ALL explanations and learning notes must be written in natural, conversational VIETNAMESE.

EXPLANATION STYLE GUIDE (VERY IMPORTANT):
Explain grammar through the actual meaning and context of each sentence, NOT through abstract formulas.

BAD style (avoid):
"Cau co cau truc S + V + O + Adv nen can trang tu."

GOOD style:
"Cau dang noi ve cach nguoi do thuc hien hanh dong. Cho trong bo nghi a cho dong tu, vi vay ta can trang tu. 'Carefully' nghia la 'mot cach can than', phu hop voi ngu canh."

GOOD style:
"Ngay truoc cho trong co mao tu 'the', va sau do khong co danh tu nao khac trong cum nay, nen vi tri nay rat co the can mot danh tu."

Specific requirements for each explanation:
1. Point out the specific clue words or phrases in the sentence that help identify the correct answer.
2. Explain what kind of word naturally fills the blank and WHY — based on what the sentence is saying.
3. For wrong options: explain the EXACT mismatch (wrong word class for this position, wrong meaning, wrong grammatical form) — never just say "sai ngu phap".
4. Mention grammar formulas only when they genuinely add value, and explain each part in plain language.
5. Keep explanations informative but not padded.

FIELDS:
1. "vietnameseSentence": Natural Vietnamese translation of the entire sentence with the correct answer filled in.
2. "shortExplanation": 1-2 sentences in VIETNAMESE. Explain why the correct answer fits based on the sentence context and meaning.
3. "detailedExplanation.whyCorrect": VIETNAMESE — why the correct option fits. Reference actual sentence context, not just abstract rules.
4. "detailedExplanation.whyWrongA" / "whyWrongB" / "whyWrongC" / "whyWrongD": VIETNAMESE — exact reason each distractor fails (cite the mismatch specifically).
5. "detailedExplanation.grammarRules": Array of 2-4 concise bullet points in VIETNAMESE. Practical rules applied. When formulas are used, explain them in plain language.
6. "detailedExplanation.keyVocabulary": Array of 1-4 key words/collocations: { "word", "meaning" (Vietnamese), "type" }.

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
    "optionLabels": {
      "A": "v-inf",
      "B": "v-ed",
      "C": "v-ing",
      "D": "v"
    },
    "answer": "A",
    "topic": "${exampleTopic}",
    "vietnameseSentence": "Giam doc tiep thi se xem xet cac de xuat chien dich moi tai cuoc hop ban dieu hanh ngay mai.",
    "shortExplanation": "Cau co 'will' dung truoc cho trong. Sau 'will', ta luon dung dong tu nguyen mau khong 'to' (bare infinitive), nen 'review' la lua chon dung.",
    "detailedExplanation": {
      "whyCorrect": "Tu 'will' ngay truoc cho trong la tro dong tu (modal verb). Quy tac co ban: sau modal verb, dong tu chinh phai o dang nguyen mau khong 'to'. 'Review' dung dang nay va co nghia la 'xem xet, danh gia' — hoan toan phu hop voi ngu canh mot giam doc chuan bi cho cuoc hop.",
      "whyWrongB": "'Reviewed' la dang qua khu hoac qua khu phan tu. Sau 'will', khong dung dang nay trong cau chu dong — muon dung 'reviewed' thi phai la 'will be reviewed' (cau bi dong).",
      "whyWrongC": "'Reviewing' la dang V-ing. De dung duoc sau 'will', cau phai co 'be' o giua: 'will be reviewing'. O day khong co 'be', nen sai.",
      "whyWrongD": "'Reviews' la dang hien tai don so it (he/she/it reviews). Sau modal verb 'will', khong them 's' vao dong tu.",
      "grammarRules": [
        "Modal verb (will, can, must, should...) + dong tu nguyen mau khong 'to' (bare infinitive) — khong chia, khong them -s/-ing/-ed.",
        "Tu 'tomorrow' va 'will' cung nhau cho thay cau dang noi ve tuong lai.",
        "Cau bi dong tuong lai co dang: will + be + V-ed/V3 — khac voi cau chu dong will + V-bare."
      ],
      "keyVocabulary": [
        { "word": "executive meeting", "meaning": "cuoc hop ban dieu hanh", "type": "Noun Phrase" },
        { "word": "campaign proposal", "meaning": "de xuat chien dich", "type": "Noun Phrase" }
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
6. Include "optionLabels" for all options where classification is clear.

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
