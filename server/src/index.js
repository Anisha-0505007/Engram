import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import authRoutes    from './routes/auth.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import itemRoutes    from './routes/item.routes.js';
import { startWorker } from './worker/worker.js';

const app = express();
const PORT = process.env.PORT || 8000;

// __dirname is not available in ESM — reconstruct it from import.meta.url
const __dirname = dirname(fileURLToPath(import.meta.url));

// helmet sets secure HTTP headers (e.g. prevents clickjacking, sniffing)
// contentSecurityPolicy disabled because the React build uses inline scripts
app.use(helmet({ contentSecurityPolicy: false }));

// In production Express serves the built React app so requests are same-origin.
// In development the Vite dev server (port 5173) needs explicit CORS allowance.
const isProd = process.env.NODE_ENV === 'production';
app.use(cors({
  origin: isProd ? false : (process.env.CLIENT_ORIGIN || 'http://localhost:5173'),
  credentials: true,
}));

// ⚠️ Webhook MUST be mounted before express.json() — the webhook router
// uses its own express.json({ verify }) to capture raw bytes for HMAC checking.
// If global express.json() runs first, the raw body is gone.
app.use('/webhook/whatsapp', webhookRoutes);

app.use(express.json());   // parse JSON request bodies for all other routes
app.use(cookieParser());   // parse cookies so req.cookies.token works

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);

// ── PRODUCTION: serve the built React app ────────────────────────────────────
// The build command copies client/dist → server/public.
// Any non-API request falls through to index.html so React Router (client-side
// routing) works — without this, refreshing /dashboard returns 404 on Render.
const publicDir = join(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.get('*', (_req, res) => {
  res.sendFile(join(publicDir, 'index.html'));
});

// Connect to MongoDB Atlas then start listening
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    startWorker(); // Start the background enrichment worker
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed', err.message);
    process.exit(1);
  });
