// ./src/routes/staffRequests.js
const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const StaffRequest = require('../models/StaffRequest');
const User = require('../models/User');

const router = express.Router();

/**
 * Helper: ensure the requester is an ADMIN of the given casino.
 * We require role === 'admin' AND that casinoId is in assignedCasinoIds.
 * (This guarantees the casino's own admin approves/denies staff.)
 */
function ensureAdminOfCasino(reqUser, casinoId) {
  if (!reqUser || reqUser.role !== 'admin') return false;
  if (!reqUser.assignedCasinoIds || !reqUser.assignedCasinoIds.length) return false;
  const target = String(casinoId);
  return reqUser.assignedCasinoIds.map(String).includes(target);
}

/**
 * GET /api/staff-requests?casinoId=...
 * List pending staff requests for a specific casino (admin of that casino only).
 */
router.get('/', auth, async (req, res) => {
  try {
    const { casinoId } = req.query;
    if (!casinoId || !mongoose.isValidObjectId(casinoId)) {
      return res.status(400).json({ error: 'casinoId is required and must be a valid ID' });
    }

    if (!ensureAdminOfCasino(req.user, casinoId)) {
      return res.status(403).json({ error: 'Admin of this casino required' });
    }

    const requests = await StaffRequest.find({ casinoId, status: 'pending' })
      .populate('userId', 'name email')
      .sort({ createdAt: 1 })
      .lean();

    return res.json({ requests });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load staff requests' });
  }
});

/**
 * POST /api/staff-requests/:id/approve
 * Approve a pending request (admin of that casino only).
 * - Upgrades user to role 'staff' if not already admin.
 * - Adds the casinoId to the user.assignedCasinoIds.
 * - Marks the request approved.
 */
router.post('/:id/approve', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid staff request id' });
    }

    const sr = await StaffRequest.findById(id);
    if (!sr) return res.status(404).json({ error: 'Staff request not found' });
    if (sr.status !== 'pending') {
      return res.status(400).json({ error: `Request is already ${sr.status}` });
    }

    if (!ensureAdminOfCasino(req.user, sr.casinoId)) {
      return res.status(403).json({ error: 'Admin of this casino required' });
    }

    // Upgrade/assign user
    const user = await User.findById(sr.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Add casino assignment
    const addToSet = { $addToSet: { assignedCasinoIds: sr.casinoId } };

    // If user is not admin, ensure role is 'staff'
    if (user.role !== 'admin') {
      addToSet.$set = { role: 'staff' };
    }

    await User.updateOne({ _id: user._id }, addToSet);

    // Mark request approved
    sr.status = 'approved';
    await sr.save();

    return res.json({
      message: 'Staff request approved. User can now manage tournaments for this casino.',
      request: { id: sr._id, status: sr.status, userId: sr.userId, casinoId: sr.casinoId },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to approve staff request' });
  }
});

/**
 * POST /api/staff-requests/:id/deny
 * Deny a pending request (admin of that casino only).
 */
router.post('/:id/deny', auth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid staff request id' });
    }

    const sr = await StaffRequest.findById(id);
    if (!sr) return res.status(404).json({ error: 'Staff request not found' });
    if (sr.status !== 'pending') {
      return res.status(400).json({ error: `Request is already ${sr.status}` });
    }

    if (!ensureAdminOfCasino(req.user, sr.casinoId)) {
      return res.status(403).json({ error: 'Admin of this casino required' });
    }

    sr.status = 'denied';
    await sr.save();

    return res.json({
      message: 'Staff request denied.',
      request: { id: sr._id, status: sr.status, userId: sr.userId, casinoId: sr.casinoId },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to deny staff request' });
  }
});

module.exports = router;
