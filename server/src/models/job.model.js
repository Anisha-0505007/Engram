import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['enrich'],
    required: true,
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true,
  },
  status: {
    type: String,
    enum: ['queued', 'running', 'done', 'failed'],
    default: 'queued',
  },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  // Worker picks jobs where runAt <= now
  runAt: { type: Date, default: Date.now },
  // Used to detect stuck jobs (worker crashed mid-run)
  lockedAt: { type: Date },
  lastError: { type: String },
}, {
  timestamps: true,
});

export default mongoose.model('Job', jobSchema);
