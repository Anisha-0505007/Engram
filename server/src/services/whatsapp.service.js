const base = process.env.WHATSAPP_BASE_URL || 'https://graph.facebook.com';
const version = process.env.WHATSAPP_API_VERSION || 'v23.0';
const token = () => process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;

export async function readLimitedBody(response, limit) {
  if (Number(response.headers.get('content-length')) > limit) throw new Error('File exceeds 10 MB limit');
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > limit) throw new Error('File exceeds 10 MB limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function downloadWhatsAppMedia(mediaId) {
  if (!token()) throw new Error('WhatsApp access token is not configured.');
  const headers = { Authorization: `Bearer ${token()}` };
  const metadata = await fetch(`${base}/${version}/${encodeURIComponent(mediaId)}`, {
    headers, signal: AbortSignal.timeout(10_000),
  });
  if (!metadata.ok) throw new Error(`WhatsApp media lookup failed (${metadata.status}).`);
  const data = await metadata.json();
  if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(data.mime_type)) throw new Error('Only JPEG, PNG, WebP and PDF files are supported.');
  if (Number(data.file_size) > 10 * 1024 * 1024) throw new Error('File exceeds 10 MB limit');
  const url = new URL(data.url);
  // Never forward the bearer token to an arbitrary URL from a malformed response.
  if (url.protocol !== 'https:' || !(url.hostname === 'facebook.com' || url.hostname.endsWith('.facebook.com') || url.hostname.endsWith('.fbcdn.net') || url.hostname.endsWith('.fbsbx.com'))) {
    throw new Error('Invalid WhatsApp media URL');
  }
  const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`WhatsApp media download failed (${response.status}).`);
  return { buffer: await readLimitedBody(response, 10 * 1024 * 1024), mimeType: data.mime_type };
}

export async function sendWhatsAppReply(phone, text) {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token() || !phoneId) throw new Error('WhatsApp replies are not configured.');
  const response = await fetch(`${base}/${version}/${phoneId}/messages`, {
    method: 'POST', signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: text } }),
  });
  if (!response.ok) throw new Error(`WhatsApp reply failed (${response.status}).`);
}
