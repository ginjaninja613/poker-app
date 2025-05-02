const mongoose = require('mongoose');
const Casino = require('./src/models/Casino');
require('dotenv').config();

const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

const seedCasinos = async () => {
  await connectDB();

  const casinos = [
    {
      name: 'Grosvenor Casino The Victoria, London',
      address: '150-162 Edgware Road, London W2 2DT, UK',
      location: {
        type: 'Point',
        coordinates: [-0.1635, 51.5149], // [longitude, latitude]
      },
      tournaments: [
        {
          name: 'Weekly Poker Night',
          buyIn: 50,
          date: new Date('2025-05-10T19:00:00Z'),
          chipCount: 0,
        },
      ],
    },
    {
      name: 'Aspers Casino Westfield Stratford City',
      address: '312 The Loft, Montfichet Rd, London E20 1ET, UK',
      location: {
        type: 'Point',
        coordinates: [0.0054, 51.5437],
      },
      tournaments: [
        {
          name: 'Stratford Poker Classic',
          buyIn: 100,
          date: new Date('2025-05-15T18:00:00Z'),
          chipCount: 0,
        },
      ],
    },
    {
      name: 'Grosvenor Casino Manchester',
      address: '2 Ramsgate St, Manchester M4 5BA, UK',
      location: {
        type: 'Point',
        coordinates: [-2.2301, 53.4845],
      },
      tournaments: [
        {
          name: 'Manchester Poker Open',
          buyIn: 75,
          date: new Date('2025-05-20T20:00:00Z'),
          chipCount: 0,
        },
      ],
    },
  ];

  try {
    await Casino.deleteMany(); // Clear existing data
    await Casino.insertMany(casinos);
    console.log('Casinos seeded successfully');
  } catch (error) {
    console.error('Error seeding casinos:', error.message);
  } finally {
    mongoose.connection.close();
  }
};

seedCasinos();