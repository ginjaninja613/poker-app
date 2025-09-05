const express = require('express');
const Casino = require('../models/Casino');
const auth = require('../middleware/auth');
const requireStaff = require('../middleware/requireStaff');
const router = express.Router();
const Tournament = require('../models/Tournament');


// List casinos (public)
router.get('/', async (_req, res) => {
  const casinos = await Casino.find().lean();
  res.json(casinos);
});

// Create casino (staff/admin only)
router.post('/', auth, requireStaff, async (req, res) => {
  try {
    const { name, city, country, location } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const casino = await Casino.create({ name, city, country, location });
    res.status(201).json(casino);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create casino' });
  }
});

// Update casino (staff/admin only, and must be in assignedCasinoIds unless admin)
router.put('/:id', auth, requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role !== 'admin' && !req.user.assignedCasinoIds.includes(id)) {
      return res.status(403).json({ error: 'Not assigned to this casino' });
    }
    const updated = await Casino.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Casino not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update casino' });
  }
});

// Delete casino (admin only)
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const deleted = await Casino.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Casino not found' });
  res.json({ ok: true });
});

// Nearby casinos: GET /api/casinos/nearby?lat=...&lng=...
router.get('/nearby', async (req, res) => {
  const { lat, lng } = req.query;
  // If lat/lng missing, just return all casinos
  if (!lat || !lng) {
    const all = await Casino.find().lean();
    return res.json(all);
  }
  try {
    // Works if "location" is a GeoJSON Point with 2dsphere index
    const casinos = await Casino.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          distanceField: 'distance',
          spherical: true,
        },
      },
    ]);
    res.json(casinos);
  } catch (err) {
    // Fallback if geo index/coords are missing: return all
    const all = await Casino.find().lean();
    res.json(all);
  }
});

// Casino detail: GET /api/casinos/:id
router.get('/:id', async (req, res) => {
  const item = await Casino.findById(req.params.id).lean();
  if (!item) return res.status(404).json({ error: 'Casino not found' });
  res.json(item);
});

// Helper for staff permission
function ensureAssignedOrAdmin(req, casinoId) {
  if (!req.user) return false;
  if (req.user.role === 'admin') return true;
  return req.user.assignedCasinoIds?.includes(String(casinoId));
}

// List tournaments for a casino: GET /api/casinos/:id/tournaments
router.get('/:id/tournaments', async (req, res) => {
  const items = await Tournament.find({ casinoId: req.params.id }).sort({ dateTimeUTC: 1 }).lean();
  res.json(items);
});

// Create tournament for a casino: POST /api/casinos/:id/tournaments
router.post('/:id/tournaments', auth, requireStaff, async (req, res) => {
  try {
    const casinoId = req.params.id;
    if (!ensureAssignedOrAdmin(req, casinoId)) {
      return res.status(403).json({ error: 'Not assigned to this casino' });
    }
    const casino = await Casino.findById(casinoId).lean();
    if (!casino) return res.status(400).json({ error: 'Casino does not exist' });

    const data = { ...req.body, casinoId };
    const created = await Tournament.create(data);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

// Update tournament: PUT /api/casinos/:casinoId/tournaments/:tournamentId
router.put('/:casinoId/tournaments/:tournamentId', auth, requireStaff, async (req, res) => {
  try {
    const { casinoId, tournamentId } = req.params;
    const existing = await Tournament.findById(tournamentId);
    if (!existing) return res.status(404).json({ error: 'Tournament not found' });
    if (String(existing.casinoId) !== String(casinoId)) {
      return res.status(400).json({ error: 'Tournament does not belong to this casino' });
    }
    if (!ensureAssignedOrAdmin(req, casinoId)) {
      return res.status(403).json({ error: 'Not assigned to this casino' });
    }

    Object.assign(existing, req.body);
    const saved = await existing.save();
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update tournament' });
  }
});

// Delete tournament: DELETE /api/casinos/:casinoId/tournaments/:tournamentId
router.delete('/:casinoId/tournaments/:tournamentId', auth, requireStaff, async (req, res) => {
  try {
    const { casinoId, tournamentId } = req.params;
    const existing = await Tournament.findById(tournamentId);
    if (!existing) return res.status(404).json({ error: 'Tournament not found' });
    if (String(existing.casinoId) !== String(casinoId)) {
      return res.status(400).json({ error: 'Tournament does not belong to this casino' });
    }
    if (!ensureAssignedOrAdmin(req, casinoId)) {
      return res.status(403).json({ error: 'Not assigned to this casino' });
    }
    await existing.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete tournament' });
  }
});


module.exports = router;
