import express from 'express';
import authenticate from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { CaptureSchema, captureLinkedMessage } from '../services/linkedCapture.service.js';
import { fileURLToPath } from 'node:url';

const router = express.Router();
// Keep release binaries outside public/: rebuilding the React app clears that directory.
const windowsInstaller = fileURLToPath(new URL('../../../connector/dist/EngramConnectorSetup.exe', import.meta.url));
router.get('/download/windows', authenticate, rateLimit(10), (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.download(windowsInstaller, 'EngramConnectorSetup.exe', error => {
    if (!error) return;
    if (res.headersSent) return next(error);
    if (error.code === 'ENOENT') return res.status(503).json({ error: 'The Windows installer is not available on this server yet. Ask the Engram operator to publish it, or use manual setup.' });
    next(error);
  });
});
router.post('/capture', authenticate, rateLimit(60), express.json({ limit: '14mb' }), validate(CaptureSchema), async (req, res) => {
  try {
    const item = await captureLinkedMessage(req.userId, req.validated);
    res.json({ itemId: item._id, status: item.status });
  } catch (error) {
    if (/^(File|Media type)/.test(error.message)) return res.status(400).json({ error: error.message });
    throw error;
  }
});
export default router;
