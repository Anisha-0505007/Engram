import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  day: { type: String, required: true },
  calls: { type: Number, default: 0 },
  expiresAt: { type: Date, expires: 0 },
});
schema.index({ userId: 1, day: 1 }, { unique: true });
export default mongoose.model('AiUsage', schema);
