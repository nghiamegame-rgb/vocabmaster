/**
 * VocabMaster — Google Apps Script (paste into Apps Script editor & redeploy)
 *
 * Sheet layout (Sheet1):
 *   Row 1  → headers: id | english | vietnamese | imageUrl | wordType | level | currentStreak | createdAt
 *   Row 2+ → one vocabulary word per row
 *
 * Endpoints
 * ─────────
 *  GET  ?_cb=<timestamp>   → returns { data: [ ...wordObjects ] }
 *  POST body = JSON array  → clears data rows, writes all words row-by-row
 *
 * Deployment settings (REQUIRED)
 * ──────────────────────────────
 *  Execute as : Me
 *  Who has access : Anyone
 */

// Column order must match HEADERS exactly.
var HEADERS = ['id', 'english', 'vietnamese', 'imageUrl', 'wordType', 'level', 'currentStreak', 'createdAt'];

// ─── GET ────────────────────────────────────────────────────────────────────

function doGet() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var lastRow = sheet.getLastRow();

    // If the sheet has only the header row (or is empty) → return empty data
    if (lastRow < 2) {
      return buildResponse({ data: [] });
    }

    // Read all data rows (skip row 1 which is the header)
    var numRows = lastRow - 1;
    var range   = sheet.getRange(2, 1, numRows, HEADERS.length);
    var values  = range.getValues();

    var words = values
      .filter(function(row) { return row[1]; }) // skip rows where 'english' is blank
      .map(function(row) {
        return {
          id:            String(row[0] || ''),
          english:       String(row[1] || '').trim(),
          vietnamese:    String(row[2] || '').trim(),
          imageUrl:      String(row[3] || '').trim(),
          wordType:      String(row[4] || 'Word'),
          level:         Number(row[5]) || 1,
          currentStreak: Number(row[6]) || 0,
          createdAt:     Number(row[7]) || Date.now(),
        };
      });

    return buildResponse({ data: words });

  } catch (e) {
    return buildResponse({ error: e.message });
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    var words = JSON.parse(e.postData.contents); // bare array from the frontend

    if (!Array.isArray(words)) {
      return buildResponse({ error: 'Expected a JSON array' });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    // 1. Ensure header row exists (writes it if sheet is blank)
    ensureHeaders(sheet);

    // 2. Clear all existing data rows (keep header in row 1)
    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      sheet.getRange(2, 1, lastRow - 1, HEADERS.length).clearContent();
    }

    // 3. Write each word as its own row, starting at row 2
    if (words.length > 0) {
      var rows = words.map(function(w) {
        return [
          w.id            ?? '',
          w.english       ?? '',
          w.vietnamese    ?? '',
          w.imageUrl      ?? '',
          w.wordType      ?? 'Word',
          w.level         ?? 1,
          w.currentStreak ?? 0,
          w.createdAt     ?? Date.now(),
        ];
      });

      sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    }

    return buildResponse({ ok: true, written: words.length });

  } catch (e) {
    return buildResponse({ error: e.message });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Write the header row if row 1 is empty. */
function ensureHeaders(sheet) {
  var firstCell = sheet.getRange(1, 1).getValue();
  if (!firstCell) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    // Freeze the header row so it stays visible while scrolling
    sheet.setFrozenRows(1);
  }
}

/** Wrap any object as a CORS-friendly JSON response. */
function buildResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
