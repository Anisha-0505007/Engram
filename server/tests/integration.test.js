import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from '../src/app.js';
import Item from '../src/models/item.model.js';
import User from '../src/models/user.model.js';
import Job from '../src/models/job.model.js';
import LinkCode from '../src/models/linkCode.model.js';
import AiUsage from '../src/models/aiUsage.model.js';
import { processOneJob, backoffMs, recoverStuckJobs } from '../src/worker/worker.js';
import { withAiUser, reserveAiCall } from '../src/services/aiQuota.service.js';

let db, server, base, cookie, owner, other;
async function request(path, { method = 'GET', body, auth = cookie, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: {
    ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Cookie: auth } : {}), ...headers,
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { response, data: await response.json().catch(() => null) };
}
test.before(async () => {
  process.env.JWT_SECRET = 'test-only-signing-secret';
  process.env.WHATSAPP_APP_SECRET = 'test-only-webhook-secret';
  // No real credentials or real AI calls are needed for these integration tests.
  delete process.env.GEMINI_API_KEY;
  db = await MongoMemoryServer.create(); await mongoose.connect(db.getUri());
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const registered = await request('/api/auth/register', { method: 'POST', auth: '', body: { email: 'owner@example.com', password: 'Test1234!' } });
  assert.equal(registered.response.status, 201);
  cookie = registered.response.headers.get('set-cookie').split(';')[0];
  owner = await User.findOne({ email: 'owner@example.com' });
  other = await User.create({ email: 'other@example.com', passwordHash: 'unused' });
});
test.after(async () => { await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await db.stop(); });
test.afterEach(async () => { await Promise.all([Item.deleteMany({}), Job.deleteMany({}), LinkCode.deleteMany({}), AiUsage.deleteMany({})]); });

test('authentication, Quick Add, item editing and cursor pagination work over HTTP', async () => {
  assert.equal((await request('/api/items', { auth: '' })).response.status, 401);
  for (const text of ['first note', 'second note', 'third note']) assert.equal((await request('/api/items', { method: 'POST', body: { text } })).response.status, 201);
  const first = await request('/api/items?limit=2');
  assert.equal(first.data.items.length, 2); assert.ok(first.data.nextCursor);
  const second = await request(`/api/items?limit=2&cursor=${first.data.nextCursor}`);
  assert.equal(second.data.items.length, 1);
  assert.equal(new Set([...first.data.items, ...second.data.items].map(x => x._id)).size, 3);
  const edited = await request(`/api/items/${first.data.items[0]._id}`, { method: 'PATCH', body: { tags: [], category: '' } });
  assert.deepEqual(edited.data.userEdits.tags, []);
  assert.equal((await request('/api/items?limit=0')).response.status, 400);
  assert.equal((await request('/api/items/not-an-id', { method: 'DELETE' })).response.status, 400);
});

test('browser auth accepts Express and Vite origins and rejects foreign origins', async () => {
  const credentials = { email: 'origin-check@example.com', password: 'Test1234!' };
  const registered = await request('/api/auth/register', { method: 'POST', auth: '', body: credentials, headers: { Origin: base } });
  assert.equal(registered.response.status, 201);
  for (const origin of [base, process.env.CLIENT_ORIGIN || 'http://localhost:5173']) {
    const login = await request('/api/auth/login', { method: 'POST', auth: '', body: credentials, headers: { Origin: origin } });
    assert.equal(login.response.status, 200, origin);
  }
  for (const origin of ['https://untrusted.example', 'http://localhost:5173.evil.example', 'null']) {
    const rejected = await request('/api/auth/login', { method: 'POST', auth: '', body: credentials, headers: { Origin: origin } });
    assert.equal(rejected.response.status, 403, origin);
  }
});
test('user A cannot list, search, edit, retry, delete or request media for B items', async () => {
  const foreign = await Item.create({ userId: other._id, source: 'web', type: 'text', rawText: 'isolationsecret', searchText: 'isolationsecret' });
  assert.equal((await request('/api/items')).data.items.length, 0);
  assert.equal((await request('/api/items/search?q=isolationsecret')).data.items.length, 0);
  for (const [method, suffix, body] of [['GET', '/media'], ['PATCH', '', { category: '', tags: [] }], ['DELETE', ''], ['POST', '/retry']]) {
    assert.equal((await request(`/api/items/${foreign._id}${suffix}`, { method, body })).response.status, 404);
  }
  assert.ok(await Item.exists({ _id: foreign._id, userId: other._id }));
});

