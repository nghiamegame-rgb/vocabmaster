/**
 * VocabMaster — Grammar Backend (Google Apps Script)
 * ====================================================
 * Project name : VocabMaster - Grammar Backend
 * Spreadsheet  : VocabMaster - Grammar TOEIC
 *
 * HƯỚNG DẪN DEPLOY (xem README bên dưới hoặc báo cáo cuối)
 *
 * Sheet layout:
 *   Sheet "SavedQuestions" → mỗi hàng là 1 câu hỏi đã lưu (JSON blob trong col A)
 *   Sheet "Meta"           → row 1: revision counter
 *
 * Endpoints:
 *   GET  ?_cb=<ts>          → { savedQuestions:[...], reviewProgress:{}, revision: N }
 *   POST body = JSON object → { action:'save', savedQuestions:[...], reviewProgress:{}, revision:N }
 *
 * CORS:
 *   POST  → mode:'no-cors' from frontend (opaque, fire-and-forget)
 *   GET   → plain fetch with ?_cb= cache-buster
 *
 * Security:
 *   Deploy as: Execute as ME, Who has access: ANYONE
 *   No auth secrets are in the frontend code.
 *   Conflict prevention: server only accepts POST if client revision >= server revision.
 */

// ── Sheet / column constants ─────────────────────────────────────────────────

var SHEET_QUESTIONS = 'SavedQuestions';
var SHEET_META      = 'Meta';

// ── GET ──────────────────────────────────────────────────────────────────────

function doGet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Ensure sheets exist
    ensureSheet(ss, SHEET_QUESTIONS);
    ensureSheet(ss, SHEET_META);

    var questionsSheet = ss.getSheetByName(SHEET_QUESTIONS);
    var metaSheet      = ss.getSheetByName(SHEET_META);

    // Read saved questions (each row = JSON blob in column A)
    var savedQuestions = [];
    var lastRow = questionsSheet.getLastRow();
    if (lastRow >= 1) {
      var values = questionsSheet.getRange(1, 1, lastRow, 1).getValues();
      savedQuestions = values
        .map(function(row) {
          try { return JSON.parse(row[0]); } catch(e) { return null; }
        })
        .filter(function(q) { return q !== null; });
    }

    // Read reviewProgress (stored as JSON blob in Meta col B, row 1)
    var reviewProgress = {};
    try {
      var metaRaw = metaSheet.getRange(1, 2).getValue();
      if (metaRaw) reviewProgress = JSON.parse(metaRaw);
    } catch(e) {}

    // Read revision counter
    var revision = 0;
    try {
      var rev = metaSheet.getRange(1, 1).getValue();
      revision = Number(rev) || 0;
    } catch(e) {}

    return buildResponse({
      savedQuestions: savedQuestions,
      reviewProgress: reviewProgress,
      revision:       revision,
    });

  } catch(e) {
    return buildResponse({ error: e.message });
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);

    if (!payload || payload.action !== 'save') {
      return buildResponse({ error: 'Invalid action' });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheet(ss, SHEET_QUESTIONS);
    ensureSheet(ss, SHEET_META);

    var questionsSheet = ss.getSheetByName(SHEET_QUESTIONS);
    var metaSheet      = ss.getSheetByName(SHEET_META);

    // ── Revision / conflict check ────────────────────────────────────────────
    var serverRevision = 0;
    try {
      serverRevision = Number(metaSheet.getRange(1, 1).getValue()) || 0;
    } catch(err) {}

    var clientRevision = Number(payload.revision) || 0;

    // Reject stale writes: client must be >= server revision
    if (clientRevision < serverRevision) {
      return buildResponse({
        error:          'Stale revision — fetch latest data first',
        serverRevision: serverRevision,
        clientRevision: clientRevision,
      });
    }

    // ── Write saved questions ────────────────────────────────────────────────
    var savedQuestions = Array.isArray(payload.savedQuestions) ? payload.savedQuestions : [];

    // Clear existing data
    var lastRow = questionsSheet.getLastRow();
    if (lastRow >= 1) {
      questionsSheet.getRange(1, 1, lastRow, 1).clearContent();
    }

    // Write each question as JSON blob in col A
    if (savedQuestions.length > 0) {
      var rows = savedQuestions.map(function(q) {
        return [JSON.stringify(q)];
      });
      questionsSheet.getRange(1, 1, rows.length, 1).setValues(rows);
    }

    // ── Write review progress ────────────────────────────────────────────────
    var reviewProgress = payload.reviewProgress || {};
    metaSheet.getRange(1, 2).setValue(JSON.stringify(reviewProgress));

    // ── Bump revision ────────────────────────────────────────────────────────
    var newRevision = Math.max(serverRevision, clientRevision) + 1;
    metaSheet.getRange(1, 1).setValue(newRevision);
    // Label row 1 col 1 as "revision" in col C for human readability
    metaSheet.getRange(1, 3).setValue('revision');

    return buildResponse({
      ok:       true,
      written:  savedQuestions.length,
      revision: newRevision,
    });

  } catch(e) {
    return buildResponse({ error: e.message });
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

// ── Test function (run manually in Apps Script editor) ────────────────────────

/**
 * Run this in the Apps Script editor (not deployed) to verify the sheet setup.
 * Select "testGrammarBackend" from the function dropdown and click Run.
 */
function testGrammarBackend() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet(ss, SHEET_QUESTIONS);
  ensureSheet(ss, SHEET_META);

  // Insert a mock question
  var mockQuestion = {
    savedId:     'test_001',
    sentence:    'The report will be _____ to the board of directors next Monday.',
    options:     { A: 'present', B: 'presented', C: 'presenting', D: 'presents' },
    answer:      'B',
    topic:       'Passive Voice',
    difficulty:  'Medium',
    savedAt:     Date.now(),
    hardMarked:  false,
    userNotes:   '',
    shortExplanation: 'Use future passive voice: will be + past participle.',
    vietnameseSentence: 'Báo cáo sẽ được trình bày cho hội đồng quản trị vào thứ Hai tới.',
    detailedExplanation: {
      whyCorrect: 'B is correct: future passive = will be + past participle (presented).',
      whyWrongA: 'A: base form cannot follow "will be" in passive.',
      whyWrongC: 'C: -ing form is active, not passive.',
      whyWrongD: 'D: simple present, wrong tense.',
      grammarRules: ['Future Passive = will be + past participle'],
      keyVocabulary: [{ word: 'board of directors', meaning: 'hội đồng quản trị', type: 'Noun Phrase' }]
    }
  };

  var sheet = ss.getSheetByName(SHEET_QUESTIONS);
  sheet.getRange(1, 1).setValue(JSON.stringify(mockQuestion));

  var meta  = ss.getSheetByName(SHEET_META);
  meta.getRange(1, 1).setValue(1);
  meta.getRange(1, 2).setValue('{}');
  meta.getRange(1, 3).setValue('revision');

  Logger.log('✅ Test data written. Run doGet() to verify response.');
}
