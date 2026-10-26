import test from 'node:test';
import assert from 'node:assert/strict';
import { requireStartupConfig, startupFailureMessage } from '../src/config/startup.js';

test('startup identifies missing variable names without printing configured values', () => {
  assert.throws(() => requireStartupConfig({ JWT_SECRET: 'private-fixture' }), error => {
    assert.deepEqual(error.missingKeys, ['MONGODB_URI']);
    const message = startupFailureMessage(error, 'configuration');
    assert.match(message, /MONGODB_URI/); assert.ok(!message.includes('private-fixture'));
    return true;
  });
  assert.doesNotThrow(() => requireStartupConfig({ MONGODB_URI: 'configured', JWT_SECRET: 'configured' }));
});
test('startup distinguishes auth, network, permissions and index failures without raw driver details', () => {
  for (const [code, stage, expected] of [[18, 'database connection', /authentication/], [13, 'index initialization', /permissions/], [11000, 'index initialization', /duplicate/], [85, 'index initialization', /conflicts/]]) {
    const result = startupFailureMessage({ code, message: 'private-fixture mongodb+srv://user:password@private.example' }, stage);
    assert.match(result, expected); assert.ok(!result.includes('private-fixture')); assert.ok(!result.includes('private.example'));
  }
  assert.match(startupFailureMessage({ name: 'MongooseServerSelectionError', message: 'private-host' }, 'database connection'), /Network Access/);
});
