// Dictation cloud client (Vercel proxy /api/dictation-sync → Apps Script → Google Sheet).
// Every response is verified; nothing is assumed saved without the server saying so.
import { DICTATION_SCHEMA, validateDictationData } from './dictationSyncMerge.js';

export const DICTATION_SYNC_URL = '/api/dictation-sync';

async function readJson(res) {
  try { return await res.json(); } catch { return null; }
}

/** @returns {Promise<{ok: true, revision: number, sentences: object[], words: object[]} | {ok: false, error: string}>} */
export async function fetchDictationFromCloud(url = DICTATION_SYNC_URL, fetchImpl = globalThis.fetch) {
  let res;
  try {
    res = await fetchImpl(`${url}${url.includes('?') ? '&' : '?'}_cb=${Date.now()}`, { method: 'GET', redirect: 'follow' });
  } catch {
    return { ok: false, error: 'network' };
  }
  // `npm run dev` (Vite only) answers /api/* with the HTML app or 404.
  if (res.status === 404 || /text\/html/i.test(res.headers?.get?.('content-type') || '')) return { ok: false, error: 'no_backend' };
  const data = await readJson(res);
  if (!data) return { ok: false, error: 'invalid_response' };
  if (data.ok !== true) return { ok: false, error: String(data.error || `http_${res.status}`) };
  if (data.schema !== DICTATION_SCHEMA || !Number.isInteger(data.revision) || data.revision < 0
      || validateDictationData({ sentences: data.sentences, words: data.words })) {
    return { ok: false, error: 'invalid_response' };
  }
  return { ok: true, revision: data.revision, sentences: data.sentences, words: data.words };
}

/** @returns {Promise<{ok: true, revision: number} | {ok: false, error: string}>} */
export async function pushDictationToCloud(data, expectedRevision, url = DICTATION_SYNC_URL, fetchImpl = globalThis.fetch) {
  const payload = { action: 'save', schema: DICTATION_SCHEMA, expectedRevision, sentences: data.sentences, words: data.words };
  let res;
  try {
    res = await fetchImpl(url, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
  } catch {
    return { ok: false, error: 'network' };
  }
  const json = await readJson(res);
  if (res.ok && json?.ok === true && json.schema === DICTATION_SCHEMA && json.revision === expectedRevision + 1
      && json.writtenSentences === payload.sentences.length && json.writtenWords === payload.words.length) {
    return { ok: true, revision: json.revision };
  }
  return { ok: false, error: String(json?.error || `http_${res.status}`) };
}

const MESSAGES = {
  unconfigured: 'Chưa cài đặt đồng bộ Google Sheet (xem docs/DICTATION-SETUP.md). Dữ liệu vẫn lưu trên thiết bị này.',
  unauthorized: 'Máy chủ từ chối: secret trên Vercel và Apps Script chưa khớp.',
  network: 'Mất kết nối mạng; sẽ thử lại khi có mạng.',
  no_backend: 'Không tìm thấy máy chủ đồng bộ (bản chạy thử trên máy không có /api).',
  invalid_response: 'Máy chủ trả dữ liệu không đọc được; chưa ghi gì.',
  interrupted: 'Lần ghi trước trên Sheet bị ngắt giữa chừng; cần khôi phục từ tab "Sao lưu" (xem DICTATION-SETUP.md).',
  busy: 'Máy chủ đang bận; sẽ thử lại sau.',
  conflict: 'Dữ liệu vừa đổi trên thiết bị khác; sẽ thử lại.',
};

export function dictationSyncMessage(error) {
  return MESSAGES[error] || `Đồng bộ lỗi (${error}). Dữ liệu vẫn lưu trên thiết bị.`;
}
