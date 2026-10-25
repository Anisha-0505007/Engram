import Item from '../models/item.model.js';
import Job from '../models/job.model.js';
import { embedText } from '../services/llm.service.js';

/**
 * GET /api/items
 * Returns paginated list of the user's items, newest first.
 * Query params: type, status, cursor (last item's createdAt ISO string)
 */
export const listItems = async (req, res) => {
  try {
    const { type, status, cursor, limit = 20 } = req.query;
    const filter = { userId: req.userId };
    if (type)   filter.type   = type;
    if (status) filter.status = status;
    if (cursor) filter.createdAt = { $lt: new Date(cursor) };

    const items = await Item.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit) + 1); // fetch one extra to know if there's a next page

    const hasMore = items.length > Number(limit);
    const results = hasMore ? items.slice(0, -1) : items;

    res.json({
      items: results,
      nextCursor: hasMore ? results.at(-1).createdAt.toISOString() : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/items/search?q=<query>
 * Hybrid search: runs keyword lookup + vector search in parallel, merges with RRF.
 */
export const searchItems = async (req, res) => {
  try {
    const { q, type } = req.query;
    if (!q) return res.json({ items: [] });

    const userId = req.userId;
    const filter = { userId };
    if (type) filter.type = type;

    // ── 1. KEYWORD SEARCH (MongoDB $text / $regex fallback) ──────────────────
    // Note: Real Atlas Search requires the index; here we use $regex as fallback
    // because Atlas Search $search pipeline needs Atlas-specific aggregation.
    const keywordResults = await Item.find({
      ...filter,
      $or: [
        { searchText: { $regex: q, $options: 'i' } },
        { rawText: { $regex: q, $options: 'i' } },
        { 'enrichment.tags': { $regex: q, $options: 'i' } },
      ],
    }).limit(20);

    // ── 2. VECTOR SEARCH ──────────────────────────────────────────────────────
    // If Atlas Vector Search index is configured, use aggregate pipeline.
    // Fallback: score by keyword overlap if no embeddings found.
    let vectorResults = [];
    try {
      const queryEmbedding = await embedText(q);
      vectorResults = await Item.aggregate([
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: 20,
            filter: { userId: { $eq: userId.toString() } },
          },
        },
        { $addFields: { _vsScore: { $meta: 'vectorSearchScore' } } },
      ]);
    } catch {
      // Vector index not set up yet or no embeddings — skip silently
    }

    // ── 3. RECIPROCAL RANK FUSION (RRF) ──────────────────────────────────────
    const K = 60;
    const scores = new Map();
    const allDocs = new Map();

    const addScore = (docs, rankList) => {
      docs.forEach((doc, i) => {
        const id = doc._id.toString();
        allDocs.set(id, doc);
        scores.set(id, (scores.get(id) || 0) + 1 / (K + i + 1));
      });
    };

    addScore(keywordResults, keywordResults);
    addScore(vectorResults, vectorResults);

    const ranked = [...scores.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id]) => allDocs.get(id));

    res.json({ items: ranked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/items/:id/media
 * Returns a presigned URL for the item's media file.
 */
export const getMediaUrl = async (req, res) => {
  try {
    const { getPresignedUrl } = await import('../services/storage.service.js');
    const item = await Item.findOne({ _id: req.params.id, userId: req.userId });
    if (!item?.media?.key) return res.status(404).json({ error: 'No media' });
    const url = await getPresignedUrl(item.media.key);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * PATCH /api/items/:id — update userEdits (tags, category)
 */
export const updateItem = async (req, res) => {
  try {
    const { category, tags } = req.body;
    const item = await Item.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { userEdits: { category, tags } },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE /api/items/:id — removes item + media + any pending jobs
 */
export const deleteItem = async (req, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, userId: req.userId });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    // Clean up media from Supabase
    if (item.media?.key) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      await supabase.storage.from('engram-media').remove([item.media.key]);
    }

    await Job.deleteMany({ itemId: item._id });
    await item.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/items/retry/:id — re-enqueue a failed item
 */
export const retryItem = async (req, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, userId: req.userId });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    await Item.findByIdAndUpdate(item._id, { status: 'pending', error: null });
    await Job.create({ type: 'enrich', itemId: item._id });
    res.json({ message: 'Requeued' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/items — Quick Add from the web UI
 */
export const createItem = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text is required' });

    const isLink = /https?:\/\/[^\s]+/.test(text);
    const item = await Item.create({
      userId: req.userId,
      source: 'web',
      type: isLink ? 'link' : 'text',
      rawText: text,
      status: 'pending',
    });
    await Job.create({ type: 'enrich', itemId: item._id });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
