export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { issueKey, filename, data: base64Data } = req.body;
  const token = process.env.JIRA_TOKEN;

  if (!token)      return res.status(503).json({ error: 'JIRA_TOKEN not configured' });
  if (!issueKey)   return res.status(400).json({ error: 'issueKey required' });
  if (!base64Data) return res.status(400).json({ error: 'data required' });

  try {
    const stripped = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer   = Buffer.from(stripped, 'base64');
    const blob     = new Blob([buffer], { type: 'image/png' });
    const form     = new FormData();
    form.append('file', blob, filename || 'screenshot.png');

    const resp = await fetch(
      `https://jira.corp.adobe.com/rest/api/2/issue/${issueKey}/attachments`,
      {
        method: 'POST',
        headers: {
          'Authorization':    `Bearer ${token}`,
          'X-Atlassian-Token': 'no-check',
        },
        body: form,
      }
    );

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ error: text });
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
