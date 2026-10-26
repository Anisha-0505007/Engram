import 'dotenv/config';
import crypto from 'node:crypto';

const required = ['WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'];
const configured = key => Boolean(process.env[key] && !/^(your_|replace|<)/i.test(process.env[key]));
for (const key of required) console.log(`${key}: ${configured(key) ? 'configured' : 'MISSING'}`);
const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
console.log(`WHATSAPP_ACCESS_TOKEN: ${token && !/^your_/i.test(token) ? 'configured' : 'MISSING'}`);
const base = process.env.WHATSAPP_CHECK_URL || 'http://localhost:8000';
const endpoint = `${base.replace(/\/$/, '')}/webhook/whatsapp`;
const request = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
try {
  const rejected = await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  console.log(`Unsigned webhook: ${rejected.status === 401 ? 'PASS (401)' : `UNEXPECTED HTTP ${rejected.status}`}`);
  if (configured('WHATSAPP_VERIFY_TOKEN')) {
    const query = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': process.env.WHATSAPP_VERIFY_TOKEN, 'hub.challenge': 'engram-setup-check' });
    const response = await request(`${endpoint}?${query}`);
    console.log(`GET verification: ${response.ok && await response.text() === 'engram-setup-check' ? 'PASS' : 'FAILED (token mismatch or endpoint unavailable)'}`);
  }
  if (configured('WHATSAPP_APP_SECRET')) {
    // Empty signed event probes signature handling without storing content or sending replies.
    const signature = 'sha256=' + crypto.createHmac('sha256', process.env.WHATSAPP_APP_SECRET).update('{}').digest('hex');
    const response = await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature }, body: '{}' });
    console.log(`Signed empty event: ${response.status === 200 ? 'PASS (200)' : `FAILED HTTP ${response.status}`}`);
  }
  if (process.argv.includes('--check-meta') && configured('WHATSAPP_PHONE_NUMBER_ID') && token) {
    const version = process.env.WHATSAPP_API_VERSION || 'v23.0';
    const response = await request(`https://graph.facebook.com/${version}/${encodeURIComponent(process.env.WHATSAPP_PHONE_NUMBER_ID)}?fields=id`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`Meta phone ID/token lookup: HTTP ${response.status}`);
  }
} catch {
  console.error('Connectivity check failed. Check the running server/public URL and network. No credential values were logged.');
  process.exitCode = 1;
}
