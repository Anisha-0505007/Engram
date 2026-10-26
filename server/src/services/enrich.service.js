import Item from '../models/item.model.js';
import { enrichText, enrichImage, embedText, LLM_MODEL, EMBEDDING_MODEL } from './llm.service.js';
import { safeFetch, extractMeta } from './urlFetcher.service.js';
import { getPresignedUrl, uploadFile } from './storage.service.js';
import { downloadWhatsAppMedia, readLimitedBody } from './whatsapp.service.js';
import { validateMedia } from './media.service.js';
import { looksConfidential, verifiedEvents } from './organize.service.js';

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
  if (item.confidential || looksConfidential(item.rawText)) {
    await Item.updateOne(owner, { confidential: true, privacyPending: false, status: 'done', error: null,
      searchText: '', events: [], $unset: { embedding: 1 } });
    return;
  }
  let data;
  let partial = false;
  let url;
  let eventSource = item.rawText || '';
  if (item.type === 'link') {
    url = item.rawText?.match(/https?:\/\/[^\s]+/)?.[0];
    let page;
    try { page = extractMeta(await safeFetch(url)); } catch {
      partial = true;
      page = { title: url || 'Saved link', description: 'Page could not be fetched. Original text is still searchable.', text: item.rawText };
    }
    // Network failures are partial; AI failures must propagate to the retry queue.
    if (looksConfidential(page.text)) {
      await Item.updateOne(owner, { confidential: true, privacyPending: false, status: 'done', searchText: '', events: [], $unset: { embedding: 1 } });
      return;
    }
    data = await enrichText([item.rawText, page.text || url].filter(Boolean).join('\n'), item.originalTimestamp);
    eventSource += `\n${page.text || ''}`;
    if (partial) data.description = page.description;
  } else if (item.type === 'image' || item.type === 'pdf') {
    if (!item.media?.key) throw new Error('Media is missing. Send the file again.');
    const signedUrl = await getPresignedUrl(item.media.key);
    if (!signedUrl) throw new Error('Media storage is unavailable.');
    const response = await fetch(signedUrl, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error('Could not download stored media.');
    const buffer = await readLimitedBody(response, 10 * 1024 * 1024);
    data = await enrichImage(buffer, item.type === 'pdf' ? 'application/pdf' : item.media.mime, item.originalTimestamp);
    if (!data.extractedText && !data.summary) throw new Error('No readable content could be extracted.');
  } else if (item.type === 'text') data = await enrichText(item.rawText || '', item.originalTimestamp);
  else throw new Error('Unsupported item type');
  const confidential = data.confidential || looksConfidential(data.extractedText)
    || Boolean(await Item.exists({ ...owner, confidential: true }));
  if (confidential) {
    await Item.updateOne(owner, { confidential: true, privacyPending: false, status: 'done', error: null,
      enrichment: { title: 'Confidential document', category: 'confidential', tags: ['private'], extractedText: data.extractedText, model: LLM_MODEL, version: 3 },
      searchText: '', events: [], $unset: { embedding: 1 } });
    return;
  }
  const tags = item.userEdits?.tags ?? data.tags;
  const events = verifiedEvents(data.events, [eventSource, data.extractedText].filter(Boolean).join('\n'));
  const searchText = [item.rawText, item.userEdits?.title || data.title, data.description, data.category, data.extractedText, data.summary, tags?.join(' ')].filter(Boolean).join(' ');
  // Persist extracted text before embedding so a provider failure does not hide useful content.
  await Item.updateOne({ ...owner, confidential: { $ne: true } }, { enrichment: { ...data, model: LLM_MODEL, version: 3 }, searchText, partial, url, events, privacyPending: false });
  const embedding = await embedText(searchText);
  await Item.updateOne({ ...owner, confidential: { $ne: true } }, { embedding, embeddingModel: EMBEDDING_MODEL,
    effectiveCategory: item.userEdits?.category ?? data.category, status: 'done', error: null });
}
