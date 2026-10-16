/**
 * cloud.js — Google Apps Script webhook integration
 *
 * Protocol 2 (deployed backend):
 *   GET  → { ok: true, words: [...], revision: N, stats: {...} }
 *   POST → body: { words: [...], expectedRevision: N }
 *          response opaque (no-cors), fire-and-forget.
 *
 * Backward-compatible with earlier deployments that returned:
 *   { data: [...] }  or a bare array.
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
 * Protocol 2: body is { words: [...], expectedRevision: N } so the backend
 * can perform CAS validation before writing.
 *
 * Uses mode:'no-cors' (required for Apps Script POST — see header comment).
 * The response is opaque; absence of a network exception = success.
 *
 * @param {object[]} words
 * @param {number}   [expectedRevision=0]  last revision received from cloud
 * @returns {Promise<boolean>} true if the request was dispatched without error
 */
export async function pushToCloud(words, expectedRevision = 0) {
  if (!isConfigured()) return false;
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      mode:   'no-cors',   // ← CRITICAL for Google Apps Script POST
      // Wrap in protocol 2 envelope: { words, expectedRevision }.
      // no-cors strips custom headers, so body is the only data channel.
      body:   JSON.stringify({ words, expectedRevision: Number(expectedRevision) || 0 }),
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
 * Protocol 2 (deployed) returns:
 *   { ok: true, words: [...], revision: N, stats: {...} }
 *
 * Also accepts older deployment shapes for backward-compatibility:
 *   { data: [...] }  or a bare JSON array.
 *
 * Returns null (not []) when there is no usable data, so the caller can
 * distinguish "cloud is empty / broken" from "successfully fetched 0 words"
 * and avoid accidentally overwriting local data with an empty list.
 *
 * @returns {Promise<{ words: object[], revision: number, stats: object|null } | null>}
 *   - Result object on success (words.length >= 1)
 *   - null if unconfigured, network error, malformed response, or 0 words
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

    // ── Word-list field resolution (protocol 2 first, then legacy) ──────────
    //  Protocol 2 : { ok, words: [...], revision, stats }
    //  Legacy v1   : { data: [...] }
    //  Very old    : bare array
    const rows = Array.isArray(json?.words)   // ← protocol 2  (primary)
      ? json.words
      : Array.isArray(json?.data)             // ← legacy { data: [...] }
        ? json.data
        : Array.isArray(json)                 // ← very old bare array
          ? json
          : null;

    // Safety guard: never overwrite local words with an empty list
    if (!rows || rows.length === 0) return null;

    // Normalise fields so the app never crashes on unexpected cloud data
    const words = rows
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

    if (words.length === 0) return null;

    return {
      words,
      revision: Number(json?.revision) || 0,   // protocol 2 CAS counter
      stats:    json?.stats ?? null,            // protocol 2 aggregate stats (informational)
    };

  } catch {
    return null;
  }
}
