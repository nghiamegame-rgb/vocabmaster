/**
 * cloud.js — Google Apps Script webhook integration
 *
 * Sheet layout (managed by google-apps-script.js):
 *   Row 1  → headers: id | english | vietnamese | imageUrl | wordType | level | currentStreak | createdAt
 *   Row 2+ → one vocabulary word per row  (no more single-cell JSON blob)
 *
 * Two operations:
 *   • pushToCloud(words)  — POST the full words array; Apps Script rewrites all rows.
 *   • fetchFromCloud()    — GET; Apps Script returns { data: [...] } built from sheet rows.
 *
 * ─── CORS behaviour with Google Apps Script ──────────────────────────────────
 *
 *  POST → must use mode:'no-cors'
 *         Apps Script does not return proper CORS headers on POST, so the
 *         browser would block a normal fetch. With no-cors the request fires
 *         successfully (Apps Script receives and processes it), but the response
 *         is opaque — that's fine, we only need fire-and-forget here.
 *         ⚠ Because no-cors strips custom headers, the body MUST be sent as a
 *         plain JSON string (not FormData / URLSearchParams).
 *
 *  GET  → must NOT use no-cors, because we need to read the JSON response.
 *         Apps Script doGet() sends proper CORS headers, so a plain fetch works.
 *         Do NOT add custom request headers (Cache-Control, Pragma, etc.) —
 *         they trigger a preflight OPTIONS request that Apps Script cannot handle.
 *         Cache busting is done via the _cb query-param instead.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { WEBHOOK_URL } from '../config';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** True when a webhook URL has actually been configured. */
function isConfigured() {
  return typeof WEBHOOK_URL === 'string' && WEBHOOK_URL.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * POST the full words array to Google Sheets.
 *
 * Apps Script will clear all existing data rows and rewrite them one-per-row,
 * so the sheet always mirrors the local state exactly.
 *
 * Uses mode:'no-cors' (required for Apps Script POST — see header comment).
 * The response is opaque; absence of a network exception = success.
 *
 * @param {object[]} words
 * @returns {Promise<boolean>} true if the request was dispatched without error
 */
export async function pushToCloud(words) {
  if (!isConfigured()) return false;
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      mode:   'no-cors',          // ← CRITICAL for Google Apps Script POST
      body:   JSON.stringify(words), // bare array — doPost reads e.postData.contents
      // No Content-Type header: no-cors strips custom headers anyway, and
      // Apps Script reads the raw body regardless of content-type.
    });
    // Response is opaque with no-cors — treat no-throw as success
    return true;
  } catch {
    // Network error (offline, DNS failure, etc.) — silently ignored
    return false;
  }
}

/**
 * GET the words array from Google Sheets.
 *
 * Apps Script returns { data: [ ...wordObjects ] } built from the sheet rows.
 * Returns null (not []) when there is no usable data, so the caller can
 * distinguish "cloud is empty / broken" from "successfully fetched 0 words"
 * and avoid accidentally overwriting local data with an empty list.
 *
 * @returns {Promise<object[] | null>}
 *   - Array of word objects (length >= 1) on success
 *   - null if unconfigured, network error, malformed response, or 0 rows
 */
export async function fetchFromCloud() {
  if (!isConfigured()) return null;
  try {
    // Timestamp query-param busts proxy / service-worker caches without
    // adding custom request headers (which would trigger a CORS preflight).
    const bustUrl = `${WEBHOOK_URL}${WEBHOOK_URL.includes('?') ? '&' : '?'}_cb=${Date.now()}`;

    const res = await fetch(bustUrl, {
      method:   'GET',
      redirect: 'follow', // Apps Script issues a redirect — must follow it
      // No custom headers — they trigger an OPTIONS preflight that Apps Script
      // cannot handle, causing a CORS error before any data is returned.
    });

    if (!res.ok) return null;

    const json = await res.json();

    // Apps Script returns { data: [...] }; also accept a bare array for
    // backwards-compatibility with any old deployment that returned one.
    const rows = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json)
        ? json
        : null;

    // Safety guard: never overwrite local words with an empty list
    if (!rows || rows.length === 0) return null;

    // Normalise fields so the app never crashes on unexpected cloud data
    return rows
      .map(w => ({
        id:            String(w.id || (Date.now() + Math.random())),
        english:       (w.english      ?? '').trim(),
        vietnamese:    (w.vietnamese   ?? '').trim(),
        imageUrl:      (w.imageUrl     ?? '').trim(),
        wordType:      w.wordType      ?? 'Word',
        level:         Number(w.level) || 1,
        currentStreak: Number(w.currentStreak) || 0,
        createdAt:     Number(w.createdAt)      || Date.now(),
      }))
      .filter(w => w.english); // drop any blank rows from the sheet

  } catch {
    return null;
  }
}
