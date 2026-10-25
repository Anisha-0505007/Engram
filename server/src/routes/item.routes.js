import express from 'express';
import authenticate from '../middleware/authenticate.js';
import {
  listItems,
  searchItems,
  getMediaUrl,
  updateItem,
  deleteItem,
  retryItem,
  createItem,
} from '../controllers/item.controller.js';

const router = express.Router();

router.get('/',            authenticate, listItems);
router.get('/search',      authenticate, searchItems);
router.post('/',           authenticate, createItem);       // Quick Add
router.get('/:id/media',   authenticate, getMediaUrl);
router.patch('/:id',       authenticate, updateItem);
router.delete('/:id',      authenticate, deleteItem);
router.post('/:id/retry',  authenticate, retryItem);

export default router;
