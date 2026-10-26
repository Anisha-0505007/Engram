import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOutbox } from '../src/outbox.js';
import { normalizeServerUrl, uploadFailureMessage } from '../src/api.js';

test('outbox survives a restart, deduplicates deliveries and retains failed HTTP attempts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'engram-outbox-test-'));
  try {
    let outbox = await createOutbox(directory);
    await Promise.all([outbox.add({ messageId: 'same', text: 'fixture' }), outbox.add({ messageId: 'same', text: 'fixture' })]);
    assert.equal((await readdir(directory)).length, 1);
    outbox = await createOutbox(directory);
    await assert.rejects(outbox.flushOne(async () => { throw Object.assign(new Error('outage'), { status: 503 }); }));
    assert.equal((await readdir(directory)).length, 1);
    let captured;
    assert.equal(await outbox.flushOne(async item => { captured = item; }), true);
    assert.equal(captured.messageId, 'same');
    assert.equal(await outbox.flushOne(async () => {}), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('invalid uploads are retained as failed files without blocking subsequent items', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'engram-outbox-test-'));
  try {
    const outbox = await createOutbox(directory);
    await outbox.add({ messageId: 'bad' });
    assert.equal(await outbox.flushOne(async () => { throw Object.assign(new Error('bad input'), { status: 400 }); }), 'rejected');
    assert.ok((await readdir(directory))[0].endsWith('.failed'));
    assert.equal(await outbox.flushOne(async () => {}), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a temporary failure on one item does not permanently block other queued items', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'engram-outbox-test-'));
  try {
    const outbox = await createOutbox(directory);
    await outbox.add({ messageId: 'first' }); await outbox.add({ messageId: 'second' });
    let failedId, sentId;
    await assert.rejects(outbox.flushOne(async item => {
      failedId = item.messageId; throw Object.assign(new Error('storage unavailable'), { status: 503 });
    }));
    await outbox.flushOne(async item => { sentId = item.messageId; });
    assert.notEqual(sentId, failedId);
    assert.equal((await readdir(directory)).length, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('credentials may only be sent over HTTPS or local HTTP', () => {
  assert.equal(normalizeServerUrl('http://localhost:8000/'), 'http://localhost:8000');
  assert.equal(normalizeServerUrl('https://engram.example'), 'https://engram.example');
  for (const input of ['http://example.com', 'https://user:password@example.com', 'https://example.com/path', 'https://example.com?token=x']) assert.throws(() => normalizeServerUrl(input));
});

test('upload failures identify configuration and deployment issues without exposing raw details', () => {
  assert.match(uploadFailureMessage({ status: 503, category: 'storage_missing' }), /SUPABASE_URL/);
  assert.match(uploadFailureMessage({ status: 404 }), /updated Engram backend/);
  assert.match(uploadFailureMessage({ status: 429 }), /rate limit/);
  assert.ok(!uploadFailureMessage({ status: 503, message: 'private message or credential' }).includes('private'));
});
