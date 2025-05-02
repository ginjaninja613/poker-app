const mongoose = require('mongoose');

const casinoSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  tournaments: [
    {
      name: { type: String, required: true },
      buyIn: { type: Number, required: true },
      date: { type: Date, required: true },
      chipCount: { type: Number, default: 0 },
      rake: { type: Number, default: 0 },
      prizePool: { type: Number }, // Optional
      lateRegistrationMinutes: { type: Number },
      reentriesAllowed: { type: Number },
      startingChips: { type: Number },
      gameType: { type: String }, // e.g., "NLH", "PLO"
      isBounty: { type: Boolean, default: false },
      bountyAmount: { type: Number },
      structure: [
        {
          level: { type: String },     // e.g., "100/200" or "Break"
          duration: { type: Number },  // in minutes
        },
      ],
    },
  ],
});

casinoSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Casino', casinoSchema);
