import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { parseSelfMessage, readMedia } from '../src/messages.js';

const self = '919999999999@s.whatsapp.net';
const own = { key: { fromMe: true, id: 'message-one', remoteJid: self }, messageTimestamp: 1793000000, message: { conversation: 'saved note' } };
test('captures only the owner self-chat, never other chats or groups', () => {
  assert.equal(parseSelfMessage(own, [self]).text, 'saved note');
  for (const remoteJid of ['911111111111@s.whatsapp.net', 'group@g.us', 'status@broadcast']) {
    assert.equal(parseSelfMessage({ ...own, key: { ...own.key, remoteJid } }, [self]), null);
  }
  assert.equal(parseSelfMessage({ ...own, key: { ...own.key, fromMe: false } }, [self]), null);
  assert.equal(parseSelfMessage(own, []), null);
});
test('supports device-suffixed IDs and explicit LID identities', () => {
  assert.ok(parseSelfMessage(own, ['919999999999:12@s.whatsapp.net']));
  const lid = { ...own, key: { ...own.key, remoteJid: '123456@lid' } };
  assert.ok(parseSelfMessage(lid, [self, '123456@lid']));
  assert.equal(parseSelfMessage(lid, [self]), null);
});
test('recognizes links and supported media; ignores view-once and unsupported content', () => {
  assert.equal(parseSelfMessage({ ...own, message: { extendedTextMessage: { text: 'https://example.com' } } }, [self]).type, 'link');
  assert.equal(parseSelfMessage({ ...own, message: { imageMessage: { mimetype: 'image/png' } } }, [self]).type, 'image');
  assert.equal(parseSelfMessage({ ...own, message: { documentMessage: { mimetype: 'application/pdf' } } }, [self]).type, 'pdf');
  assert.equal(parseSelfMessage({ ...own, message: { viewOnceMessage: { message: { imageMessage: {} } } } }, [self]), null);
  assert.equal(parseSelfMessage({ ...own, message: { audioMessage: {} } }, [self]), null);
});
test('preserves timestamps and applies the media cap while streaming', async () => {
  assert.equal(parseSelfMessage(own, [self]).timestamp, new Date(1793000000 * 1000).toISOString());
  assert.equal(parseSelfMessage({ ...own, messageTimestamp: 'invalid' }, [self]), null);
  await assert.rejects(readMedia(Readable.from([Buffer.alloc(4), Buffer.alloc(4)]), 5), /limit/);
  assert.equal((await readMedia(Readable.from([Buffer.from('ok')]))).toString(), 'ok');
});
