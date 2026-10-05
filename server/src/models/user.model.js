import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  whatsappPhone: {
    type: String,
    unique: true,
    sparse: true, // sparse: allows multiple null/undefined, but non-null values must be unique
  },
}, {
  timestamps: true,
});

export default mongoose.model('User', userSchema);
