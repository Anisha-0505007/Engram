import Job from '../models/job.model.js';

export async function enqueueEnrichment(item, retry = false) {
  const dedupeKey = `enrich:${item._id}`;
  // Retrying resets the existing job; concurrent clicks never create two workers.
  if (retry) {
    await Job.updateOne({ dedupeKey, status: { $in: ['done', 'failed'] } }, {
      $set: { status: 'queued', attempts: 0, runAt: new Date(), lockedAt: null, lastError: null },
    });
  }
  try {
    return await Job.findOneAndUpdate({ dedupeKey }, { $setOnInsert: {
      userId: item.userId, itemId: item._id, type: 'enrich', dedupeKey,
    } }, { upsert: true, returnDocument: 'after' });
  } catch (error) {
    if (error.code !== 11000) throw error;
    return Job.findOne({ dedupeKey });
  }
}
