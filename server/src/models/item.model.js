import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  source: {
    type: String,
    enum: ['whatsapp', 'web', 'export'],
    required: true,
  },
  waMessageId: {
    type: String,
    unique: true,
    sparse: true, // web/export items have no whatsapp message id
  },
  type: {
    type: String,
    enum: ['link', 'image', 'pdf', 'text', 'unsupported'],
    required: true,
  },
  rawText: { type: String },
  url: { type: String },
  media: {
    key: String,
    mime: String,
    size: Number,
  },
  originalTimestamp: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['pending', 'processing', 'done', 'failed'],
    default: 'pending',
  },
  // Populated by the enrichment worker (F8)
  enrichment: {
    title: String,
    description: String,
    extractedText: String,
    summary: String,
    category: String,
    tags: [String],
    model: String,    // which LLM model was used
    version: Number,  // bump to force re-enrichment
  },
  // Overrides set by the user that survive re-enrichment
  userEdits: {
    category: String,
    tags: [String],
  },
  // Flat text field for Atlas Search (full-text keyword search)
  searchText: { type: String },
  // Vector embedding for Atlas Vector Search (F10)
  embedding: { type: [Number], default: undefined },
  error: { type: String },
}, {
  timestamps: true,
});

export default mongoose.model('Item', itemSchema);
