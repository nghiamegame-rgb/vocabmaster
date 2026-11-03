import { buildGrammarCorpus } from './grammarCorpus.js';
import { createGrammarBatch } from './grammarBatch.js';
import { buildGrammarPrompt } from './grammarPrompt.js';

const invalidXmlText = text => Array.from(text).some(char => {
  const point = char.codePointAt(0);
  return (point < 32 && ![9, 10, 13].includes(point)) ||
    (point >= 0xd800 && point <= 0xdfff) || point === 0xfffe || point === 0xffff;
});

// Only saved sentences enter the workbook. Practice imports still have their
// separate, larger corpus for duplicate checks in GrammarPractice.
export function buildGrammarExportSource(words, savedQuestions, settings) {
  if (!Array.isArray(words) || !Array.isArray(savedQuestions)) {
    return { error: 'Chưa đọc được đầy đủ hai kho dữ liệu trên thiết bị.' };
  }
  const malformedWords = words.filter(word => typeof word?.english !== 'string').length;
  const eligible = words.filter(word => typeof word?.english === 'string' && word.english.trim());
  const corpus = buildGrammarCorpus(eligible, savedQuestions, { preserveText: true });
  if (malformedWords || corpus.unresolved) {
    return { error: `Chưa thể xuất đầy đủ: ${malformedWords} mục Vocabulary lỗi tiếng Anh, ${corpus.unresolved} bản ghi Grammar không khôi phục được câu hoàn chỉnh. Hãy kiểm tra nguồn; không xuất một phần.` };
  }
  const snapshot = { data: corpus.data, settings: { count: settings.count, topic: settings.topic } };
  // Excel's native limits: fail explicitly instead of truncating any input.
  if (snapshot.data.vocab.length > 1048575 || snapshot.data.grammar.length > 1048575 ||
      [...snapshot.data.vocab.map(([text]) => text), ...snapshot.data.grammar].some(text =>
        text.length > 32767 || invalidXmlText(text))) {
    return { error: 'Dữ liệu vượt giới hạn hàng/độ dài ô Excel hoặc chứa ký tự XML không hợp lệ. Không cắt hay xuất thiếu dữ liệu.' };
  }
  return { snapshot, key: JSON.stringify(snapshot) };
}

export function prepareGrammarExport(source) {
  if (source.error || !source.snapshot) throw new Error(source.error || 'Dữ liệu chưa sẵn sàng.');
  const batch = createGrammarBatch(source.snapshot.data);
  const settings = structuredClone(source.snapshot.settings);
  const workbookName = `Grammar-${batch.id}.xlsx`;
  return {
    id: batch.id, data: batch.data, settings, key: source.key, workbookName,
    prompt: buildGrammarPrompt({ ...settings, batchId: batch.id, data: batch.data, workbookName }),
  };
}

export async function createGrammarWorkbook(prepared) {
  const { default: writeExcelFile } = await import('write-excel-file/universal');
  const sheet = (name, header, values, width) => ({
    sheet: name,
    data: [[{ value: header, type: String, fontWeight: 'bold' }],
      ...values.map(value => [{ value, type: String, wrap: true }])],
    columns: [{ width }], stickyRowsCount: 1,
  });
  return writeExcelFile([
    sheet('Vocabulary', 'English', prepared.data.vocab.map(([english]) => english), 45),
    sheet('Grammar', 'Sentence', prepared.data.grammar, 100),
  ]).toBlob();
}

export function downloadGrammarWorkbook(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
