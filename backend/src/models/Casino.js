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
      name: {
        type: String,
        required: true,
      },
      buyIn: {
        type: Number,
        required: true,
      },
      date: {
        type: Date,
        required: true,
      },
      chipCount: {
        type: Number,
        default: 0,
      },
    },
  ],
});

// Create an index for geospatial queries (e.g., find nearby casinos)
casinoSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Casino', casinoSchema);