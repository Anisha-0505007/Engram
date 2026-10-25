import Item from '../models/item.model.js';
import { enrichText, enrichImage, embedText } from './llm.service.js';
import { safeFetch, extractMeta } from './urlFetcher.service.js';
import { getPresignedUrl } from './storage.service.js';

/**
 * Runs the full enrichment pipeline for one item.
 * Called by the worker after claiming a job.
 */
export async function enrichItem(itemId) {
  const item = await Item.findById(itemId);
  if (!item) throw new Error(`Item ${itemId} not found`);

  let enrichmentData = {};
  let textForEmbedding = '';

  // ── LINK ──────────────────────────────────────────────
  if (item.type === 'link') {
    const urlMatch = item.rawText?.match(/https?:\/\/[^\s]+/);
    const url = urlMatch?.[0];

    if (url) {
      try {
        const html = await safeFetch(url);
        const { title, description, text } = extractMeta(html);
        const structured = await enrichText(text || item.rawText);
        enrichmentData = {
          title: structured.title || title,
          description: structured.description || description,
          summary: structured.summary,
          category: structured.category,
          tags: structured.tags,
          model: 'gemini-1.5-flash',
          version: 1,
        };
        textForEmbedding = [structured.title, structured.summary, structured.tags?.join(' ')].join(' ');

        // Save url separately on the item
        await Item.updateOne({ _id: itemId }, { url });
      } catch (err) {
        // Dead link or SSRF blocked — partial enrichment, still searchable by date/type
        enrichmentData = { title: url, description: 'Could not fetch page', category: 'other', tags: [], model: 'none', version: 1 };
        textForEmbedding = url;
      }
    }
  }

  // ── IMAGE ─────────────────────────────────────────────
  else if (item.type === 'image') {
    if (item.media?.key) {
      // Fetch the image buffer from Supabase
      const signedUrl = await getPresignedUrl(item.media.key);
      if (signedUrl) {
        const res = await fetch(signedUrl);
        const buffer = Buffer.from(await res.arrayBuffer());
        const structured = await enrichImage(buffer, item.media.mime || 'image/jpeg');
        enrichmentData = {
          extractedText: structured.extractedText,
          title: structured.title,
          description: structured.description,
          summary: structured.summary,
          category: structured.category,
          tags: structured.tags,
          model: 'gemini-1.5-flash',
          version: 1,
        };
        textForEmbedding = [structured.extractedText, structured.title, structured.summary].join(' ');
      }
    }
  }

  // ── TEXT / PLAIN NOTE ─────────────────────────────────
  else if (item.type === 'text') {
    const structured = await enrichText(item.rawText || '');
    enrichmentData = {
      title: structured.title,
      description: structured.description,
      summary: structured.summary,
      category: structured.category,
      tags: structured.tags,
      model: 'gemini-1.5-flash',
      version: 1,
    };
    textForEmbedding = [item.rawText, structured.summary, structured.tags?.join(' ')].join(' ');
  }

  // ── EMBEDDING ─────────────────────────────────────────
  let embedding;
  if (textForEmbedding.trim()) {
    embedding = await embedText(textForEmbedding);
  }

  // Build the searchText field (used by Atlas Search full-text index)
  const effectiveTags = item.userEdits?.tags?.length ? item.userEdits.tags : enrichmentData.tags;
  const searchText = [
    item.rawText,
    enrichmentData.title,
    enrichmentData.description,
    enrichmentData.extractedText,
    effectiveTags?.join(' '),
  ].filter(Boolean).join(' ');

  // Never overwrite userEdits — those are user-controlled
  await Item.findByIdAndUpdate(itemId, {
    enrichment: enrichmentData,
    searchText,
    embedding,
    status: 'done',
    error: null,
  });
}
