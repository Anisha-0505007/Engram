import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';

import authRoutes    from './routes/auth.routes.js';
import webhookRoutes from './routes/webhook.routes.js';

const app = express();
const PORT = process.env.PORT || 8000;

// helmet sets secure HTTP headers (e.g. prevents clickjacking, sniffing)
app.use(helmet());

// Only allow requests from our frontend origin; credentials=true lets the
// browser send cookies cross-origin during local development
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// ⚠️ Webhook MUST be mounted before express.json() — the webhook router
// uses its own express.json({ verify }) to capture raw bytes for HMAC checking.
// If global express.json() runs first, the raw body is gone.
app.use('/webhook/whatsapp', webhookRoutes);

app.use(express.json());   // parse JSON request bodies for all other routes
app.use(cookieParser());   // parse cookies so req.cookies.token works

// Mount auth routes under /api/auth
app.use('/api/auth', authRoutes);

// Health-check (used by Render to confirm the process is alive)
app.get('/', (_req, res) => {
  res.send('Engram API is running ✅');
});

// Connect to MongoDB Atlas then start listening
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed', err.message);
    process.exit(1); // crash fast so Render restarts and alerts us
  });
