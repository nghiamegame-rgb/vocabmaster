/* eslint-disable no-unused-vars -- Apps Script invokes doGet/doPost from the web app deployment. */
/**
 * VocabMaster — Dictation Backend (Google Apps Script, V8 runtime)
 * =================================================================
 * Dán TOÀN BỘ file này vào một dự án Apps Script gắn với spreadsheet riêng cho
 * chép chính tả. Hướng dẫn từng bước: docs/DICTATION-SETUP.md.
 *
 * Tabs (tự tạo ở lần ghi đầu; hàng 1 là tiêu đề tiếng Việt):
 *   "Từ vựng"         → mỗi hàng 1 từ đã lưu (kể cả từ đã xoá, ghi "Đã xoá")
 *   "Câu hoàn chỉnh"  → mỗi hàng 1 câu của các bài (kể cả câu đã xoá)
 *   "Meta"            → B1 revision, B2 lần ghi cuối, B3 cờ "đang ghi", B4 schema
 *   "Sao lưu"         → bản sao trước mỗi lần ghi (revision cũ + JSON từng hàng)
 * Cột cuối mỗi hàng ("Dữ liệu (JSON)") là dữ liệu thật; các cột khác chỉ để đọc.
 * ĐỪNG sửa tay cột JSON. Sửa các cột khác cũng không có tác dụng (bị ghi đè).
 *
 * An toàn dữ liệu (giống backend Grammar/Structures):
 *   1. Secret BẮT BUỘC: Script Property DICTATION_SYNC_SECRET (cùng giá trị với
 *      biến môi trường Vercel DICTATION_SYNC_SECRET). Chưa đặt → từ chối mọi yêu cầu.
 *   2. LockService: mọi đọc/ghi lần lượt.
 *   3. Compare-And-Swap: chỉ ghi khi expectedRevision === revision hiện tại.
 *   4. Không mất dữ liệu: bản gửi lên phải chứa mọi bản ghi đang có trên Sheet
 *      (kể cả tombstone đã xoá) — thiết bị cũ không thể xoá hay hồi sinh dữ liệu.
 *   5. Sao lưu trước khi ghi; lỗi giữa chừng thì khôi phục, cờ "đang ghi" chặn đọc
 *      nếu bị ngắt đột ngột.
 */

var DICT_SHEET_WORDS = 'Từ vựng';
var DICT_SHEET_SENTENCES = 'Câu hoàn chỉnh';
var DICT_SHEET_META = 'Meta';
var DICT_SHEET_BACKUP = 'Sao lưu';
var DICT_SCHEMA = 1;
var DICT_LOCK_TIMEOUT_MS = 10000;
var DICT_MAX_RECORDS = 20000;
var DICT_MAX_JSON_CHARS = 45000;
var DICT_COLS = 10;

var DICT_WORD_HEADERS = ['Từ', 'Câu gốc', 'Tên bài', 'Ngày lưu', 'Nghe đúng', 'Nghe sai', 'Trạng thái', 'Cập nhật', 'ID', 'Dữ liệu (JSON – không sửa tay)'];
var DICT_SENTENCE_HEADERS = ['Tên bài', 'Thứ tự', 'Câu tiếng Anh', 'Bản dịch tiếng Việt', 'Kết quả gần nhất', 'Số lần thử', 'Trạng thái', 'Cập nhật', 'ID', 'Dữ liệu (JSON – không sửa tay)'];

// ── Auth ──────────────────────────────────────────────────────────────────────

function dictCheckAuth(e, payload) {
  var required = PropertiesService.getScriptProperties().getProperty('DICTATION_SYNC_SECRET');
  if (!required) return { ok: false, error: 'unauthorized', message: 'Script Property DICTATION_SYNC_SECRET is not configured.' };
  var provided = (payload && payload.secret) || (e && e.parameter && e.parameter.secret);
  if (!provided || provided !== required) return { ok: false, error: 'unauthorized', message: 'Missing or invalid sync secret.' };
  return { ok: true };
}

// ── Validation + merge (same rules as src/utils/dictationSyncMerge.js) ───────

