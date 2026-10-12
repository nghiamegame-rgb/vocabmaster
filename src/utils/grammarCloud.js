/**
 * grammarCloud.js — Google Apps Script webhook integration for Grammar module.
 *
 * Communicates with the separate "VocabMaster - Grammar Backend" Apps Script.
 * Does NOT touch the Vocabulary webhook (WEBHOOK_URL in config.js).
 *
 * Operations:
 *   pushGrammarToCloud(savedQuestions, reviewProgress)  — POST full state
 *   fetchGrammarFromCloud()                              — GET saved state
 *
 * CORS behaviour mirrors cloud.js (see that file for detailed explanation).
 * POST → mode:'no-cors' (opaque response, fire-and-forget).
 * GET  → plain fetch with ?_cb= cache-buster, no custom headers.
 *
 * Until the user configures the Grammar webhook URL, all operations are
 * local-only and clearly labelled as such in the UI.
 */

import { getGrammarCloudUrl } from './grammarStorage';

/** True when a grammar webhook URL has been configured. */
function isConfigured() {
  const url = getGrammarCloudUrl();
  return typeof url === 'string' && url.trim().length > 0;
}

/**
 * POST the full grammar state to Google Sheets.
 * @param {{ savedQuestions: object[], reviewProgress: object }} payload
 * @returns {Promise<boolean>}
 */
export async function pushGrammarToCloud(payload) {
  if (!isConfigured()) return false;
  try {
    await fetch(getGrammarCloudUrl(), {
      method: 'POST',
      mode:   'no-cors',
      body:   JSON.stringify({ action: 'save', ...payload }),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * GET grammar saved state from Google Sheets.
 * @returns {Promise<{savedQuestions: object[], reviewProgress: object} | null>}
 */
export async function fetchGrammarFromCloud() {
  if (!isConfigured()) return null;
  try {
    const url = getGrammarCloudUrl();
    const bustUrl = `${url}${url.includes('?') ? '&' : '?'}_cb=${Date.now()}`;
    const res = await fetch(bustUrl, { method: 'GET', redirect: 'follow' });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json || !Array.isArray(json.savedQuestions)) return null;
    return {
      savedQuestions: json.savedQuestions,
      reviewProgress: json.reviewProgress ?? {},
      serverRevision: json.revision ?? 0,
    };
  } catch {
    return null;
  }
}

/** Whether grammar cloud is configured (so UI can show local-only badge). */
export function isGrammarCloudConfigured() {
  return isConfigured();
}
