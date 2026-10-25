import { AsyncLocalStorage } from 'node:async_hooks';
import AiUsage from '../models/aiUsage.model.js';

const context = new AsyncLocalStorage();
export const withAiUser = (userId, fn) => context.run({ userId }, fn);
export async function reserveAiCall() {
  const userId = context.getStore()?.userId;
  if (!userId) throw new Error('AI request requires an authenticated owner');
  const day = new Date().toISOString().slice(0, 10);
  try {
    await AiUsage.updateOne({ userId, day }, {
      $setOnInsert: { calls: 0, expiresAt: new Date(Date.now() + 3 * 86400_000) },
    }, { upsert: true });
  } catch (error) { if (error.code !== 11000) throw error; }
  const reserved = await AiUsage.findOneAndUpdate({
    userId, day, calls: { $lt: Number(process.env.DAILY_AI_CALL_LIMIT) || 100 },
  }, { $inc: { calls: 1 } });
  if (!reserved) {
    const error = new Error('Daily AI quota reached. Processing resumes tomorrow (UTC).');
    error.code = 'AI_QUOTA';
    throw error;
  }
}
