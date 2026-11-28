import { GRAMMAR_TOPICS, validateGrammarJSON, normalizeQuestions } from './grammarPrompt.js';
import { READING_ITEM_LABELS, validateReadingItem } from './grammarReadingItems.js';
import { sentenceKey } from './grammarBatch.js';

// Map normalized characters back to source offsets; the English sentence is immutable.
function comparisonMap(text) {
  let normalized = '';
  const starts = [], ends = [];
  let offset = 0;
  for (const char of text) {
    const start = offset;
    offset += char.length;
    const value = /\s/u.test(char) ? ' ' : char.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[‐‑]/g, '-').toLowerCase();
    if (value === ' ' && normalized.endsWith(' ')) { ends[ends.length - 1] = offset; continue; }
    for (let unit = 0; unit < value.length; unit++) { normalized += value[unit]; starts.push(start); ends.push(offset); }
  }
  return { normalized, starts, ends };
}

export function matchGrammarSubstring(sentence, phrase) {
  if (typeof phrase !== 'string' || !phrase.trim()) return { error: 'Cần trích dẫn dạng chuỗi không rỗng.' };
  if (/\.{3}|…/.test(phrase)) return { error: 'Không dùng dấu ba chấm hoặc trích dẫn rút gọn; cần một đoạn liên tục trong câu.', suggestion: 'Chép một đoạn nguyên văn; đặt mẫu khái quát vào readingItems[].pattern.' };
  if (sentence.includes(phrase)) return { text: phrase };
  const source = comparisonMap(sentence);
  const needle = comparisonMap(phrase).normalized.trim();
  const matches = [];
  let at = source.normalized.indexOf(needle);
  while (at !== -1) {
    matches.push([source.starts[at], source.ends[at + needle.length - 1]]);
    at = source.normalized.indexOf(needle, at + 1);
  }
  if (matches.length === 1) return { text: sentence.slice(...matches[0]) };
  return matches.length > 1
    ? { error: 'Có nhiều vị trí khớp sau chuẩn hóa; không thể tự chọn đoạn trích.', suggestion: 'Mở rộng trích dẫn để xác định một đoạn duy nhất, hoặc chép đúng chữ hoa/thường từ câu.' }
    : { error: 'Không tìm thấy đoạn trích liên tục trong câu.', suggestion: 'Chép đúng một đoạn trong sentence; mẫu có chỗ lược bỏ chỉ được đặt trong pattern.' };
}

// Scan whole top-level containers; never rescue a nested fragment of bad JSON.
// Shared by Grammar import and Smart Quiz.
export function scanJsonContainers(content) {
  const containers = [];
  let start = -1, stack = [], quoted = false, escaped = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (start === -1) {
      if (char === '[' || char === '{') { start = i; stack = [char]; quoted = false; escaped = false; }
      continue;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '[' || char === '{') stack.push(char);
    else if (char === ']' || char === '}') {
      if (stack.pop() !== (char === ']' ? '[' : '{')) throw new Error('Ngoặc JSON không khớp. Hãy dán lại nguyên mảng JSON.');
      if (!stack.length) { containers.push(content.slice(start, i + 1)); start = -1; }
    }
  }
  if (start !== -1) throw new Error('JSON chưa đóng đủ ngoặc hoặc dấu nháy. Hãy copy toàn bộ kết quả từ AI.');
  return containers;
}

