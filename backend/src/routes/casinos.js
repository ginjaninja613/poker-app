const express = require('express');
const router = express.Router();
const Casino = require('../models/Casino');

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
    res.json(casino);
  } catch (err) {
    res.status(404).json({ error: 'Casino not found' });
  }
});

// POST: Add tournament to a casino
router.post('/:id/tournaments', async (req, res) => {
  try {
    const { id } = req.params;
    const newTournament = req.body;
    console.log('📦 Received new tournament:', newTournament);

    const casino = await Casino.findById(id);
    if (!casino) {
      return res.status(404).json({ error: 'Casino not found' });
    }

    casino.tournaments.push(newTournament);
    await casino.save();

    res.status(201).json({ message: 'Tournament added successfully' });
  } catch (err) {
    console.error('Error adding tournament:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

