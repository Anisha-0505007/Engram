import crypto from 'node:crypto';
import { z } from 'zod';
import User from '../models/user.model.js';
import LinkCode from '../models/linkCode.model.js';
import Item from '../models/item.model.js';
import Job from '../models/job.model.js';
import { enqueueEnrichment } from '../services/jobs.service.js';
import { sendWhatsAppReply } from '../services/whatsapp.service.js';

export async function saveItemIdempotent(itemData) {
  try { return await Item.create(itemData); }
  catch (error) {
    if (error.code !== 11000 || !itemData.waMessageId) throw error;
    const existing = await Item.findOne({ waMessageId: itemData.waMessageId, userId: itemData.userId });
    if (!existing) throw error;
    return existing;
  }
}

export function verifySignature(rawBody, signature) {
  if (!process.env.WHATSAPP_APP_SECRET || !Buffer.isBuffer(rawBody) || typeof signature !== 'string' || !/^sha256=[a-f\d]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signature.slice(7), 'hex');
  const actual = crypto.createHmac('sha256', process.env.WHATSAPP_APP_SECRET).update(rawBody).digest();
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function verifyWebhook(req, res) {
  const parsed = z.object({ 'hub.mode': z.literal('subscribe'), 'hub.verify_token': z.string(), 'hub.challenge': z.string().max(500) }).safeParse(req.query);
  if (!parsed.success || !process.env.WHATSAPP_VERIFY_TOKEN || parsed.data['hub.verify_token'] !== process.env.WHATSAPP_VERIFY_TOKEN) return res.sendStatus(403);
  res.status(200).send(parsed.data['hub.challenge']);
}

const Message = z.object({
  id: z.string().min(1).max(250), from: z.string().regex(/^\d{6,20}$/), type: z.string().max(40),
  timestamp: z.string().regex(/^\d+$/).optional(),
  text: z.object({ body: z.string().max(20000) }).optional(),
  image: z.object({ id: z.string().max(200), mime_type: z.string().optional(), caption: z.string().max(20000).optional() }).optional(),
  document: z.object({ id: z.string().max(200), mime_type: z.string().optional(), caption: z.string().max(20000).optional() }).optional(),
});
const Payload = z.object({ entry: z.array(z.object({ changes: z.array(z.object({
  value: z.object({ messages: z.array(Message).max(100).optional() }),
})).max(100) })).max(100).optional() });

// Unlinked/unsupported content is never persisted; replies contain no saved content.
const replyWithoutStorage = (phone, text) => sendWhatsAppReply(phone, text).catch(() => console.warn('WhatsApp instruction reply failed.'));

export async function processMessage(message) {
  let user = await User.findOne({ whatsappPhone: message.from });
  if (!user) {
    const code = message.type === 'text' ? message.text?.body.trim() : '';
    if (/^\d{6}$/.test(code)) {
      // TTL cleanup is asynchronous, so explicitly enforce age at consumption time.
      const linked = await LinkCode.findOneAndDelete({ code, createdAt: { $gt: new Date(Date.now() - 600_000) } });
      if (linked) {
        user = await User.findOneAndUpdate({ _id: linked.userId, whatsappPhone: { $exists: false } }, { whatsappPhone: message.from }, { returnDocument: 'after' });
        if (user) { void replyWithoutStorage(message.from, 'WhatsApp linked ✅ Send a link, note, image or PDF to save it.'); return; }
      }
    }
    void replyWithoutStorage(message.from, 'Open Engram, choose Get Link Code, then send the 6-digit code here.');
    return;
  }
  const media = message.type === 'image' ? message.image : message.document;
  const supported = (message.type === 'text' && message.text) || (message.type === 'image' && media) ||
    (message.type === 'document' && media?.mime_type === 'application/pdf');
  if (!supported) { void replyWithoutStorage(message.from, "Can't save that yet. Send a link, note, image or PDF (up to 10 MB)."); return; }
  const rawText = message.text?.body || media?.caption || '';
  const type = message.type === 'text' ? (/https?:\/\/[^\s]+/.test(rawText) ? 'link' : 'text') : message.type === 'image' ? 'image' : 'pdf';
  const item = await saveItemIdempotent({ userId: user._id, source: 'whatsapp', waMessageId: message.id,
    type, rawText, searchText: rawText, media: media ? { id: media.id, mime: media.mime_type } : undefined,
    originalTimestamp: message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date() });
  // Repeated deliveries repair a missing job, but cannot enqueue a second copy.
  await enqueueEnrichment(item);
  try {
    await Job.updateOne({ dedupeKey: `reply:${message.id}` }, { $setOnInsert: {
      type: 'reply', userId: user._id, phone: message.from, replyText: 'Saved ✅ Processing in the background.', dedupeKey: `reply:${message.id}`,
    } }, { upsert: true });
  } catch (error) { if (error.code !== 11000) throw error; }
}

export async function handleWebhook(req, res) {
  if (!verifySignature(req.rawBody, req.headers['x-hub-signature-256'])) return res.status(401).json({ error: 'Invalid signature' });
  const parsed = Payload.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid webhook payload' });
  try {
    for (const entry of parsed.data.entry || []) for (const change of entry.changes) {
      for (const message of change.value.messages || []) await processMessage(message);
    }
    // Acknowledge only durable capture + queue writes. Downloads and AI run later.
    res.sendStatus(200);
  } catch {
    console.error('Webhook capture failed; sender should retry.');
    res.sendStatus(503);
  }
}