function dictIsStr(v, max, min) { return typeof v === 'string' && v.length >= (min || 0) && v.length <= max; }
function dictIsTime(v) { return typeof v === 'number' && isFinite(v) && v >= 0; }
function dictIsCount(v) { return typeof v === 'number' && Math.floor(v) === v && v >= 0; }
function dictIsObj(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }

function dictCounterError(map, nested) {
  if (!dictIsObj(map)) return 'counters must be an object';
  var keys = Object.keys(map);
  for (var i = 0; i < keys.length; i++) {
    var value = map[keys[i]];
    if (!dictIsStr(keys[i], 100, 1)) return 'bad device id';
    if (nested) {
      if (!dictIsObj(value) || !dictIsCount(value.correct === undefined ? 0 : value.correct) || !dictIsCount(value.wrong === undefined ? 0 : value.wrong)) return 'bad listen counter';
    } else if (!dictIsCount(value)) return 'bad counter';
  }
  return '';
}

function dictValidateSentence(s) {
  if (!dictIsObj(s)) return 'sentence must be an object';
  if (!dictIsStr(s.id, 120, 1) || !dictIsStr(s.lessonId, 100, 1)) return 'bad id';
  if (!dictIsStr(s.lessonTitle, 200) || !dictIsStr(s.english, 2000, 1) || !dictIsStr(s.vietnamese === undefined || s.vietnamese === null ? '' : s.vietnamese, 2000)) return 'bad text';
  if (!dictIsCount(s.order) || !dictIsTime(s.createdAt) || !dictIsTime(s.updatedAt)) return 'bad order/time';
  if (s.deletedAt !== undefined && s.deletedAt !== null && !dictIsTime(s.deletedAt)) return 'bad deletedAt';
  if ([undefined, null, 'correct', 'wrong'].indexOf(s.lastResult) === -1) return 'bad lastResult';
  if (s.lastResultAt !== undefined && !dictIsTime(s.lastResultAt)) return 'bad lastResultAt';
  if (s.attempts !== undefined) return dictCounterError(s.attempts, false);
  return '';
}

function dictValidateWord(w) {
  if (!dictIsObj(w)) return 'word must be an object';
  if (!dictIsStr(w.id, 100, 1) || !dictIsStr(w.word, 100, 1)) return 'bad word';
  var opt = function (v) { return v === undefined || v === null ? '' : v; };
  if (!dictIsStr(opt(w.sentenceId), 120) || !dictIsStr(opt(w.sentence), 2000) || !dictIsStr(opt(w.lessonTitle), 200)) return 'bad source';
  if (!dictIsTime(w.savedAt) || !dictIsTime(w.updatedAt)) return 'bad time';
  if (w.deletedAt !== undefined && w.deletedAt !== null && !dictIsTime(w.deletedAt)) return 'bad deletedAt';
  if (w.listen !== undefined) return dictCounterError(w.listen, true);
  return '';
}

function dictValidateData(data) {
  if (!dictIsObj(data) || !Array.isArray(data.sentences) || !Array.isArray(data.words)) return 'data must have sentences and words arrays';
  if (data.sentences.length > DICT_MAX_RECORDS || data.words.length > DICT_MAX_RECORDS) return 'too many records';
  var i, e;
  for (i = 0; i < data.sentences.length; i++) { e = dictValidateSentence(data.sentences[i]); if (e) return e; }
  for (i = 0; i < data.words.length; i++) { e = dictValidateWord(data.words[i]); if (e) return e; }
  if (new Set(data.sentences.map(function (s) { return s.id; })).size !== data.sentences.length) return 'duplicate sentence id';
  if (new Set(data.words.map(function (w) { return w.id; })).size !== data.words.length) return 'duplicate word id';
  return '';
}

function dictCanonicalJson(value) {
  function canon(v) {
    if (Array.isArray(v)) return v.map(canon);
    if (v && typeof v === 'object') {
      var out = {};
      Object.keys(v).sort().forEach(function (k) { if (v[k] !== undefined && v[k] !== null) out[k] = canon(v[k]); });
      return out;
    }
    return v;
  }
  return JSON.stringify(canon(value));
}

