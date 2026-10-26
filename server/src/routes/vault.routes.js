import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/user.model.js';
import authenticate from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { vaultCookie, vaultCookieOptions, vaultUnlocked } from '../middleware/vault.js';

const router = express.Router();
router.use(authenticate);
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/', (req, res) => res.json({ unlocked: vaultUnlocked(req) }));
router.post('/unlock', rateLimit(5, 15 * 60_000), validate(z.object({ password: z.string().min(1).max(72) })), async (req, res) => {
  const user = await User.findOne({ _id: req.userId });
  if (!user || !await bcrypt.compare(req.validated.password, user.passwordHash)) return res.status(403).json({ error: 'Incorrect password' });
  const token = jwt.sign({ userId: req.userId, session: req.cookies.token }, process.env.JWT_SECRET, { expiresIn: '5m', audience: 'engram-vault' });
  res.cookie(vaultCookie, token, vaultCookieOptions()).json({ unlocked: true, expiresIn: 300 });
});
router.post('/lock', (_req, res) => res.clearCookie(vaultCookie, vaultCookieOptions()).json({ unlocked: false }));
export default router;
