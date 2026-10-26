import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import AiUsage from '../src/models/aiUsage.model.js';
import { withAiUser } from '../src/services/aiQuota.service.js';

function configureSimulation() {
  process.env.CLOUDFLARE_BASE_URL = process.env.AI_SIMULATION_URL || 'http://127.0.0.1:4900/cloudflare';
  process.env.CLOUDFLARE_ACCOUNT_ID = 'a'.repeat(32);
  process.env.CLOUDFLARE_API_TOKEN = 'simulation-placeholder';
}

test('Ask simulation retrieves links inside notes, sends original URLs and keeps sources for uncited answers', { skip: process.env.RUN_AI_SIMULATION !== '1' }, async t => {
  configureSimulation();
  process.env.JWT_SECRET = 'ask-simulation-test-secret';
  const { default: jwt } = await import('jsonwebtoken');
  const { default: Item } = await import('../src/models/item.model.js');
  const { app } = await import('../src/app.js');
  const db = await MongoMemoryServer.create();
  await mongoose.connect(db.getUri());
  const owner = new mongoose.Types.ObjectId();
  const other = new mongoose.Types.ObjectId();
  const create = (userId, extra = {}) => Item.create({ userId, source: 'web', type: 'text', rawText: 'Software internship application https://example.com/internship',
    enrichment: { title: 'Summer role', summary: 'Apply for the summer opportunity.' }, ...extra });
  const expected = await create(owner);
  await create(other);
  await create(owner, { confidential: true });
  // Atlas is unavailable in in-memory Mongo. Simulate an empty index, not the database or AI HTTP client.
  t.mock.method(Item, 'aggregate', async pipeline => {
    if (pipeline[0].$search) return [];
    throw new Error('Atlas vector index unavailable in this fixture');
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const cookie = `token=${jwt.sign({ userId: String(owner) }, process.env.JWT_SECRET)}`;
  const ask = async q => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/items/ask`, { method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ q }) });
    assert.equal(response.status, 200);
    return response.json();
  };
  try {
    const found = await ask('Can you find any internship application links');
    assert.deepEqual(found.items.map(item => item._id), [String(expected._id)]);
    assert.match(found.answer, /https:\/\/example.com\/internship \[1\]/);
    assert.equal(found.sources.length, 1);
    const uncited = await ask('internship application links uncited-answer-fixture');
    assert.equal(uncited.sources.length, 1);
    assert.match(uncited.answer, /could not generate a reliably cited answer/);
    const absent = await ask('no-match-fixture');
    assert.equal(absent.items.length, 0);
    assert.equal(absent.sources.length, 0);
    assert.equal(absent.answer, "I couldn't find that in your saved items.");
  } finally {
    await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect(); await db.stop();
  }
});

test('Cloudflare simulation: JSON repair, image/PDF enrichment, embeddings and errors over real HTTP', { skip: process.env.RUN_AI_SIMULATION !== '1' }, async t => {
  configureSimulation();
  // Only the Mongo quota store is isolated; HTTP, provider parsing and schemas run for real.
  t.mock.method(AiUsage, 'updateOne', async () => ({}));
  t.mock.method(AiUsage, 'findOneAndUpdate', async () => ({ calls: 1 }));
  const { enrichText, enrichImage, embedText } = await import('../src/services/llm.service.js');
  await withAiUser('fixture-owner', async () => {
    assert.equal((await enrichText('repair-fixture')).title, 'Saved fixture');
    const image = await enrichImage(Buffer.from([1, 2, 3]), 'image/png');
    assert.match(image.extractedText, /100 Mbps/);
    const pdf = await enrichImage(Buffer.from('%PDF-synthetic'), 'application/pdf');
    assert.match(pdf.extractedText, /100 Mbps/);
    const vector = await embedText('wifi '.repeat(300));
    assert.equal(vector.length, 768); assert.ok(Math.abs(Math.hypot(...vector) - 1) < 1e-8);
    await assert.rejects(enrichText('outage-fixture'), /503/);
    await assert.rejects(enrichText('rate-limit-fixture'), /429/);
  });
});

test('real AI HTTP client processes an item and marks exhausted jobs failed', { skip: process.env.RUN_AI_SIMULATION_DB !== '1' }, async () => {
  configureSimulation();
  const { enrichText, embedText } = await import('../src/services/llm.service.js');
  const { enrichItem } = await import('../src/services/enrich.service.js');
  const { processOneJob } = await import('../src/worker/worker.js');
  const { default: Item } = await import('../src/models/item.model.js');
  const { default: Job } = await import('../src/models/job.model.js');
  const db = await MongoMemoryServer.create();
  try {
    await mongoose.connect(db.getUri());
    await AiUsage.init();
    const userId = new mongoose.Types.ObjectId();
    const data = await withAiUser(userId, () => enrichText('repair-fixture'));
    assert.equal(data.title, 'Saved fixture');
    const vector = await withAiUser(userId, () => embedText('wifi fixture'));
    assert.equal(vector.length, 768); assert.ok(Math.abs(Math.hypot(...vector) - 1) < 1e-8);
    const item = await Item.create({ userId, source: 'web', type: 'text', rawText: 'wifi fixture' });
    await enrichItemWithOwner();
    async function enrichItemWithOwner() { await withAiUser(userId, () => enrichItem(item._id, userId)); }
    const done = await Item.findOne({ _id: item._id, userId });
    assert.equal(done.status, 'done'); assert.equal(done.embedding.length, 768);
    await assert.rejects(withAiUser(userId, () => enrichText('outage-fixture')), /503/);
    await assert.rejects(withAiUser(userId, () => enrichText('rate-limit-fixture')), /429/);
    const broken = await Item.create({ userId, source: 'web', type: 'text', rawText: 'outage-fixture' });
    const job = await Job.create({ type: 'enrich', itemId: broken._id, maxAttempts: 1 });
    await processOneJob();
    assert.equal((await Job.findById(job._id)).status, 'failed');
    assert.equal((await Item.findById(broken._id)).status, 'failed');
    const deadline = await Item.create({ userId, source: 'web', type: 'text', rawText: 'deadline-fixture: Apply by 2026-11-01 at 17:00 IST' });
    await withAiUser(userId, () => enrichItem(deadline._id, userId));
    const organized = await Item.findOne({ _id: deadline._id, userId });
    assert.equal(organized.events.length, 1);
    assert.equal(organized.events[0].dueAt.toISOString(), '2026-11-01T11:30:00.000Z');
    const privateItem = await Item.create({ userId, source: 'web', type: 'text', rawText: 'private-image-fixture' });
    await withAiUser(userId, () => enrichItem(privateItem._id, userId));
    const protectedItem = await Item.findOne({ _id: privateItem._id, userId });
    assert.equal(protectedItem.confidential, true);
    assert.equal(protectedItem.embedding, undefined);
    assert.equal(protectedItem.searchText, '');
    const unknown = await Item.create({ userId, source: 'web', type: 'image', rawText: 'missing-classification-fixture' });
    const unknownJob = await Job.create({ type: 'enrich', userId, itemId: unknown._id, maxAttempts: 1 });
    await processOneJob({ enrich: () => enrichText('missing-classification-fixture') });
    assert.equal((await Job.findOne({ _id: unknownJob._id, userId })).status, 'failed');
    const hidden = await Item.findOne({ _id: unknown._id, userId });
    assert.equal(hidden.privacyPending, true);
    assert.equal(hidden.status, 'failed');
  } finally { await mongoose.disconnect(); await db.stop(); }
});
