const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'staff'], default: 'user' },
  casinoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Casino' } // ✅ Only used for staff
});

module.exports = mongoose.model('User', userSchema);
