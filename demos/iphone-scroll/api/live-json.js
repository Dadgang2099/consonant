/**
 * GET /live.json — serves the persisted design payload from Vercel KV
 * (vercel.json rewrites /live.json → /api/live-json)
 */
module.exports = async function handler(req, res) {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) { res.status(404).end(); return; }

  const r = await fetch(`${url}/get/iphone_live`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!r.ok) { res.status(404).end(); return; }

  const data = await r.json();
  if (!data.result) { res.status(404).end(); return; }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(data.result);
};
