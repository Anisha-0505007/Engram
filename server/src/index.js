import 'dotenv/config';
import mongoose from 'mongoose';
import { app } from './app.js';
import { startWorker } from './worker/worker.js';

const PORT = Number(process.env.PORT) || 8000;
try {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) throw new Error('Configuration missing');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  // Unique indexes must exist before webhook requests can race each other.
  await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  const stopWorker = startWorker();
  const server = app.listen(PORT, () => console.log(`Engram ready at http://localhost:${PORT}`));
  const shutdown = () => { stopWorker(); server.close(() => mongoose.disconnect().then(() => process.exit(0))); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} catch {
  console.error('Startup failed. Check database connectivity and required server configuration.');
  process.exitCode = 1;
}
