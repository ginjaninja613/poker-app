const mongoose = require('mongoose');

const CasinoSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  city: { type: String, trim: true },
  country: { type: String, trim: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
  },
}, { timestamps: true });

CasinoSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Casino', CasinoSchema);
