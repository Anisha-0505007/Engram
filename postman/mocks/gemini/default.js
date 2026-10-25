const http = require('http');

// Shapes mirror Gemini REST documentation. Content is synthetic and intentionally fixed.
http.createServer(async (req, res) => {
  let body = req.body;
  if (!body) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch { body = {}; }
  }
  const text = JSON.stringify(body);
  res.setHeader('Content-Type', 'application/json');
  if (text.includes('outage-fixture')) { res.statusCode = 503; return res.end(JSON.stringify({ error: { code: 503, message: 'Synthetic service outage' } })); }
  if (text.includes('rate-limit-fixture')) { res.statusCode = 429; return res.end(JSON.stringify({ error: { code: 429, message: 'Synthetic rate limit' } })); }
  if (req.method === 'POST' && req.url.endsWith(':embedContent')) {
    if (body.outputDimensionality !== 768 || !body.content?.parts?.[0]?.text) { res.statusCode = 400; return res.end('{}'); }
    return res.end(JSON.stringify({ embedding: { values: Array.from({ length: 768 }, (_, i) => i === 0 ? 1 : 0.01) } }));
  }
  if (req.method === 'POST' && req.url.endsWith(':generateContent')) {
    if (!body.contents?.[0]?.parts?.[0]?.text) { res.statusCode = 400; return res.end('{}'); }
    const invalid = text.includes('repair-fixture') && !text.includes('Repair the following JSON');
    const result = invalid ? '{broken' : JSON.stringify({ title: 'Saved fixture', description: 'Synthetic fixture content.', summary: 'Saved Wi-Fi plan fixture.', category: 'note', tags: ['wifi'], extractedText: 'Wi-Fi fixture 100 Mbps' });
    return res.end(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: result }] } }] }));
  }
  res.statusCode = 501; res.end(JSON.stringify({ error: 'Endpoint is outside this fixture contract' }));
}).listen(process.env.PORT || 4901);
