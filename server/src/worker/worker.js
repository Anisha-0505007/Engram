import Job from '../models/job.model.js';
import Item from '../models/item.model.js';
import { enrichItem } from '../services/enrich.service.js';
import { withAiUser } from '../services/aiQuota.service.js';
import { sendWhatsAppReply } from '../services/whatsapp.service.js';

const POLL_MS = 2000;
const STUCK_THRESHOLD_MS = 120_000;
export const backoffMs = attempts => Math.min(30_000 * 4 ** (attempts - 1), 480_000);

export async function recoverStuckJobs() {
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);
  await Job.updateMany({ status: 'running', lockedAt: { $lt: cutoff } }, { status: 'queued', lockedAt: null });
}

export async function processOneJob({ enrich = enrichItem, reply = sendWhatsAppReply } = {}) {
  const job = await Job.findOneAndUpdate({ status: 'queued', runAt: { $lte: new Date() } },
    { $set: { status: 'running', lockedAt: new Date() }, $inc: { attempts: 1 } },
    { returnDocument: 'after', sort: { type: -1, runAt: 1 } });
  if (!job) return false;
  // Heartbeats prevent another tick reclaiming a healthy, long-running AI job.
  const heartbeat = setInterval(() => {
    Job.updateOne({ _id: job._id, status: 'running' }, { lockedAt: new Date() }).catch(() => {});
  }, 20_000);
  try {
    if (job.type === 'reply') await reply(job.phone, job.replyText);
    else {
      const item = await Item.findById(job.itemId);
      if (item && !item.deleting) {
        await Item.updateOne({ _id: item._id, userId: item.userId }, { status: 'processing' });
        await withAiUser(item.userId, () => enrich(item._id, item.userId));
      }
    }
    await Job.updateOne({ _id: job._id }, { status: 'done', lockedAt: null });
  } catch (error) {
    const quota = error.code === 'AI_QUOTA';
    const failed = !quota && (error.retryable === false || job.attempts >= job.maxAttempts);
    const tomorrow = new Date(); tomorrow.setUTCHours(24, 0, 1, 0);
    await Job.updateOne({ _id: job._id }, { $set: {
      status: failed ? 'failed' : 'queued', lastError: error.message, lockedAt: null,
      runAt: quota ? tomorrow : new Date(Date.now() + backoffMs(job.attempts)),
    }, ...(quota ? { $inc: { attempts: -1 } } : {}) });
    if (job.itemId) {
      const item = await Item.findById(job.itemId);
      if (item) await Item.updateOne({ _id: item._id, userId: item.userId }, {
        status: failed ? 'failed' : 'pending', error: error.message,
      });
    }
  } finally { clearInterval(heartbeat); }
  return true;
}

export function startWorker() {
  let stopped = false;
  let timer;
  const tick = async () => {
    try { await recoverStuckJobs(); await processOneJob(); }
    catch { console.error('Worker could not reach the database. Retrying.'); }
    finally { if (!stopped) timer = setTimeout(tick, POLL_MS); }
  };
  tick();
  return () => { stopped = true; clearTimeout(timer); };
}
