import test from 'node:test';
import assert from 'node:assert/strict';
import { requireStartupConfig, demoConfigurationIssues, startupFailureMessage } from '../src/config/startup.js';

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

test('demo preflight reports missing storage and AI separately without exposing configured credentials', () => {
  const env = { MONGODB_URI: 'private-fixture', JWT_SECRET: 'private-fixture', CLIENT_ORIGIN: 'https://demo.example' };
  assert.deepEqual(demoConfigurationIssues(env), [
    'SUPABASE_URL is missing', 'SUPABASE_SERVICE_ROLE_KEY is missing',
    'CLOUDFLARE_ACCOUNT_ID is missing', 'CLOUDFLARE_API_TOKEN is missing',
  ]);
  assert.ok(!demoConfigurationIssues(env).join(' ').includes('private-fixture'));
  Object.assign(env, { SUPABASE_URL: 'https://storage.example', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-key',
    CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32), CLOUDFLARE_API_TOKEN: 'synthetic-token' });
  assert.deepEqual(demoConfigurationIssues(env), []);
  env.SUPABASE_URL = 'https://private-fixture@storage.example/private-fixture';
  env.CLOUDFLARE_ACCOUNT_ID = 'private-fixture';
  const issues = demoConfigurationIssues(env).join(' ');
  assert.match(issues, /SUPABASE_URL/); assert.match(issues, /CLOUDFLARE_ACCOUNT_ID/);
  assert.ok(!issues.includes('private-fixture'));
  env.SUPABASE_URL = 'http://localhost:54321';
  env.CLOUDFLARE_ACCOUNT_ID = 'a'.repeat(32);
  assert.deepEqual(demoConfigurationIssues(env), []);
  env.NODE_ENV = 'production';
  assert.match(demoConfigurationIssues(env)[0], /SUPABASE_URL/);
});
