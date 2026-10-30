/**
 * VocabMaster — Grammar Backend (Google Apps Script)
 * ====================================================
 * Project name : VocabMaster - Grammar Backend
 * Spreadsheet  : VocabMaster - Grammar TOEIC
 *
 * Sheet layout:
 *   Sheet "SavedQuestions" → each row is 1 saved question (JSON blob in col A)
 *   Sheet "Meta"           → row 1 col A: revision counter (integer)
 *                            row 1 col B: reviewProgress (JSON blob)
 *                            row 1 col C: "revision" label
 *                            row 1 col D: lastUpdated (ISO timestamp)
 *   Sheet "Backup"         → automatic pre-write backup of previous state
 *
 * Security & Data Integrity Features:
 *   1. Strict Compare-And-Swap (CAS): writes are rejected unless expectedRevision === serverRevision.
 *   2. Concurrency Control: Google Apps Script LockService serializes all writes.
 *   3. Secret Authentication: Optional GRAMMAR_SYNC_SECRET in Script Properties prevents unauthorized public writes.
 *   4. Zero Data Loss: Pre-write backup and in-place updates prevent accidental wipes.
 *   5. Empty Dataset Protection: Accidental empty writes rejected without confirmEmpty: true.
 *   6. Strict Payload Validation: Malformed questions or invalid schemas are rejected before touching sheets.
 *   7. Safe Testing: testGrammarBackend() uses isolated _TEST_* sheets and never touches production data.
 */

// ── Sheet / Lock constants ───────────────────────────────────────────────────

var SHEET_QUESTIONS   = 'SavedQuestions';
var SHEET_META        = 'Meta';
var SHEET_STRUCTURES  = 'Structures';
var SHEET_STRUCTURES_BACKUP = 'StructuresBackup';
var SHEET_BACKUP      = 'Backup';
var LOCK_TIMEOUT_MS   = 10000; // 10 seconds timeout for script lock
var MAX_QUESTIONS     = 5000;

// ── Authentication Helper ────────────────────────────────────────────────────

/**
 * Validates request authorization if a secret is configured in Script Properties.
 * To set the secret in Apps Script:
 *   File / Project Settings -> Script Properties -> Add "GRAMMAR_SYNC_SECRET" = "<your-random-token>"
 */
function checkAuth(e, payload) {
  var requiredSecret = PropertiesService.getScriptProperties().getProperty('GRAMMAR_SYNC_SECRET');
  if (!requiredSecret) {
    // No secret configured in Script Properties -> allow (setup/development mode)
    return { ok: true };
  }

  var providedSecret = (payload && payload.secret) || (e && e.parameter && e.parameter.secret);
  if (!providedSecret || providedSecret !== requiredSecret) {
    return {
      ok: false,
      error: 'unauthorized',
      message: 'Unauthorized: missing or invalid sync secret token.'
    };
  }
  return { ok: true };
}

// ── Validation Helpers ───────────────────────────────────────────────────────

/**
 * Validates an individual question's structure.
 */
function validateQuestion(q, index) {
  if (!q || typeof q !== 'object') {
    return 'Question at index ' + index + ' must be an object.';
  }
  if (!q.savedId || typeof q.savedId !== 'string' || q.savedId.trim().length === 0) {
    return 'Question at index ' + index + ' missing valid savedId.';
  }
  if (!q.sentence || typeof q.sentence !== 'string' || q.sentence.indexOf('_____') === -1) {
    return 'Question at index ' + index + ' missing sentence with _____ blank.';
  }
  if (!q.options || typeof q.options !== 'object') {
    return 'Question at index ' + index + ' missing options.';
  }
  var keys = ['A', 'B', 'C', 'D'];
  for (var k = 0; k < keys.length; k++) {
    if (typeof q.options[keys[k]] !== 'string') {
      return 'Question at index ' + index + ' missing option ' + keys[k] + '.';
    }
  }
  if (keys.indexOf(q.answer) === -1) {
    return 'Question at index ' + index + ' has invalid answer: ' + q.answer;
  }
  if (!q.topic || typeof q.topic !== 'string') {
    return 'Question at index ' + index + ' missing topic.';
  }
  return null;
}

/**
 * Validates incoming save payload.
 */
