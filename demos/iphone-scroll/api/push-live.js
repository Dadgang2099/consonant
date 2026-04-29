/**
 * POST /push-live — persists the design payload to Vercel KV
 * Environment vars required: KV_REST_API_URL, KV_REST_API_TOKEN
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')    { res.status(405).end(); return; }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString();

  try { JSON.parse(body); } catch (_) {
    res.status(400).json({ ok: false, error: 'invalid JSON' }); return;
  }

  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    res.status(503).json({ ok: false, error: 'KV not configured' }); return;
  }

  const r = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['SET', 'iphone_live', body]]),
  });

  if (!r.ok) {
    const err = await r.text();
    console.error('[push-live] KV error', err);
    res.status(500).json({ ok: false }); return;
  }

  console.log('[push-live] saved', new Date().toISOString());
  res.json({ ok: true, ts: new Date().toISOString() });
};
