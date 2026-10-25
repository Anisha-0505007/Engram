import 'dotenv/config';
import mongoose from 'mongoose';

export const definitions = [
  { name: 'vector_index', type: 'vectorSearch', definition: { fields: [
    { type: 'vector', path: 'embedding', numDimensions: 768, similarity: 'cosine' },
    ...['userId', 'type', 'originalTimestamp', 'effectiveCategory', 'embeddingModel'].map(path => ({ type: 'filter', path })),
  ] } },
  { name: 'text_index', type: 'search', definition: { mappings: { dynamic: false, fields: {
    userId: { type: 'objectId' }, type: { type: 'token' }, originalTimestamp: { type: 'date' },
    effectiveCategory: { type: 'token' }, searchText: { type: 'string' }, rawText: { type: 'string' },
    enrichment: { type: 'document', fields: { title: { type: 'string' } } },
    userEdits: { type: 'document', fields: { tags: { type: 'string' } } },
  } } } },
];

try {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const collection = mongoose.connection.db.collection('items');
  const existing = await collection.listSearchIndexes().toArray();
  for (const index of definitions) {
    const current = existing.find(entry => entry.name === index.name);
    if (process.argv.includes('--apply')) {
      if (!current) { await collection.createSearchIndex(index); console.log(`${index.name}: creation requested`); }
      else if (JSON.stringify(current.latestDefinition) !== JSON.stringify(index.definition)) {
        await collection.updateSearchIndex(index.name, index.definition); console.log(`${index.name}: update requested`);
      } else console.log(`${index.name}: already matches`);
    } else console.log(`${index.name}: ${current?.status || 'MISSING'}; queryable=${Boolean(current?.queryable)}`);
  }
} catch (error) {
  console.error(`Atlas index operation failed (${error.code || error.name}). Connection details hidden.`);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
