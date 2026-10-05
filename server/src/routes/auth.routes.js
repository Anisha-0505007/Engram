import express from 'express';
import { register, login, logout, me } from '../controllers/auth.controller.js';
import authenticate from '../middleware/authenticate.js';

const router = express.Router();

// Public routes — no token needed
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Protected route — authenticate middleware checks the cookie first
router.get('/me', authenticate, me);

export default router;
