require('dotenv').config();
const mongoose = require('mongoose');
const Casino = require('./src/models/Casino');

const globalCasinos = [
  {
    name: 'Bellagio',
    address: '3600 S Las Vegas Blvd, Las Vegas, NV, USA',
    coordinates: [-115.1755, 36.1126],
  },
  {
    name: 'Marina Bay Sands',
    address: '10 Bayfront Avenue, Singapore',
    coordinates: [103.8608, 1.2834],
  },
  {
    name: 'Casino de Monte-Carlo',
    address: 'Place du Casino, 98000 Monaco',
    coordinates: [7.4246, 43.7396],
  },
  {
    name: 'Crown Melbourne',
    address: '8 Whiteman St, Southbank VIC 3006, Australia',
    coordinates: [144.9581, -37.8236],
  },
  {
    name: 'The Venetian Macao',
    address: 'Estrada da Baía de N. Senhora da Esperança, Macau',
    coordinates: [113.5587, 22.1473],
  },
  {
    name: 'Casino Barcelona',
    address: 'C/ de la Marina, 19, 21, 08005 Barcelona, Spain',
    coordinates: [2.1956, 41.3841],
  },
  {
    name: 'Foxwoods Resort Casino',
    address: '350 Trolley Line Blvd, Ledyard, CT, USA',
    coordinates: [-71.9631, 41.4734],
  },
];

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('🌍 Connected to MongoDB, adding global casinos...');

    for (let entry of globalCasinos) {
      const exists = await Casino.findOne({ name: entry.name });
      if (exists) {
        console.log(`✅ Already exists: ${entry.name}`);
        continue;
      }

      const newCasino = new Casino({
        name: entry.name,
        address: entry.address,
        location: {
          type: 'Point',
          coordinates: entry.coordinates,
        },
        tournaments: [
          {
            name: 'Global Poker Night',
            buyIn: 150,
            date: new Date(),
          },
        ],
      });

      await newCasino.save();
      console.log(`✅ Added: ${entry.name}`);
    }

    mongoose.disconnect();
    console.log('✅ Done. All global casinos inserted!');
  })
  .catch((err) => {
    console.error('❌ Error:', err.message);
  });
