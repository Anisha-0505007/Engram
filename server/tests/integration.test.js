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
import { captureLinkedMessage, CaptureSchema } from '../src/services/linkedCapture.service.js';
import { loginToEngram } from '../../connector/src/api.js';
import { buildFilter, vectorProjection } from '../src/services/search.service.js';

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
  delete process.env.CLOUDFLARE_API_TOKEN;
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

test('vector result projection preserves bookmark state and bookmark-section filtering', async () => {
  const saved = await Item.create({ userId: owner._id, source: 'web', type: 'text', rawText: 'Saved workshop', bookmarked: true });
  await Item.create({ userId: owner._id, source: 'web', type: 'text', rawText: 'Another workshop', bookmarked: false });
  await Item.create({ userId: other._id, source: 'web', type: 'text', rawText: 'Another owner', bookmarked: true });
  // In-memory Mongo cannot run Atlas Vector Search. Exercise the real projection
  // and the subsequent owner/bookmark filter with a fixed score instead.
  const results = await Item.aggregate([
    { $project: { ...vectorProjection, vectorScore: { $literal: 0.9 } } },
    { $match: buildFilter(String(owner._id), { section: 'bookmarks' }) },
  ]);
  assert.deepEqual(results.map(item => String(item._id)), [String(saved._id)]);
  assert.equal(results[0].bookmarked, true);
});

test('confidential items require a password unlock and stay outside AI retrieval', async () => {
  const saved = await request('/api/items', { method: 'POST', body: { text: 'Aadhaar card fixture' } });
  assert.equal(saved.response.status, 201);
  const id = saved.data._id;
  await processOneJob();
  assert.equal((await Item.findOne({ _id: id, userId: owner._id })).status, 'done');
  assert.equal((await request('/api/items')).data.items.length, 0);
  assert.equal((await request('/api/items?section=confidential')).data.items.length, 0);
  assert.equal((await request(`/api/items/${id}/media`)).response.status, 404);
  assert.equal((await request('/api/items/search?q=Aadhaar')).data.items.length, 0);
  assert.equal((await request('/api/items/ask', { method: 'POST', body: { q: 'Aadhaar' } })).data.sources.length, 0);
  const bad = await request('/api/vault/unlock', { method: 'POST', body: { password: 'incorrect' } });
  assert.equal(bad.response.status, 403);
  const unlocked = await request('/api/vault/unlock', { method: 'POST', body: { password: 'Test1234!' } });
  const vault = unlocked.response.headers.get('set-cookie').split(';')[0];
  const auth = `${cookie}; ${vault}`;
  assert.equal((await request('/api/items?section=confidential&q=Aadhaar', { auth })).data.items.length, 1);
  assert.equal((await request('/api/items', { auth })).data.items.length, 0);
  // A different signed login cannot borrow an unlock from another session.
  const jwt = (await import('jsonwebtoken')).default;
  const newLogin = await request('/api/auth/login', { method: 'POST', auth: '', body: { email: 'owner@example.com', password: 'Test1234!' } });
  const differentCookie = newLogin.response.headers.get('set-cookie').split(';')[0];
  assert.notEqual(differentCookie, cookie);
  assert.equal((await request('/api/items?section=confidential', { auth: `${differentCookie}; ${vault}` })).data.items.length, 0);
  const expired = jwt.sign({ userId: String(owner._id), session: cookie.slice(6) }, process.env.JWT_SECRET, { expiresIn: -1, audience: 'engram-vault' });
  assert.equal((await request('/api/items?section=confidential', { auth: `${cookie}; engramVault=${expired}` })).data.items.length, 0);
});

test('sections overlap, Upcoming sorts by nearest event, and reminders dismiss per stage', async () => {
  const later = new Date(Date.now() + 12 * 3600_000), soon = new Date(Date.now() + 30 * 60_000);
  const first = await Item.create({ userId: owner._id, source: 'web', type: 'text', rawText: 'Apply https://example.com/internship', events: [{ label: 'Apply', evidence: 'fixture', dueAt: later }], status: 'done' });
  const second = await Item.create({ userId: owner._id, source: 'web', type: 'text', rawText: 'Interview', events: [{ label: 'Interview', evidence: 'fixture', dueAt: soon }], status: 'done' });
  await Item.create({ userId: other._id, source: 'web', type: 'text', rawText: 'Other user event', events: [{ label: 'Hidden', dueAt: soon }] });
  assert.equal((await request('/api/items?section=links')).data.items[0]._id, String(first._id));
  const upcoming = await request('/api/items?section=upcoming&limit=1');
  assert.equal(upcoming.data.items[0]._id, String(second._id));
  const next = await request(`/api/items?section=upcoming&limit=1&cursor=${upcoming.data.nextCursor}`);
  assert.equal(next.data.items[0]._id, String(first._id));
  const reminders = (await request('/api/items/reminders')).data.reminders;
  assert.equal(reminders.length, 2); assert.equal(reminders[0].stage, 'hour');
  await request(`/api/items/${second._id}/dismiss-reminder`, { method: 'POST', body: { key: reminders[0].key } });
  assert.equal((await request('/api/items/reminders')).data.reminders.length, 1);
});