async function webhook(messages) {
  const body = { entry: [{ changes: [{ value: { messages } }] }] };
  const signature = 'sha256=' + crypto.createHmac('sha256', process.env.WHATSAPP_APP_SECRET).update(JSON.stringify(body)).digest('hex');
  return request('/webhook/whatsapp', { method: 'POST', body, headers: { 'X-Hub-Signature-256': signature } });
}
test('duplicate batched webhooks create one item and one enrichment job per message', async () => {
  await User.updateOne({ _id: owner._id }, { whatsappPhone: '919876543210' });
  const messages = ['one', 'two'].map(id => ({ id, from: '919876543210', type: 'text', timestamp: '1785580800', text: { body: id } }));
  assert.equal((await webhook(messages)).response.status, 200);
  assert.equal((await webhook(messages)).response.status, 200);
  assert.equal(await Item.countDocuments(), 2);
  assert.equal(await Job.countDocuments({ type: 'enrich' }), 2);
  assert.equal(await Job.countDocuments({ type: 'reply' }), 2);
  assert.equal((await Item.findOne()).originalTimestamp.toISOString(), '2026-08-01T10:40:00.000Z');
});
test('bad signature fails; unlinked sender and unsupported messages store no items', async () => {
  assert.equal((await request('/webhook/whatsapp', { method: 'POST', body: {} })).response.status, 401);
  await webhook([{ id: 'unlinked', from: '911111111111', type: 'text', text: { body: 'private' } }]);
  await webhook([{ id: 'sticker', from: '919876543210', type: 'sticker' }]);
  assert.equal(await Item.countDocuments(), 0);
  assert.equal(await Job.countDocuments(), 0);
});
test('expired link code cannot link a phone even before TTL deletion', async () => {
  await LinkCode.create({ userId: other._id, code: '123456', createdAt: new Date(Date.now() - 660_000) });
  await webhook([{ id: 'code', from: '912222222222', type: 'text', text: { body: '123456' } }]);
  assert.equal((await User.findById(other._id)).whatsappPhone, undefined);
});
test('worker backs off, fails after max attempts, and recovers stale claims', async () => {
  const item = await Item.create({ userId: owner._id, source: 'web', type: 'text' });
  const job = await Job.create({ type: 'enrich', userId: owner._id, itemId: item._id, maxAttempts: 2 });
  const enrich = async () => { throw new Error('simulated AI outage'); };
  await processOneJob({ enrich });
  let current = await Job.findById(job._id);
  assert.equal(current.status, 'queued'); assert.equal(current.attempts, 1);
  assert.ok(current.runAt.getTime() > Date.now() + 20000);
  await Job.updateOne({ _id: job._id }, { runAt: new Date(0) });
  await processOneJob({ enrich });
  assert.equal((await Job.findById(job._id)).status, 'failed');
  assert.equal((await Item.findById(item._id)).status, 'failed');
  assert.equal(backoffMs(1), 30000); assert.equal(backoffMs(3), 480000);
  await Job.updateOne({ _id: job._id }, { status: 'running', lockedAt: new Date(0) });
  await recoverStuckJobs(); assert.equal((await Job.findById(job._id)).status, 'queued');
});
test('daily quota is atomic and a quota wait does not consume job attempts', async () => {
  process.env.DAILY_AI_CALL_LIMIT = '1';
  const calls = await Promise.allSettled([1, 2, 3].map(() => withAiUser(owner._id, reserveAiCall)));
  assert.equal(calls.filter(x => x.status === 'fulfilled').length, 1);
  const item = await Item.create({ userId: owner._id, source: 'web', type: 'text' });
  const job = await Job.create({ type: 'enrich', itemId: item._id });
  await processOneJob({ enrich: reserveAiCall });
  const current = await Job.findById(job._id);
  assert.equal(current.status, 'queued'); assert.equal(current.attempts, 0);
  assert.equal((await Item.findById(item._id)).status, 'pending');
  delete process.env.DAILY_AI_CALL_LIMIT;
});

test('concurrent retries reuse one job; deletion cancels queued work', async () => {
  const item = await Item.create({ userId: owner._id, source: 'web', type: 'text', status: 'failed' });
  const responses = await Promise.all([1, 2].map(() => request(`/api/items/${item._id}/retry`, { method: 'POST' })));
  assert.deepEqual(responses.map(x => x.response.status).sort(), [200, 409]);
  assert.equal(await Job.countDocuments({ itemId: item._id }), 1);
  assert.equal((await request(`/api/items/${item._id}`, { method: 'DELETE' })).response.status, 200);
  assert.equal(await Item.countDocuments({ _id: item._id }), 0);
  assert.equal(await Job.countDocuments({ itemId: item._id }), 0);
});
test('deletion refuses active jobs and releases its lock', async () => {
  const item = await Item.create({ userId: owner._id, source: 'web', type: 'text', status: 'processing' });
  await Job.create({ type: 'enrich', itemId: item._id, status: 'running' });
  assert.equal((await request(`/api/items/${item._id}`, { method: 'DELETE' })).response.status, 409);
  assert.equal((await Item.findById(item._id)).deleting, false);
});
