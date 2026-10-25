import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

export function isPrivateIp(value) {
  const ip = value.toLowerCase().replace(/^\[|\]$/g, '');
  if (net.isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 168].includes(b)) ||
      (a === 198 && [18, 19].includes(b));
  }
  if (net.isIP(ip) !== 6) return true;
  // Only globally routable 2000::/3 IPv6; reject mapped IPv4 and transition ranges.
  return !/^[23][0-9a-f]{0,3}:/i.test(ip) || /^200[12]:/i.test(ip) || /^2001:db8:/i.test(ip);
}

export async function resolvePublicUrl(rawUrl, lookup = dns.lookup) {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Only public http/https URLs are allowed');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(hostname) ? [{ address: hostname, family: net.isIP(hostname) }] : await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) throw new Error('URL points to a blocked network');
  return { url, address: addresses[0] };
}

function requestPage(url, address, timeoutMs) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    // Pin the checked address so the connection cannot perform a second DNS lookup.
    const request = transport.get(url, {
      agent: false, headers: { 'User-Agent': 'Engram-Bot/1.0', 'Accept-Encoding': 'identity' },
      lookup: (_host, options, callback) => options.all
        ? callback(null, [address]) : callback(null, address.address, address.family),
    }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.destroy(); clearTimeout(timer);
        return resolve({ redirect: response.headers.location });
      }
      if (response.statusCode < 200 || response.statusCode >= 300 || !response.headers['content-type']?.includes('text/html')) {
        request.destroy(new Error('Page is unavailable or is not HTML')); return;
      }
      let size = 0;
      const chunks = [];
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) request.destroy(new Error('Page exceeds 2 MB'));
        else chunks.push(chunk);
      });
      response.on('end', () => { clearTimeout(timer); resolve({ html: Buffer.concat(chunks).toString('utf8') }); });
      response.on('error', reject);
    });
    const timer = setTimeout(() => request.destroy(new Error('Page fetch timed out')), timeoutMs);
    request.on('error', error => { clearTimeout(timer); reject(error); });
  });
}

export async function safeFetch(rawUrl, { lookup = dns.lookup, request = requestPage } = {}) {
  const deadline = Date.now() + 5000;
  for (let redirects = 0; redirects <= 3; redirects++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Page fetch timed out');
    let timer;
    const checked = await Promise.race([
      resolvePublicUrl(rawUrl, lookup),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DNS timed out')), remaining); }),
    ]).finally(() => clearTimeout(timer));
    const result = await request(checked.url, checked.address, Math.max(1, deadline - Date.now()));
    if (result.html !== undefined) return result.html;
    if (!result.redirect || redirects === 3) throw new Error('Too many redirects or invalid redirect');
    rawUrl = new URL(result.redirect, checked.url).href;
  }
}

export function extractMeta(html) {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || '';
  const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() || '';
  const text = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return { title, description, text };
}