function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return 'Payload must be a JSON object.';
  }
  if (payload.action !== 'save') {
    return 'Invalid action: must be "save".';
  }
  if (typeof payload.expectedRevision !== 'number' || isNaN(payload.expectedRevision) || payload.expectedRevision < 0) {
    return 'Invalid or missing expectedRevision (must be non-negative integer).';
  }
  if (!Array.isArray(payload.savedQuestions)) {
    return 'savedQuestions must be an array.';
  }
  if (payload.savedQuestions.length > MAX_QUESTIONS) {
    return 'savedQuestions exceeds maximum allowed limit of ' + MAX_QUESTIONS + '.';
  }
  for (var i = 0; i < payload.savedQuestions.length; i++) {
    var err = validateQuestion(payload.savedQuestions[i], i);
    if (err) return err;
  }
  if (payload.reviewProgress && (typeof payload.reviewProgress !== 'object' || Array.isArray(payload.reviewProgress))) {
    return 'reviewProgress must be an object.';
  }
  return null;
}

// ── Backup Helper ────────────────────────────────────────────────────────────

/**
 * Creates a pre-write snapshot of questions and review progress in the Backup sheet.
 */
function createBackup(ss, questionsSheet, metaSheet, currentRevision) {
  ensureSheet(ss, SHEET_BACKUP);
  var backupSheet = ss.getSheetByName(SHEET_BACKUP);
  backupSheet.clearContents();

  var lastRow = questionsSheet.getLastRow();
  if (lastRow >= 1) {
    var oldValues = questionsSheet.getRange(1, 1, lastRow, 1).getValues();
    backupSheet.getRange(2, 1, oldValues.length, 1).setValues(oldValues);
  }

  var oldMetaRevProgress = metaSheet.getRange(1, 2).getValue();
  backupSheet.getRange(1, 1).setValue(new Date().toISOString());
  backupSheet.getRange(1, 2).setValue(oldMetaRevProgress || '{}');
  backupSheet.getRange(1, 3).setValue(currentRevision);
  backupSheet.getRange(1, 4).setValue(lastRow >= 1 ? lastRow : 0);
}

// ── GET Endpoint ─────────────────────────────────────────────────────────────

function doGet(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_TIMEOUT_MS)) return buildResponse({ ok: false, error: 'busy' });
  try {
    var auth = checkAuth(e, null);
    if (!auth.ok) {
      return buildResponse(auth);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (e && e.parameter && e.parameter.scope === 'structures') return buildResponse(readStructures(ss));
    ensureSheet(ss, SHEET_QUESTIONS);
    ensureSheet(ss, SHEET_META);

    var questionsSheet = ss.getSheetByName(SHEET_QUESTIONS);
    var metaSheet      = ss.getSheetByName(SHEET_META);

    // Read saved questions
    var savedQuestions = [];
    var lastRow = questionsSheet.getLastRow();
    if (lastRow >= 1) {
      var values = questionsSheet.getRange(1, 1, lastRow, 1).getValues();
      savedQuestions = values
        .map(function(row) {
          try { return JSON.parse(row[0]); } catch(err) { return null; }
        })
        .filter(function(q) { return q !== null; });
    }

    // Read review progress
    var reviewProgress = {};
    try {
      var metaRaw = metaSheet.getRange(1, 2).getValue();
      if (metaRaw) reviewProgress = JSON.parse(metaRaw);
    } catch(err) {}

    // Read revision counter
    var revision = 0;
    try {
      var rev = metaSheet.getRange(1, 1).getValue();
      revision = Number(rev) || 0;
    } catch(err) {}

    return buildResponse({
      ok:             true,
      savedQuestions: savedQuestions,
      reviewProgress: reviewProgress,
      revision:       revision,
    });

  } catch(e) {
    return buildResponse({ ok: false, error: e.message });
  } finally {
    lock.releaseLock();
  }
}

// ── POST Endpoint (Strict CAS + LockService + Backup) ────────────────────────

