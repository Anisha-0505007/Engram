import crypto from 'crypto';
import User from '../models/user.model.js';
import LinkCode from '../models/linkCode.model.js';
import Item from '../models/item.model.js';

/**
 * Idempotently saves an item to the database.
 * ✍️ STUDENT WRITES THIS FUNCTION.
 * 
 * @param {Object} itemData - The parsed data to save
 * @returns {Object} The saved (or existing) item document
 * 
 * Steps:
 * 1. Meta might deliver the same webhook twice. We must not save duplicates.
 * 2. Use Item.create(itemData) wrapped in a try/catch block.
 * 3. If it succeeds, return the new item.
 * 4. If it fails with a MongoDB duplicate key error (error.code === 11000), 
 *    it means the waMessageId already exists. 
 *    In that case, catch the error, find the existing item using Item.findOne({ waMessageId: itemData.waMessageId }), and return that.
 * 5. If it's any other error, throw it so it can be handled upstream.
 */
export async function saveItemIdempotent(itemData) {
  try {
    const newItem = await Item.create(itemData);
    return newItem;
  } catch (error) {
    if (error.code === 11000) {
      const existingItem = await Item.findOne({ waMessageId: itemData.waMessageId });
      return existingItem;
    } else {
      throw error;
    }
  }
}



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
export const handleWebhook = async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];

  // rawBody was attached by the verify callback in index.js (see there)
  if (!verifySignature(req.rawBody, signature)) {

    console.warn('❌ Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Always return 200 quickly — Meta will retry if we're slow or error
  res.sendStatus(200);


  try {
    const body = req.body;

    // Check if this is an actual message event (Meta sends status updates too)
    if (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const message = body.entry[0].changes[0].value.messages[0];
      const fromPhone = message.from; // Sender's WhatsApp number

      // 1. Check if this phone number is linked to a user
      let user = await User.findOne({ whatsappPhone: fromPhone });

      // 2. If not linked, check if they sent a 6-digit link code
      if (!user && message.type === 'text') {
        const text = message.text.body.trim();
        if (/^\d{6}$/.test(text)) {
          const linkCode = await LinkCode.findOne({ code: text });
          if (linkCode) {
            // Link successful! Update user and delete code
            user = await User.findById(linkCode.userId);
            user.whatsappPhone = fromPhone;
            await user.save();
            await LinkCode.deleteOne({ _id: linkCode._id });
            console.log(`✅ Linked WhatsApp number ${fromPhone} to user ${user.email}`);
            // (In F6 we will actually reply to them via WhatsApp here)
            return;
          }
        }
        console.log(`⚠️ Unlinked phone ${fromPhone} sent a message. Ignoring.`);
        return; // Unlinked and not a valid code — do nothing
      }

      if (!user) return; // Still not linked

      // 3. Number is linked. Parse the message to prepare the Item data.
      let itemType = 'unsupported';
      let rawText = '';

      if (message.type === 'text') {
        itemType = 'text';
        rawText = message.text.body;
        // Basic URL detection (if it contains http/https, treat as link)
        if (/https?:\/\/[^\s]+/.test(rawText)) {
          itemType = 'link';
        }
      } else if (message.type === 'image') {
        itemType = 'image';
      } else if (message.type === 'document') {
        itemType = 'pdf'; // assuming PDF for now
      }

      const itemData = {
        userId: user._id,
        source: 'whatsapp',
        waMessageId: message.id,
        type: itemType,
        rawText,
        status: 'pending',
      };

      // 4. Save item idempotently!
      const savedItem = await saveItemIdempotent(itemData);
      console.log(`✅ Item saved/found: ${savedItem._id} (type: ${savedItem.type})`);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
  }
};
