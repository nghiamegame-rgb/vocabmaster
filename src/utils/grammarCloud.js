/**
 * grammarCloud.js — Cloud synchronization client for Grammar module.
 *
 * Communicates with either:
 * 1. The secure Vercel Serverless Function proxy (/api/grammar-sync) — recommended.
 * 2. Or directly with Google Apps Script Web App URL.
 *
 * Strict Persistence Guarantees:
 * - NO opaque no-cors assumptions: server response is verified.
 * - CAS verification: writes are confirmed with serverRevision.
 * - Conflict detection: detects when server revision differs from expected revision.
 */

import { getGrammarCloudUrl } from './grammarStorage';
import { validateQuestion, validateStructure } from './grammarSyncMerge';

/** True when a grammar sync URL has been configured. */
export function isGrammarCloudConfigured() {
  const url = getGrammarCloudUrl();
  return typeof url === 'string' && url.trim().length > 0;
}

/**
 * Pushes saved questions and review progress to cloud with strict CAS verification.
 *
 * @param {object} options
 * @param {object[]} options.savedQuestions
 * @param {object} options.reviewProgress
 * @param {number} options.expectedRevision
 * @param {boolean} [options.confirmEmpty]
 * @returns {Promise<{ ok: boolean, revision?: number, written?: number, error?: string, serverRevision?: number, message?: string }>}
 */
export async function pushGrammarToCloud({
  savedQuestions = [],
  reviewProgress = {},
  expectedRevision = 0,
  confirmEmpty = false,
  url = getGrammarCloudUrl(),
}) {
  if (!url.trim()) {
    return { ok: false, error: 'unconfigured', message: 'Cloud sync is not configured.' };
  }

  const payload = {
    action:           'save',
    expectedRevision: Number(expectedRevision) || 0,
    savedQuestions:   Array.isArray(savedQuestions) ? savedQuestions : [],
    reviewProgress:   reviewProgress || {},
    confirmEmpty:     Boolean(confirmEmpty),
  };

  try {
    // Send as text/plain to avoid preflight OPTIONS when calling Apps Script directly,
    // while remaining fully compatible with the Vercel proxy.
    const res = await fetch(url, {
      method:   'POST',
      headers:  { 'Content-Type': 'text/plain;charset=utf-8' },
      body:     JSON.stringify(payload),
      redirect: 'follow',
    });

    let json;
    try {
      json = await res.json();
    } catch {
      return {
        ok:      false,
        error:   'invalid_response',
        message: 'Could not parse JSON response from server.',
      };
    }

    if (res.ok && json?.ok === true && Number.isInteger(json.revision)
        && json.revision === payload.expectedRevision + 1
        && json.written === payload.savedQuestions.length) {
      return {
        ok:       true,
        revision: Number(json.revision) || 0,
        written:  Number(json.written) || 0,
      };
    }

    if (json && json.error === 'conflict') {
      return {
        ok:             false,
        error:          'conflict',
        serverRevision: Number(json.serverRevision) || 0,
        clientRevision: Number(json.clientRevision) || expectedRevision,
        message:        json.message || 'Revision conflict on server.',
      };
    }

    return {
      ok:             false,
      error:          json?.error || 'save_failed',
      serverRevision: json?.serverRevision,
      message:        json?.message || `Server error (HTTP ${res.status})`,
    };

  } catch (err) {
    return {
      ok:      false,
      error:   'network',
      message: err.message || 'Network request failed',
    };
  }
}

/**
 * Fetches latest saved questions and revision from cloud.
 *
 * @returns {Promise<{savedQuestions: object[], reviewProgress: object, structures: object[], hasStructures: boolean, serverRevision: number} | null>}
 */
export async function fetchGrammarFromCloud(url = getGrammarCloudUrl()) {
  if (!url.trim()) return null;

  try {
    const bustUrl = `${url}${url.includes('?') ? '&' : '?'}_cb=${Date.now()}`;
    const res = await fetch(bustUrl, {
      method:   'GET',
      redirect: 'follow',
    });

    if (!res.ok) return null;

    const json = await res.json();
    if (!json || json.ok !== true || !Array.isArray(json.savedQuestions)
        || !Number.isInteger(json.revision) || json.revision < 0
        || json.savedQuestions.some(q => validateQuestion(q))
        || !json.reviewProgress || typeof json.reviewProgress !== 'object'
        || Array.isArray(json.reviewProgress)) {
      return null;
    }
    const hasStructures = Array.isArray(json.structures);
    if (hasStructures && json.structures.some(item => validateStructure(item))) return null;

    return {
      savedQuestions: json.savedQuestions,
      reviewProgress: json.reviewProgress ?? {},
      structures: hasStructures ? json.structures : [],
      hasStructures,
      serverRevision: Number(json.revision) || 0,
    };
  } catch {
    return null;
  }
}
