const express = require('express');
const router = express.Router();
const Casino = require('../models/Casino');
const User = require('../models/User');
const requireStaff = require('../middleware/requireStaff');

// GET all casinos
router.get('/', async (req, res) => {
  try {
    const casinos = await Casino.find();
    res.json(casinos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch casinos' });
  }
});

// GET nearby casinos by lat/lng
router.get('/nearby', async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'Latitude and longitude required' });
  }

  try {
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
    res.status(500).json({ error: 'Failed to find nearby casinos' });
  }
});

// GET a specific casino by ID
router.get('/:id', async (req, res) => {
  try {
    const casino = await Casino.findById(req.params.id);
    if (!casino) {
      return res.status(404).json({ error: 'Casino not found' });
    }
    res.json(casino);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET a specific tournament (used in EditTournamentScreen)
router.get('/:casinoId/tournaments/:tournamentId', requireStaff, async (req, res) => {
  try {
    console.log('🔍 GET single tournament', req.params);
    const { casinoId, tournamentId } = req.params;

    const staff = await User.findById(req.user.id);
    if (!staff || !staff.casinoId || staff.casinoId.toString() !== casinoId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const casino = await Casino.findById(casinoId);
    if (!casino) return res.status(404).json({ error: 'Casino not found' });

    const tournament = casino.tournaments.find(t => t._id.toString() === tournamentId);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    console.log('🎯 GET tournament sending:', tournament);
    res.json(tournament);
  } catch (err) {
    console.error('🔥 Error loading tournament:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST: Add tournament
router.post('/:id/tournaments', requireStaff, async (req, res) => {
  try {
    const { id } = req.params;
    const newTournament = req.body;

    const casino = await Casino.findById(id);
    if (!casino) {
      return res.status(404).json({ error: 'Casino not found' });
    }

    const staff = await User.findById(req.user.id);
    if (!staff || !staff.casinoId || staff.casinoId.toString() !== id.toString()) {
      return res.status(403).json({ error: 'You can only add tournaments to your assigned casino' });
    }

    casino.tournaments.push(newTournament);
    await casino.save();

    res.status(201).json({ message: 'Tournament added successfully' });
  } catch (err) {
    console.error('🔥 Add tournament error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT: Edit a tournament
router.put('/:casinoId/tournaments/:tournamentId', requireStaff, async (req, res) => {
  try {
    const { casinoId, tournamentId } = req.params;
    const updatedFields = req.body;

    const staff = await User.findById(req.user.id);
    if (!staff || !staff.casinoId || staff.casinoId.toString() !== casinoId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const casino = await Casino.findById(casinoId);
    if (!casino) return res.status(404).json({ error: 'Casino not found' });

    const index = casino.tournaments.findIndex(t => t._id.toString() === tournamentId);
    if (index === -1) return res.status(404).json({ error: 'Tournament not found' });

    const original = casino.tournaments[index] || {};

    // 🛠 Fully replace this tournament with merged object
    casino.tournaments[index] = {
      ...original,
      ...updatedFields,
      _id: original._id
    };

    // 🧠 Force Mongoose to see that the nested array has changed
    casino.markModified('tournaments');

    await casino.save();

    console.log('✅ Tournament updated and saved with markModified');
    res.json({ message: 'Tournament updated successfully' });
  } catch (err) {
    console.error('🔥 Update tournament error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});



// DELETE: Delete a tournament
router.delete('/:casinoId/tournaments/:tournamentId', requireStaff, async (req, res) => {
  try {
    console.log('🗑️ DELETE request:', req.params);
    const { casinoId, tournamentId } = req.params;

    const staff = await User.findById(req.user.id);
    if (!staff || !staff.casinoId || staff.casinoId.toString() !== casinoId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const casino = await Casino.findById(casinoId);
    if (!casino) {
      return res.status(404).json({ error: 'Casino not found' });
    }

    casino.tournaments = casino.tournaments.filter(
      t => t._id.toString() !== tournamentId
    );
    await casino.save();

    console.log('✅ Tournament deleted');
    res.json({ message: 'Tournament deleted successfully' });
  } catch (err) {
    console.error('🔥 Delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
