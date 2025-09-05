const mongoose = require('mongoose');

const LevelSchema = new mongoose.Schema(
  {
    level: Number,
    smallBlind: Number,
    bigBlind: Number,
    ante: Number,
    durationMinutes: Number,
    isBreak: Boolean,
  },
  { _id: false }
);

const BlindLevelSchema = new mongoose.Schema({
  level: { type: Number, required: true },
  smallBlind: { type: Number, required: true },
  bigBlind: { type: Number, required: true },
  ante: { type: Number, default: 0 },
  durationMinutes: { type: Number, required: true },
  isBreak: { type: Boolean, default: false },
}, { _id: false });


const TournamentSchema = new mongoose.Schema({
  casinoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Casino', required: true, index: true },
  name: { type: String, required: true, trim: true },
  dateTimeUTC: { type: Date, required: true }, // start datetime in UTC
  buyIn: { type: Number, required: true, min: 0 },
  rake: { type: Number, required: true, min: 0 },
  bounty: { type: Number, default: 0, min: 0 },
  reEntryUnlimited: { type: Boolean, default: false },
  prizePool: { type: Number, default: 0 },
  gameType: { type: String, default: 'No Limit Hold’em' },
  days: [{
    label: { type: String, default: '' },
    startTimeUTC: { type: Date, required: true },
    structure: [LevelSchema],
  }],
  startingStack: { type: Number, required: true, min: 0 },
  reEntry: { type: Boolean, default: false },
  reEntryCount: { type: Number, default: 0, min: 0 },
  lateRegLevels: { type: Number, default: 0, min: 0 }, // late registration measured in number of levels
  structure: [LevelSchema], // blind levels + breaks
  notes: { type: String, default: '' },
  status: { type: String, enum: ['scheduled','running','completed','cancelled'], default: 'scheduled', index: true },
}, { timestamps: true });




module.exports = mongoose.model('Tournament', TournamentSchema);

