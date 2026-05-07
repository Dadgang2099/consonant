export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { channel, text, jiraKey, jiraUrl } = req.body;
  const token = process.env.SLACK_BOT_TOKEN;

  if (!token)   return res.status(503).json({ error: 'SLACK_BOT_TOKEN not configured' });
  if (!channel) return res.status(400).json({ error: 'channel required' });

  const blocks = [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: text || '_(no comment)_' },
    },
  ];

  if (jiraKey && jiraUrl) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Jira:* <${jiraUrl}|${jiraKey}>` },
    });
  }

  try {
    const resp = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ channel, text: text || 'New annotation', blocks }),
    });

    const data = await resp.json();
    if (!data.ok) return res.status(400).json({ error: data.error });

    res.json({ ok: true, ts: data.ts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
