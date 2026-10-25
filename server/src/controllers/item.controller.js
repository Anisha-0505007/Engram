import Item from '../models/item.model.js';
import Job from '../models/job.model.js';
import { embedText } from '../services/llm.service.js';
import { parseQuery } from '../services/queryUnderstanding.service.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
 * GET /api/items/search?q=<query>&type=<type>
 * 1. Parses the natural language query into structured filters (F13)
 * 2. Runs keyword + vector search in parallel (F12, F14)
 * 3. Merges results with Reciprocal Rank Fusion (F14)
 */
export const searchItems = async (req, res) => {
  try {
    const { q, type } = req.query;
    if (!q) return res.json({ items: [] });

    const userId = req.userId;

    // ── 1. QUERY UNDERSTANDING (F13) ─────────────────────────────────────────
    // Parse "PG link from August" → { text: "PG", type: "link", dateFrom: "...", dateTo: "..." }
    const parsed = await parseQuery(q);

    // Build the MongoDB filter — userId is always from the verified JWT, never the request
    const filter = { userId };
    // Allow explicit ?type= override from UI filter buttons; otherwise use LLM-parsed type
    const resolvedType = type || parsed.type;
    if (resolvedType) filter.type = resolvedType;
    if (parsed.category) filter['enrichment.category'] = parsed.category;
    if (parsed.dateFrom || parsed.dateTo) {
      filter.createdAt = {};
      if (parsed.dateFrom) filter.createdAt.$gte = new Date(parsed.dateFrom);
      if (parsed.dateTo)   filter.createdAt.$lte = new Date(parsed.dateTo + 'T23:59:59Z');
    }

    const searchText = parsed.text || q; // fallback to raw query if LLM returned empty text

    // ── 2a. KEYWORD SEARCH ───────────────────────────────────────────────────
    const keywordResults = await Item.find({
      ...filter,
      $or: [
        { searchText:         { $regex: searchText, $options: 'i' } },
        { rawText:            { $regex: searchText, $options: 'i' } },
        { 'enrichment.tags':  { $regex: searchText, $options: 'i' } },
      ],
    }).limit(20);

    // ── 2b. VECTOR SEARCH ────────────────────────────────────────────────────
    let vectorResults = [];
    try {
      const queryEmbedding = await embedText(searchText);
      vectorResults = await Item.aggregate([
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: 20,
            // Pre-filter by userId — Atlas Vector Search supports pre-filtering
            filter: { userId: { $eq: userId.toString() } },
          },
        },
        { $addFields: { _vsScore: { $meta: 'vectorSearchScore' } } },
      ]);
    } catch {
      // Vector index not configured or no embeddings yet — degrade silently
    }

    // ── 3. RECIPROCAL RANK FUSION ─────────────────────────────────────────────
    // score(d) = Σ 1/(k + rank_i(d))  where k=60 is a smoothing constant
    const K = 60;
    const scores  = new Map();
    const allDocs = new Map();

    const addScore = (docs) => {
      docs.forEach((doc, i) => {
        const id = doc._id.toString();
        allDocs.set(id, doc);
        scores.set(id, (scores.get(id) || 0) + 1 / (K + i + 1));
      });
    };

    addScore(keywordResults);
    addScore(vectorResults);

    const ranked = [...scores.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([id]) => allDocs.get(id));

    res.json({ items: ranked, parsedQuery: parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/items/ask
 * Body: { q: string }
 * 1. Runs hybrid search to get top items
 * 2. Passes them to Gemini with a grounding prompt
 * 3. Returns { answer, sources: [item ids] }
 */
export const askItems = async (req, res) => {
  try {
    const { q } = req.body;
    if (!q?.trim()) return res.status(400).json({ error: 'q is required' });

    const userId = req.userId;

    // Reuse the search logic to get relevant items
    const parsed = await parseQuery(q);
    const filter = { userId };
    if (parsed.type)     filter.type = parsed.type;
    if (parsed.dateFrom || parsed.dateTo) {
      filter.createdAt = {};
      if (parsed.dateFrom) filter.createdAt.$gte = new Date(parsed.dateFrom);
      if (parsed.dateTo)   filter.createdAt.$lte = new Date(parsed.dateTo + 'T23:59:59Z');
    }

    const searchText = parsed.text || q;

    // Get keyword matches
    const keywordResults = await Item.find({
      ...filter,
      $or: [
        { searchText: { $regex: searchText, $options: 'i' } },
        { rawText:    { $regex: searchText, $options: 'i' } },
      ],
    }).limit(10);

    // Try vector search
    let vectorResults = [];
    try {
      const queryEmbedding = await embedText(searchText);
      vectorResults = await Item.aggregate([
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 50,
            limit: 10,
            filter: { userId: { $eq: userId.toString() } },
          },
        },
      ]);
    } catch { /* no vector index yet */ }

    // RRF merge
    const K = 60;
    const scores = new Map();
    const allDocs = new Map();
    [...keywordResults, ...vectorResults].forEach((doc, i) => {
      const id = doc._id.toString();
      allDocs.set(id, doc);
      scores.set(id, (scores.get(id) || 0) + 1 / (K + i + 1));
    });

    const topItems = [...scores.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => allDocs.get(id));

    if (topItems.length === 0) {
      return res.json({
        answer: "I couldn't find anything in your saved items that matches that question.",
        sources: [],
      });
    }

    // Build the grounding context — each item gets a short snippet the LLM can cite
    const context = topItems.map((item, i) => {
      const title   = item.enrichment?.title || item.rawText?.slice(0, 60) || 'Untitled';
      const summary = item.enrichment?.summary || item.rawText?.slice(0, 200) || '';
      return `[${i + 1}] ID:${item._id} — ${title}\n${summary}`;
    }).join('\n\n');

    const prompt = `You are a helpful assistant answering questions based ONLY on the user's saved items below.
Rules:
- Answer using only the information in the items. Do not add external knowledge.
- Cite the item by its number [1], [2] etc when you use information from it.
- If none of the items contain a relevant answer, say exactly: "I couldn't find that in your saved items."
- Be concise (2-4 sentences max).

User's question: "${q}"

Saved items:
${context}

Answer:`;

    const result = await model.generateContent(prompt);
    const answer = result.response.text().trim();

    // Extract which item IDs were cited (look for [1], [2] etc in the answer)
    const citedIndices = [...answer.matchAll(/\[(\d+)\]/g)]
      .map(m => parseInt(m[1]) - 1)
      .filter(i => i >= 0 && i < topItems.length);

    const sources = [...new Set(citedIndices)].map(i => ({
      _id:   topItems[i]._id,
      title: topItems[i].enrichment?.title || topItems[i].rawText?.slice(0, 60) || 'Untitled',
      type:  topItems[i].type,
    }));

    res.json({ answer, sources });
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
 * userEdits survive re-enrichment — they are never overwritten by the worker.
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
 * DELETE /api/items/:id — removes item, its media from storage, and pending jobs
 */
export const deleteItem = async (req, res) => {
  try {
    const item = await Item.findOne({ _id: req.params.id, userId: req.userId });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    // Clean up media from Supabase storage
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
 * POST /api/items/:id/retry — re-enqueue a failed item
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
      type:   isLink ? 'link' : 'text',
      rawText: text,
      status: 'pending',
    });
    await Job.create({ type: 'enrich', itemId: item._id });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
