import { validateSentenceAnalysis } from './grammarSentence.js';
import { validateReadingItems } from './grammarReadingItems.js';

// Keep established keys for compatibility with saved records and history.
export const TOPIC_LABELS = {
  Mixed: 'Tổng hợp',
  Tenses: 'Các thì',
  'Subject-Verb Agreement': 'Hòa hợp chủ ngữ – động từ',
  'Word Forms': 'Từ loại',
  Prepositions: 'Giới từ',
  'Articles & Determiners': 'Mạo từ và từ hạn định',
  Conjunctions: 'Liên từ',
  'Passive Voice': 'Câu bị động',
  'Relative Clauses': 'Mệnh đề quan hệ',
  'Noun Clauses': 'Mệnh đề danh từ',
  'Adverbial Clauses': 'Mệnh đề trạng ngữ',
  Conditionals: 'Câu điều kiện',
  'Comparatives & Superlatives': 'So sánh',
  'Modal Verbs': 'Động từ khuyết thiếu',
  'Gerunds & Infinitives': 'V-ing và To V',
  'Reported Speech': 'Câu tường thuật',
  'Pronouns & Quantifiers': 'Đại từ và lượng từ',
  'Participles & Reduced Clauses': 'Mệnh đề rút gọn',
  'Sentence Structure & Word Order': 'Cấu trúc câu',
};
export const GRAMMAR_TOPICS = Object.keys(TOPIC_LABELS);
export const GRAMMAR_COUNTS = [5, 10, 15, 20];
export const GRAMMAR_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
export const getTopicLabel = topic => TOPIC_LABELS[topic] || topic || 'Tổng hợp';
export const getAvailableTopics = questions => [...new Set([...GRAMMAR_TOPICS, ...questions.map(q => q.topic).filter(Boolean)])];

