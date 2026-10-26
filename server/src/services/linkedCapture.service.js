import crypto from 'node:crypto';
import { z } from 'zod';
import Item from '../models/item.model.js';
import { validateMedia } from './media.service.js';
import { uploadFile, deleteFile } from './storage.service.js';
import { enqueueEnrichment } from './jobs.service.js';

export const CaptureSchema = z.object({
  messageId: z.string().min(1).max(250),
  timestamp: z.iso.datetime(),
  text: z.string().max(20000).default(''),
  type: z.enum(['text', 'link', 'image', 'pdf']),
  media: z.object({
    data: z.string().min(4).max(14_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
    mime: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  }).optional(),
}).superRefine((value, context) => {
  const isMedia = ['image', 'pdf'].includes(value.type);
  if (isMedia !== Boolean(value.media)) context.addIssue({ code: 'custom', message: 'Media is required only for image/PDF messages' });
  if (!isMedia && !value.text.trim()) context.addIssue({ code: 'custom', message: 'Message text is empty' });
  if (value.media && (value.type === 'pdf') !== (value.media.mime === 'application/pdf')) context.addIssue({ code: 'custom', message: 'Media type mismatch' });
});

export async function captureLinkedMessage(userId, input, storage = { uploadFile, deleteFile }) {
  // Scope deduplication to the verified Engram owner; message IDs never grant access.
  const owner = { userId, captureId: input.messageId };
  let item = await Item.findOne(owner);
  if (item) { await enqueueEnrichment(item); return item; }
  let media;
  if (input.media) {
    const buffer = Buffer.from(input.media.data, 'base64');
    validateMedia(buffer, input.media.mime);
    const digest = crypto.createHash('sha256').update(input.messageId).digest('hex');
    const key = await storage.uploadFile(buffer, `${userId}/linked-${digest}`, input.media.mime);
    media = { key, mime: input.media.mime, size: buffer.length };
  }
  try {
    item = await Item.create({ ...owner, source: 'linked-device', type: input.type,
      rawText: input.text, searchText: input.text, originalTimestamp: new Date(input.timestamp), media });
  } catch (error) {
    if (error.code === 11000) item = await Item.findOne(owner);
    // A duplicate uses the same storage key, so never delete its media during a race.
    if (!item) { if (media) await storage.deleteFile(media.key); throw error; }
  }
  await enqueueEnrichment(item);
  return item;
}
