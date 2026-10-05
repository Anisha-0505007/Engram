import express from 'express';
import { verifyWebhook, handleWebhook } from '../controllers/webhook.controller.js';

const router = express.Router();

// GET — Meta's one-time verification challenge
router.get('/', verifyWebhook);

// POST — incoming WhatsApp messages
// express.json() with a verify callback: parses JSON normally, but also
// saves the *raw bytes* as req.rawBody before parsing.
// This is needed because the HMAC signature is computed over the exact raw bytes.
router.post(
  '/',
  express.json({
    verify: (req, _res, buf) => {
      // buf is a Buffer of the raw request bytes — stash it for verifySignature
      req.rawBody = buf;
    },
  }),
  handleWebhook,
);

export default router;