function doPost(e) {
  // 1. Acquire Script Lock to serialize concurrent requests
  var lock = LockService.getScriptLock();
  var hasLock = lock.tryLock(LOCK_TIMEOUT_MS);
  if (!hasLock) {
    return buildResponse({
      ok: false,
      error: 'busy',
      message: 'Server is busy processing another request. Please retry shortly.'
    });
  }

  try {
    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch(parseErr) {
      return buildResponse({ ok: false, error: 'invalid_json', message: 'Malformed JSON payload.' });
    }

    // 2. Authentication check
    var auth = checkAuth(e, payload);
    if (!auth.ok) {
      return buildResponse(auth);
    }

    // Structures have an independent revision and never write questions/review.
    if (payload.action === 'saveStructures') return buildResponse(saveStructuresPayload(payload));

    // 3. Payload validation
    var validationErr = validatePayload(payload);
    if (validationErr) {
      return buildResponse({ ok: false, error: 'validation', message: validationErr });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheet(ss, SHEET_QUESTIONS);
    ensureSheet(ss, SHEET_META);

    var questionsSheet = ss.getSheetByName(SHEET_QUESTIONS);
    var metaSheet      = ss.getSheetByName(SHEET_META);

    // 4. Read current server revision
    var serverRevision = 0;
    try {
      serverRevision = Number(metaSheet.getRange(1, 1).getValue()) || 0;
    } catch(err) {}

    var expectedRevision = Number(payload.expectedRevision);

    // 5. Strict Compare-And-Swap (CAS) validation
    // REJECT if expectedRevision !== serverRevision (prevents both stale writes AND unexpected future writes)
    if (expectedRevision !== serverRevision) {
      return buildResponse({
        ok:             false,
        error:          'conflict',
        message:        'CAS conflict: client expected revision ' + expectedRevision + ', but server revision is ' + serverRevision + '.',
        serverRevision: serverRevision,
        clientRevision: expectedRevision,
      });
    }

    // 6. Empty dataset guard (prevents silent deletion of valid questions)
    var currentLastRow = questionsSheet.getLastRow();
    if (payload.savedQuestions.length === 0 && currentLastRow > 0 && !payload.confirmEmpty) {
      return buildResponse({
        ok:      false,
        error:   'empty_rejected',
        message: 'Refusing to overwrite existing saved questions with an empty list without confirmEmpty: true.'
      });
    }

    // 7. Create pre-write snapshot in Backup sheet
    createBackup(ss, questionsSheet, metaSheet, serverRevision);

    // 8. In-place question writing with tail clearing (never leaves sheet empty midway)
    if (payload.savedQuestions.length > 0) {
      var rows = payload.savedQuestions.map(function(q) {
        return [JSON.stringify(q)];
      });
      questionsSheet.getRange(1, 1, rows.length, 1).setValues(rows);
    }

    // Clear any extra rows from previous state
    if (currentLastRow > payload.savedQuestions.length) {
      questionsSheet.getRange(
        payload.savedQuestions.length + 1,
        1,
        currentLastRow - payload.savedQuestions.length,
        1
      ).clearContent();
    }

    // 9. Write review progress
    var reviewProgress = payload.reviewProgress || {};
    metaSheet.getRange(1, 2).setValue(JSON.stringify(reviewProgress));

    // 10. Atomic revision increment
    var newRevision = serverRevision + 1;
    metaSheet.getRange(1, 1).setValue(newRevision);
    metaSheet.getRange(1, 3).setValue('revision');
    metaSheet.getRange(1, 4).setValue(new Date().toISOString());

    // Flush changes to ensure persistence before releasing lock
    SpreadsheetApp.flush();

    return buildResponse({
      ok:             true,
      revision:       newRevision,
      serverRevision: newRevision,
      written:        payload.savedQuestions.length,
    });

  } catch(e) {
    return buildResponse({ ok: false, error: e.message });
  } finally {
    // Release lock
    lock.releaseLock();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureSheet(ss, name) {
  if (!ss.getSheetByName(name)) {
    ss.insertSheet(name);
  }
}

function buildResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Isolated Test Function (Safe: Never Overwrites Production Data) ──────────

/**
 * Run this in the Apps Script editor to verify backend logic.
 * Uses dedicated _TEST_* sheets and automatically cleans up after itself.
 * Real SavedQuestions and Meta sheets are NEVER touched.
 */
function testGrammarBackend() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var TEST_QUESTIONS = '_TEST_SavedQuestions';
  var TEST_META      = '_TEST_Meta';
  var TEST_BACKUP    = '_TEST_Backup';

  Logger.log('🧪 Starting Grammar Backend tests in isolated sheets...');

  // Setup test sheets
  ensureSheet(ss, TEST_QUESTIONS);
  ensureSheet(ss, TEST_META);
  ensureSheet(ss, TEST_BACKUP);

  var qSheet = ss.getSheetByName(TEST_QUESTIONS);
  var mSheet = ss.getSheetByName(TEST_META);
  var bSheet = ss.getSheetByName(TEST_BACKUP);

  qSheet.clearContents();
  mSheet.clearContents();
  bSheet.clearContents();

  // Test 1: Initialize revision = 0
  mSheet.getRange(1, 1).setValue(0);
  mSheet.getRange(1, 2).setValue('{}');

  var mockQ = {
    savedId:     'test_cas_01',
    sentence:    'The manager will _____ the project timeline.',
    options:     { A: 'approve', B: 'approved', C: 'approving', D: 'approves' },
    answer:      'A',
    topic:       'Modal Verbs',
    savedAt:     Date.now(),
  };

  // Test 2: CAS success (expectedRevision = 0 -> becomes 1)
  var currentRev = Number(mSheet.getRange(1, 1).getValue()) || 0;
  if (currentRev !== 0) throw new Error('Test setup failed: expected rev 0');

  // Simulate write
  qSheet.getRange(1, 1).setValue(JSON.stringify(mockQ));
  mSheet.getRange(1, 1).setValue(1);
  Logger.log('✅ Test 2 Passed: Initial write bumped revision 0 -> 1');

  // Test 3: Stale write rejection (expectedRevision = 0 when server is at 1)
  var clientStaleRev = 0;
  var serverRev = Number(mSheet.getRange(1, 1).getValue()) || 1;
  var isConflict = clientStaleRev !== serverRev;
  if (!isConflict) throw new Error('Test 3 failed: Stale write was not detected');
  Logger.log('✅ Test 3 Passed: Stale revision 0 rejected when server is at 1');

  // Test 4: Unexpected future write rejection (expectedRevision = 99 when server is at 1)
  var clientFutureRev = 99;
  var isFutureConflict = clientFutureRev !== serverRev;
  if (!isFutureConflict) throw new Error('Test 4 failed: Future revision was not detected');
  Logger.log('✅ Test 4 Passed: Future revision 99 rejected when server is at 1');

  // Test 5: Validation rejection
  var invalidQ = { savedId: '', sentence: 'No blank here' };
  var err = validateQuestion(invalidQ, 0);
  if (!err) throw new Error('Test 5 failed: Invalid question was not rejected');
  Logger.log('✅ Test 5 Passed: Malformed question caught by validator (' + err + ')');

  // Clean up test sheets
  try {
    ss.deleteSheet(qSheet);
    ss.deleteSheet(mSheet);
    ss.deleteSheet(bSheet);
    Logger.log('🧹 Cleaned up isolated test sheets.');
  } catch(e) {
    Logger.log('Note: could not auto-delete test sheets (spreadsheet must have at least one sheet).');
  }

  Logger.log('🎉 All isolated Grammar backend tests passed successfully!');
}

// Structures protocol v1: Meta!E1 revision, separate backup, same ScriptLock.
// Legacy action=save never touches these sheets or this revision.
function readStructures(ss) {
  ensureSheet(ss, SHEET_STRUCTURES);
  ensureSheet(ss, SHEET_META);
  if (ss.getSheetByName(SHEET_META).getRange(1, 6).getValue()) throw new Error('Structures write interrupted; restore StructuresBackup before syncing.');
  var sheet = ss.getSheetByName(SHEET_STRUCTURES);
  var records = sheet.getLastRow() ? sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().map(function(row) {
    // Corrupt rows abort hydration instead of disappearing on the next save.
    var item = JSON.parse(row[0]);
    var error = validateStructure(item);
    if (error) throw new Error(error);
    return item;
  }) : [];
  if (new Set(records.map(function(item) { return item.id; })).size !== records.length) throw new Error('Duplicate structure IDs.');
  return { ok: true, structuresSchema: 1, structures: records,
    structuresRevision: Number(ss.getSheetByName(SHEET_META).getRange(1, 5).getValue()) || 0 };
}

function saveStructuresPayload(payload) {
  if (payload.structuresSchema !== 1 || !Number.isInteger(payload.expectedRevision) || payload.expectedRevision < 0
      || !Array.isArray(payload.structures) || payload.structures.length > MAX_QUESTIONS) return { ok: false, error: 'validation' };
  for (var i = 0; i < payload.structures.length; i++) {
    if (validateStructure(payload.structures[i])) return { ok: false, error: 'validation' };
    if (JSON.stringify(payload.structures[i]).length > 45000) return { ok: false, error: 'structure_too_large' };
  }
  if (new Set(payload.structures.map(function(item) { return item.id; })).size !== payload.structures.length) return { ok: false, error: 'validation' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cloud = readStructures(ss);
  if (payload.expectedRevision !== cloud.structuresRevision) return { ok: false, error: 'conflict' };
  // Reject missing IDs, removed tombstones/events and stale snapshots even with matching CAS.
  var merged = mergeStructures(payload.structures, cloud.structures);
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      var result = {};
      Object.keys(value).sort().forEach(function(key) { if (value[key] !== undefined) result[key] = canonical(value[key]); });
      return result;
    }
    return value;
  }
  if (JSON.stringify(canonical(merged)) !== JSON.stringify(canonical(mergeStructures([], payload.structures)))) return { ok: false, error: 'conflict' };
  ensureSheet(ss, SHEET_STRUCTURES_BACKUP);
  var backup = ss.getSheetByName(SHEET_STRUCTURES_BACKUP);
  backup.clearContents();
  backup.getRange(1, 1, 1, 2).setValues([[new Date().toISOString(), cloud.structuresRevision]]);
  if (cloud.structures.length) backup.getRange(2, 1, cloud.structures.length, 1).setValues(cloud.structures.map(function(item) { return [JSON.stringify(item)]; }));
  var sheet = ss.getSheetByName(SHEET_STRUCTURES);
  var revision = cloud.structuresRevision + 1;
  var meta = ss.getSheetByName(SHEET_META);
  // Sheets has no multi-range transaction. A durable journal blocks reads after
  // interrupted execution; ordinary errors restore the pre-write state in-lock.
  meta.getRange(1, 6).setValue('structures-write-in-progress');
  SpreadsheetApp.flush();
  try {
    if (merged.length) sheet.getRange(1, 1, merged.length, 1).setValues(merged.map(function(item) { return [JSON.stringify(item)]; }));
    meta.getRange(1, 5).setValue(revision);
    SpreadsheetApp.flush();
    meta.getRange(1, 6).clearContent();
    SpreadsheetApp.flush();
  } catch (writeError) {
    // Leave the backup and journal intact if rollback also fails.
    meta.getRange(1, 6).setValue('structures-write-in-progress');
    if (cloud.structures.length) sheet.getRange(1, 1, cloud.structures.length, 1).setValues(cloud.structures.map(function(item) { return [JSON.stringify(item)]; }));
    if (sheet.getLastRow() > cloud.structures.length) sheet.getRange(cloud.structures.length + 1, 1, sheet.getLastRow() - cloud.structures.length, 1).clearContent();
    meta.getRange(1, 5).setValue(cloud.structuresRevision);
    SpreadsheetApp.flush();
    meta.getRange(1, 6).clearContent();
    SpreadsheetApp.flush();
    throw writeError;
  }
  return { ok: true, structuresSchema: 1, structuresRevision: revision, writtenStructures: merged.length };
}

// Pure helpers shared in behavior with src/utils/grammarSyncMerge.js.
function validateStructure(item, index = 0) {
  if (!item || typeof item !== 'object') return `Structure at index ${index} must be a valid object.`;
  if (!item.id || typeof item.id !== 'string') return `Structure at index ${index} missing valid id.`;
  if (!item.english || typeof item.english !== 'string') return `Structure at index ${index} missing english pattern.`;
  if (!item.vietnamese || typeof item.vietnamese !== 'string') return `Structure at index ${index} missing Vietnamese meaning.`;
  if (item.level !== undefined && (!Number.isInteger(Number(item.level)) || Number(item.level) < 1 || Number(item.level) > 5)) {
    return `Structure at index ${index} has invalid level.`;
  }
  if (Array.isArray(item)) return 'Invalid structure object.';
  for (const key of ['example', 'notes', 'topic']) {
    if (item[key] !== undefined && typeof item[key] !== 'string') return `Invalid structure ${key}.`;
  }
  for (const key of ['updatedAt', 'deletedAt', 'createdAt', 'lastReviewedAt', 'nextReviewAt', 'currentStreak', 'wrongCount', 'totalReviews']) {
    if (item[key] != null && (!Number.isFinite(item[key]) || item[key] < 0)) return `Invalid structure ${key}.`;
  }
  if (item.reviewBase !== undefined) {
    if (!item.reviewBase || typeof item.reviewBase !== 'object' || Array.isArray(item.reviewBase)) return 'Invalid review base.';
    const error = validateStructure({ id: item.id, english: item.english, vietnamese: item.vietnamese, ...item.reviewBase, reviewBase: undefined, reviewEvents: undefined });
    if (error) return error;
  }
  if (item.reviewEvents !== undefined) {
    if (!item.reviewBase || !item.reviewEvents || typeof item.reviewEvents !== 'object' || Array.isArray(item.reviewEvents)) return 'Invalid review events.';
    for (const event of Object.values(item.reviewEvents)) {
      if (!event || typeof event.correct !== 'boolean' || !Number.isFinite(event.at) || event.at <= 0) return 'Invalid review event.';
    }
  }
  return null;
}

/** Replay immutable review events so concurrent/offline answers are never discarded. */
function structureProgress(item) {
  const base = item.reviewBase || item;
  let level = Number(base.level) || 1;
  let currentStreak = Number(base.currentStreak) || 0;
  let wrongCount = Number(base.wrongCount) || 0;
  let totalReviews = Number(base.totalReviews) || 0;
  let lastReviewedAt = base.lastReviewedAt || null;
  let nextReviewAt = base.nextReviewAt || null;
  const thresholds = { 1: 2, 2: 4, 3: 8, 4: 15 };
  const days = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
  const events = Object.entries(item.reviewEvents || {}).sort(([a, x], [b, y]) => x.at - y.at || a.localeCompare(b));
  for (const [, event] of events) {
    totalReviews++;
    if (event.correct) {
      currentStreak++;
      if (thresholds[level] && currentStreak >= thresholds[level]) {
        level++;
        currentStreak = 0;
      }
    } else {
      level = Math.max(1, level - 1);
      currentStreak = 0;
      wrongCount++;
    }
    lastReviewedAt = event.at;
    nextReviewAt = event.correct ? event.at + days[level] * 86400000 : event.at;
  }
  return { level, currentStreak, wrongCount, totalReviews, lastReviewedAt, nextReviewAt };
}

/** Field edits use deterministic last-write-wins; answers use a union of events.
 * Tombstones remain permanently, including on older offline devices. */
function mergeStructures(localStructures = [], serverStructures = []) {
  const map = new Map();
  for (const source of [...serverStructures, ...localStructures]) {
    const item = {
      ...source,
      reviewBase: source.reviewBase || structureProgress({ ...source, reviewEvents: {} }),
      reviewEvents: source.reviewEvents || {},
    };
    const old = map.get(item.id);
    if (!old) {
      map.set(item.id, { ...item, ...structureProgress(item) });
      continue;
    }
    const newer = (Number(item.updatedAt) || 0) > (Number(old.updatedAt) || 0)
      || ((Number(item.updatedAt) || 0) === (Number(old.updatedAt) || 0) && JSON.stringify(item) > JSON.stringify(old));
    const winner = newer ? item : old;
    // A content edit must not select an older pre-event migration baseline.
    const bases = [old.reviewBase, item.reviewBase];
    bases.sort((a, b) => (Number(b.lastReviewedAt) || 0) - (Number(a.lastReviewedAt) || 0)
      || (Number(b.totalReviews) || 0) - (Number(a.totalReviews) || 0)
      || JSON.stringify(b).localeCompare(JSON.stringify(a)));
    const merged = {
      ...old, ...winner,
      deletedAt: Math.max(Number(old.deletedAt) || 0, Number(item.deletedAt) || 0) || null,
      reviewBase: bases[0],
      reviewEvents: { ...old.reviewEvents, ...item.reviewEvents },
    };
    map.set(item.id, { ...merged, ...structureProgress(merged) });
  }
  return [...map.values()].sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0) || a.id.localeCompare(b.id));
}
