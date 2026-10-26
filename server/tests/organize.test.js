import test from 'node:test';
import assert from 'node:assert/strict';
import { looksConfidential, verifiedEvents, reminderStage } from '../src/services/organize.service.js';
import { EnrichmentSchema } from '../src/services/llm.service.js';
import { parseStructured } from '../src/services/llm.service.js';

test('local privacy detection covers identity documents and credentials, leaving ordinary subjects alone', () => {
  for (const text of ['Aadhaar card', 'adhar card', 'aadhar', 'card no 4111 1111 1111 1111', 'password: demo', '2345 6789 0123']) assert.equal(looksConfidential(text), true, text);
  for (const text of ['garden photograph', 'internship opportunity', 'submit on 2026-11-01']) assert.equal(looksConfidential(text), false, text);
});

test('dates need source evidence and date-only events retain India calendar dates', () => {
  const events = verifiedEvents([
    { label: 'Apply', evidence: 'apply by 1 November 2026', date: '2026-11-01' },
    { label: 'Invented', evidence: 'not in the original', date: '2026-11-03' },
  ], 'Please apply by 1 November 2026.');
  assert.equal(events.length, 1);
  assert.equal(events[0].dueAt.toISOString(), '2026-11-01T18:29:59.000Z');
  assert.equal(events[0].dateOnly, true);
  const base = { title: '', description: '', summary: '', category: '', tags: [], events: [{ label: 'x', evidence: 'x', date: '2026-02-30' }] };
  assert.equal(EnrichmentSchema.safeParse(base).success, false);
});

test('reminders move from one-day to urgent and stop after the event', () => {
  const now = Date.parse('2026-10-26T00:00:00Z');
  assert.equal(reminderStage(now + 90000_000, now), null);
  assert.equal(reminderStage(now + 7200_000, now), 'day');
  assert.equal(reminderStage(now + 3600_000, now), 'hour');
  assert.equal(reminderStage(now - 1, now), null);
});

test('structured replies accept fenced JSON inside prose but still reject invalid fields', () => {
  const data = { title: 'Garden', description: '', summary: '', category: 'photos', tags: ['garden'], confidential: false };
  const parsed = parseStructured(`Here is the result:\n\n\`\`\`json\n${JSON.stringify(data)}\n\`\`\`\nEnd.`, EnrichmentSchema);
  assert.equal(parsed.title, 'Garden');
  const missingClassification = { ...data }; delete missingClassification.confidential;
  assert.equal(EnrichmentSchema.safeParse(missingClassification).success, false);
  assert.throws(() => parseStructured('Example: ```json\n{"title":23}\n```', EnrichmentSchema));
});
