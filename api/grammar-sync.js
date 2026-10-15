/**
 * api/grammar-sync.js — Vercel Serverless Function Proxy for Grammar Cloud Sync.
 *
 * Provides a secure, authenticated server-side proxy between the frontend client
 * and Google Apps Script backend.
 *
 * Security Benefits:
 * 1. ZERO credentials in frontend client code:
 *    - GRAMMAR_SYNC_SECRET is stored strictly in server-side environment variables.
 *    - GRAMMAR_APPS_SCRIPT_URL is stored strictly in server-side environment variables.
 * 2. Reliable server-confirmed persistence:
 *    - Eliminates opaque "no-cors" POST requests.
 *    - Returns true HTTP status codes (200 OK, 409 Conflict, 400 Bad Request, 503 Busy)
 *      and parses server responses for confirmed persistence.
 * 3. Same-origin requests:
 *    - Frontend calls /api/grammar-sync without cross-origin friction.
 */

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const scriptUrl = process.env.GRAMMAR_APPS_SCRIPT_URL;
  const syncSecret = process.env.GRAMMAR_SYNC_SECRET;

  if (!scriptUrl) {
    return res.status(500).json({
      ok: false,
      error: 'unconfigured',
      message: 'Server environment variable GRAMMAR_APPS_SCRIPT_URL is not configured.',
    });
  }

  try {
    // ── Handle GET (Fetch saved questions & revision) ────────────────────────
    if (req.method === 'GET') {
      const url = new URL(scriptUrl);
      if (syncSecret) {
        url.searchParams.set('secret', syncSecret);
      }
      url.searchParams.set('_cb', String(Date.now()));

      const upstream = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'follow',
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
      if (syncSecret) {
        payload.secret = syncSecret;
      }

      const upstream = await fetch(scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        redirect: 'follow',
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
  } catch (err) {
    return res.status(502).json({
      ok: false,
      error: 'proxy_failed',
      message: 'Proxy upstream request failed: ' + err.message,
    });
  }
}
