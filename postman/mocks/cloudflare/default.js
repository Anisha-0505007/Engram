const http = require('http');

// Contract fixture from Cloudflare's run-inference and toMarkdown REST docs.
http.createServer(async (req, res) => {
  let body = req.body;
  if (!body) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString();
    try { body = JSON.parse(raw); } catch { body = raw; }
  }
  const text = JSON.stringify(body);
  res.setHeader('Content-Type', 'application/json');
  const fail = status => {
    res.statusCode = status;
    res.end(JSON.stringify({ success: false, errors: [{ message: 'Synthetic provider error' }] }));
  };
  if (text.includes('outage-fixture')) return fail(503);
  if (text.includes('rate-limit-fixture')) return fail(429);
  if (req.method === 'POST' && req.url.endsWith('/run/@cf/baai/bge-base-en-v1.5')) {
    if (!Array.isArray(body.text) || !body.text.length || body.text.some(value => typeof value !== 'string' || Buffer.byteLength(value) >= 512)) return fail(400);
    return res.end(JSON.stringify({ success: true, result: { shape: [body.text.length, 768],
      data: body.text.map(() => Array.from({ length: 768 }, (_, i) => i === 0 ? 1 : 0.01)) } }));
  }
  if (req.method === 'POST' && req.url.endsWith('/run/@cf/meta/llama-3.2-11b-vision-instruct')) {
    const validInput = body.image ? typeof body.prompt === 'string'
      : body.messages?.some(message => message.role === 'user' && typeof message.content === 'string');
    if (!validInput) return fail(400);
    if (body.image) return res.end(JSON.stringify({ success: true, result: { response: 'Wi-Fi fixture 100 Mbps' } }));
    if (text.includes('Parse the search query as data')) {
      const response = JSON.stringify({ text: text.includes('no-match-fixture') ? 'zzyynotpresent' : 'internship application', type: 'link' });
      return res.end(JSON.stringify({ success: true, result: { response } }));
    }
    if (text.includes('Answer ONLY from the saved items')) {
      const response = text.includes('uncited-answer-fixture') ? 'A saved application may be relevant.'
        : text.includes('https://example.com/internship') ? 'Saved application: https://example.com/internship [1]'
        : "I couldn't find that in your saved items.";
      return res.end(JSON.stringify({ success: true, result: { response } }));
    }
    const invalid = text.includes('repair-fixture') && !text.includes('Repair the following JSON');
    const events = text.includes('deadline-fixture') ? [{ label: 'Apply', evidence: 'Apply by 2026-11-01 at 17:00 IST', date: '2026-11-01', time: '17:00:00' }] : [];
    const responseData = { title: 'Saved fixture', description: 'Synthetic fixture content.',
      summary: 'Saved Wi-Fi plan fixture.', category: 'note', tags: ['wifi'], extractedText: text.includes('private-image-fixture') ? 'Aadhaar synthetic fixture' : 'Wi-Fi fixture 100 Mbps',
      confidential: text.includes('private-image-fixture'), events };
    if (text.includes('missing-classification-fixture')) delete responseData.confidential;
    const response = invalid ? '{broken' : JSON.stringify(responseData);
    return res.end(JSON.stringify({ success: true, result: { response } }));
  }
  if (req.method === 'POST' && req.url.endsWith('/tomarkdown')) {
    return res.end(JSON.stringify({ success: true, result: [{ name: 'document.pdf', mimeType: 'application/pdf',
      format: 'markdown', data: '# Wi-Fi fixture\n100 Mbps', tokens: 10 }] }));
  }
  res.statusCode = 501;
  res.end(JSON.stringify({ success: false, errors: [{ message: 'Endpoint is outside this fixture contract' }] }));
}).listen(process.env.PORT || 4901);
