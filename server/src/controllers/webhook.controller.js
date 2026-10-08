import crypto from 'crypto';

/**
 * verifySignature
 * ✍️ STUDENT WRITES THIS FUNCTION.
 *
 * Meta sends a header: X-Hub-Signature-256: sha256=<hex_hash>
 * You must recompute the HMAC and compare it to the header.
 *
 * @param {Buffer} rawBody  - the exact bytes of the request body (set by the verify callback in index.js)
 * @param {string} signature - the full value of the X-Hub-Signature-256 header (e.g. "sha256=abc123...")
 * @returns {boolean} true if the signature matches, false otherwise
**/
export function verifySignature(rawBody, signature) {


  if (!signature) {
    return false;
  }

  const prefix = 'sha256=';
  if (!signature.startsWith(prefix)) {
    return false;
  }

  const expectedHex = signature.slice(prefix.length).trim();
  if (expectedHex.length === 0) {
    return false;
  }

  const hmac = crypto.createHmac('sha256', process.env.WHATSAPP_APP_SECRET);
  hmac.update(rawBody);
  const computedHex = hmac.digest('hex');

  const computedBuf = Buffer.from(computedHex, 'hex');
  const expectedBuf = Buffer.from(expectedHex, 'hex');

  if (computedBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(computedBuf, expectedBuf);
}

/**
 * GET /webhook/whatsapp
 * Meta calls this once when you register the URL, to confirm you own it.
 * It sends three query params: hub.mode, hub.verify_token, hub.challenge.
 * If mode === 'subscribe' and verify_token matches our env var, echo the challenge.
 */
export const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('✅ Webhook verified by Meta');
    return res.status(200).send(challenge);
  }

  // Token mismatch — someone else is trying to verify, or misconfigured
  res.status(403).json({ error: 'Verification failed' });
};

/**
 * POST /webhook/whatsapp
 * Meta sends every incoming WhatsApp message here.
 * We verify the signature first, then (for now) just log and return 200.
 * Real processing (parse, save, enqueue) comes in F3.
 */
export const handleWebhook = (req, res) => {
  const signature = req.headers['x-hub-signature-256'];

  // rawBody was attached by the verify callback in index.js (see there)
  if (!verifySignature(req.rawBody, signature)) {

    console.warn('❌ Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Always return 200 quickly — Meta will retry if we're slow or error
  // Real work (save + enqueue) happens asynchronously in F3+
  console.log('📨 Webhook received (signature OK) — processing TBD in F3');
  res.sendStatus(200);
};
