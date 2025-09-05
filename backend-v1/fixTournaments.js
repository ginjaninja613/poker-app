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
      let needsUpdate = false;

      const updatedTournaments = casino.tournaments.map((t) => {
        const hasRake = t.rake !== undefined;
        const hasStructure = Array.isArray(t.structure) && t.structure.length > 0;

        if (!hasRake || !hasStructure) {
          needsUpdate = true;
          return {
            ...t.toObject(),
            rake: hasRake ? t.rake : Math.round(t.buyIn * 0.1),
            structure: hasStructure ? t.structure : defaultStructure,
          };
        }

        return t;
      });

      if (needsUpdate) {
        await Casino.updateOne(
          { _id: casino._id },
          { $set: { tournaments: updatedTournaments } }
        );
        console.log(`✅ Fixed tournaments for: ${casino.name}`);
      } else {
        console.log(`ℹ️ No fix needed for: ${casino.name}`);
      }
    }

    mongoose.disconnect();
    console.log('✅ Done fixing tournaments!');
  })
  .catch((err) => {
    console.error('❌ Error:', err.message);
  });
