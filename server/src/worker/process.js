import 'dotenv/config';
import mongoose from 'mongoose';
// Importing the app registers every model before the shared index initializer runs.
import '../app.js';
import { connectToDatabase } from '../config/database.js';
import { startupFailureMessage } from '../config/startup.js';
import { startWorker } from './worker.js';

let stopWorker;
try {
  await connectToDatabase();
  console.log('Engram background worker connected to MongoDB.');
  stopWorker = startWorker();
} catch (error) {
  console.error(startupFailureMessage(error, 'database connection'));
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
}

async function shutdown() {
  stopWorker?.();
  await mongoose.disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
