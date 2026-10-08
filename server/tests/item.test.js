import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { saveItemIdempotent } from '../src/controllers/webhook.controller.js';
import Item from '../src/models/item.model.js';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

test.after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test.afterEach(async () => {
  await Item.deleteMany({});
});

test('saveItemIdempotent saves a new item', async () => {
  const itemData = {
    userId: new mongoose.Types.ObjectId(),
    source: 'whatsapp',
    waMessageId: 'wamid.123',
    type: 'text',
    rawText: 'hello',
  };

  const saved = await saveItemIdempotent(itemData);
  assert.ok(saved._id);
  assert.equal(saved.waMessageId, 'wamid.123');

  const count = await Item.countDocuments();
  assert.equal(count, 1);
});

test('saveItemIdempotent returns existing item on duplicate waMessageId without throwing', async () => {
  const userId = new mongoose.Types.ObjectId();
  const itemData = {
    userId,
    source: 'whatsapp',
    waMessageId: 'wamid.duplicate',
    type: 'text',
    rawText: 'hello',
  };

  // 1st insert
  const saved1 = await saveItemIdempotent(itemData);
  
  // 2nd insert with exact same waMessageId
  const saved2 = await saveItemIdempotent(itemData);

  assert.equal(saved1._id.toString(), saved2._id.toString());
  
  const count = await Item.countDocuments();
  assert.equal(count, 1); // Should still only be 1 item in the DB
});

test('saveItemIdempotent throws on non-duplicate-key errors', async () => {
  const itemData = {
    source: 'whatsapp', // Missing required userId
    waMessageId: 'wamid.456',
    type: 'text',
  };

  await assert.rejects(
    async () => await saveItemIdempotent(itemData),
    (err) => err.name === 'ValidationError'
  );
});
