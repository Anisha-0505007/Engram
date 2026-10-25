import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

test('real AI HTTP client processes an item, repairs JSON and handles provider errors', { skip: process.env.RUN_AI_SIMULATION !== '1' }, async () => {
  process.env.GEMINI_BASE_URL = 'http://127.0.0.1:4900/gemini';
  process.env.GEMINI_API_KEY = 'simulation-placeholder';
  const { enrichText, embedText } = await import('../src/services/llm.service.js');
  const { withAiUser } = await import('../src/services/aiQuota.service.js');
  const { enrichItem } = await import('../src/services/enrich.service.js');
  const { processOneJob } = await import('../src/worker/worker.js');
  const { default: Item } = await import('../src/models/item.model.js');
  const { default: Job } = await import('../src/models/job.model.js');
  const { default: AiUsage } = await import('../src/models/aiUsage.model.js');
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
  } finally { await mongoose.disconnect(); await db.stop(); }
});
