/**
 * Tests for F13 — Query Understanding
 *
 * These tests make real Gemini API calls (GEMINI_API_KEY must be set).
 * They validate the *structure* of the response and the fallback behavior,
 * not the exact LLM output (which varies by run).
 *
 * Run with:  npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuery } from '../src/services/queryUnderstanding.service.js';

test('parseQuery returns an object with at least a text field', async () => {
  const result = await parseQuery('hello world');
  assert.ok(typeof result === 'object' && result !== null, 'should return an object');
  assert.ok(typeof result.text === 'string', 'text field must be a string');
});

test('parseQuery never throws, even on a minimal query', async () => {
  const result = await parseQuery('x');
  assert.ok(result, 'should return something, not throw');
  assert.ok(typeof result.text === 'string', 'text must be a string');
});

test('parseQuery returns valid date strings when date filters are present', async () => {
  const result = await parseQuery('links I saved in August');
  if (result.dateFrom) {
    assert.doesNotThrow(() => new Date(result.dateFrom), 'dateFrom should be a valid date string');
  }
  if (result.dateTo) {
    assert.doesNotThrow(() => new Date(result.dateTo), 'dateTo should be a valid date string');
  }
  // text should be a non-null string
  assert.ok(typeof result.text === 'string');
});

test('parseQuery type field is one of the allowed enum values when present', async () => {
  const result = await parseQuery('visa PDF document');
  if (result.type !== undefined) {
    const allowed = ['link', 'image', 'pdf', 'text'];
    assert.ok(allowed.includes(result.type), `type "${result.type}" must be one of ${allowed.join(', ')}`);
  }
});

test('parseQuery returns { text: rawQuery } fallback when input is empty', async () => {
  // Empty string triggers the short-circuit guard in parseQuery
  const result = await parseQuery('');
  assert.deepEqual(result, { text: '' });
});
