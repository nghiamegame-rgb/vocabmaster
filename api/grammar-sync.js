/**
 * api/grammar-sync.js — Vercel Serverless Function Proxy for Grammar Cloud Sync.
 *
 * Server-side proxy between the frontend (same origin) and the Google Apps
 * Script backend for Grammar sentences and Structures.
 *
 * - GRAMMAR_APPS_SCRIPT_URL and GRAMMAR_SYNC_SECRET are REQUIRED server-side
 *   environment variables; without them the proxy answers 503 "unconfigured".
 *   The same secret must be set as Script Property GRAMMAR_SYNC_SECRET.
 * - No credentials in frontend code; no CORS headers (same-origin only).
 * - Every upstream call has a 25 s timeout; internal error details are never
 *   returned to the browser.
 * - Returns real HTTP status codes (200, 400, 401, 409, 503) from the parsed
 *   Apps Script response so the client can verify persistence.
 */

const UPSTREAM_TIMEOUT_MS = 25000;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const scriptUrl = process.env.GRAMMAR_APPS_SCRIPT_URL;
  const syncSecret = process.env.GRAMMAR_SYNC_SECRET;
  if (!scriptUrl || !syncSecret) {
    return res.status(503).json({ ok: false, error: 'unconfigured' });
  }

  try {
    // ── Handle GET (Fetch saved questions & revision) ────────────────────────
    if (req.method === 'GET') {
      const url = new URL(scriptUrl);
      url.searchParams.set('secret', syncSecret);
      url.searchParams.set('_cb', String(Date.now()));
      if (req.query?.scope === 'structures') url.searchParams.set('scope', 'structures');

      const upstream = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'follow',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });

      if (!upstream.ok) {
        return res.status(upstream.status).json({
          ok: false,
          error: 'upstream_error',
          message: `Google Apps Script returned HTTP ${upstream.status}`,
        });
      }

      const data = await upstream.json();
      return res.status(200).json(data);
    }

    // ── Handle POST (Save questions with CAS & Lock) ─────────────────────────
    if (req.method === 'POST') {
      let payload;
      if (typeof req.body === 'string') {
        try {
          payload = JSON.parse(req.body);
        } catch {
          return res.status(400).json({
            ok: false,
            error: 'invalid_json',
            message: 'Malformed JSON payload body',
          });
        }
      } else {
        payload = req.body || {};
      }

      // Inject server-side secret token into payload
      payload.secret = syncSecret;

      const upstream = await fetch(scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        redirect: 'follow',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });

      if (!upstream.ok) {
        return res.status(upstream.status).json({
          ok: false,
          error: 'upstream_error',
          message: `Google Apps Script returned HTTP ${upstream.status}`,
        });
      }

      const data = await upstream.json();

      let statusCode = 200;
      if (!data.ok) {
        if (data.error === 'conflict') statusCode = 409;
        else if (data.error === 'unauthorized') statusCode = 401;
        else if (data.error === 'busy') statusCode = 503;
        else statusCode = 400;
      }

      return res.status(statusCode).json(data);
    }

    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch {
    // Never echo internal error messages (they may contain URLs or secrets).
    return res.status(502).json({ ok: false, error: 'proxy_failed' });
  }
}
