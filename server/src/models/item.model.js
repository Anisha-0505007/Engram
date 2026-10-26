import mongoose from 'mongoose';
import { looksConfidential } from '../services/organize.service.js';

const itemSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  source: {
    type: String,
    enum: ['whatsapp', 'web', 'export', 'linked-device'],
    required: true,
  },
  waMessageId: {
    type: String,
    unique: true,
    sparse: true, // web/export items have no whatsapp message id
  },
  captureId: { type: String },
  type: {
    type: String,
    enum: ['link', 'image', 'pdf', 'text', 'unsupported'],
    required: true,
  },
  rawText: { type: String },
  url: { type: String },
  media: {
    id: String,
    key: String,
    mime: String,
    size: Number,
  },
  originalTimestamp: { type: Date, default: Date.now },
  bookmarked: { type: Boolean, default: false },
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
    title: { type: String, maxlength: 160 },
    category: String,
    tags: [String],
  },
  // Flat text field for Atlas Search (full-text keyword search)
  searchText: { type: String },
  // Vector embedding for Atlas Vector Search (F10)
  embedding: { type: [Number], default: undefined },
  embeddingModel: String,
  effectiveCategory: String,
  partial: { type: Boolean, default: false },
  confidential: { type: Boolean, default: false },
  // Unclassified media must not flash in public lists before AI finishes checking it.
  privacyPending: { type: Boolean, default: function () { return ['image', 'pdf'].includes(this.type); } },
  privacyCheckQueuedAt: Date,
  events: [{ label: String, evidence: String, dueAt: Date, dateOnly: Boolean }],
  dismissedReminders: { type: [String], default: [] },
  deleting: { type: Boolean, default: false },
  error: { type: String },
}, {
  timestamps: true,
});

itemSchema.index({ userId: 1, originalTimestamp: -1, _id: -1 });
itemSchema.index({ userId: 1, confidential: 1, 'events.dueAt': 1 });
itemSchema.pre('validate', function () {
  if (looksConfidential(this.rawText)) this.confidential = true;
  if (this.confidential) { this.searchText = ''; this.embedding = undefined; }
});
itemSchema.index({ userId: 1, captureId: 1 }, { unique: true, partialFilterExpression: { captureId: { $type: 'string' } } });
itemSchema.index({ userId: 1, type: 1, originalTimestamp: -1 });
// Undefined distinguishes an explicit empty tag override from no override.
itemSchema.path('userEdits.tags').default(undefined);
export default mongoose.model('Item', itemSchema);
