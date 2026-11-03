/* eslint-disable no-unused-vars -- Apps Script invokes these globals from deployments/editor. */
/** Vocabulary protocol 1 ONLY. See docs/VOCABULARY-RECOVERY.md.
 * Immutable Drive snapshots are authoritative; first Sheet is a readable mirror.
 * Script Property VOCAB_HEAD points to the committed snapshot file. Old files
 * are retained as backups. Never edit snapshots or delete them during recovery.
 * All reads, commits, pauses and recovery share the same ScriptLock.
 */
var HEADERS = ['id', 'english', 'vietnamese', 'imageUrl', 'wordType', 'level', 'currentStreak', 'createdAt', 'lastReviewedDate', 'annotation'];
function vocabLocked(work) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('busy');
  try { return work(); } finally { lock.releaseLock(); }
}
function vocabProps() { return PropertiesService.getScriptProperties(); }
function vocabPaused() { return vocabProps().getProperty('VOCAB_WRITES_ENABLED') !== 'true'; }
function vocabAuth(secret) {
  var expected = vocabProps().getProperty('VOCAB_SYNC_SECRET');
  if (!expected || secret !== expected) throw new Error('unauthorized');
}
function vocabValidate(s) {
  if (!s || s.protocol !== 1 || typeof s.generation !== 'string' || !s.generation || !Number.isSafeInteger(s.revision) || s.revision < 0
      || !Array.isArray(s.words) || !Array.isArray(s.tombstones) || s.words.length + s.tombstones.length > 20000) throw new Error('invalid_snapshot');
  var ids = new Set();
  s.words.forEach(function(w) {
    if (!w || typeof w.id !== 'string' || !w.id || ids.has(w.id) || typeof w.english !== 'string' || !w.english.trim()
        || typeof w.vietnamese !== 'string' || JSON.stringify(w).length > 45000) throw new Error('invalid_word');
    ['annotation', 'imageUrl', 'wordType'].forEach(function(k) { if (w[k] !== undefined && typeof w[k] !== 'string') throw new Error('invalid_field'); });
    ['level', 'currentStreak', 'createdAt', 'lastReviewedDate'].forEach(function(k) { if (w[k] != null && (!Number.isFinite(w[k]) || w[k] < 0)) throw new Error('invalid_number'); });
    if (w.level !== undefined && (!Number.isInteger(w.level) || w.level < 1 || w.level > 5)) throw new Error('invalid_level');
    ids.add(w.id);
  });
  s.tombstones.forEach(function(id) {
    if (typeof id !== 'string' || !id || ids.has(id)) throw new Error('invalid_tombstone');
    ids.add(id);
  });
  return s;
}
function vocabRead() {
  var id = vocabProps().getProperty('VOCAB_HEAD');
  if (!id) throw new Error('recovery_required');
  return vocabValidate(JSON.parse(DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8')));
}
function vocabMirror(s) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  // Text prefix prevents spreadsheet formula evaluation; canonical JSON is untouched.
  var rows = [HEADERS].concat(s.words.map(function(w) { return HEADERS.map(function(k) {
    var v = w[k] == null ? '' : w[k]; return typeof v === 'string' ? "'" + v : v;
  }); }));
  var count = Math.max(sheet.getLastRow(), rows.length);
  while (rows.length < count) rows.push(HEADERS.map(function() { return ''; }));
  sheet.getRange(1, 1, rows.length, HEADERS.length).setValues(rows);
  SpreadsheetApp.flush();
}
function vocabCommit(s) {
  vocabValidate(s);
  // Durable immutable backup before touching the mirror or commit pointer.
  var text = JSON.stringify(s);
  var file = DriveApp.createFile('Vocabulary-' + s.generation + '-r' + s.revision + '.json', text, 'application/json');
  if (file.getBlob().getDataAsString('UTF-8') !== text) throw new Error('snapshot_verification_failed');
  vocabMirror(s);
  vocabProps().setProperty('VOCAB_HEAD', file.getId()); // sole commit point
  return s;
}
function doGet(e) {
  try { return buildResponse(vocabLocked(function() {
    vocabAuth(e && e.parameter && e.parameter.secret);
    return Object.assign({}, vocabRead(), { ok: true, paused: vocabPaused() });
  })); } catch (error) { return buildResponse({ ok: false, error: error.message }); }
}
function doPost(e) {
  try { return buildResponse(vocabLocked(function() {
    var p = JSON.parse(e.postData.contents);
    // Unconditionally reject ALL legacy arrays/unversioned requests, even paused.
    if (!p || Array.isArray(p) || p.protocol !== 1) throw new Error('protocol_required');
    vocabAuth(p.secret);
    if (vocabPaused()) throw new Error('paused');
    var current = vocabRead();
    if (p.generation !== current.generation) throw new Error('generation');
    if (p.expectedRevision !== current.revision) throw new Error('conflict');
    if (typeof p.requestId !== 'string' || !p.requestId) throw new Error('request_id');
    var next = vocabValidate({ protocol: 1, generation: current.generation, revision: current.revision + 1,
      requestId: p.requestId, words: p.words, tombstones: p.tombstones });
    if (!next.words.length && p.confirmEmpty !== true) throw new Error('confirm_empty');
    var dead = new Set(next.tombstones), live = new Set(next.words.map(function(w) { return w.id; }));
    current.tombstones.forEach(function(id) { if (!dead.has(id)) throw new Error('lost_tombstone'); });
    current.words.forEach(function(w) { if (!live.has(w.id) && !dead.has(w.id)) throw new Error('missing_deletion'); });
    vocabCommit(next);
    return Object.assign({}, next, { ok: true, paused: false });
  })); } catch (error) { return buildResponse({ ok: false, error: error.message }); }
}
// Editor-only administrative functions. Never exposed through doPost.
function pauseVocabularyWrites() {
  return vocabLocked(function() { vocabProps().setProperty('VOCAB_WRITES_ENABLED', 'false'); });
}
function resumeVocabularyWrites() {
  return vocabLocked(function() { vocabRead(); if (!vocabProps().getProperty('VOCAB_SYNC_SECRET')) throw new Error('secret_required'); vocabProps().setProperty('VOCAB_WRITES_ENABLED', 'true'); });
}
function vocabRecoveryInput() {
  var id = vocabProps().getProperty('VOCAB_RECOVERY_FILE_ID');
  if (!id) throw new Error('clean_snapshot_required');
  var text = DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8');
  var words = JSON.parse(text);
  vocabValidate({ protocol: 1, generation: 'preview', revision: 0, words: words, tombstones: [] });
  var sha = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
  return { words: words, sha256: sha };
}
function previewVocabularyRecovery() {
  var input = vocabRecoveryInput();
  console.log(JSON.stringify({ count: input.words.length, sha256: input.sha256 }));
  return { count: input.words.length, sha256: input.sha256 };
}
function restoreConfirmedVocabulary() {
  return vocabLocked(function() {
    if (!vocabPaused()) throw new Error('pause_first');
    var input = vocabRecoveryInput();
    if (vocabProps().getProperty('VOCAB_CONFIRMED_SHA256') !== input.sha256) throw new Error('confirmation_required');
    var next = { protocol: 1, generation: Utilities.getUuid(), revision: 0, words: input.words, tombstones: [] };
    vocabCommit(next);
    vocabProps().deleteProperty('VOCAB_CONFIRMED_SHA256');
    console.log(JSON.stringify({ generation: next.generation, revision: 0, count: next.words.length }));
    return next;
  });
}
function repairVocabularyMirror() { return vocabLocked(function() { if (!vocabPaused()) throw new Error('pause_first'); vocabMirror(vocabRead()); }); }
function buildResponse(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
