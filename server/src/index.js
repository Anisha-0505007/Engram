import 'dotenv/config';
import { app } from './app.js';
import { startWorker } from './worker/worker.js';
import mongoose from 'mongoose';
import { connectToDatabase } from './config/database.js';
import { requireStartupConfig, demoConfigurationIssues, startupFailureMessage } from './config/startup.js';

const PORT = Number(process.env.PORT) || 8000;
let stage = 'configuration';
try {
  requireStartupConfig();
  const demoIssues = demoConfigurationIssues();
  if (demoIssues.length) console.warn(`Demo configuration incomplete: ${demoIssues.join('; ')}. Media or AI workflows may be unavailable.`);
  console.log('Required server configuration is present. Connecting to Atlas...');
  stage = 'database connection';
  await connectToDatabase();
  console.log('Atlas connected and application indexes initialized.');
  stage = 'HTTP server';
  const stopWorker = startWorker();
  const server = app.listen(PORT, () => console.log(`Engram HTTP server listening on port ${PORT}. Provider workflows require separate verification.`));
  const shutdown = () => { stopWorker(); server.close(() => mongoose.disconnect().then(() => process.exit(0))); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} catch (error) {
  console.error(startupFailureMessage(error, stage));
  // Close driver resources so failed deploys exit rather than hanging on sockets.
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
}
