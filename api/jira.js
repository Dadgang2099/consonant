export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { project, summary, description } = req.body;
  const token = process.env.JIRA_TOKEN;

  if (!token)   return res.status(503).json({ error: 'JIRA_TOKEN not configured' });
  if (!project) return res.status(400).json({ error: 'project required' });
  if (!summary) return res.status(400).json({ error: 'summary required' });

  try {
    const resp = await fetch('https://jira.corp.adobe.com/rest/api/2/issue', {
      method: 'POST',
      headers: {
        'Authorization':  `Bearer ${token}`,
        'Content-Type':   'application/json',
        'Accept':         'application/json',
      },
      body: JSON.stringify({
        fields: {
          project:     { key: project },
          summary,
          description: description || '',
          issuetype:   { name: 'Task' },
        },
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json({
        error: data.errorMessages?.[0] || data.errors ? JSON.stringify(data.errors) : 'Jira error',
      });
    }

    res.json({
      key: data.key,
      url: `https://jira.corp.adobe.com/browse/${data.key}`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
