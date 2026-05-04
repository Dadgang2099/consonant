// Vercel serverless function — proxy the in-app chat bar to Claude.
// The browser POSTs { instruction, state } here; we ask Claude to return a
// JSON object mapping panel input IDs → new values via tool_use, then we
// hand that back to the client which applies it to the inputs.
//
// Set ANTHROPIC_API_KEY in Vercel env (production + preview).

const MODEL = 'claude-haiku-4-5-20251001';

const APPLY_TOOL = {
  name: 'apply_panel_changes',
  description:
    'Apply changes to the iPhone scroll-hero control panels. Only include keys that should change. Numeric values must be inside the listed range.',
  input_schema: {
    type: 'object',
    properties: {
      // PHONE panel (merged with shadow rows)
      scaleInput:       { type: 'number', minimum: 20,   maximum: 160,  description: 'Phone scale %' },
      yRefInput:        { type: 'number', minimum: -500, maximum: 2000, description: 'Phone Y position px' },
      xOffInput:        { type: 'number', minimum: -600, maximum: 600,  description: 'Phone X offset px' },
      phoneOpacity:     { type: 'number', minimum: 0,    maximum: 100,  description: 'Phone opacity %' },
      shadowBlur:       { type: 'number', minimum: 0,    maximum: 200,  description: 'Shadow blur px' },
      shadowOpacity:    { type: 'number', minimum: 0,    maximum: 1,    description: 'Shadow opacity 0–1' },
      shadowY:          { type: 'number', minimum: 0,    maximum: 180,  description: 'Shadow Y lift px' },
      shadowX:          { type: 'number', minimum: -80,  maximum: 80,   description: 'Shadow X shift px' },
      shadowCPickerHex: { type: 'string', description: 'Shadow color, 6-char hex without #' },
      // SCROLL VIDEO panel
      seqSpeed:         { type: 'number', minimum: 1,    maximum: 6 },
      // CARDS panel (below-hero triptych, 3 cards: A/B/C)
      card1Scale:       { type: 'number', minimum: 1,    maximum: 8,    description: 'Card A zoom 1–8×' },
      card1X:           { type: 'number', minimum: 0,    maximum: 100,  description: 'Card A focal X 0–100%' },
      card1Y:           { type: 'number', minimum: 0,    maximum: 100,  description: 'Card A focal Y 0–100%' },
      card2Scale:       { type: 'number', minimum: 1,    maximum: 8,    description: 'Card B zoom 1–8×' },
      card2X:           { type: 'number', minimum: 0,    maximum: 100,  description: 'Card B focal X 0–100%' },
      card2Y:           { type: 'number', minimum: 0,    maximum: 100,  description: 'Card B focal Y 0–100%' },
      card3Scale:       { type: 'number', minimum: 1,    maximum: 8,    description: 'Card C zoom 1–8×' },
      card3X:           { type: 'number', minimum: 0,    maximum: 100,  description: 'Card C focal X 0–100%' },
      card3Y:           { type: 'number', minimum: 0,    maximum: 100,  description: 'Card C focal Y 0–100%' },
      // HERO CONTENT panel
      hlSize:           { type: 'number', minimum: 24,   maximum: 160 },
      hlWeight:         { type: 'number', enum: [300, 400, 500, 600, 700, 800] },
      hlTracking:       { type: 'number', minimum: -0.08, maximum: 0.12 },
      hlLineH:          { type: 'number', minimum: 0.8,  maximum: 2.2 },
      bdSize:           { type: 'number', minimum: 12,   maximum: 32 },
      bdWeight:         { type: 'number', enum: [300, 400, 500, 600] },
      bdTracking:       { type: 'number', minimum: -0.04, maximum: 0.1 },
      bdLineH:          { type: 'number', minimum: 1,    maximum: 2.5 },
      lockupTop:        { type: 'number', minimum: 10,   maximum: 80 },
      lockupMaxW:       { type: 'number', minimum: 320,  maximum: 1400 },
      lockupPad:        { type: 'number', minimum: 0,    maximum: 160 },
      lockupGap:        { type: 'number', minimum: 0,    maximum: 80 },
      lockupScale:      { type: 'number', minimum: 50,   maximum: 150 },
      ctaGap:           { type: 'number', minimum: 0,    maximum: 80 },
      headline:         { type: 'string' },
      body:             { type: 'string' },
      cta1:             { type: 'string' },
      cta2:             { type: 'string' },
    },
  },
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error:
        'ANTHROPIC_API_KEY is not set on this deployment. Run `vercel env add ANTHROPIC_API_KEY production` and redeploy.',
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};
  const { instruction, state } = body;
  if (!instruction || typeof instruction !== 'string') {
    return res.status(400).json({ error: 'Missing instruction string' });
  }

  const system =
    'You drive the design control panels for an iPhone scroll-hero demo. ' +
    'You read the current panel state, interpret the user instruction, and call ' +
    '`apply_panel_changes` with ONLY the keys that should change. Keep numeric ' +
    'values inside their declared ranges. For colors, return a 6-char hex without #. ' +
    'When the user describes a vibe ("cooler shadow", "punchier headline"), pick ' +
    'sensible values — bias toward small adjustments unless the user explicitly ' +
    'asks for a big change.\n\n' +
    'CURRENT_STATE = ' + JSON.stringify(state || {});

  let upstream;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system,
        tools: [APPLY_TOOL],
        tool_choice: { type: 'tool', name: 'apply_panel_changes' },
        messages: [{ role: 'user', content: instruction }],
      }),
    });
  } catch (e) {
    return res.status(502).json({ error: 'Upstream fetch failed: ' + (e?.message || e) });
  }

  if (!upstream.ok) {
    const errBody = await upstream.json().catch(() => ({}));
    return res.status(upstream.status).json({
      error: errBody?.error?.message || `Anthropic returned ${upstream.status}`,
    });
  }

  const data = await upstream.json();
  const toolBlock = (data.content || []).find(b => b.type === 'tool_use' && b.name === APPLY_TOOL.name);
  if (!toolBlock || !toolBlock.input) {
    return res.status(502).json({ error: 'Model did not call apply_panel_changes' });
  }
  return res.status(200).json({ changes: toolBlock.input });
}
