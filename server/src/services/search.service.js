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
  const filter = { userId: new mongoose.Types.ObjectId(userId), privacyPending: { $ne: true } };
  if (!options.vaultUnlocked || options.section !== 'confidential') filter.confidential = { $ne: true };
  if (options.section === 'confidential') {
    if (options.vaultUnlocked) {
      delete filter.confidential; delete filter.privacyPending;
      filter.confidential = true;
    } else filter.confidential = { $in: [] };
  }
  if (options.section === 'links') filter.$and = [{ $or: [{ type: 'link' }, { rawText: /https?:\/\/\S+/i }, { url: /^https?:\/\//i }] }];
  if (options.section === 'photos') {
    filter.type = 'image';
    filter.events = { $not: { $elemMatch: { dueAt: { $gte: new Date() } } } };
  }
  if (options.section === 'bookmarks') filter.bookmarked = true;
  if (options.section === 'upcoming') filter.events = { $elemMatch: { dueAt: { $gte: new Date() } } };
  if (options.type === 'link' && options.section !== 'photos') {
    // A link saved inside a note or caption is still a useful application link.
    filter.$and = [...(filter.$and || []), { $or: [{ type: 'link' }, { rawText: /https?:\/\/\S+/i }, { url: /^https?:\/\//i }] }];
  } else if (options.type && options.section !== 'photos') filter.type = options.type;
  if (options.dateFrom || options.dateTo) {
    const midnight = date => new Date(`${date}T00:00:00${options.timezone === 'Asia/Kolkata' ? '+05:30' : 'Z'}`);
    filter.originalTimestamp = {};
    if (options.dateFrom) filter.originalTimestamp.$gte = midnight(options.dateFrom);
    if (options.dateTo) filter.originalTimestamp.$lt = new Date(midnight(options.dateTo).getTime() + 86400_000);
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
// Low-confidence nearest neighbors look like matches even when their meaning is unrelated.
export const MIN_VECTOR_SCORE = 0.68;
export function relevantVectorResults(results, minimum = MIN_VECTOR_SCORE) {
  return results.filter(item => Number.isFinite(item.vectorScore) && item.vectorScore >= minimum)
    .map(({ vectorScore: _score, ...item }) => item);
}
export const vectorProjection = Object.fromEntries([
  // The section filter runs after projection, so bookmark membership must survive it.
  '_id', 'userId', 'source', 'captureId', 'type', 'rawText', 'url', 'media', 'originalTimestamp', 'bookmarked',
  'status', 'enrichment', 'userEdits', 'searchText', 'embeddingModel', 'effectiveCategory', 'partial',
  'confidential', 'privacyPending', 'privacyCheckQueuedAt', 'events', 'dismissedReminders', 'deleting',
  'error', 'createdAt', 'updatedAt',
].map(path => [path, 1]));
vectorProjection.vectorScore = { $meta: 'vectorSearchScore' };
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const requestWords = new Set('a an the can could would you i me my any some please find show get give have saved do we is are of for from in on to and or'.split(' '));
export function keywordTerms(text) {
  const words = (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(word => !requestWords.has(word));
  return [...new Set(words)].slice(0, 12).map(escapeRegex).join('|');
}

export async function retrieve(userId, options, { understand = true } = {}) {
  const parsed = understand ? await parseQuery(options.q || '', options.timezone) : { text: options.q || '' };
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
    let indexed;
    try {
      indexed = await Item.aggregate([
        { $search: { index: 'text_index', compound: { filter: atlasFilters,
          mustNot: [{ equals: { path: 'confidential', value: true } }, { equals: { path: 'privacyPending', value: true } }],
          must: [{ text: { query: text, path: ['searchText', 'rawText', 'enrichment.title', 'userEdits.tags'] } }],
        } } },
        { $match: filter }, { $limit: 20 }, { $project: projection },
      ]);
      if (indexed.length) return indexed;
    } catch {
      warnings.push('Atlas text index unavailable; using basic keyword search.');
    }
    // An empty index result is not an error, but saved fields may still contain matches.
    const terms = keywordTerms(text);
    if (!terms) return [];
    const basic = await Item.find({ $and: [filter, { $or: [
      { searchText: { $regex: terms, $options: 'i' } },
      { rawText: { $regex: terms, $options: 'i' } },
      { url: { $regex: terms, $options: 'i' } },
      { 'enrichment.title': { $regex: terms, $options: 'i' } },
      { 'userEdits.title': { $regex: terms, $options: 'i' } },
      { 'userEdits.tags': { $regex: terms, $options: 'i' } },
    ] }] }).select(projection).sort({ originalTimestamp: -1, _id: -1 }).limit(20).lean();
    if (indexed && basic.length) warnings.push('Additional matches found using basic saved-text search.');
    return basic;
  };
  const vectorTask = async () => {
    try {
      const queryVector = await embedText(text, 'RETRIEVAL_QUERY');
      // Owner/privacy filters run before ranking; URL-bearing notes are matched afterward.
      const vectorFilter = { userId: filter.userId, embeddingModel: EMBEDDING_MODEL,
        confidential: filter.confidential, privacyPending: { $ne: true },
        ...(filter.type ? { type: filter.type } : {}),
        ...(filter.originalTimestamp ? { originalTimestamp: filter.originalTimestamp } : {}),
      };
      if (resolved.category) vectorFilter.effectiveCategory = resolved.category;
      return await Item.aggregate([
        { $vectorSearch: { index: 'vector_index', path: 'embedding', queryVector,
          numCandidates: 200, limit: 40, filter: vectorFilter } },
        // Keep the Atlas confidence score so weak nearest neighbors never become results.
        { $project: vectorProjection },
        { $match: filter }, { $limit: 20 },
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
  const relevantVectors = relevantVectorResults(vector);
  return { items: reciprocalRankFusion([keyword, relevantVectors]), keyword, vector: relevantVectors, parsedQuery: resolved, warnings };
}
