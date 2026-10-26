import 'dotenv/config';

const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const wabaId = process.argv[2];
const version = process.env.WHATSAPP_API_VERSION || 'v23.0';
if (!token || !phoneId || !/^\d+$/.test(wabaId || '')) {
  console.error('Configure WhatsApp credentials locally, then pass the public WABA ID as the first argument.');
  process.exit(1);
}
async function check(label, path, fields) {
  const query = fields ? `?fields=${encodeURIComponent(fields)}` : '';
  const response = await fetch(`https://graph.facebook.com/${version}/${path}${query}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Never log raw provider bodies, bearer tokens or URLs with credentials.
    console.log(`${label}: HTTP ${response.status}; Meta error code ${Number(data.error?.code) || 'unknown'}`);
    return null;
  }
  return data;
}
const state = value => typeof value === 'string' && /^[A-Z_ -]{1,80}$/.test(value) ? value : 'not returned';
try {
  const account = await check('WABA lookup', wabaId, 'id,account_review_status,business_verification_status,owner_business_info');
  if (account) {
    console.log(`Account review: ${state(account.account_review_status)}`);
    console.log(`Business verification: ${state(account.business_verification_status)}`);
    console.log(`Owner matches the denied Business Account: ${String(account.owner_business_info?.id) === '1414547740441498'}`);
  }
  const subscriptions = await check('WABA subscriptions', `${wabaId}/subscribed_apps`);
  if (subscriptions) console.log(`Subscribed apps: ${Array.isArray(subscriptions.data) ? subscriptions.data.length : 'not returned'}`);
  const phone = await check('Phone lookup', phoneId, 'id,code_verification_status');
  if (phone) console.log(`Phone code verification: ${state(phone.code_verification_status)}`);
} catch {
  console.error('Meta metadata check could not connect. No credentials were displayed.');
  process.exitCode = 1;
}
