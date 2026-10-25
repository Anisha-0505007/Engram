import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivateIp, safeFetch } from '../src/services/urlFetcher.service.js';
import { reciprocalRankFusion, buildFilter } from '../src/services/search.service.js';
import { QuerySchema } from '../src/services/queryUnderstanding.service.js';
import { parseStructured, EnrichmentSchema } from '../src/services/llm.service.js';
import { credentials, listSchema } from '../src/middleware/validate.js';
import { validateMedia } from '../src/services/media.service.js';

test('SSRF blocks private IPv4, IPv6 and mapped addresses', () => {
  for (const ip of ['0.0.0.0', '10.1.2.3', '172.31.1.1', '192.168.1.1', '127.0.0.1', '169.254.169.254', '100.64.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fd00::1', 'fe80::1']) assert.equal(isPrivateIp(ip), true, ip);
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(isPrivateIp(ip), false, ip);
});
test('SSRF rechecks redirects before making another connection', async () => {
  let connections = 0;
  await assert.rejects(safeFetch('https://public.example', {
    lookup: async () => [{ address: '8.8.8.8', family: 4 }],
    request: async () => { connections++; return { redirect: 'http://127.0.0.1/admin' }; },
  }), /blocked/);
  assert.equal(connections, 1);
});
test('SSRF caps redirects, rejects schemes and mixed public/private DNS', async () => {
  const lookup = async () => [{ address: '8.8.8.8', family: 4 }];
  let connections = 0;
  await assert.rejects(safeFetch('https://public.example', { lookup, request: async () => { connections++; return { redirect: '/loop' }; } }), /redirect/);
  assert.equal(connections, 4);
  await assert.rejects(safeFetch('file:///etc/passwd'), /http/);
  await assert.rejects(safeFetch('https://mixed.example', { lookup: async () => [{ address: '8.8.8.8' }, { address: '127.0.0.1' }] }), /blocked/);
});
test('RRF restarts ranks for each list and rewards overlap', () => {
  const a = { _id: 'a' }, b = { _id: 'b' }, c = { _id: 'c' };
  assert.deepEqual(reciprocalRankFusion([[a, b], [c, b]]).map(x => x._id), ['b', 'a', 'c']);
  assert.deepEqual(reciprocalRankFusion([[a, a], [b]]).map(x => x._id), ['a', 'b']);
});
test('query schema rejects invalid dates, reversed ranges and invalid types', () => {
  for (const query of [{ text: 'x', dateFrom: '2026-02-30' }, { text: 'x', dateFrom: 'yesterday' }, { text: 'x', type: 'sticker' }, { text: '', dateFrom: '2026-10-20', dateTo: '2026-10-01' }]) assert.equal(QuerySchema.safeParse(query).success, false);
  assert.equal(QuerySchema.safeParse({ text: '', type: 'link', dateFrom: '2026-08-01' }).success, true);
});
test('enrichment schema rejects malformed AI fields', () => {
  assert.throws(() => parseStructured('{"title":42}', EnrichmentSchema));
});
test('request validation rejects Mongo operators, unbounded pagination and long bcrypt inputs', () => {
  assert.equal(credentials.safeParse({ email: { $ne: '' }, password: '12345678' }).success, false);
  assert.equal(credentials.safeParse({ email: 'x@example.com', password: 'é'.repeat(40) }).success, false);
  for (const limit of ['0', '-1', '50000', 'abc']) assert.equal(listSchema.safeParse({ limit }).success, false);
});
test('filter owner is an ObjectId and dates use original timestamps', () => {
  const filter = buildFilter('0123456789abcdef01234567', { dateFrom: '2026-08-01', dateTo: '2026-08-31', type: 'image' });
  assert.equal(filter.userId._bsontype, 'ObjectId');
  assert.equal(filter.originalTimestamp.$lt.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(filter.type, 'image');
});
test('media rejects forged MIME types and oversized content', () => {
  assert.throws(() => validateMedia(Buffer.from('fake'), 'application/pdf'));
  assert.throws(() => validateMedia(Buffer.alloc(10 * 1024 * 1024 + 1), 'image/png'));
  assert.doesNotThrow(() => validateMedia(Buffer.from('%PDF-1.7\n'), 'application/pdf'));
});