// Does a quote followed by `rest` end the string, given its container and role?
function closesString(rest, container, isKey, inner) {
  const next = rest.trimStart();
  if (next[0] === '}' || next[0] === ']') return true;
  const after = next.slice(1);
  if (next[0] === ':') return isKey && /^\s*(?:["[{\d-]|(?:true|false|null)\b)/.test(after);
  if (next[0] !== ',') return false;
  if (/^[ \t]*[\r\n]/.test(after)) return true;
  if (inner % 2) return false; // inside a quoted phrase, e.g. "a", "b"
  if (/^\s*(?:[[\]{}\d-]|(?:true|false|null)\b)/.test(after)) return true;
  return container === '{' ? /^\s*"[^"\n]*"\s*:/.test(after) : /^\s*"/.test(after);
}

// Returns the input unchanged when a quote cannot be repaired with confidence.
export function repairLooseJson(content) {
  if (typeof content !== 'string') return '';
  const firstBracket = content.indexOf('[');
  const lastBracket = content.lastIndexOf(']');
  let text = firstBracket !== -1 && lastBracket > firstBracket
    ? content.slice(firstBracket, lastBracket + 1)
    : content;
  text = text.replace(/[“”]/g, '"');

  let out = '';
  let inString = false;
  const stack = [];
  let last = ''; // last non-whitespace character outside strings
  let isKey = false;
  let inner = 0; // unescaped quotes found inside the current string
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!inString) {
      if (ch === '"') {
        inString = true;
        isKey = stack.at(-1) === '{' && (last === '{' || last === ',');
        inner = 0;
      } else if (ch === '[' || ch === '{') stack.push(ch);
      else if (ch === ']' || ch === '}') stack.pop();
      if (!/\s/.test(ch)) last = ch;
      out += ch;
      continue;
    }
    if (ch === '\\') {
      if (i + 1 < text.length) {
        const next = text[i + 1];
        if (next === '\r' || next === '\n' || next === '\t') {
          out += '\\\\';
        } else {
          out += ch + next;
          i++;
        }
      } else {
        out += '\\\\';
      }
      continue;
    }
    if (ch === '\r') {
      if (text[i + 1] === '\n') i++;
      out += '\\n';
      continue;
    }
    if (ch === '\n') {
      out += '\\n';
      continue;
    }
    if (ch === '\t') {
      out += '\\t';
      continue;
    }
    if (ch === '"') {
      const rest = text.slice(i + 1);
      if (closesString(rest, stack.at(-1), isKey, inner)) {
        // Inner quotes must come in pairs; otherwise strings may have been split.
        if (inner % 2) return content;
        inString = false;
        last = '"';
        out += '"';
      } else {
        // An opening quote followed by a space, comma or colon is more likely a
        // real delimiter: escaping it could merge fields, so give up.
        if (inner % 2 === 0 && /^[\s,:]/.test(rest)) return content;
        inner++;
        out += '\\"';
      }
      continue;
    }
    out += ch;
  }

  let cleaned = '';
  inString = false;
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    if (inString) {
      cleaned += ch;
      if (ch === '\\' && i + 1 < out.length) {
        cleaned += out[++i];
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      cleaned += ch;
      continue;
    }
    if (ch === ',') {
      let j = i + 1;
      while (j < out.length && /\s/.test(out[j])) j++;
      if (out[j] === '}' || out[j] === ']') continue;
    }
    cleaned += ch;
  }
  return cleaned;
}

function formatJsonErrorContext(source, errorMessage) {
  const match = String(errorMessage || '').match(/\bposition\s+(\d+)/i);
  if (!match) {
    // "Unexpected token" messages carry a quoted excerpt instead of a position.
    const excerpt = String(errorMessage || '').match(/, (?:\.\.\.)?"([\s\S]*)"(?:\.\.\.)? is not valid JSON/);
    return excerpt ? ` Lỗi gần: "…${excerpt[1].replace(/[\r\n\t]+/g, ' ')}…"` : '';
  }
  if (typeof source !== 'string' || !source.length) return '';
  const pos = Number(match[1]);
  if (!Number.isFinite(pos) || pos < 0) return '';
  const half = 30;
  const start = Math.max(0, pos - half);
  const end = Math.min(source.length, pos + half);
  const snippet = source.slice(start, end).replace(/[\r\n\t]+/g, ' ');
  const prefix = start > 0 ? '…' : '';
  const suffix = end < source.length ? '…' : '';
  return ` Lỗi gần: "${prefix}${snippet}${suffix}"`;
}

function parseGrammarInputDetailed(input) {
  const raw = input.trim();
  if (!raw) throw new Error('Chưa có JSON. Hãy dán kết quả từ AI.');
  const fenced = raw.match(/^```(?:json)?\s*\n?([\s\S]*?)\s*```$/i);
  const content = fenced ? fenced[1].trim() : raw;
  try {
    return { parsed: JSON.parse(content), repaired: false };
  } catch (directError) {
    let containers = null;
    let scanError = null;
    try {
      containers = scanJsonContainers(content);
    } catch (err) {
      scanError = err;
    }

    if (containers && containers.length > 1) {
      throw new Error('Có nhiều khối JSON; không thể xác định bộ câu cần nhập. Chỉ dán một mảng JSON.');
    }
    if (containers && containers.length === 1) {
      try {
        const parsed = JSON.parse(containers[0]);
        if (!Array.isArray(parsed)) throw new Error('Khối tìm thấy là object, không phải mảng.');
        return { parsed, repaired: false };
      } catch (containerError) {
        if (containerError.message === 'Khối tìm thấy là object, không phải mảng.') throw containerError;
        const repairedText = repairLooseJson(content);
        try {
          const parsed = JSON.parse(repairedText);
          if (Array.isArray(parsed)) return { parsed, repaired: true };
        } catch { /* fall through to error with context */ }
        const context = formatJsonErrorContext(containers[0], containerError.message);
        throw new Error(`Khối JSON tìm thấy chưa hợp lệ: ${containerError.message}${context} Kiểm tra dấu nháy kép, dấu phẩy và ngoặc; không dùng comment hoặc dấu phẩy cuối.`);
      }
    }

    if (content.includes('[') && content.includes(']')) {
      const repairedText = repairLooseJson(content);
      try {
        const parsed = JSON.parse(repairedText);
        if (Array.isArray(parsed)) return { parsed, repaired: true };
      } catch (repairError) {
        if (scanError) {
          const context = formatJsonErrorContext(content, directError.message) || formatJsonErrorContext(repairedText, repairError.message);
          throw new Error(`${scanError.message}${context}`);
        }
        const context = formatJsonErrorContext(repairedText, repairError.message) || formatJsonErrorContext(content, directError.message);
        throw new Error(`Khối JSON tìm thấy chưa hợp lệ: ${repairError.message}${context} Kiểm tra dấu nháy kép, dấu phẩy và ngoặc; không dùng comment hoặc dấu phẩy cuối.`);
      }
    }

    if (scanError) {
      const context = formatJsonErrorContext(content, directError.message);
      throw new Error(`${scanError.message}${context}`);
    }
    throw new Error('Không tìm thấy một mảng JSON rõ ràng. Hãy dán mảng bắt đầu bằng [ và kết thúc bằng ].');
  }
}

