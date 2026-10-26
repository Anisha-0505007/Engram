import { reserveAiCall } from './aiQuota.service.js';

export const CLOUDFLARE_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

function providerError(message, retryable = true) {
  return Object.assign(new Error(message), { retryable });
}

export async function callCloudflare(path, body, { countQuota = true } = {}) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !/^[a-f\d]{32}$/i.test(account) || !token?.trim()) {
    throw providerError('Cloudflare AI needs CLOUDFLARE_ACCOUNT_ID (32 hex characters) and CLOUDFLARE_API_TOKEN on the server.', false);
  }
  if (countQuota) await reserveAiCall();
  const base = process.env.CLOUDFLARE_BASE_URL || `https://api.cloudflare.com/client/v4/accounts/${account}/ai`;
  const multipart = body instanceof FormData;
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method: 'POST', signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${token}`, ...(!multipart ? { 'Content-Type': 'application/json' } : {}) },
      body: multipart ? body : JSON.stringify(body),
    });
  } catch { throw providerError('Cloudflare AI could not be reached. Please retry later.'); }
  if (!response.ok) {
    // Upstream bodies can echo private content; only expose status and our own advice.
    const reason = [401, 403].includes(response.status) ? 'Check the account ID, token permission and model terms.'
      : response.status === 429 ? 'Provider quota or rate limit reached. Try again later.'
      : 'Check model access and request limits.';
    throw providerError(`Cloudflare AI returned ${response.status}. ${reason}`, ![400, 401, 403, 404, 413, 422].includes(response.status));
  }
  let data;
  try { data = await response.json(); }
  catch { throw providerError('Cloudflare AI returned an unreadable response. Please retry later.'); }
  if (data.success !== true || data.result === undefined) {
    throw providerError('Cloudflare AI did not report a successful result. Check account access and model terms.');
  }
  return data.result;
}

export async function generateCloudflareText(prompt, parts = [], json = false) {
  if (parts.length > 1) throw providerError('Cloudflare AI accepts one image per request.', false);
  const part = parts[0]?.inlineData;
  if (parts.length && (!part || !['image/jpeg', 'image/png', 'image/webp'].includes(part.mimeType))) {
    throw providerError('Cloudflare vision needs a JPEG, PNG or WebP image. PDFs need document extraction.', false);
  }
  const instruction = json ? `${prompt}\nReturn only a JSON object, without markdown fences.` : prompt;
  const result = await callCloudflare(`/run/${CLOUDFLARE_MODEL}`, {
    // Chat roles prevent the model from continuing the prompt as unfinished text.
    // The image schema requires prompt; text-only requests accept chat messages.
    ...(part ? { prompt: instruction } : { messages: [{ role: 'user', content: instruction }] }),
    ...(part ? { image: [...Buffer.from(part.data, 'base64')] } : {}),
    max_tokens: 4096, temperature: 0.1,
  });
  if (result.finish_reason === 'length') throw providerError('Cloudflare AI output reached its token limit. Try a smaller document.');
  // Workers AI can return parsed JSON rather than a string for structured replies.
  const response = result.response && typeof result.response === 'object'
    ? JSON.stringify(result.response) : result.response;
  if (typeof response !== 'string' || !response.trim()) {
    throw providerError('Cloudflare AI returned no usable content.');
  }
  return response.trim();
}

export async function extractCloudflarePdf(buffer) {
  const form = new FormData();
  // Upload bytes directly; no public storage URL or personal filename is sent.
  form.append('files', new Blob([buffer], { type: 'application/pdf' }), 'document.pdf');
  const result = await callCloudflare('/tomarkdown', form);
  const file = result?.[0];
  if (file?.format !== 'markdown' || typeof file.data !== 'string' || !file.data.trim()) {
    throw providerError('Cloudflare could not extract readable PDF text. Try an unlocked PDF with selectable text.', false);
  }
  return file.data.slice(0, 100000);
}
