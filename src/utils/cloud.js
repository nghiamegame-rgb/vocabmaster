/**
 * cloud.js — Google Apps Script webhook integration
 *
 * Two operations:
 *   • pushToCloud(words)   — POST the full words array to the sheet.
 *   • fetchFromCloud()     — GET the full words array from the sheet.
 *
 * ─── IMPORTANT: CORS behaviour with Google Apps Script ───────────────────────
 *
 *  POST  → must use  mode: 'no-cors'
 *          Google Apps Script does not send back proper CORS headers on POST
 *          responses, so the browser blocks them. With no-cors the request
 *          fires successfully and the sheet receives the data, but the response
 *          is opaque (unreadable). That is fine — we only need fire-and-forget.
 *          Body is sent as a plain JSON array (not wrapped in { words: [...] })
 *          so doPost() can parse it with JSON.parse(e.postData.contents).
 *
 *  GET   → must NOT use no-cors, because we need to read the JSON response.
 *          Apps Script doGet() returns proper CORS headers, so a normal fetch
 *          works. If you see a CORS error on GET, re-check that your deployment
 *          is set to "Execute as: Me" and "Who has access: Anyone".
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
 * POST the current words array to the Google Sheet.
 *
 * Uses mode:'no-cors' (required for Apps Script POST).
 * The response will always be opaque, so we cannot read res.ok —
 * we treat the absence of a network-level exception as success.
 *
 * @param {object[]} words
 * @returns {Promise<boolean>} true if the request was sent without a network error
 */
export async function pushToCloud(words) {
  if (!isConfigured()) return false;
  try {
    await fetch(WEBHOOK_URL, {
      method:  'POST',
      mode:    'no-cors',           // ← CRITICAL for Google Apps Script
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(words), // bare array — doPost reads e.postData.contents
    });
    // With no-cors the response is opaque, so we just assume success if no throw
    return true;
  } catch {
    // Network error (offline, DNS failure, etc.) — silently ignored
    return false;
  }
}

/**
 * GET the words array from the Google Sheet.
 *
 * Refuses to return an empty array — returns null instead so the caller
 * can distinguish "cloud is genuinely empty" from "request failed / sheet
 * not set up yet". This prevents an accidental overwrite of local data.
 *
 * @returns {Promise<object[] | null>}
 *   - Array of word objects (length >= 1) on success
 *   - null if unconfigured, network fails, response is malformed, or the
 *     sheet returned 0 rows (treat as "no useful data")
 */
export async function fetchFromCloud() {
  if (!isConfigured()) return null;
  try {
    // Append a timestamp query-param as a last-resort cache buster for
    // proxies / service workers that ignore Cache-Control headers.
    const bustUrl = `${WEBHOOK_URL}${WEBHOOK_URL.includes('?') ? '&' : '?'}_cb=${Date.now()}`;

    const res = await fetch(bustUrl, {
      method: 'GET',
      cache:  'no-store',           // tell the browser fetch cache to skip
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma':        'no-cache',
        'Expires':       '0',
      },
      // No 'no-cors' here — we MUST read the response body
    });

    if (!res.ok) return null;

    const json = await res.json();

    // Accept both { data: [...] } and a bare array
    const rows = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
        ? json.data
        : null;

    // ── Safety guard ────────────────────────────────────────────────────────
    // If the sheet returned 0 rows (never had data, or doGet is broken),
    // return null rather than [] so the caller never overwrites local words
    // with an empty list.
    if (!rows || rows.length === 0) return null;

    // Normalise fields so the app never crashes on unexpected cloud data
    return rows
      .map(w => ({
        id:            w.id            ?? String(Date.now() + Math.random()),
        english:       (w.english      ?? '').trim(),
        vietnamese:    (w.vietnamese   ?? '').trim(),
        imageUrl:      (w.imageUrl     ?? '').trim(),
        wordType:      w.wordType      ?? 'Word',
        level:         Number(w.level) || 1,
        currentStreak: Number(w.currentStreak) || 0,
        createdAt:     w.createdAt     ?? Date.now(),
      }))
      .filter(w => w.english); // drop blank rows from the sheet

  } catch {
    return null;
  }
}
