import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import itemRoutes from './routes/item.routes.js';
import connectorRoutes from './routes/connector.routes.js';
import vaultRoutes from './routes/vault.routes.js';

export const app = express();
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
const allowedClientOrigins = new Set([
  process.env.CLIENT_ORIGIN,
  ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173']),
].filter(Boolean));
app.use(helmet({ contentSecurityPolicy: {
  directives: { 'img-src': ["'self'", 'data:', 'https:'], 'style-src': ["'self'", "'unsafe-inline'"], 'connect-src': ["'self'"] },
} }));
app.use(cors({
  origin: (origin, callback) => callback(null, Boolean(origin && allowedClientOrigins.has(origin))),
  credentials: true,
}));
app.use('/webhook/whatsapp', webhookRoutes);
app.use(cookieParser());
app.use('/api', (req, res, next) => {
  // CORS alone does not prevent cross-site writes. Enforce the browser's Origin too.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
    // The built UI uses Express's origin in development too; Vite is an additional origin.
    const allowed = new Set([`${req.protocol}://${req.get('host')}`, ...allowedClientOrigins]);
    if (!allowed.has(req.headers.origin)) return res.status(403).json({ error: 'Request origin is not allowed' });
  }
  next();
});
// Connector uploads are authenticated and limited before parsing their larger bodies.
app.use('/api/connectors', connectorRoutes);
app.use('/api/items/upload', express.json({ limit: '14mb' }));
app.use(express.json({ limit: '100kb' }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/items', itemRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
app.use(express.static(publicDir));
app.get('/{*path}', (_req, res) => res.sendFile(`${publicDir}/index.html`));
app.use((error, _req, res, _next) => {
  if (error.code === 'AI_QUOTA') return res.status(429).json({ error: error.message });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large' });
  if (error instanceof SyntaxError) return res.status(400).json({ error: 'Invalid JSON request' });
  // Provider response bodies, database details and saved content never reach logs.
  const safe = /^(AI |Media |Could not delete media|WhatsApp )/.test(error.message);
  res.status(503).json({ error: safe ? error.message : 'Service unavailable. Please try again.' });
});
