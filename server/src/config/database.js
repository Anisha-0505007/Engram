import mongoose from 'mongoose';
import { requireStartupConfig } from './startup.js';

export async function connectToDatabase() {
  requireStartupConfig();
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  // Create unique indexes before accepting webhook writes or worker jobs.
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
}
