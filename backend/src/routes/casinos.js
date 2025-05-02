const express = require('express');
const router = express.Router();
const Casino = require('../models/Casino');

// GET /api/casinos/nearby?lat=...&lng=...
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const results = await Casino.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          distanceField: 'distance',
          spherical: true,
        },
      },
    ]);

    res.json(results);
  } catch (error) {
    console.error('Error fetching sorted casinos:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
