import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['enrich', 'reply'],
    required: true,
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: function () { return this.type === 'enrich'; },
  },
  status: {
    type: String,
    enum: ['queued', 'running', 'done', 'failed', 'cancelled'],
    default: 'queued',
  },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  // Worker picks jobs where runAt <= now
  runAt: { type: Date, default: Date.now },
  // Used to detect stuck jobs (worker crashed mid-run)
  lockedAt: { type: Date },
  lastError: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dedupeKey: { type: String, unique: true, sparse: true },
  phone: String,
  replyText: String,
}, {
  timestamps: true,
});

jobSchema.index({ status: 1, runAt: 1 });
export default mongoose.model('Job', jobSchema);
