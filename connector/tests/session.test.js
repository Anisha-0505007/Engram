import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { accountSessionPath, archiveSession, hasSavedSession } from '../src/session.js';
import { disconnectDiagnostic, authenticationFailureAdvice } from '../src/connection.js';

test('reset archives only the verified account session and preserves its outbox', async () => {
  const root = await mkdtemp(join(tmpdir(), 'engram-session-test-'));
  const owner = 'a'.repeat(24);
  const other = 'b'.repeat(24);
  try {
    for (const id of [owner, other]) {
      await mkdir(accountSessionPath(root, id), { recursive: true });
      await writeFile(join(accountSessionPath(root, id), 'synthetic.txt'), id);
    }
    const outbox = join(root, '.engram-outbox', owner);
    await mkdir(outbox, { recursive: true });
    await writeFile(join(outbox, 'synthetic.txt'), 'queued demo content');
    assert.equal(await archiveSession(root, owner), true);
    assert.equal(await hasSavedSession(root, owner), false);
    assert.equal(await hasSavedSession(root, other), true);
    assert.equal(await readFile(join(outbox, 'synthetic.txt'), 'utf8'), 'queued demo content');
    const backups = join(root, '.engram-session-backups', owner);
    const [backup] = await readdir(backups);
    assert.equal(await readFile(join(backups, backup, 'synthetic.txt'), 'utf8'), owner);
    assert.equal(await archiveSession(root, owner), false);
    assert.throws(() => accountSessionPath(root, '../another-account'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('disconnect diagnostics distinguish first pairing, confirmation and saved sessions without leaking payloads', () => {
  const error = { output: { statusCode: 401 }, message: 'PRIVATE PROVIDER TEXT', data: { token: 'PRIVATE TOKEN' } };
  assert.match(disconnectDiagnostic(error, {}).message, /before pairing code/);
  assert.match(disconnectDiagnostic(error, { pairingCodeShown: true }).message, /pairing confirmation/);
  assert.match(disconnectDiagnostic(error, { registered: true }).message, /saved session/);
  assert.match(disconnectDiagnostic(error, { connected: true }).message, /after connection/);
  assert.doesNotMatch(disconnectDiagnostic(error, {}).message, /PRIVATE/);
  assert.equal(disconnectDiagnostic({ output: { statusCode: 'PRIVATE' } }, {}).code, 'unknown');
  assert.match(authenticationFailureAdvice(false), /initial pairing/);
  assert.match(authenticationFailureAdvice(true), /saved session/);
});
