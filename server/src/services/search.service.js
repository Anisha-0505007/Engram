import mongoose from 'mongoose';
import Item from '../models/item.model.js';
import { embedText, EMBEDDING_MODEL } from './llm.service.js';
import { parseQuery } from './queryUnderstanding.service.js';

export function reciprocalRankFusion(lists, limit = 10) {
  const scores = new Map();
  const docs = new Map();
  for (const list of lists) {
    const seen = new Set();
    list.forEach((doc, rank) => {
      const id = String(doc._id);
      if (seen.has(id)) return;
      seen.add(id); docs.set(id, doc);
      scores.set(id, (scores.get(id) || 0) + 1 / (60 + rank + 1));
    });
  }
  return [...scores].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => docs.get(id));
}

export function buildFilter(userId, options) {
  const filter = { userId: new mongoose.Types.ObjectId(userId) };
  if (options.type) filter.type = options.type;
  if (options.dateFrom || options.dateTo) {
    filter.originalTimestamp = {};
    if (options.dateFrom) filter.originalTimestamp.$gte = new Date(options.dateFrom);
    if (options.dateTo) filter.originalTimestamp.$lt = new Date(new Date(options.dateTo).getTime() + 86400_000);
  }
  if (options.category) {
    filter.$or = [
      { 'userEdits.category': options.category },
      { 'userEdits.category': { $exists: false }, 'enrichment.category': options.category },
    ];
  }
  return filter;
}

const projection = { embedding: 0 };
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function retrieve(userId, options, { understand = true } = {}) {
  const parsed = understand ? await parseQuery(options.q || '') : { text: options.q || '' };
  const resolved = { ...parsed, ...Object.fromEntries(Object.entries(options).filter(([key, value]) => key !== 'q' && value)) };
  const filter = buildFilter(userId, resolved);
  const text = parsed.text;
  if (!text.trim()) {
    const items = await Item.find(filter).select(projection).sort({ originalTimestamp: -1, _id: -1 }).limit(20).lean();
    return { items, keyword: items, vector: [], parsedQuery: resolved, warnings: [] };
  }
  const warnings = [];
  const atlasFilters = [{ equals: { path: 'userId', value: filter.userId } }];
  if (filter.type) atlasFilters.push({ equals: { path: 'type', value: filter.type } });
  if (filter.originalTimestamp) atlasFilters.push({ range: { path: 'originalTimestamp',
    ...(filter.originalTimestamp.$gte ? { gte: filter.originalTimestamp.$gte } : {}),
    ...(filter.originalTimestamp.$lt ? { lt: filter.originalTimestamp.$lt } : {}),
  } });
  if (resolved.category) atlasFilters.push({ equals: { path: 'effectiveCategory', value: resolved.category } });
  const keywordTask = async () => {
    try {
      return await Item.aggregate([
        { $search: { index: 'text_index', compound: { filter: atlasFilters,
          must: [{ text: { query: text, path: ['searchText', 'rawText', 'enrichment.title', 'userEdits.tags'] } }],
        } } },
        { $match: filter }, { $limit: 20 }, { $project: projection },
      ]);
    } catch {
      warnings.push('Atlas text index unavailable; using basic keyword search.');
      const terms = text.split(/\s+/).filter(Boolean).slice(0, 12).map(escapeRegex).join('|');
      return Item.find({ $and: [filter, { $or: [
        { searchText: { $regex: terms, $options: 'i' } },
        { rawText: { $regex: terms, $options: 'i' } },
        { 'userEdits.tags': { $regex: terms, $options: 'i' } },
      ] }] }).select(projection).sort({ originalTimestamp: -1, _id: -1 }).limit(20).lean();
    }
  };
  const vectorTask = async () => {
    try {
      const queryVector = await embedText(text, 'RETRIEVAL_QUERY');
      // Every vector candidate is pre-filtered by owner, type and date before ranking.
      const vectorFilter = { ...filter, embeddingModel: EMBEDDING_MODEL };
      delete vectorFilter.$or;
      if (resolved.category) vectorFilter.effectiveCategory = resolved.category;
      return await Item.aggregate([
        { $vectorSearch: { index: 'vector_index', path: 'embedding', queryVector,
          numCandidates: 200, limit: 40, filter: vectorFilter } },
        { $match: filter }, { $limit: 20 }, { $project: projection },
      ]);
    } catch (error) {
      if (error.code === 'AI_QUOTA') warnings.push(error.message);
      else warnings.push('Semantic search unavailable; showing keyword results.');
      return [];
    }
  };
  const [keyword, vector] = await Promise.all([
    options.mode === 'vector' ? [] : keywordTask(),
    options.mode === 'keyword' ? [] : vectorTask(),
  ]);
  return { items: reciprocalRankFusion([keyword, vector]), keyword, vector, parsedQuery: resolved, warnings };
}
