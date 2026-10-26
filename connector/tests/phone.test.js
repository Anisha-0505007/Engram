import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhoneNumber } from '../src/phone.js';

test('pairing accepts formatted numbers and rejects invalid input', () => {
  for (const phone of ['919999999999', '+91 99999 99999', '+91 (99999)-99999']) {
    assert.equal(normalizePhoneNumber(phone), '919999999999');
  }
  for (const phone of ['', '123', 'phone919999999999', '++919999999999', '000000000000', '9'.repeat(16)]) {
    assert.throws(() => normalizePhoneNumber(phone));
  }
});
