// Versioned records coexist with legacy TOEIC records, without migration.
export const isSentenceAnalysis = q => q?.schemaVersion === 2 && q?.type === 'sentence-analysis';

// Mirrored in Apps Script (no ES module imports); tests check both validators.
export function validateSentenceAnalysis(q) {
  if (!q || typeof q !== 'object' || Array.isArray(q) || q.schemaVersion !== 2 || q.type !== 'sentence-analysis') return 'Cần schemaVersion: 2 và type: "sentence-analysis".';
  for (const key of ['sentence', 'vietnameseSentence', 'topic']) {
    if (typeof q[key] !== 'string' || !q[key].trim()) return `Thiếu ${key} dạng chuỗi không rỗng.`;
  }
  if (/_{2,}|\[(?:blank|gap)\]|\.{3}|…/i.test(q.sentence)) return 'Cần câu hoàn chỉnh, không có chỗ trống hoặc dấu lược bỏ.';
  if ('options' in q || 'answer' in q || 'optionLabels' in q) return 'Phân tích câu không được chứa options, answer hoặc optionLabels.';
  if (!Array.isArray(q.grammarPoints) || !q.grammarPoints.length) return 'grammarPoints phải là mảng không rỗng.';
  for (const point of q.grammarPoints) {
    if (!point || typeof point !== 'object' || Array.isArray(point)) return 'Điểm ngữ pháp phải là object.';
    for (const key of ['category', 'phrase', 'explanation']) {
      if (typeof point[key] !== 'string' || !point[key].trim()) return `Điểm ngữ pháp thiếu ${key}.`;
    }
    if (!q.sentence.includes(point.phrase)) return `Cụm "${point.phrase}" không xuất hiện nguyên văn trong câu.`;
  }
  for (const key of ['structures', 'readingNotes']) {
    if (q[key] !== undefined && (!Array.isArray(q[key]) || q[key].some(s => typeof s !== 'string' || !s.trim()))) return `${key} phải là mảng chuỗi không rỗng.`;
  }
  return null;
}

// Complete legacy sentences for display only; never change stored records.
export function getGrammarSentence(q) {
  return isSentenceAnalysis(q) ? q.sentence : q.sentence?.replace(/_____/g, q.options?.[q.answer] ?? '_____');
}

// Presentation only: never rewrite saved analyses or alter their array order.
export function getQuickGrammarPoints(question, selectedTopic) {
  const topic = selectedTopic || question.analysisTopic || question.topic || 'Mixed';
  const points = question.grammarPoints || [];
  const nonStructural = points.filter(point => point.category !== 'Sentence Structure & Word Order');
  const useful = topic === 'Mixed'
    ? (nonStructural.length ? nonStructural : points)
    : points.filter(point => point.category === topic);
  const seen = new Set();
  return useful.filter(point => {
    const key = point.phrase.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6).map(point => {
    const text = point.explanation.trim();
    const firstSentence = text.match(/^.*?[.!?](?=\s|$)/u)?.[0] || text;
    const explanation = firstSentence.length > 220
      ? `${firstSentence.slice(0, 217).replace(/\s+\S*$/, '').trimEnd()}…` : firstSentence;
    return { ...point, explanation };
  });
}
