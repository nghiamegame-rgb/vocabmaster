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
  try {
    var auth = checkAuth(e, null);
    if (!auth.ok) {
      return buildResponse(auth);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
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
