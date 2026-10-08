import mongoose from 'mongoose';

const linkCodeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  code: {
    type: String,
    required: true,
    unique: true, // Ensure codes are unique across active requests
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600, // TTL Index: MongoDB automatically deletes this document after 600 seconds (10 minutes)
  },
});

export default mongoose.model('LinkCode', linkCodeSchema);
