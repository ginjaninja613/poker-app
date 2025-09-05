const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'staff', 'admin'], default: 'user', index: true },
  assignedCasinoIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Casino' }], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
