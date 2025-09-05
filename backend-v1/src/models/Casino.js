const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  buyIn: Number,
  rake: Number,
  bounty: Number,
  startTime: String,
  lateRegLevels: Number,
  structure: [
    {
      level: String,
      smallBlind: Number,
      bigBlind: Number,
      duration: Number,
    },
  ],
  date: Date,
  prizePool: Number,
  isBounty: Boolean,
  bountyAmount: Number,
  reentriesAllowed: Number,
});

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

  // ✅ Now properly typed with a subdocument schema
  tournaments: [tournamentSchema],
});

casinoSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Casino', casinoSchema);
