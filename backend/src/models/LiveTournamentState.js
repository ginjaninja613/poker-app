// backend/src/models/LiveTournamentState.js
const mongoose = require('mongoose');

const LiveTournamentStateSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      unique: true,
      index: true,
    },
    // convenience: helps permission checks and quick filters
    casinoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Casino',
      index: true,
    },

    status: {
      type: String,
      enum: ['scheduled', 'running', 'paused', 'completed'],
      default: 'paused',
      index: true,
    },

    // what the floor is running right now
    dayIndex: { type: Number, default: 0, min: 0 },
    levelIndex: { type: Number, default: 0, min: 0 },
    remainingMs: { type: Number, default: 0, min: 0 },

    // optional helpers for clients
    totalLevels: { type: Number, default: 0, min: 0 },
    dayLabel: { type: String },

    // updated each PATCH (we’ll set it in the route)
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    versionKey: false,
  }
);

// keep updatedAt fresh on save
LiveTournamentStateSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('LiveTournamentState', LiveTournamentStateSchema);
