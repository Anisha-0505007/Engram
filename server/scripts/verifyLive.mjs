import 'dotenv/config';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import User from '../src/models/user.model.js';
import Item from '../src/models/item.model.js';
import AiUsage from '../src/models/aiUsage.model.js';
import { withAiUser } from '../src/services/aiQuota.service.js';
import { enrichItem } from '../src/services/enrich.service.js';
import { enrichImage, embedText, EMBEDDING_MODEL, LLM_MODEL } from '../src/services/llm.service.js';
import { retrieve } from '../src/services/search.service.js';
import { buildFilter } from '../src/services/search.service.js';
import { uploadFile, deleteFile, getPresignedUrl } from '../src/services/storage.service.js';

// All records and files below are synthetic and removed in finally. No WhatsApp messages are sent.
const owners = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
let storageKey;
async function verifyAtlas() {
  const vector = Array.from({ length: 768 }, (_, i) => i === 0 ? 1 : 0);
  const base = { source: 'web', status: 'done', privacyPending: false, rawText: 'Engram verification fixture', searchText: 'Engram verification fixture',
    embedding: vector, embeddingModel: EMBEDDING_MODEL, effectiveCategory: 'verification', originalTimestamp: new Date('2026-10-20T12:00:00Z') };
  const fixtures = await Item.insertMany([
    { ...base, userId: owners[0], type: 'pdf' },
    { ...base, userId: owners[1], type: 'pdf' },
    { ...base, userId: owners[0], type: 'text' },
    { ...base, userId: owners[0], type: 'pdf', originalTimestamp: new Date('2026-01-01') },
  ]);
  // Keep synthetic stale vectors on protected fixtures to prove the index pre-filter.
  for (const flags of [{ confidential: true }, { privacyPending: true }]) {
    const inserted = await Item.collection.insertOne({ ...base, userId: owners[0], type: 'pdf', ...flags });
    fixtures.push({ _id: inserted.insertedId });
  }
  const filter = buildFilter(owners[0], { type: 'pdf', dateFrom: '2026-10-01', dateTo: '2026-10-25' });
  filter.embeddingModel = EMBEDDING_MODEL;
  filter.effectiveCategory = 'verification';
  for (let attempt = 0; attempt < 10; attempt++) {
    const [vectorMatches, textMatches] = await Promise.all([
      Item.aggregate([{ $vectorSearch: { index: 'vector_index', path: 'embedding', queryVector: vector, numCandidates: 100, limit: 10, filter } }]),
      Item.aggregate([{ $search: { index: 'text_index', compound: {
        mustNot: [{ equals: { path: 'confidential', value: true } }, { equals: { path: 'privacyPending', value: true } }],
        filter: [{ equals: { path: 'userId', value: owners[0] } }, { equals: { path: 'type', value: 'pdf' } },
          { range: { path: 'originalTimestamp', gte: new Date('2026-10-01'), lt: new Date('2026-10-26') } },
          { equals: { path: 'effectiveCategory', value: 'verification' } }],
        must: [{ text: { path: 'searchText', query: 'Engram verification fixture' } }],
      } } }]),
    ]);
    const ownIds = new Set(fixtures.map(item => String(item._id)));
    const matches = [vectorMatches, textMatches].map(list => list.filter(item => ownIds.has(String(item._id))));
    if (matches.every(list => list.length === 1 && String(list[0]._id) === String(fixtures[0]._id))) {
      console.log('PASS: real Atlas text and vector indexes enforce owner, type, date, category and privacy filters');
      console.log('Synthetic vectors verify filtering only, not semantic relevance.');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  throw new Error('Atlas filter verification did not converge within 30 seconds');
}
function fixturePdf() {
  const stream = 'BT /F1 18 Tf 40 750 Td (Engram verification Wi-Fi plan: 100 Mbps, 500 rupees monthly.) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let output = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(output)); output += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output);
}
try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await AiUsage.init();
  await User.insertMany(owners.map((id, i) => ({ _id: id, email: `verification-${crypto.randomUUID()}-${i}@example.test`, passwordHash: crypto.randomBytes(32).toString('hex') })));
  if (process.argv.includes('--atlas-only')) await verifyAtlas();
  else {
  const buffer = fixturePdf();
  let pdf;
  if (process.argv.includes('--without-storage')) {
    console.log('SKIP: storage upload/retrieval (not configured)');
    const data = await withAiUser(owners[0], () => enrichImage(buffer, 'application/pdf'));
    const searchText = [data.title, data.summary, data.extractedText].join(' ');
    const embedding = await withAiUser(owners[0], () => embedText(searchText));
    pdf = await Item.create({ userId: owners[0], source: 'web', type: 'pdf', status: 'done',
      enrichment: { ...data, model: LLM_MODEL }, privacyPending: false, searchText, embedding, embeddingModel: EMBEDDING_MODEL,
      effectiveCategory: data.category });
  } else {
  storageKey = await uploadFile(buffer, `${owners[0]}/verification.pdf`, 'application/pdf');
  const signedUrl = await getPresignedUrl(storageKey);
  if (!signedUrl) throw new Error('Media signed URL unavailable');
  const fileResponse = await fetch(signedUrl, { signal: AbortSignal.timeout(15000) });
  if (!fileResponse.ok) throw new Error('Media retrieval failed');
  console.log('PASS: private PDF upload and signed retrieval');
  pdf = await Item.create({ userId: owners[0], source: 'web', type: 'pdf', rawText: 'Engram verification Wi-Fi plan',
    media: { key: storageKey, mime: 'application/pdf', size: buffer.length } });
  await withAiUser(owners[0], () => enrichItem(pdf._id, owners[0]));
  }
  const enriched = await Item.findOne({ _id: pdf._id, userId: owners[0] });
  if (enriched.status !== 'done' || !enriched.enrichment.extractedText?.includes('100') || enriched.embedding?.length !== 768) throw new Error('PDF enrichment did not meet acceptance criteria');
  console.log('PASS: live Cloudflare PDF extraction and 768-dimensional embedding');
  const foreign = await Item.create({ userId: owners[1], source: 'web', type: 'pdf', rawText: 'foreign verification',
    embedding: enriched.embedding, embeddingModel: enriched.embeddingModel, effectiveCategory: enriched.effectiveCategory, searchText: enriched.searchText });
  const indexes = await mongoose.connection.db.collection('items').listSearchIndexes().toArray();
  console.log(`Atlas index states: ${indexes.map(index => `${index.name}=${index.status}`).join(', ')}`);
  let found = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    const result = await withAiUser(owners[0], () => retrieve(owners[0], { q: 'Wi-Fi plan', type: 'pdf', mode: 'hybrid' }, { understand: false }));
    if (result.items.some(item => String(item._id) === String(foreign._id))) throw new Error('User isolation failed');
    if (result.keyword.some(item => String(item._id) === String(pdf._id)) && result.vector.some(item => String(item._id) === String(pdf._id)) && !result.warnings.length) { found = true; break; }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  if (!found) throw new Error('Atlas indexes did not return both keyword and vector matches within the verification window');
  console.log('PASS: real Atlas keyword + vector retrieval, PDF type filter and cross-user isolation');
  }
} catch (error) {
  const safe = /^(AI |Media |PDF |Atlas |User |Supabase client|Failed to upload)/.test(error.message);
  console.error(safe ? error.message : `Live verification failed (${error.code || error.name}); provider details hidden.`);
  process.exitCode = 1;
} finally {
  if (storageKey) {
    try { await deleteFile(storageKey); console.log('Synthetic media cleaned up'); }
    catch { console.error('Synthetic media cleanup failed; retry cleanup before submission.'); process.exitCode = 1; }
  }
  if (mongoose.connection.readyState === 1) {
    await Item.deleteMany({ userId: { $in: owners } });
    await AiUsage.deleteMany({ userId: { $in: owners } });
    await User.deleteMany({ _id: { $in: owners } });
    await mongoose.disconnect();
  }
}
