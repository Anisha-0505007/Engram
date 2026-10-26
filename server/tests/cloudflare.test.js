import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import AiUsage from '../src/models/aiUsage.model.js';
import { withAiUser } from '../src/services/aiQuota.service.js';
import { callCloudflare, generateCloudflareText, extractCloudflarePdf } from '../src/services/cloudflare.service.js';
import { embedText, splitEmbeddingText } from '../src/services/embedding.service.js';

test('Cloudflare real HTTP contract, embeddings, PDF and safe failure handling', async t => {
  t.mock.method(AiUsage, 'updateOne', async () => ({}));
  t.mock.method(AiUsage, 'findOneAndUpdate', async () => ({ calls: 1 }));
  const names = ['CLOUDFLARE_BASE_URL', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'];
  const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
  let status = 200, variant = 'normal';
  const requests = [];
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = req.headers['content-type'].startsWith('application/json') ? JSON.parse(raw) : raw;
    requests.push({ path: req.url, headers: req.headers, body });
    res.writeHead(status, { 'Content-Type': 'application/json' });
    let result = { response: '{"ok":true}' };
    if (req.url.includes('bge-base')) result = { data: body.text.map(() => Array.from({ length: 768 }, (_, i) => i === 0 ? 2 : 0)) };
    if (req.url === '/tomarkdown') result = [{ format: 'markdown', data: 'Wi-Fi fixture 100 Mbps' }];
    if (variant === 'empty-vector') result.data[0].fill(0);
    if (variant === 'wrong-dimension') result.data[0].pop();
    if (variant === 'pdf-error') result = [{ format: 'error', error: 'PRIVATE provider text' }];
    if (variant === 'empty') result = { response: '' };
    if (variant === 'object') result = { response: { ok: true } };
    if (variant === 'truncated') result.finish_reason = 'length';
    if (variant === 'unreadable') return res.end('PRIVATE invalid JSON');
    res.end(JSON.stringify({ success: status === 200 && variant !== 'failure-envelope', result, errors: [{ message: 'PRIVATE provider text' }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.CLOUDFLARE_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.CLOUDFLARE_ACCOUNT_ID = 'a'.repeat(32);
  process.env.CLOUDFLARE_API_TOKEN = 'synthetic-token';
  const run = fn => withAiUser('fixture-owner', fn);
  try {
    assert.equal(await run(() => generateCloudflareText('Return JSON', [], true)), '{"ok":true}');
    assert.equal(requests[0].headers.authorization, 'Bearer synthetic-token');
    assert.match(requests[0].path, /^\/run\/@cf\/meta\/llama-3.2-11b-vision-instruct$/);
    assert.equal(requests[0].body.messages[0].role, 'user');
    assert.match(requests[0].body.messages[0].content, /JSON object/);
    variant = 'object';
    assert.equal(await run(() => generateCloudflareText('Return JSON', [], true)), '{"ok":true}');
    variant = 'normal';
    await run(() => generateCloudflareText('Read image', [{ inlineData: { mimeType: 'image/png', data: 'AQID' } }]));
    assert.deepEqual(requests.at(-1).body.image, [1, 2, 3]);
    assert.equal(requests.at(-1).body.prompt, 'Read image');
    assert.equal(requests.at(-1).body.messages, undefined);
    const vector = await run(() => embedText('wifi '.repeat(250)));
    assert.equal(vector.length, 768); assert.equal(vector[0], 1);
    assert.ok(requests.at(-1).body.text.length > 1);
    await run(() => embedText('wifi plan', 'RETRIEVAL_QUERY'));
    assert.match(requests.at(-1).body.text[0], /^Represent this sentence/);
    assert.equal(await run(() => extractCloudflarePdf(Buffer.from('%PDF-fixture'))), 'Wi-Fi fixture 100 Mbps');
    assert.match(requests.at(-1).headers['content-type'], /^multipart\/form-data; boundary=/);
    assert.match(requests.at(-1).body, /name="files"; filename="document.pdf"/);
    for (const code of [400, 401, 403, 404, 413, 422, 429, 503]) {
      status = code;
      await assert.rejects(run(() => generateCloudflareText('fixture')), error => {
        assert.equal(error.retryable, [429, 503].includes(code));
        assert.ok(!error.message.includes('PRIVATE')); return true;
      });
    }
    status = 200;
    for (const [value, message] of [['empty', /no usable/], ['truncated', /token limit/], ['unreadable', /unreadable/], ['failure-envelope', /successful result/]]) {
      variant = value; await assert.rejects(run(() => generateCloudflareText('fixture')), message);
    }
    for (const value of ['empty-vector', 'wrong-dimension']) {
      variant = value; await assert.rejects(run(() => embedText('fixture')));
    }
    variant = 'pdf-error'; await assert.rejects(run(() => extractCloudflarePdf(Buffer.from('%PDF'))), /readable PDF/);
    delete process.env.CLOUDFLARE_API_TOKEN;
    await assert.rejects(callCloudflare('/run/fixture', {}), error => error.retryable === false && /CLOUDFLARE_API_TOKEN/.test(error.message));
  } finally {
    for (const name of names) { if (original[name] === undefined) delete process.env[name]; else process.env[name] = original[name]; }
    await new Promise(resolve => server.close(resolve));
  }
});

test('embedding windows bound Unicode input and total cost', () => {
  const chunks = splitEmbeddingText('😀न'.repeat(10000), 'RETRIEVAL_QUERY');
  assert.ok(chunks.length <= 32);
  assert.ok(chunks.every(chunk => Buffer.byteLength(chunk) < 512));
  assert.throws(() => splitEmbeddingText('  '), /empty/);
});
