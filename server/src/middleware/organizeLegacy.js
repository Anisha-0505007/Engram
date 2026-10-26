import Item from '../models/item.model.js';
import { enqueueEnrichment } from '../services/jobs.service.js';

// Classify old uploads through the existing durable worker, without a review gate.
export default async function organizeLegacy(req, _res, next) {
  const owner = { userId: req.userId };
  const sensitive = /\b(aadhaar|aadhar|adhar|passport|pan\s*card|credit\s*card|debit\s*card|card\s*(no|number)|cvv|password|confidential|bank\s*account)\b|\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/i;
  await Item.updateMany({ ...owner, confidential: { $ne: true }, $or: [
    { rawText: sensitive }, { 'enrichment.extractedText': sensitive },
  ] }, { $set: { confidential: true, searchText: '', events: [] }, $unset: { embedding: 1 } });
  await Item.updateMany({ ...owner, privacyPending: { $exists: false }, type: { $in: ['image', 'pdf'] } }, { $set: { privacyPending: true } });
  const pending = await Item.find({ ...owner, privacyPending: true, confidential: { $ne: true },
    privacyCheckQueuedAt: { $exists: false }, deleting: { $ne: true } }).select('_id userId').limit(20).lean();
  for (const item of pending) {
    // Queue first: a crash before recording the marker safely reuses the same job.
    await enqueueEnrichment(item, true);
    await Item.updateOne({ ...owner, _id: item._id, privacyPending: true }, { $set: { privacyCheckQueuedAt: new Date() } });
    await Item.updateOne({ ...owner, _id: item._id, privacyPending: true, status: { $in: ['done', 'failed'] } }, { status: 'pending', error: null });
  }
  next();
}
