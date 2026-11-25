// Excel export of Dictation data (2 sheets), same library as grammarExport.js.
import { liveRecords, listenTotals, totalCount } from './dictationSyncMerge.js';

const date = ms => (ms ? new Date(ms).toLocaleString('vi-VN') : '');

/** Rows (header first) for the two sheets; only live (not deleted) records. */
export function buildDictationExportRows(data) {
  const words = [['Từ', 'Câu gốc', 'Tên bài', 'Ngày lưu', 'Nghe đúng', 'Nghe sai'],
    ...liveRecords(data.words).map(w => {
      const t = listenTotals(w);
      return [w.word, w.sentence || '', w.lessonTitle || '', date(w.savedAt), t.correct, t.wrong];
    })];
  const sentences = [['Tên bài', 'Thứ tự', 'Câu tiếng Anh', 'Bản dịch tiếng Việt', 'Kết quả gần nhất', 'Số lần thử', 'Cập nhật'],
    ...liveRecords(data.sentences).map(s => [
      s.lessonTitle, s.order + 1, s.english, s.vietnamese || '',
      s.lastResult === 'correct' ? 'Đúng' : s.lastResult === 'wrong' ? 'Sai' : 'Chưa làm',
      totalCount(s.attempts), date(Math.max(s.updatedAt || 0, s.lastResultAt || 0)),
    ])];
  return { words, sentences };
}

export async function downloadDictationWorkbook(data) {
  const { default: writeExcelFile } = await import('write-excel-file/universal');
  const rows = buildDictationExportRows(data);
  const toSheet = (name, table, widths) => ({
    sheet: name,
    data: table.map((row, r) => row.map(value => (r === 0
      ? { value: String(value), type: String, fontWeight: 'bold' }
      : typeof value === 'number' ? { value, type: Number } : { value: String(value), type: String, wrap: true }))),
    columns: widths.map(width => ({ width })),
    stickyRowsCount: 1,
  });
  const blob = await writeExcelFile([
    toSheet('Từ vựng', rows.words, [18, 60, 24, 20, 10, 10]),
    toSheet('Câu hoàn chỉnh', rows.sentences, [24, 8, 70, 60, 16, 10, 20]),
  ]).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `Dictation-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return { words: rows.words.length - 1, sentences: rows.sentences.length - 1 };
}
