import { z } from 'zod';
import { callCloudflare } from './cloudflare.service.js';

export const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
export const EMBEDDING_DIMENSIONS = 768;
const VectorSchema = z.array(z.number().finite()).length(EMBEDDING_DIMENSIONS);
const queryPrefix = 'Represent this sentence for searching relevant passages: ';

export function splitEmbeddingText(text, taskType) {
  if (!text.trim()) throw new Error('Cannot embed empty text.');
  const prefix = taskType === 'RETRIEVAL_QUERY' ? queryPrefix : '';
  const chunks = [];
  let chunk = '';
  let bytes = 0;
  // BGE allows 512 tokens. A 400-byte ceiling is conservative even for Unicode.
  for (const character of text.slice(0, 12000)) {
    const size = Buffer.byteLength(character);
    if (bytes + size > 400) {
      chunks.push(prefix + chunk);
      if (chunks.length === 32) return chunks;
      chunk = ''; bytes = 0;
    }
    chunk += character; bytes += size;
  }
  if (chunk) chunks.push(prefix + chunk);
  return chunks;
}

export async function embedText(text, taskType = 'RETRIEVAL_DOCUMENT') {
  const chunks = splitEmbeddingText(text, taskType);
  const result = await callCloudflare(`/run/${EMBEDDING_MODEL}`, { text: chunks });
  const vectors = z.array(VectorSchema).length(chunks.length).parse(result.data);
  const combined = Array(EMBEDDING_DIMENSIONS).fill(0);
  // Keep one vector per item while including content beyond BGE's first window.
  for (const vector of vectors) {
    const length = Math.hypot(...vector);
    if (!length) throw new Error('Cloudflare AI returned an empty embedding.');
    vector.forEach((value, index) => { combined[index] += value / length; });
  }
  const norm = Math.hypot(...combined);
  if (!norm) throw new Error('Cloudflare AI returned an empty combined embedding.');
  return combined.map(value => value / norm);
}
