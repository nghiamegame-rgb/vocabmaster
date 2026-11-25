// Excel export of Dictation sentences, made to be read by a chatbot: ONE sheet,
// ONE column, one English sentence per row and nothing else (no header, dates,
// lesson names, translations or results). It is not a backup — the .json export is.
// Same library as grammarExport.js.
import { lessonsOf } from './dictationModel.js';

export const EXPORT_SHEET_NAME = 'Câu tiếng Anh';
export const EXPORT_COLUMN_WIDTH = 100;

// Characters XML cannot hold would make Excel reject the whole file.
const isXmlChar = char => {
  const point = char.codePointAt(0);
  if (point < 32) return point === 9 || point === 10 || point === 13;
  return !(point >= 0xd800 && point <= 0xdfff) && point !== 0xfffe && point !== 0xffff;
};

const toOneLine = text => Array.from(text, char => (isXmlChar(char) ? char : ' ')).join('').replace(/\s+/g, ' ').trim();

/**
 * English sentences to export: sentences in use (not deleted), lesson by lesson in
 * their position order, only the part before "|", one line each, without repeats
 * (compared trimmed and ignoring upper/lower case; the first one is kept).
 */
export function buildDictationExportSentences(data) {
  const seen = new Set();
  const sentences = [];
  for (const lesson of lessonsOf(data)) {
    for (const sentence of lesson.sentences) {
      const english = toOneLine(String(sentence.english ?? '').split('|')[0]);
      const key = english.toLowerCase();
      if (!english || seen.has(key)) continue;
      seen.add(key);
      sentences.push(english);
    }
  }
  return sentences;
}

export async function createDictationWorkbook(sentences) {
  const { default: writeExcelFile } = await import('write-excel-file/universal');
  return writeExcelFile([{
    sheet: EXPORT_SHEET_NAME,
    // String cells: a sentence starting with "=" stays text, never a formula.
    data: sentences.map(value => [{ value, type: String }]),
    columns: [{ width: EXPORT_COLUMN_WIDTH }],
  }]).toBlob();
}

/** Downloads the file. With no sentence to export, nothing is downloaded. */
export async function downloadDictationWorkbook(data) {
  const sentences = buildDictationExportSentences(data);
  if (!sentences.length) return { sentences: 0 };
  const blob = await createDictationWorkbook(sentences);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `Dictation-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return { sentences: sentences.length };
}