export function parseGrammarInput(input) {
  return parseGrammarInputDetailed(input).parsed;
}

export function formatGrammarIssue(issue) {
  const location = issue.sentence ? `Câu ${issue.sentence} · ${issue.field}` : issue.field;
  const value = issue.value === undefined ? '' : ` · ${JSON.stringify(issue.value).slice(0, 220)}`;
  return `${location}${value}: ${issue.reason}${issue.suggestion ? ` ${issue.suggestion}` : ''}`;
}

export function prepareGrammarImport(input, config = {}) {
  const result = { questions: [], errors: [], optionalIssues: [], duplicates: [], normalizations: [], config };
  let parsed;
  let repaired = false;
  try { ({ parsed, repaired } = parseGrammarInputDetailed(input)); } catch (error) {
    result.errors.push({ field: 'JSON', reason: error.message }); return result;
  }
  if (repaired) {
    result.normalizations.push({ field: 'JSON', reason: 'Đã tự sửa dấu nháy/dấu phẩy trong JSON' });
  }
  if (!Array.isArray(parsed) || !parsed.length) {
    result.errors.push({ field: 'JSON', reason: 'Cần một mảng không rỗng chứa các câu phân tích.' }); return result;
  }
  if (config.count && parsed.length !== config.count) result.errors.push({ field: 'Số câu', reason: `Cần ${config.count} câu, hiện có ${parsed.length}.` });
  const recent = new Set((config.recentSentences || []).map(sentenceKey));
  const inBatch = new Set();
  result.questions = parsed.map((original, index) => {
    const addError = (field, value, reason, suggestion) => result.errors.push({ sentence: index + 1, field, value, reason, suggestion });
    if (!original || typeof original !== 'object' || Array.isArray(original)) { addError('item', original, 'Mỗi câu phải là object.'); return original; }
    const q = { ...original };
    if (q.schemaVersion !== 2) addError('schemaVersion', q.schemaVersion, 'Giá trị bắt buộc là số 2.');
    if (q.type !== 'sentence-analysis') addError('type', q.type, 'Giá trị bắt buộc là "sentence-analysis".');
    for (const field of ['sentence', 'vietnameseSentence', 'topic']) {
      if (typeof q[field] !== 'string' || !q[field].trim()) addError(field, q[field], 'Cần chuỗi không rỗng.');
    }
    if (typeof q.sentence !== 'string' || !q.sentence.trim()) return q;
    if (/_{2,}|\[(?:blank|gap)\]|\.{3}|…/i.test(q.sentence)) addError('sentence', q.sentence, 'Cần câu hoàn chỉnh, không có chỗ trống hoặc lược bỏ.');
    for (const field of ['options', 'answer', 'optionLabels']) if (field in q) addError(field, q[field], 'Không dùng trường trắc nghiệm trong phân tích câu.');
    if (!GRAMMAR_TOPICS.includes(q.topic)) addError('topic', q.topic, 'Không thuộc danh sách chủ đề.', 'Dùng đúng khóa chủ đề trong prompt.');
    if (config.topic && config.topic !== 'Mixed' && q.topic !== config.topic) addError('topic', q.topic, `Chủ đề chính phải là "${config.topic}".`);
    const normalizeQuote = (item, key, path, optional, readingIndex) => {
      const match = matchGrammarSubstring(q.sentence, item[key]);
      if (match.error) {
        const issue = { sentence: index + 1, field: path, value: item[key], reason: match.error, suggestion: match.suggestion };
        if (optional) result.optionalIssues.push({ ...issue, key: `${index}:${readingIndex}`, questionIndex: index, readingIndex });
        else result.errors.push(issue);
      } else if (match.text !== item[key]) {
        result.normalizations.push({ sentence: index + 1, field: path, before: item[key], after: match.text });
        item[key] = match.text;
      }
    };
    if (!Array.isArray(q.grammarPoints) || !q.grammarPoints.length) addError('grammarPoints', q.grammarPoints, 'Cần mảng phân tích ngữ pháp không rỗng.');
    else {
      q.grammarPoints = q.grammarPoints.map((point, p) => {
        const path = `grammarPoints[${p + 1}]`;
        if (!point || typeof point !== 'object' || Array.isArray(point)) { addError(path, point, 'Cần object gồm category, phrase và explanation.'); return point; }
        const copy = { ...point };
        if (!GRAMMAR_TOPICS.includes(copy.category)) addError(`${path}.category`, copy.category, 'Category phải là một khóa chủ đề trong prompt.');
        if (typeof copy.explanation !== 'string' || !copy.explanation.trim()) addError(`${path}.explanation`, copy.explanation, 'Cần giải thích tiếng Việt không rỗng.');
        normalizeQuote(copy, 'phrase', `${path}.phrase`, false);
        return copy;
      });
      if (q.topic !== 'Mixed' && !q.grammarPoints.some(p => p?.category === q.topic)) addError('grammarPoints', q.topic, 'Thiếu điểm phân tích cho chủ đề chính.');
    }
    for (const field of ['structures', 'readingNotes']) {
      if (q[field] !== undefined && (!Array.isArray(q[field]) || q[field].some(s => typeof s !== 'string' || !s.trim()))) addError(field, q[field], 'Cần mảng các chuỗi không rỗng.');
    }
    if (q.readingItems !== undefined) {
      if (!Array.isArray(q.readingItems)) result.optionalIssues.push({ sentence: index + 1, field: 'readingItems', value: q.readingItems, reason: 'Cần một mảng mục đọc hiểu.', suggestion: 'Sửa thành mảng hoặc xác nhận loại riêng trường tùy chọn này.', key: `${index}:all`, questionIndex: index, readingIndex: null });
      else q.readingItems = q.readingItems.map((item, r) => {
        const copy = item && typeof item === 'object' && !Array.isArray(item) ? { ...item } : item;
        const path = `readingItems[${r + 1}]`;
        const before = result.optionalIssues.length;
        if (copy && typeof copy === 'object' && !Array.isArray(copy)) normalizeQuote(copy, 'text', `${path}.text`, true, r);
        const error = validateReadingItem(copy, q.sentence);
        if (error && result.optionalIssues.length === before) {
          const field = !copy || typeof copy !== 'object' || Array.isArray(copy) ? path
            : !Object.hasOwn(READING_ITEM_LABELS, copy.category) ? `${path}.category`
              : `${path}.${['explanation', 'meaning', 'usefulness', 'pattern'].find(k => (k === 'explanation' || copy[k] !== undefined) && (typeof copy[k] !== 'string' || !copy[k].trim())) || 'text'}`;
          result.optionalIssues.push({ sentence: index + 1, field, value: copy?.text ?? copy, reason: error, suggestion: 'Sửa mục này hoặc xác nhận loại riêng mục tùy chọn.', key: `${index}:${r}`, questionIndex: index, readingIndex: r });
        }
        return copy;
      });
    }
    const key = sentenceKey(q.sentence);
    if (inBatch.has(key)) addError('sentence', q.sentence, 'Câu bị trùng trong cùng bộ JSON.', 'Yêu cầu AI thay câu trùng; không tự xóa câu khỏi bộ.');
    inBatch.add(key);
    if (recent.has(key)) result.duplicates.push({ sentence: index + 1, text: q.sentence });
    return q;
  });
  return result;
}

export function completeGrammarImport(result, { excludedItems = [], allowDuplicates = false } = {}) {
  if (result.errors.length) return { valid: false, errors: result.errors.map(formatGrammarIssue) };
  if (result.optionalIssues.some(issue => !excludedItems.includes(issue.key))) return { valid: false, errors: ['Cần xác nhận từng mục đọc hiểu lỗi trước khi loại nội dung.'] };
  if (result.duplicates.length && !allowDuplicates) return { valid: false, errors: ['Có câu trùng với kho Grammar hiện tại. Sửa JSON hoặc xác nhận vẫn muốn luyện.'] };
  const questions = result.questions.map((q, i) => {
    const issues = result.optionalIssues.filter(issue => issue.questionIndex === i);
    if (!issues.length) return q;
    return { ...q, readingItems: issues.some(issue => issue.readingIndex === null) ? [] : q.readingItems.filter((_, r) => !issues.some(issue => issue.readingIndex === r)) };
  });
  const check = validateGrammarJSON(questions, result.config);
  return check.valid ? { valid: true, questions: normalizeQuestions(questions) } : check;
}
