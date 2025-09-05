require('dotenv').config();
const mongoose = require('mongoose');
const Casino = require('./src/models/Casino');

const defaultStructure = [
  { level: '25/50', duration: 20 },
  { level: '50/100', duration: 20 },
  { level: '100/200', duration: 25 },
  { level: '150/300', duration: 25 },
  { level: '200/400', duration: 30 },
];

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('🔧 Connected to MongoDB');

    const casinos = await Casino.find();

    for (let casino of casinos) {
      let updated = false;

      const updatedTournaments = casino.tournaments.map((tournament) => {
        if (!tournament.rake || !tournament.structure) {
          updated = true;
          return {
            ...tournament.toObject(),
            rake: tournament.rake || Math.round(tournament.buyIn * 0.1),
            structure: tournament.structure && tournament.structure.length > 0
              ? tournament.structure
              : defaultStructure,
          };
        }
        return tournament;
      });

      if (updated) {
        casino.tournaments = updatedTournaments;
        await casino.save();
        console.log(`✅ Updated: ${casino.name}`);
      } else {
        console.log(`ℹ️ No update needed: ${casino.name}`);
      }
    }

    mongoose.disconnect();
    console.log('✅ Done updating tournaments!');
  })
  .catch((err) => {
    console.error('❌ Error:', err.message);
  });

