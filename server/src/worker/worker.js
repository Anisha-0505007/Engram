import Job from '../models/job.model.js';
import Item from '../models/item.model.js';
import { enrichItem } from '../services/enrich.service.js';

const POLL_MS = 5000;          // Check for new jobs every 5 seconds
const STUCK_THRESHOLD_MS = 60000; // Jobs running > 60s are considered stuck

function backoffMs(attempts) {
  // Exponential backoff: 30s, 120s, 480s
  return Math.min(30_000 * Math.pow(4, attempts - 1), 480_000);
}

async function recoverStuckJobs() {
  const stuckCutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);
  await Job.updateMany(
    { status: 'running', lockedAt: { $lt: stuckCutoff } },
    { status: 'queued', lockedAt: null }
  );
}

async function processOneJob() {
  // Atomic claim: find a queued job whose runAt has passed and mark it running
  const job = await Job.findOneAndUpdate(
    { status: 'queued', runAt: { $lte: new Date() } },
    { $set: { status: 'running', lockedAt: new Date() }, $inc: { attempts: 1 } },
    { new: true, sort: { runAt: 1 } }
  );

  if (!job) return; // No work to do right now

  try {
    await Item.findByIdAndUpdate(job.itemId, { status: 'processing' });
    await enrichItem(job.itemId);
    await Job.findByIdAndUpdate(job._id, { status: 'done' });
    console.log(`✅ Job ${job._id} done (item: ${job.itemId})`);
  } catch (err) {
    console.error(`❌ Job ${job._id} failed: ${err.message}`);

    const failed = job.attempts >= job.maxAttempts;
    await Job.findByIdAndUpdate(job._id, {
      status: failed ? 'failed' : 'queued',
      lastError: err.message,
      lockedAt: null,
      runAt: failed ? undefined : new Date(Date.now() + backoffMs(job.attempts)),
    });

    await Item.findByIdAndUpdate(job.itemId, {
      status: failed ? 'failed' : 'pending',
      error: err.message,
    });
  }
}

export function startWorker() {
  console.log('🔄 Worker started — polling every', POLL_MS / 1000, 'seconds');

  const tick = async () => {
    try {
      await recoverStuckJobs();
      await processOneJob();
    } catch (err) {
      console.error('Worker tick error:', err.message);
    } finally {
      setTimeout(tick, POLL_MS);
    }
  };

  tick();
}