export function buildGrammarPrompt({ count = 10, topic = 'Mixed' } = {}) {
  return `You are an English reading instructor for Vietnamese learners preparing for VSTEP B1.
Generate exactly ${count} complete, grammatically correct English sentences for grammar recognition and sentence analysis.
Use a graduated difficulty range: mostly B1–B2, with occasional accessible C1-style exposure. Aim for about 40% B1, 30% B1+/B2 medium, 20% harder B2, and 10% C1-style exposure (round sensibly; at most one C1-style item for 5 sentences). Order from easier to medium to harder, ending with occasional C1-style exposure. Do not make all items hard or stay at minimum B1. For harder items, scaffold the clause relationships and unfamiliar language clearly in Vietnamese so a learner targeting VSTEP B1 can still understand.
Use natural sentences similar to VSTEP reading passages about daily life, education, community, work, travel, health, technology and the environment. C1-style exposure should come from richer sentence structure or nuanced linking, not obscure words or artificially long sentences. Vary structures and contexts.
These are study categories, NOT an official VSTEP syllabus.

MAIN FOCUS: ${topic} (${getTopicLabel(topic)}).
${topic === 'Mixed' ? 'Vary primary topics; use the actual dominant topic for each sentence.' : `Every sentence must demonstrate ${topic}; set its topic to "${topic}".`}
The selected topic is only the main focus. Identify ALL meaningful grammar points in EACH sentence, including other topics (tenses, agreement, word forms, prepositions, articles, clauses, passive voice, etc.). Do not restrict analysis to the selected topic. Do not add irrelevant points to reach a quota.
For every grammar point, provide its category, an EXACT contiguous English phrase copied from the sentence (preserve case and punctuation), and a clear Vietnamese explanation of its function, meaning and contextual clues.
Explain how the sentence is built: identify the main subject and verb, objects/complements and how clauses connect where relevant. Explain references and time relationships when useful.
Provide a natural Vietnamese translation. All explanations and optional structures/reading notes must be in Vietnamese.
NO blanks, NO A/B/C/D options, NO answer field, NO correct-answer selection.

READING LEARNING ITEMS (readingItems, shown as "Lưu ý đọc hiểu"):
Extract only meaningful, reusable learning items actually occurring in each sentence: important vocabulary, structures, parts of speech / word forms, prepositions, collocations, useful phrases or recurring patterns. Do NOT invent or force items to reach a quantity; an empty array is acceptable when nothing is useful.
Each item must have category (vocabulary, structure, word-form, preposition, phrase, collocation, or pattern), text (EXACT contiguous English text from the sentence, preserving case and punctuation), and explanation (short Vietnamese explanation).
Optional: meaning (concise Vietnamese meaning suggestion), usefulness (why it helps VSTEP reading), pattern (a reusable English grammar pattern, grounded in the exact text; only when genuinely useful for saving to Grammar Structures).
Use vocabulary/phrase/collocation/preposition/word-form for Vocabulary items; structure/pattern for Grammar Structures. A vocabulary item may also include a pattern when both destinations genuinely make sense. Never put Vietnamese notes inside the English text or pattern.
Keep optional readingNotes as an array of plain Vietnamese strings for general comprehension notes; put structured learning items in readingItems, not in readingNotes. Do not duplicate a point unless its reading value is distinct.

Return ONLY a JSON array, without markdown or surrounding text. Each item uses this versioned schema:
{
  "schemaVersion": 2,
  "type": "sentence-analysis",
  "id": "s1",
  "sentence": "Students who live near the library often study there after class.",
  "vietnameseSentence": "Những sinh viên sống gần thư viện thường học ở đó sau giờ học.",
  "topic": "Relative Clauses",
  "grammarPoints": [
    { "category": "Sentence Structure & Word Order", "phrase": "Students who live near the library", "explanation": "Cả cụm là chủ ngữ của động từ chính study; mệnh đề who live near the library bổ nghĩa cho Students." },
    { "category": "Relative Clauses", "phrase": "who live near the library", "explanation": "Mệnh đề quan hệ xác định sinh viên nào; who thay cho Students và làm chủ ngữ của live." },
    { "category": "Tenses", "phrase": "often study", "explanation": "Hiện tại đơn diễn tả thói quen; often cho biết việc học xảy ra thường xuyên." },
    { "category": "Subject-Verb Agreement", "phrase": "Students", "explanation": "Students là chủ ngữ số nhiều nên study và live không thêm s." },
    { "category": "Prepositions", "phrase": "after class", "explanation": "After đứng trước danh từ class, chỉ thời điểm sau giờ học." },
    { "category": "Articles & Determiners", "phrase": "the library", "explanation": "The chỉ thư viện cụ thể, có thể xác định trong ngữ cảnh." },
    { "category": "Prepositions", "phrase": "near the library", "explanation": "Cụm giới từ chỉ nơi sinh viên sống, gần thư viện." },
    { "category": "Word Forms", "phrase": "there", "explanation": "Trạng từ chỉ nơi chốn thay cho at the library để tránh lặp lại địa điểm." }
  ],
  "structures": ["Chủ ngữ được mở rộng bằng mệnh đề quan hệ; động từ chính là study."],
  "readingNotes": ["There chỉ thư viện; không nhầm live trong mệnh đề phụ với động từ chính study."],
  "readingItems": [
    { "category": "preposition", "text": "after class", "meaning": "sau giờ học", "explanation": "After + danh từ chỉ thời điểm sau một hoạt động.", "usefulness": "Giúp xác định trình tự thời gian trong đoạn đọc." },
    { "category": "structure", "text": "Students who live near the library", "pattern": "noun + who + verb", "explanation": "Mệnh đề quan hệ với who bổ nghĩa cho danh từ chỉ người.", "usefulness": "Giúp tìm đúng chủ ngữ dù có mệnh đề xen giữa." }
  ]
}
The example illustrates the schema only; adapt topic and analysis to the requested focus.
Required for newly generated items: schemaVersion, type, sentence, vietnameseSentence, topic, non-empty grammarPoints, readingItems (array, possibly empty).
Optional: id, structures (array of strings), readingNotes (array of strings).
Topic and grammar point category keys must be from: ${GRAMMAR_TOPICS.join(', ')}.
Generate exactly ${count} items with unique ids s1 through s${count}. One complete sentence per item; never use placeholders or exercises. Output JSON only.`;
}

export function validateGrammarJSON(parsed, { count, topic } = {}) {
  if (!Array.isArray(parsed) || !parsed.length) return { valid: false, errors: ['JSON phải là mảng có ít nhất một câu phân tích.'] };
  const errors = [];
  if (count && parsed.length !== count) errors.push(`Cần đúng ${count} câu; JSON hiện có ${parsed.length} câu.`);
  const sentences = new Set();
  parsed.forEach((q, i) => {
    const error = validateSentenceAnalysis(q);
    if (error) { errors.push(`Câu ${i + 1}: ${error}`); return; }
    const readingError = validateReadingItems(q);
    if (readingError) errors.push(`Câu ${i + 1}: ${readingError}`);
    if (!GRAMMAR_TOPICS.includes(q.topic) || q.grammarPoints.some(p => !GRAMMAR_TOPICS.includes(p.category))) errors.push(`Câu ${i + 1}: chủ đề hoặc category không nằm trong danh sách.`);
    if (topic && topic !== 'Mixed' && q.topic !== topic) errors.push(`Câu ${i + 1}: chủ đề chính phải là ${getTopicLabel(topic)}.`);
    if (q.topic !== 'Mixed' && !q.grammarPoints.some(p => p.category === q.topic)) errors.push(`Câu ${i + 1}: chưa phân tích chủ đề chính.`);
    const key = q.sentence.trim().toLowerCase();
    if (sentences.has(key)) errors.push(`Câu ${i + 1}: câu tiếng Anh bị trùng.`);
    sentences.add(key);
  });
  return { valid: errors.length === 0, ...(errors.length ? { errors } : {}) };
}

export function normalizeQuestions(questions) {
  return questions.map((q, i) => ({ ...q, id: q.id || `s${i + 1}` }));
}
