const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Casino = require('../models/Casino');
const auth = require('../middleware/auth');
const router = express.Router();
const mongoose = require('mongoose');
const StaffRequest = require('../models/StaffRequest');


// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, roleRequest, requestedCasinoId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);

    // Always create new users as role='user' with no assigned casinos initially.
    const user = await User.create({
      name,
      email,
      passwordHash,
      role: 'user',
      assignedCasinoIds: [],
    });

    // If they requested staff access, create a pending StaffRequest tied to a casino.
    let staffRequestInfo = null;
    if (roleRequest === 'staff') {
      if (!requestedCasinoId || !mongoose.isValidObjectId(requestedCasinoId)) {
        return res.status(400).json({ error: 'requestedCasinoId is required and must be a valid ID for staff requests' });
      }
      const casino = await Casino.findById(requestedCasinoId).lean();
      if (!casino) {
        return res.status(400).json({ error: 'Requested casino not found' });
      }

      // Avoid duplicate pending requests (unique index also enforces this).
      const existingPending = await StaffRequest.findOne({
        userId: user._id,
        casinoId: requestedCasinoId,
        status: 'pending',
      });

      if (!existingPending) {
        try {
          const sr = await StaffRequest.create({
            userId: user._id,
            casinoId: requestedCasinoId,
            status: 'pending',
          });
          staffRequestInfo = { id: sr._id, status: sr.status, casinoId: requestedCasinoId };
        } catch (e) {
          // If unique index races, ignore and just proceed.
          staffRequestInfo = { status: 'pending', casinoId: requestedCasinoId };
        }
      } else {
        staffRequestInfo = { id: existingPending._id, status: existingPending.status, casinoId: requestedCasinoId };
      }
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role, // still "user" until approved
        assignedCasinoIds: user.assignedCasinoIds,
      },
      ...(staffRequestInfo
        ? {
            staffRequest: staffRequestInfo,
            message: 'Registered. Staff access is pending admin approval.',
          }
        : { message: 'Registered successfully.' }),
    });
  } catch (err) {
    console.error('Register error:', err); // <-- see the real error in your server console
    return res.status(500).json({ error: err.message || 'Registration failed' });
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
