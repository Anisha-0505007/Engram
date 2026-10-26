import 'dotenv/config';
import mongoose from 'mongoose';
import { app } from './app.js';
import { connectToDatabase } from './config/database.js';
import { startupFailureMessage } from './config/startup.js';

let stage = 'database connection';
try {
  await connectToDatabase();
} catch (error) {
  console.error(startupFailureMessage(error, stage));
  await mongoose.disconnect().catch(() => {});
  // Keep the original driver error and any connection details out of function logs.
  throw new Error('Engram could not initialize its database connection.');
}

export default app;
