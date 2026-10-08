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
    unique: true, // Idempotency: Prevents saving the exact same WhatsApp message twice
    sparse: true, // Allows items created via 'web' to be missing this field without throwing a unique constraint error
  },
  type: {
    type: String,
    enum: ['link', 'image', 'pdf', 'text', 'unsupported'],
    required: true,
  },
  rawText: {
    type: String,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'done', 'failed'],
    default: 'pending', // Items start as pending, background worker picks them up later
  },
  originalTimestamp: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

export default mongoose.model('Item', itemSchema);
