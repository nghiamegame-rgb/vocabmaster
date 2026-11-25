/**
 * api/dictation-sync.js — Vercel Serverless Function proxy for Dictation sync.
 *
 * Same design as api/grammar-sync.js:
 * - DICTATION_APPS_SCRIPT_URL and DICTATION_SYNC_SECRET are REQUIRED server-side
 *   environment variables; without them the proxy answers 503 "unconfigured".
 *   The same secret must be set as Script Property DICTATION_SYNC_SECRET.
 * - No credentials in frontend code; no CORS headers (same-origin only).
 * - 25 s upstream timeout; internal error details are never returned.
 * - Real HTTP status codes so the client can tell conflicts from failures.
 */

const UPSTREAM_TIMEOUT_MS = 25000;

function statusFor(data) {
  if (data?.ok) return 200;
  if (data?.error === 'conflict') return 409;
  if (data?.error === 'unauthorized') return 401;
  if (data?.error === 'busy') return 503;
  if (data?.error === 'interrupted' || data?.error === 'server_error') return 500;
  return 400;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const scriptUrl = process.env.DICTATION_APPS_SCRIPT_URL;
  const syncSecret = process.env.DICTATION_SYNC_SECRET;
  if (!scriptUrl || !syncSecret) {
    return res.status(503).json({ ok: false, error: 'unconfigured' });
  }

  try {
    if (req.method === 'GET') {
      const url = new URL(scriptUrl);
      url.searchParams.set('secret', syncSecret);
      url.searchParams.set('_cb', String(Date.now()));
      const upstream = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'follow',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!upstream.ok) return res.status(upstream.status).json({ ok: false, error: 'upstream_error' });
      const data = await upstream.json();
      return res.status(statusFor(data)).json(data);
    }

    if (req.method === 'POST') {
      let payload;
      if (typeof req.body === 'string') {
        try { payload = JSON.parse(req.body); } catch {
          return res.status(400).json({ ok: false, error: 'invalid_json' });
        }
      } else {
        payload = req.body || {};
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return res.status(400).json({ ok: false, error: 'invalid_json' });
      }
      payload.secret = syncSecret;
      const upstream = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        redirect: 'follow',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!upstream.ok) return res.status(upstream.status).json({ ok: false, error: 'upstream_error' });
      const data = await upstream.json();
      return res.status(statusFor(data)).json(data);
    }

    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch {
    // Never echo internal error messages (they may contain URLs or secrets).
    return res.status(502).json({ ok: false, error: 'proxy_failed' });
  }
}