var DICT_SENTENCE_CONTENT = ['id', 'lessonId', 'lessonTitle', 'order', 'english', 'vietnamese', 'createdAt', 'updatedAt', 'deletedAt'];
var DICT_WORD_CONTENT = ['id', 'word', 'sentenceId', 'sentence', 'lessonTitle', 'savedAt', 'updatedAt', 'deletedAt'];

function dictPick(record, fields) {
  var out = {};
  fields.forEach(function (f) { if (record[f] !== undefined && record[f] !== null) out[f] = record[f]; });
  return out;
}

function dictNewerContent(a, b, fields) {
  var ca = dictPick(a, fields), cb = dictPick(b, fields);
  var ua = a.updatedAt || 0, ub = b.updatedAt || 0;
  if (ua !== ub) return ua > ub ? ca : cb;
  return dictCanonicalJson(ca) >= dictCanonicalJson(cb) ? ca : cb;
}

function dictUnionKeys(a, b) {
  var seen = {}, keys = [];
  Object.keys(a || {}).concat(Object.keys(b || {})).forEach(function (k) { if (!seen[k]) { seen[k] = true; keys.push(k); } });
  return keys;
}

function dictMergeSentence(a, b) {
  if (!a) a = b; if (!b) b = a;
  var merged = dictNewerContent(a, b, DICT_SENTENCE_CONTENT);
  var ra = a.lastResultAt || 0, rb = b.lastResultAt || 0;
  var result = ra !== rb ? (ra > rb ? a : b) : (String(a.lastResult || '') >= String(b.lastResult || '') ? a : b);
  if (result.lastResult) { merged.lastResult = result.lastResult; merged.lastResultAt = result.lastResultAt || 0; }
  var attempts = {};
  dictUnionKeys(a.attempts, b.attempts).forEach(function (k) {
    attempts[k] = Math.max((a.attempts || {})[k] || 0, (b.attempts || {})[k] || 0);
  });
  if (Object.keys(attempts).length) merged.attempts = attempts;
  return merged;
}

function dictMergeWord(a, b) {
  if (!a) a = b; if (!b) b = a;
  var merged = dictNewerContent(a, b, DICT_WORD_CONTENT);
  var listen = {};
  dictUnionKeys(a.listen, b.listen).forEach(function (k) {
    var x = (a.listen || {})[k] || {}, y = (b.listen || {})[k] || {};
    listen[k] = { correct: Math.max(x.correct || 0, y.correct || 0), wrong: Math.max(x.wrong || 0, y.wrong || 0) };
  });
  if (Object.keys(listen).length) merged.listen = listen;
  return merged;
}

function dictMergeList(local, remote, mergeOne, order) {
  var map = {}, ids = [];
  (remote || []).concat(local || []).forEach(function (r) {
    if (Object.prototype.hasOwnProperty.call(map, r.id)) map[r.id] = mergeOne(map[r.id], r);
    else { map[r.id] = mergeOne(null, r); ids.push(r.id); }
  });
  return ids.map(function (id) { return map[id]; }).sort(order);
}

function dictCmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function dictSentenceOrder(a, b) { return (a.createdAt - b.createdAt) || dictCmp(a.lessonId, b.lessonId) || (a.order - b.order) || dictCmp(a.id, b.id); }
function dictWordOrder(a, b) { return (a.savedAt - b.savedAt) || dictCmp(a.id, b.id); }

function dictMergeData(local, remote) {
  local = local || {}; remote = remote || {};
  return {
    sentences: dictMergeList(local.sentences, remote.sentences, dictMergeSentence, dictSentenceOrder),
    words: dictMergeList(local.words, remote.words, dictMergeWord, dictWordOrder),
  };
}

// ── Sheet helpers ────────────────────────────────────────────────────────────

