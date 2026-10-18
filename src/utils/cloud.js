/**
 * cloud.js — Google Apps Script webhook integration
 *
 * Deployed backend: Google Apps Script v6
 *   GET  → { data: [ ...wordObjects ] }
 *   POST → body is a plain JSON array; Apps Script clears then rewrites all rows.
 *          Response is opaque (no-cors), fire-and-forget.
 *
 * ─── CORS behaviour with Google Apps Script ──────────────────────────────────
 *
 *  POST → must use mode:'no-cors'
 *         Apps Script does not return proper CORS headers on POST, so the
 *         browser would block a normal fetch. With no-cors the request fires
 *         successfully (Apps Script receives and processes it), but the response
 *         is opaque — we cannot read it.
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
import { migrateWordList } from './annotation';

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
 * v6 backend expects a plain JSON array in the POST body.
 * Apps Script doPost() reads e.postData.contents and rewrites all rows.
 *
 * Uses mode:'no-cors' (required for Apps Script POST — see header comment).
 * The response is opaque; absence of a network exception = the request was
 * dispatched, but we CANNOT confirm the sheet was actually updated.
 *
 * @param {object[]} words
 * @returns {Promise<boolean>} true if the request was dispatched without a
 *   network-level error (does NOT mean the sheet was written successfully)
 */
export async function pushToCloud(words) {
  if (!isConfigured()) return false;
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      mode:   'no-cors',             // ← CRITICAL for Google Apps Script POST
      body:   JSON.stringify(words), // plain array — doPost reads e.postData.contents
      // No Content-Type header: no-cors strips custom headers anyway, and
      // Apps Script reads the raw body regardless of content-type.
    });
    // Response is opaque with no-cors — treat no-throw as "dispatched"
    return true;
  } catch {
    // Network error (offline, DNS failure, etc.)
    return false;
  }
}

/**
 * GET the words array from Google Sheets.
 *
 * v6 backend returns { data: [ ...wordObjects ] } built from sheet rows.
 * Also accepts a bare JSON array for compatibility with older deployments.
 *
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

    // v6 returns { data: [...] }; also accept a bare array for compatibility
    // with any older deployment that returned one directly.
    const rows = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json)
        ? json
        : null;

    // Safety guard: never overwrite local words with an empty list
    if (!rows || rows.length === 0) return null;

    // Normalise fields so the app never crashes on unexpected cloud data
    const normalized = rows
      .map(w => ({
        id:            String(w.id || (Date.now() + Math.random())),
        english:       (w.english      ?? '').trim(),
        annotation:    typeof w.annotation === 'string' ? w.annotation.trim() : undefined, // may be undefined for old sheets
        vietnamese:    (w.vietnamese   ?? '').trim(),
        imageUrl:      (w.imageUrl     ?? '').trim(),
        wordType:      w.wordType      ?? 'Word',
        level:         Number(w.level) || 1,
        currentStreak: Number(w.currentStreak) || 0,
        createdAt:     Number(w.createdAt)      || Date.now(),
        lastReviewedDate: w.lastReviewedDate ? Number(w.lastReviewedDate) : undefined,
      }))
      .filter(w => w.english); // drop any blank rows from the sheet

    // Run migration so cloud words without the annotation field get it extracted
    // from any embedded parenthetical in the english field (backward compatibility).
    return migrateWordList(normalized);

  } catch {
    return null;
  }
}

/**
 * Verify that a recent POST actually updated the sheet by doing a follow-up GET
 * and comparing the cloud word count with the expected count.
 *
 * Because POST is no-cors (response opaque), we cannot read the POST response.
 * This GET-based verification is the only reliable way to confirm the write.
 *
 * NOTE: Google Apps Script responses can be cached by CDN proxies for up to
 * ~20 seconds. The _cb cache-buster in fetchFromCloud mitigates this, but
 * there is a small window where the GET may return stale data right after a POST.
 * We add a short wait before verifying to reduce the chance of a false negative.
 *
 * @param {number} expectedCount  - how many words we just pushed
 * @param {number} [waitMs=2500]  - ms to wait before doing the verification GET
 * @returns {Promise<'ok'|'mismatch'|'error'>}
 *   - 'ok'       cloud row count >= expectedCount
 *   - 'mismatch' cloud returned fewer rows than expected
 *   - 'error'    network/parse failure during the verification GET
 */
export async function verifyPush(expectedCount, waitMs = 2500) {
  if (!isConfigured()) return 'error';
  // Short wait: give Apps Script time to commit the write before we re-read.
  await new Promise(r => setTimeout(r, waitMs));
  try {
    const cloudWords = await fetchFromCloud();
    if (cloudWords === null) return 'error';
    return cloudWords.length >= expectedCount ? 'ok' : 'mismatch';
  } catch {
    return 'error';
  }
}
