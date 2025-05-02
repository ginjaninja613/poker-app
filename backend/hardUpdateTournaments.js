require('dotenv').config();
const mongoose = require('mongoose');

const defaultStructure = [
  { level: '25/50', duration: 20 },
  { level: '50/100', duration: 20 },
  { level: '100/200', duration: 25 },
  { level: '150/300', duration: 25 },
  { level: '200/400', duration: 30 },
];

async function updateTournaments() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const db = mongoose.connection.db;
    const collection = db.collection('casinos');

    const casinos = await collection.find({}).toArray();

    for (const casino of casinos) {
      const updatedTournaments = (casino.tournaments || []).map((tournament) => {
        const newTournament = { ...tournament };

        if (newTournament.rake === undefined) {
          newTournament.rake = Math.round(newTournament.buyIn * 0.1);
        }

        if (!Array.isArray(newTournament.structure) || newTournament.structure.length === 0) {
          newTournament.structure = defaultStructure;
        }

        return newTournament;
      });

      await collection.updateOne(
        { _id: casino._id },
        { $set: { tournaments: updatedTournaments } }
      );

      console.log(`✅ Hard-updated: ${casino.name}`);
    }

    console.log('✅ All tournaments updated directly in MongoDB!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to update tournaments:', err.message);
    process.exit(1);
  }
}

updateTournaments();
