import test from 'node:test';
import assert from 'node:assert/strict';
import { serverFromLaunchLink } from '../src/launch.js';

test('dashboard launch links accept HTTPS and local development origins', () => {
  assert.equal(serverFromLaunchLink('engram://connect?server=https%3A%2F%2Fengram.example'), 'https://engram.example');
  assert.equal(serverFromLaunchLink('engram://connect?server=http%3A%2F%2Flocalhost%3A8000'), 'http://localhost:8000');
});

test('launch links reject commands, credentials, duplicate servers and insecure remote URLs', () => {
  for (const value of ['cmd.exe', 'https://example.com', 'engram://other?server=https://example.com',
    'engram://connect?server=http://example.com', 'engram://connect?server=https://a.com&server=https://b.com',
    'engram://connect?server=https://a.com&command=calc', 'engram://connect?server=https://user:pass@a.com',
    'engram://connect/path?server=https://a.com', 'engram://connect?server=https://a.com#fragment']) {
    assert.throws(() => serverFromLaunchLink(value));
  }
});
