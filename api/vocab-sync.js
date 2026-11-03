// Same-origin readable ACK; upstream credentials stay server-side.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false, error: 'method' });
  const url = process.env.VOCAB_APPS_SCRIPT_URL, secret = process.env.VOCAB_SYNC_SECRET;
  if (!url || !secret) return res.status(503).json({ ok: false, error: 'unconfigured' });
  try {
    const target = new URL(url);
    let options = { redirect: 'follow', signal: AbortSignal.timeout(25000) };
    if (req.method === 'GET') {
      target.searchParams.set('secret', secret); target.searchParams.set('_cb', String(Date.now()));
    } else {
      if (process.env.VOCAB_WRITES_ENABLED !== 'true') return res.status(503).json({ ok: false, error: 'paused' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || Array.isArray(body) || body.protocol !== 1) return res.status(400).json({ ok: false, error: 'protocol_required' });
      options = { ...options, method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, secret }) };
    }
    const upstream = await fetch(target, options);
    if (!upstream.ok) throw new Error('upstream');
    const data = await upstream.json();
    return res.status(data.ok ? 200 : ['conflict', 'generation'].includes(data.error) ? 409 : 503).json(data);
  } catch { return res.status(502).json({ ok: false, error: 'upstream_failed' }); }
}
