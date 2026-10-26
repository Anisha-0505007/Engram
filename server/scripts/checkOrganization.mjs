import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mock } from 'node:test';
import AiUsage from '../src/models/aiUsage.model.js';
import { withAiUser } from '../src/services/aiQuota.service.js';
import { enrichText, enrichImage } from '../src/services/llm.service.js';
import { verifiedEvents } from '../src/services/organize.service.js';

// Exercise the real provider, parser and repair path without touching real user quotas.
mock.method(AiUsage, 'updateOne', async () => ({}));
mock.method(AiUsage, 'findOneAndUpdate', async () => ({ calls: 1 }));
const run = fn => withAiUser('synthetic-verification', fn);

const cases = [
  { name: 'deadline', text: 'Submit the internship report by 2026-11-01 at 17:00 IST.', check(data) {
    const events = verifiedEvents(data.events, this.text);
    assert.ok(events.some(event => event.dueAt.toISOString() === '2026-11-01T11:30:00.000Z'));
  } },
  { name: 'garden subject', text: 'This photo shows my garden, green plants and pink flowers.', check(data) {
    assert.match([data.title, data.summary, ...data.tags].join(' '), /garden/i);
    assert.equal(data.events.length, 0); assert.equal(data.confidential, false);
  } },
  { name: 'internship subject', text: 'Software engineering internship application: https://example.com/internship. No closing date announced.', check(data) {
    assert.match([data.title, data.summary, ...data.tags].join(' '), /internship/i);
    assert.equal(data.events.length, 0);
  } },
];
for (const fixture of cases) {
  try {
    fixture.check(await run(() => enrichText(fixture.text, '2026-10-26T10:00:00Z')));
    console.log(`PASS: ${fixture.name}`);
  } catch { console.error(`FAIL: ${fixture.name}. Synthetic output did not meet the expected contract or the provider was unavailable.`); process.exitCode = 1; }
}
if (process.argv.includes('--images')) {
  for (const name of ['deadline', 'identity']) {
    try {
      const image = await readFile(new URL(`../../.cache/${name}-fixture.png`, import.meta.url));
      const data = await run(() => enrichImage(image, 'image/png', '2026-10-26T10:00:00Z'));
      if (name === 'identity') assert.equal(data.confidential, true);
      else {
        assert.match(data.extractedText, /2026-11-01/);
        assert.ok(verifiedEvents(data.events, data.extractedText).some(event => event.dueAt.toISOString() === '2026-11-01T11:30:00.000Z'));
      }
      console.log(`PASS: synthetic ${name} image`);
    } catch { console.error(`FAIL: synthetic ${name} image`); process.exitCode = 1; }
  }
}
mock.restoreAll();
