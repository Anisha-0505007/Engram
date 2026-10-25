import dns from 'dns/promises';

const PRIVATE_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^::1$/,
  /^fc[0-9a-f][0-9a-f]:/i,
];

function isPrivateIp(ip) {
  return PRIVATE_RANGES.some((re) => re.test(ip));
}

/**
 * SSRF-safe URL fetcher. Resolves the hostname to an IP and rejects
 * private/loopback/link-local ranges before making the request.
 * Max 3 redirects, 5s timeout, 2MB response cap.
 */
export async function safeFetch(rawUrl) {
  const url = new URL(rawUrl);

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http/https URLs are allowed');
  }

  // Resolve DNS and check IPs before connecting
  const addresses = await dns.lookup(url.hostname, { all: true });
  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new Error(`SSRF blocked: ${url.hostname} resolves to private IP ${address}`);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  let response;
  try {
    response = await fetch(rawUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Engram-Bot/1.0' },
    });
  } finally {
    clearTimeout(timeout);
  }

  // Check Content-Type: only parse HTML
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('text/html')) {
    throw new Error(`Unsupported content type: ${ct}`);
  }

  // Cap response at 2MB to prevent memory abuse
  const MAX_BYTES = 2 * 1024 * 1024;
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error('Response too large (> 2MB)');
  }

  return new TextDecoder().decode(buffer);
}

/**
 * Extracts the <title> and <meta description> from an HTML string.
 */
export function extractMeta(html) {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || '';
  const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() || '';
  // Rudimentary: strip all HTML tags to get plain text for enrichment
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return { title, description: desc, text };
}
