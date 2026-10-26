import express from 'express';
import authenticate from '../middleware/authenticate.js';
import organizeLegacy from '../middleware/organizeLegacy.js';
import { z } from 'zod';
import { validate, validateId, searchSchema, listSchema, edits } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  listItems,
  searchItems,
  askItems,
  getMediaUrl,
  updateItem,
  deleteItem,
  retryItem,
  createItem,
  uploadItem,
  setConfidential, setBookmark, listReminders, dismissReminder, itemOverview, retryClassification,
} from '../controllers/item.controller.js';

const router = express.Router();

router.use(authenticate);
router.use(organizeLegacy);
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/reminders', listReminders);
router.get('/overview', itemOverview);
router.post('/retry-classification', rateLimit(5), retryClassification);
router.get('/', validate(listSchema, 'query'), listItems);
router.get('/search', rateLimit(15), validate(searchSchema, 'query'), searchItems);
router.post('/ask', rateLimit(10), validate(searchSchema.extend({ q: z.string().trim().min(1).max(500) })), askItems);
router.post('/', rateLimit(30), validate(z.object({ text: z.string().trim().min(1).max(20000), confidential: z.boolean().default(false) })), createItem);
router.post('/upload', rateLimit(10), validate(z.object({
  data: z.string().min(4).max(14_000_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  caption: z.string().trim().max(20000).default(''),
  confidential: z.boolean().default(false),
})), uploadItem);
router.use('/:id', validateId);
router.get('/:id/media', getMediaUrl);
router.patch('/:id/bookmark', validate(z.object({ bookmarked: z.boolean() })), setBookmark);
router.patch('/:id', validate(edits), updateItem);
router.delete('/:id', deleteItem);
router.post('/:id/retry', rateLimit(10), retryItem);
router.post('/:id/confidential', setConfidential);
router.post('/:id/dismiss-reminder', validate(z.object({ key: z.string().regex(/^[a-f\d]{24}:(day|hour)$/i) })), dismissReminder);

export default router;

