import 'dotenv/config';
import { z } from 'zod';
import { callCloudflare, CLOUDFLARE_MODEL } from '../src/services/cloudflare.service.js';
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from '../src/services/embedding.service.js';

// Synthetic probes bypass the per-user Mongo quota; no saved content is accessed.
const run = (path, body) => callCloudflare(path, body, { countQuota: false });
const alternate = process.argv.includes('--alternate-model');
const model = alternate ? '@cf/meta/llama-3.2-1b-instruct' : CLOUDFLARE_MODEL;
function reportFailure(label, error) {
  // Never print raw upstream responses or schema errors that may contain input.
  const message = error.message?.startsWith('Cloudflare')
    ? error.message : 'Response validation or connectivity failed. Private details hidden.';
  console.error(`FAIL: ${label}. ${message}`);
  process.exitCode = 1;
}
try {
  if (process.argv.includes('--accept-model-terms')) {
    if (alternate) throw new Error('Use the terms flag only with the original vision model.');
    await run(`/run/${CLOUDFLARE_MODEL}`, { prompt: 'agree' });
    console.log('Model terms acceptance request succeeded. Run this script again to verify inference.');
  } else {
    console.log(`Testing generation model: ${model}`);
    try {
    const started = Date.now();
    const result = await run(`/run/${model}`, {
      messages: [{ role: 'user', content: 'Return only a JSON object with a single field ok set to true. No markdown.' }],
      max_tokens: 128, temperature: 0,
    });
    const content = typeof result.response === 'object' ? JSON.stringify(result.response) : String(result.response || '');
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    z.object({ ok: z.literal(true) }).parse(JSON.parse(cleaned));
    console.log(`PASS: Cloudflare generation and JSON (${Date.now() - started} ms).`);
    } catch (error) { reportFailure('generation', error); }
    // Probe embeddings even if generation is forbidden, to isolate model access.
    try {
    const embedding = await run(`/run/${EMBEDDING_MODEL}`, { text: ['Synthetic Engram verification'] });
    const vector = z.array(z.number().finite()).length(EMBEDDING_DIMENSIONS).parse(embedding.data?.[0]);
    if (!Math.hypot(...vector)) throw new Error('empty vector');
    console.log(`PASS: Cloudflare embedding (${vector.length} dimensions).`);
    } catch (error) { reportFailure('embeddings', error); }
    if (!process.exitCode) console.log('Synthetic text and embeddings passed. Image/PDF quality and hosted configuration still need verification.');
    if (alternate) console.log('This text-only diagnostic does not change the app model or verify image support.');
  }
} catch (error) {
  // Only our adapter messages are safe to print, never raw transport/schema errors.
  reportFailure('AI check', error);
}