test('Photos excludes confidential and unclassified images and date filters preserve original timestamps', async () => {
  await Item.create({ userId: owner._id, source: 'web', type: 'image', rawText: 'garden photograph', privacyPending: false, originalTimestamp: '2026-08-01T12:00:00Z' });
  await Item.create({ userId: owner._id, source: 'web', type: 'image', rawText: 'unclassified upload' });
  await Item.create({ userId: owner._id, source: 'web', type: 'image', rawText: 'Aadhaar', privacyPending: false });
  assert.equal((await request('/api/items?section=photos')).data.items.length, 1);
  const overview = await request('/api/items/overview');
  assert.deepEqual(overview.data, { confidential: 1, classifying: 1, classificationFailed: 0 });
  assert.equal((await request('/api/items?dateFrom=2026-08-01&dateTo=2026-08-01')).data.items.length, 1);
  await Item.create({ userId: owner._id, source: 'web', type: 'text', rawText: 'Just after midnight in India', originalTimestamp: '2026-07-31T19:00:00Z' });
  assert.equal((await request('/api/items?dateFrom=2026-08-01&dateTo=2026-08-01&timezone=Asia%2FKolkata')).data.items.length, 2);
});

test('existing files queue automatic privacy classification once without password unlock', async () => {
  const existing = await Item.collection.insertOne({ userId: owner._id, source: 'web', type: 'image', rawText: 'Synthetic garden photo', status: 'done', originalTimestamp: new Date() });
  const foreign = await Item.collection.insertOne({ userId: other._id, source: 'web', type: 'image', rawText: 'Foreign fixture', status: 'done', originalTimestamp: new Date() });
  await Promise.all([request('/api/items'), request('/api/items/overview')]);
  const queued = await Item.findOne({ _id: existing.insertedId, userId: owner._id });
  assert.equal(queued.privacyPending, true);
  assert.equal(queued.status, 'pending');
  assert.ok(queued.privacyCheckQueuedAt);
  assert.equal(await Job.countDocuments({ userId: owner._id, itemId: existing.insertedId }), 1);
  assert.equal(await Job.countDocuments({ userId: other._id, itemId: foreign.insertedId }), 0);
  await Job.updateOne({ userId: owner._id, itemId: existing.insertedId }, { status: 'failed', attempts: 3 });
  await Item.updateOne({ userId: owner._id, _id: existing.insertedId }, { status: 'failed' });
  await request('/api/items/overview');
  assert.equal((await Job.findOne({ userId: owner._id, itemId: existing.insertedId })).status, 'failed');
  const retry = await request('/api/items/retry-classification', { method: 'POST' });
  assert.equal(retry.data.queued, 1);
  assert.equal((await Job.findOne({ userId: owner._id, itemId: existing.insertedId })).status, 'queued');
});

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

test('custom headings persist, remain searchable and reset without changing the original message', async () => {
  const saved = await request('/api/items', { method: 'POST', body: { text: 'original message fixture' } });
  const id = saved.data._id;
  const edited = await request(`/api/items/${id}`, { method: 'PATCH', body: { title: '  Semester reading list  ', category: 'Study', tags: ['books'] } });
  assert.equal(edited.response.status, 200);
  assert.equal(edited.data.userEdits.title, 'Semester reading list');
  assert.equal(edited.data.rawText, 'original message fixture');
  assert.match(edited.data.searchText, /Semester reading list/);
  const list = await request('/api/items');
  assert.equal(list.data.items.find(item => item._id === id).userEdits.title, 'Semester reading list');
  // A client using the older edit contract must preserve a heading it does not send.
  await request(`/api/items/${id}`, { method: 'PATCH', body: { category: 'Reading', tags: [] } });
  assert.equal((await Item.findOne({ _id: id, userId: owner._id })).userEdits.title, 'Semester reading list');
  assert.equal((await request(`/api/items/${id}`, { method: 'PATCH', body: { title: 'x'.repeat(161), category: '', tags: [] } })).response.status, 400);
  assert.equal((await request(`/api/items/${id}`, { method: 'PATCH', body: { title: '   ', category: '', tags: [] } })).response.status, 400);
  const foreign = await Item.create({ userId: other._id, source: 'web', type: 'text', rawText: 'other user' });
  assert.equal((await request(`/api/items/${foreign._id}`, { method: 'PATCH', body: { title: 'Forbidden', category: '', tags: [] } })).response.status, 404);
  const reset = await request(`/api/items/${id}`, { method: 'PATCH', body: { title: null, category: '', tags: [] } });
  assert.equal(reset.response.status, 200);
  assert.equal(reset.data.userEdits.title, undefined);
  assert.doesNotMatch(reset.data.searchText, /Semester reading list/);
});

