// Additive v2 extension: keep readingNotes as string[] for existing backends.
export const READING_ITEM_LABELS = {
  vocabulary: 'Từ vựng', structure: 'Cấu trúc', 'word-form': 'Từ loại / dạng từ',
  preposition: 'Giới từ', phrase: 'Cụm từ', collocation: 'Kết hợp từ', pattern: 'Mẫu câu',
};
const VOCAB_CATEGORIES = ['vocabulary', 'word-form', 'preposition', 'phrase', 'collocation'];

export function validateReadingItem(item, sentence) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return 'Mục đọc hiểu phải là object.';
  if (!Object.hasOwn(READING_ITEM_LABELS, item.category)) return 'category của mục đọc hiểu không hợp lệ.';
  for (const key of ['text', 'explanation']) {
    if (typeof item[key] !== 'string' || !item[key].trim()) return `Mục đọc hiểu thiếu ${key}.`;
  }
  if (!sentence.includes(item.text)) return `Mục đọc hiểu "${item.text}" không xuất hiện nguyên văn trong câu.`;
  for (const key of ['usefulness', 'meaning', 'pattern']) {
    if (item[key] !== undefined && (typeof item[key] !== 'string' || !item[key].trim())) return `${key} phải là chuỗi không rỗng.`;
  }
  return null;
}

export function validateReadingItems(question) {
  if (question.readingItems === undefined) return null; // Older v2 records remain valid.
  if (!Array.isArray(question.readingItems)) return 'readingItems phải là mảng.';
  for (const item of question.readingItems) {
    const error = validateReadingItem(item, question.sentence);
    if (error) return error;
  }
  return null;
}

export function getReadingDestinations(item) {
  return [
    ...(VOCAB_CATEGORIES.includes(item.category) ? ['vocab'] : []),
    ...(['structure', 'pattern'].includes(item.category) || item.pattern ? ['structure'] : []),
  ];
}

export function buildReadingDraft(item, question, destination) {
  if (destination === 'structure') return {
    english: item.pattern || item.text,
    vietnamese: item.meaning || '',
    example: question.sentence,
    notes: [item.explanation, item.usefulness, `Trích từ câu: ${item.text}`].filter(Boolean).join('\n'),
    topic: question.topic,
  };
  return {
    english: item.text,
    vietnamese: item.meaning || item.explanation,
    annotation: [READING_ITEM_LABELS[item.category], item.explanation, item.usefulness].filter(Boolean).join(' · '),
    wordType: item.category === 'preposition' ? 'Preposition' : /\s/.test(item.text.trim()) ? 'Phrase' : 'Word',
  };
}

export const normalizeLearningText = value => String(value || '').normalize('NFKC')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim().replace(/\s+/g, ' ').toLowerCase();

// Only add through the existing stores; never update matching records or progress.
export function saveReadingDraft(destination, draft, { words = [], structures = [], addWord, addStructure }) {
  if (!['vocab', 'structure'].includes(destination)) return { ok: false, error: 'Nơi lưu không hợp lệ.' };
  const english = String(draft.english || '').trim();
  const vietnamese = String(draft.vietnamese || '').trim();
  if (!english || !vietnamese) return { ok: false, error: 'Vui lòng nhập nội dung tiếng Anh và nghĩa / giải thích tiếng Việt.' };
  const collection = destination === 'vocab' ? words : structures;
  if (collection.some(item => !item.deletedAt && normalizeLearningText(item.english) === normalizeLearningText(english))) {
    return { ok: false, error: 'Nội dung này đã có trong thư viện đích. Bản ghi hiện tại được giữ nguyên.' };
  }
  if (destination === 'structure') return addStructure
    ? addStructure({ english, vietnamese, example: draft.example, notes: draft.notes, topic: draft.topic })
    : { ok: false, error: 'Chưa thể thêm cấu trúc.' };
  if (!addWord) return { ok: false, error: 'Chưa thể thêm từ vựng.' };
  const added = addWord({ english, vietnamese, annotation: draft.annotation || '', wordType: draft.wordType || 'Word' });
  return added ? { ok: true } : { ok: false, error: 'Từ / cụm từ này đã có trong Vocabulary.' };
}
