import express from 'express';
import { register, login, logout, me, generateLinkCode } from '../controllers/auth.controller.js';
import authenticate from '../middleware/authenticate.js';
import { validate, credentials } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = express.Router();

// Public routes — no token needed
router.post('/register', rateLimit(10, 15 * 60_000), validate(credentials), register);
router.post('/login', rateLimit(20, 15 * 60_000), validate(credentials), login);
router.post('/logout', logout);

// Protected routes — authenticate middleware checks the cookie first
router.get('/me', authenticate, me);
router.post('/link-code', authenticate, rateLimit(5), generateLinkCode);

export default router;
