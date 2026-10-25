import Item from '../models/item.model.js';
import { enrichText, enrichImage, embedText, LLM_MODEL, EMBEDDING_MODEL } from './llm.service.js';
import { safeFetch, extractMeta } from './urlFetcher.service.js';
import { getPresignedUrl, uploadFile } from './storage.service.js';
import { downloadWhatsAppMedia, readLimitedBody } from './whatsapp.service.js';
import { validateMedia } from './media.service.js';

export async function enrichItem(itemId, userId) {
  const owner = { _id: itemId, userId };
  const item = await Item.findOne(owner);
  if (!item) return;
  if (item.media?.id && !item.media?.key) {
    const { buffer, mimeType } = await downloadWhatsAppMedia(item.media.id);
    validateMedia(buffer, mimeType);
    const key = await uploadFile(buffer, `${userId}/${item._id}`, mimeType);
    item.media = { id: item.media.id, key, mime: mimeType, size: buffer.length };
    await Item.updateOne(owner, { media: item.media });
  }
  let data;
  let partial = false;
  let url;
  if (item.type === 'link') {
    url = item.rawText?.match(/https?:\/\/[^\s]+/)?.[0];
    let page;
    try { page = extractMeta(await safeFetch(url)); } catch {
      partial = true;
      page = { title: url || 'Saved link', description: 'Page could not be fetched. Original text is still searchable.', text: item.rawText };
    }
    // Network failures are partial; AI failures must propagate to the retry queue.
    data = await enrichText(page.text || item.rawText || url);
    if (partial) data.description = page.description;
  } else if (item.type === 'image' || item.type === 'pdf') {
    if (!item.media?.key) throw new Error('Media is missing. Send the file again.');
    const signedUrl = await getPresignedUrl(item.media.key);
    if (!signedUrl) throw new Error('Media storage is unavailable.');
    const response = await fetch(signedUrl, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error('Could not download stored media.');
    const buffer = await readLimitedBody(response, 10 * 1024 * 1024);
    data = await enrichImage(buffer, item.type === 'pdf' ? 'application/pdf' : item.media.mime);
    if (!data.extractedText && !data.summary) throw new Error('No readable content could be extracted.');
  } else if (item.type === 'text') data = await enrichText(item.rawText || '');
  else throw new Error('Unsupported item type');
  const tags = item.userEdits?.tags ?? data.tags;
  const searchText = [item.rawText, data.title, data.description, data.extractedText, data.summary, tags?.join(' ')].filter(Boolean).join(' ');
  // Persist extracted text before embedding so a provider failure does not hide useful content.
  await Item.updateOne(owner, { enrichment: { ...data, model: LLM_MODEL, version: 2 }, searchText, partial, url });
  const embedding = await embedText(searchText);
  await Item.updateOne(owner, { embedding, embeddingModel: EMBEDDING_MODEL,
    effectiveCategory: item.userEdits?.category ?? data.category, status: 'done', error: null });
}