test('bookmarks are owner-scoped, toggle explicitly and exclude private items', async () => {
  const saved = await request('/api/items', { method: 'POST', body: { text: 'bookmark fixture' } });
  const id = saved.data._id;
  const added = await request(`/api/items/${id}/bookmark`, { method: 'PATCH', body: { bookmarked: true } });
  assert.equal(added.response.status, 200);
  assert.equal(added.data.bookmarked, true);
  assert.equal((await request('/api/items?section=bookmarks')).data.items[0]._id, id);
  assert.equal((await request(`/api/items/${id}/bookmark`, { method: 'PATCH', body: { bookmarked: true } })).data.bookmarked, true);
  assert.equal((await request(`/api/items/${id}/bookmark`, { method: 'PATCH', body: { bookmarked: 'false' } })).response.status, 400);
  assert.equal((await request(`/api/items/${id}/bookmark`, { method: 'PATCH', auth: '', body: { bookmarked: false } })).response.status, 401);

  const foreign = await Item.create({ userId: other._id, source: 'web', type: 'text', rawText: 'foreign bookmark', bookmarked: true });
  assert.equal((await request('/api/items?section=bookmarks')).data.items.some(item => item._id === String(foreign._id)), false);
  assert.equal((await request(`/api/items/${foreign._id}/bookmark`, { method: 'PATCH', body: { bookmarked: false } })).response.status, 404);

  const privateItem = await Item.create({ userId: owner._id, source: 'web', type: 'text', rawText: 'private bookmark fixture', confidential: true });
  assert.equal((await request(`/api/items/${privateItem._id}/bookmark`, { method: 'PATCH', body: { bookmarked: true } })).response.status, 404);
  const removed = await request(`/api/items/${id}/bookmark`, { method: 'PATCH', body: { bookmarked: false } });
  assert.equal(removed.data.bookmarked, false);
  assert.equal((await request('/api/items?section=bookmarks')).data.items.length, 0);
});

test('linked capture uses JWT ownership, preserves timestamps and deduplicates concurrent delivery', async () => {
  const body = { messageId: 'linked-id', timestamp: '2026-08-01T12:30:00.000Z', type: 'text', text: 'self-chat fixture', userId: String(other._id) };
  assert.equal((await request('/api/connectors/capture', { method: 'POST', auth: '', body })).response.status, 401);
  const responses = await Promise.all([1, 2].map(() => request('/api/connectors/capture', { method: 'POST', body })));
  assert.ok(responses.every(result => result.response.status === 200));
  assert.equal(responses[0].data.itemId, responses[1].data.itemId);
  assert.equal(await Item.countDocuments({ userId: owner._id, captureId: 'linked-id' }), 1);
  assert.equal(await Item.countDocuments({ userId: other._id }), 0);
  assert.equal(await Job.countDocuments({ type: 'enrich' }), 1);
  const item = await Item.findOne({ userId: owner._id, captureId: 'linked-id' });
  assert.equal(item.originalTimestamp.toISOString(), body.timestamp);
  assert.equal(item.source, 'linked-device');
  // The same WhatsApp ID in another authenticated account cannot retrieve A's item.
  const second = await captureLinkedMessage(other._id, CaptureSchema.parse(body));
  assert.notEqual(String(second._id), String(item._id));
});
test('linked capture rejects mismatched media and invalid timestamps before enqueueing', async () => {
  for (const body of [
    { messageId: 'x', timestamp: 'bad', type: 'text', text: 'note' },
    { messageId: 'x', timestamp: '2026-08-01T00:00:00Z', type: 'image', text: 'note' },
  ]) assert.equal((await request('/api/connectors/capture', { method: 'POST', body })).response.status, 400);
  assert.equal(await Job.countDocuments(), 0);
});

test('local connector signs in and uploads through its real HTTP client', async () => {
  const client = await loginToEngram(base, 'owner@example.com', 'Test1234!');
  assert.equal(String(client.userId), String(owner._id));
  const captured = await client.send({ messageId: 'http-client-fixture', timestamp: '2026-10-26T00:00:00Z', type: 'text', text: 'fixture' });
  assert.equal((await Item.findOne({ userId: owner._id, _id: captured.itemId })).source, 'linked-device');
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
