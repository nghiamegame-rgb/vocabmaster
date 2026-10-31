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

VSTEP VOCABULARY AND GRAMMAR PRIORITIES:
Select useful language targets FIRST, then naturally incorporate them into complete sentences that fit the selected grammar focus and the difficulty distribution above. Prioritize high-utility B1–B2 vocabulary across education, health, the environment, technology, society, work and daily life; frequent collocations and prepositional phrases; and reusable grammar patterns that help learners understand longer, complex reading sentences.
Include useful word forms and word families that help learners infer meanings and recognize a word's role in context. Prioritize linking expressions, relative clauses, passive constructions, participle clauses, and other recurring reading structures where they fit naturally.
Prefer common, reusable language over rare or unnecessarily academic vocabulary, including in harder items. Do not force unrelated targets into one sentence or create unnatural combinations. Vary the targets across the set so the sentences offer worthwhile material to save and review for VSTEP preparation.

MAIN FOCUS: ${topic} (${getTopicLabel(topic)}).
${topic === 'Mixed' ? 'Vary primary topics; use the actual dominant topic for each sentence.' : `Every sentence must demonstrate ${topic}; set its topic to "${topic}".`}
NATURAL QUICK EXPLANATION (reuse grammarPoints; no new fields):
${topic === 'Mixed'
  ? 'Mixed: choose only a few of the most useful points across grammar topics. Do not inventory every possible feature or narrate the whole sentence structure.'
  : `Explain ONLY parts relevant to ${topic}. Use "${topic}" as the category of these points. Do not add unrelated tense, agreement, article or sentence-structure explanations. At most one brief supporting note may be included within a relevant explanation if essential to understand it.`}
Usually provide 3–6 short grammarPoints per sentence, fewer when that is all the selected topic needs. Never pad to reach a count. Each point quotes an EXACT contiguous English phrase from the sentence and gives ONE short, natural Vietnamese explanation of why that part is used here (roughly 15–35 Vietnamese words). Sound like a practical teacher, not a grammar textbook. Explain meaning or a useful contextual clue; avoid repetitive definitions and academic narration.
Do NOT use mechanical sentence formulas such as S + V + O, Prep Phrase 1 + Prep Phrase 2, or noun phrase + clause. Do NOT generate a long formal sentence-structure paragraph. Omit optional structures unless genuinely needed; keep any such note brief.
Examples of tone: "depend on": "Mang nghĩa phụ thuộc vào; depend đi với on để chỉ điều mình dựa vào."; "sensitive": "Đứng trước documents để nói tài liệu thuộc loại nhạy cảm, nên dùng tính từ."; "for sharing": "Ở đây for nói mục đích sử dụng; động từ share theo sau được viết thành sharing." Choose only examples relevant to the selected topic, never all of them by default.
Provide a natural Vietnamese translation. All explanations and optional structures/reading notes must be in Vietnamese.
NO blanks, NO A/B/C/D options, NO answer field, NO correct-answer selection.

READING LEARNING ITEMS (readingItems, shown as "Lưu ý đọc hiểu"):
Extract only meaningful, reusable learning items actually occurring in each sentence: important vocabulary, structures, parts of speech / word forms, prepositions, collocations, useful phrases or recurring patterns. Keep this optional learning section short (usually 0–3 worthwhile items); avoid restating the quick explanation. Do NOT invent or force items to reach a quantity; an empty array is acceptable when nothing is useful.
Each item must have category (vocabulary, structure, word-form, preposition, phrase, collocation, or pattern), text (EXACT contiguous English text from the sentence, preserving case and punctuation), and explanation (short Vietnamese explanation).
Optional: meaning (concise Vietnamese meaning suggestion), usefulness (why it helps VSTEP reading), pattern (a reusable English grammar pattern, grounded in the exact text; only when genuinely useful for saving to Grammar Structures).
For structure/pattern items and any item with a pattern, include meaning as a clear Vietnamese meaning of the ENTIRE reusable expression or pattern, not just the grammatical role of one word or preposition. Keep technical grammar commentary in explanation and the topic in topic, never substitute either for meaning. For example, text "throw plastic bottles into", pattern "throw something into somewhere", meaning "Vứt/bỏ cái gì vào trong một nơi nào đó.", explanation "Giới từ into chỉ sự chuyển động vào bên trong một địa điểm hoặc vật chứa." Use this only when the exact text occurs in the sentence; do not invent extracts.
In readingItems, clearly identify the highest-value vocabulary, collocations, prepositions, phrases and reusable grammar patterns from each sentence. Provide Vietnamese meanings in meaning when applicable and explain their use in context in explanation. For word-form items, explain the observed form, its part of speech and a useful word-family relationship in Vietnamese; keep text as an exact extract, not a list of related words absent from the sentence. For reusable structures, include pattern when useful. Give priority to items worth saving and revisiting for VSTEP reading, without adding low-value or forced items merely to increase quantity.
Use vocabulary/phrase/collocation/preposition/word-form for Vocabulary items; structure/pattern for Grammar Structures. A vocabulary item may also include a pattern when both destinations genuinely make sense. Never put Vietnamese notes inside the English text or pattern.
Keep optional readingNotes as an array of plain Vietnamese strings for general comprehension notes; put structured learning items in readingItems, not in readingNotes. Do not duplicate a point unless its reading value is distinct.

Return ONLY a JSON array, without markdown or surrounding text. Each item uses this versioned schema:
{
  "schemaVersion": 2,
  "type": "sentence-analysis",
  "id": "s1",
  "sentence": "Employees depend on secure cloud platforms for sharing documents with remote colleagues.",
  "vietnameseSentence": "Nhân viên dựa vào các nền tảng đám mây an toàn để chia sẻ tài liệu với đồng nghiệp làm việc từ xa.",
  "topic": "Prepositions",
  "grammarPoints": [
    { "category": "Prepositions", "phrase": "depend on", "explanation": "Mang nghĩa phụ thuộc vào; depend đi với on để chỉ điều mình dựa vào." },
    { "category": "Prepositions", "phrase": "for sharing", "explanation": "For nói mục đích sử dụng nền tảng; động từ share theo sau được viết thành sharing." },
    { "category": "Prepositions", "phrase": "with remote colleagues", "explanation": "With cho biết tài liệu được chia sẻ với ai; ở đây là các đồng nghiệp làm việc từ xa." }
  ],
  "readingNotes": [],
  "readingItems": [
    { "category": "collocation", "text": "cloud platforms", "meaning": "các nền tảng đám mây", "explanation": "Cụm thường dùng khi nói về công cụ làm việc và lưu trữ trực tuyến." },
    { "category": "structure", "text": "sharing documents with remote colleagues", "pattern": "share something with somebody", "meaning": "Chia sẻ thứ gì với ai.", "explanation": "Sau share, nêu thứ được chia sẻ rồi dùng with để giới thiệu người nhận." }
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