function dictEnsureSheet(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

/** Text that Sheets would treat as a formula is written as plain text. */
function dictText(value) {
  var s = value === undefined || value === null ? '' : String(value);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function dictDate(ms) {
  if (!ms) return '';
  var date = new Date(ms);
  try {
    if (typeof Utilities !== 'undefined' && typeof Session !== 'undefined') {
      return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    }
  } catch { /* fall back to ISO */ }
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function dictSum(map, field) {
  return Object.keys(map || {}).reduce(function (sum, k) {
    var v = field ? (map[k] || {})[field] : map[k];
    return sum + (Number(v) || 0);
  }, 0);
}

function dictWordRow(w) {
  return [dictText(w.word), dictText(w.sentence), dictText(w.lessonTitle), dictDate(w.savedAt),
    dictSum(w.listen, 'correct'), dictSum(w.listen, 'wrong'), w.deletedAt ? 'Đã xoá' : 'Đang dùng',
    dictDate(w.updatedAt), dictText(w.id), JSON.stringify(w)];
}

function dictSentenceRow(s) {
  var result = s.lastResult === 'correct' ? 'Đúng' : s.lastResult === 'wrong' ? 'Sai' : 'Chưa làm';
  return [dictText(s.lessonTitle), s.order + 1, dictText(s.english), dictText(s.vietnamese), result,
    dictSum(s.attempts), s.deletedAt ? 'Đã xoá' : 'Đang dùng', dictDate(Math.max(s.updatedAt || 0, s.lastResultAt || 0)),
    dictText(s.id), JSON.stringify(s)];
}

function dictReadRecords(sheet, validate) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var values = sheet.getRange(2, DICT_COLS, last - 1, 1).getValues();
  var records = [];
  for (var i = 0; i < values.length; i++) {
    var raw = values[i][0];
    if (raw === '' || raw === null) continue; // blank row: clients still hold the record
    var record = JSON.parse(raw); // corrupt JSON aborts the read instead of losing the row
    var error = validate(record);
    if (error) throw new Error('Row ' + (i + 2) + ' of ' + sheet.getName() + ': ' + error);
    records.push(record);
  }
  return records;
}

function dictWriteRows(sheet, headers, rows) {
  sheet.getRange(1, 1, 1, DICT_COLS).setValues([headers]);
  if (rows.length) sheet.getRange(2, 1, rows.length, DICT_COLS).setValues(rows);
  var last = sheet.getLastRow();
  if (last > rows.length + 1) sheet.getRange(rows.length + 2, 1, last - rows.length - 1, DICT_COLS).clearContent();
}

function dictReadAll(ss) {
  var meta = dictEnsureSheet(ss, DICT_SHEET_META);
  if (meta.getRange(3, 2).getValue()) {
    throw { dictError: 'interrupted', message: 'A previous write was interrupted. Restore from sheet "' + DICT_SHEET_BACKUP + '" and clear Meta!B3.' };
  }
  var data = {
    sentences: dictReadRecords(dictEnsureSheet(ss, DICT_SHEET_SENTENCES), dictValidateSentence),
    words: dictReadRecords(dictEnsureSheet(ss, DICT_SHEET_WORDS), dictValidateWord),
  };
  var problem = dictValidateData(data);
  if (problem) throw new Error(problem);
  return { data: data, revision: Number(meta.getRange(1, 2).getValue()) || 0, meta: meta };
}

function dictResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function dictErrorResponse(err) {
  if (err && err.dictError) return dictResponse({ ok: false, error: err.dictError, message: err.message });
  return dictResponse({ ok: false, error: 'server_error', message: 'Dictation backend error. Check the Apps Script executions log.' });
}

// ── GET: read everything ─────────────────────────────────────────────────────

function doGet(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(DICT_LOCK_TIMEOUT_MS)) return dictResponse({ ok: false, error: 'busy' });
  try {
    var auth = dictCheckAuth(e, null);
    if (!auth.ok) return dictResponse(auth);
    var cloud = dictReadAll(SpreadsheetApp.getActiveSpreadsheet());
    return dictResponse({ ok: true, schema: DICT_SCHEMA, revision: cloud.revision, sentences: cloud.data.sentences, words: cloud.data.words });
  } catch (err) {
    return dictErrorResponse(err);
  } finally {
    lock.releaseLock();
  }
}

// ── POST: save (CAS, superset check, backup, journal) ────────────────────────

function doPost(e) {
  var payload;
  try { payload = JSON.parse(e && e.postData && e.postData.contents || '{}'); }
  catch { return dictResponse({ ok: false, error: 'invalid_json' }); }
  var auth = dictCheckAuth(e, payload);
  if (!auth.ok) return dictResponse(auth);
  if (payload.action !== 'save' || payload.schema !== DICT_SCHEMA
      || typeof payload.expectedRevision !== 'number' || Math.floor(payload.expectedRevision) !== payload.expectedRevision || payload.expectedRevision < 0) {
    return dictResponse({ ok: false, error: 'validation', message: 'Unsupported action/schema or bad expectedRevision.' });
  }
  var incoming = { sentences: payload.sentences, words: payload.words };
  var problem = dictValidateData(incoming);
  if (problem) return dictResponse({ ok: false, error: 'validation', message: problem });
  var tooLarge = incoming.sentences.concat(incoming.words).some(function (r) { return JSON.stringify(r).length > DICT_MAX_JSON_CHARS; });
  if (tooLarge) return dictResponse({ ok: false, error: 'too_large' });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(DICT_LOCK_TIMEOUT_MS)) return dictResponse({ ok: false, error: 'busy' });
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cloud = dictReadAll(ss);
    if (payload.expectedRevision !== cloud.revision) {
      return dictResponse({ ok: false, error: 'conflict', serverRevision: cloud.revision });
    }
    // The client must send a merge that already contains every cloud record.
    var normalized = dictMergeData(incoming, {});
    if (dictCanonicalJson(dictMergeData(incoming, cloud.data)) !== dictCanonicalJson(normalized)) {
      return dictResponse({ ok: false, error: 'conflict', serverRevision: cloud.revision, message: 'Payload is missing or older than cloud records.' });
    }

    // Backup the current state before touching the data sheets.
    var backup = dictEnsureSheet(ss, DICT_SHEET_BACKUP);
    backup.clearContents();
    var backupRows = [[new Date().toISOString(), 'revision ' + cloud.revision]];
    cloud.data.sentences.forEach(function (s) { backupRows.push(['sentence', JSON.stringify(s)]); });
    cloud.data.words.forEach(function (w) { backupRows.push(['word', JSON.stringify(w)]); });
    backup.getRange(1, 1, backupRows.length, 2).setValues(backupRows);

    var sentenceSheet = dictEnsureSheet(ss, DICT_SHEET_SENTENCES);
    var wordSheet = dictEnsureSheet(ss, DICT_SHEET_WORDS);
    var meta = cloud.meta;
    var revision = cloud.revision + 1;
    meta.getRange(3, 1, 1, 2).setValues([['Đang ghi (đừng sửa)', 'dictation-write-in-progress']]);
    SpreadsheetApp.flush();
    try {
      dictWriteRows(sentenceSheet, DICT_SENTENCE_HEADERS, normalized.sentences.map(dictSentenceRow));
      dictWriteRows(wordSheet, DICT_WORD_HEADERS, normalized.words.map(dictWordRow));
      meta.getRange(1, 1, 2, 2).setValues([['Revision', revision], ['Cập nhật lần cuối', new Date().toISOString()]]);
      meta.getRange(4, 1, 1, 2).setValues([['Schema', DICT_SCHEMA]]);
      SpreadsheetApp.flush();
      meta.getRange(3, 2).clearContent();
      SpreadsheetApp.flush();
    } catch (writeError) {
      // Restore the previous rows; keep the journal if this fails too.
      dictWriteRows(sentenceSheet, DICT_SENTENCE_HEADERS, cloud.data.sentences.map(dictSentenceRow));
      dictWriteRows(wordSheet, DICT_WORD_HEADERS, cloud.data.words.map(dictWordRow));
      meta.getRange(1, 2).setValue(cloud.revision);
      SpreadsheetApp.flush();
      meta.getRange(3, 2).clearContent();
      SpreadsheetApp.flush();
      throw writeError;
    }
    return dictResponse({ ok: true, schema: DICT_SCHEMA, revision: revision, writtenSentences: normalized.sentences.length, writtenWords: normalized.words.length });
  } catch (err) {
    return dictErrorResponse(err);
  } finally {
    lock.releaseLock();
  }
}
