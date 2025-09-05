const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Casino = require('../models/Casino');
const auth = require('../middleware/auth');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'user', assignedCasinoIds = [] } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: 'Email already registered' });
    const passwordHash = await bcrypt.hash(password, 10);
    // Validate assigned casinos exist when role is staff
    let validAssigned = [];
    if ((role === 'staff' || role === 'admin') && assignedCasinoIds?.length) {
      const found = await Casino.find({ _id: { $in: assignedCasinoIds } }, '_id').lean();
      validAssigned = found.map(d => d._id);
    }
    const user = await User.create({ name, email, passwordHash, role, assignedCasinoIds: validAssigned });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, assignedCasinoIds: user.assignedCasinoIds } });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, assignedCasinoIds: user.assignedCasinoIds } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Profile (verify token)
router.get('/me', auth, async (req, res) => {
  res.json({ id: req.user.id, role: req.user.role, assignedCasinoIds: req.user.assignedCasinoIds });
});

module.exports = router;
