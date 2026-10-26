import 'dotenv/config';
import mongoose from 'mongoose';
import { app } from './app.js';
import { startWorker } from './worker/worker.js';
import { requireStartupConfig, startupFailureMessage } from './config/startup.js';

const PORT = Number(process.env.PORT) || 8000;
let stage = 'configuration';
try {
  requireStartupConfig();
  console.log('Required server configuration is present. Connecting to Atlas...');
  stage = 'database connection';
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  console.log('Atlas connected. Initializing application indexes...');
  stage = 'index initialization';
  // Unique indexes must exist before webhook requests can race each other.
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  stage = 'HTTP server';
  const stopWorker = startWorker();
  const server = app.listen(PORT, () => console.log(`Engram ready at http://localhost:${PORT}`));
  const shutdown = () => { stopWorker(); server.close(() => mongoose.disconnect().then(() => process.exit(0))); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} catch (error) {
  console.error(startupFailureMessage(error, stage));
  // Close driver resources so failed deploys exit rather than hanging on sockets.
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
}
