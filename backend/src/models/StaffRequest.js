// backend/src/models/StaffRequest.js
const mongoose = require('mongoose');

const StaffRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    casinoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Casino', required: true, index: true },
    status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending', index: true },
  },
  { timestamps: true }
);

// Prevent duplicate *pending* requests for the same user+casino
StaffRequestSchema.index(
  { userId: 1, casinoId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);

module.exports = mongoose.model('StaffRequest', StaffRequestSchema);
