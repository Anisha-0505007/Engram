import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { verifySignature } from '../src/controllers/webhook.controller.js';

test('verifySignature returns true for valid HMAC signature', () => {
  process.env.WHATSAPP_APP_SECRET = 'test_secret_123';
  const rawBody = Buffer.from(JSON.stringify({ event: 'test' }));
  
  const hmac = crypto.createHmac('sha256', process.env.WHATSAPP_APP_SECRET);
  hmac.update(rawBody);
  const validDigest = hmac.digest('hex');
  const signatureHeader = `sha256=${validDigest}`;

  assert.equal(verifySignature(rawBody, signatureHeader), true);
});

test('verifySignature returns false for invalid HMAC signature', () => {
  process.env.WHATSAPP_APP_SECRET = 'test_secret_123';
  const rawBody = Buffer.from(JSON.stringify({ event: 'test' }));
  const invalidSignatureHeader = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';

  assert.equal(verifySignature(rawBody, invalidSignatureHeader), false);
});

test('verifySignature returns false when signature header is missing or malformed', () => {
  process.env.WHATSAPP_APP_SECRET = 'test_secret_123';
  const rawBody = Buffer.from(JSON.stringify({ event: 'test' }));

  assert.equal(verifySignature(rawBody, null), false);
  assert.equal(verifySignature(rawBody, undefined), false);
  assert.equal(verifySignature(rawBody, 'invalidheaderformat'), false);
});
