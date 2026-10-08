import express from 'express';
import { register, login, logout, me, generateLinkCode } from '../controllers/auth.controller.js';
import authenticate from '../middleware/authenticate.js';

const router = express.Router();

// Public routes — no token needed
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Protected routes — authenticate middleware checks the cookie first
router.get('/me', authenticate, me);
router.post('/link-code', authenticate, generateLinkCode);

export default router;
