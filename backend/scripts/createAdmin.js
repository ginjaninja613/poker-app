// backend/scripts/createAdmin.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../src/models/User');
const Casino = require('../src/models/Casino');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI missing in .env');
  process.exit(1);
}

async function listCasinos() {
  await mongoose.connect(MONGO_URI);
  const casinos = await Casino.find({}, { name: 1 }).lean();
  if (!casinos.length) {
    console.log('No casinos found.');
  } else {
    console.log('Casinos:');
    casinos.forEach(c => console.log(`- ${c._id}  ${c.name}`));
  }
  await mongoose.disconnect();
  process.exit(0);
}

async function main() {
  const [flagOrName, email, password, casinoId] = process.argv.slice(2);

  if (flagOrName === '--list-casinos') {
    return listCasinos();
  }

  const name = flagOrName;

  if (!name || !email || !password || !casinoId) {
    console.log('\nUsage:');
    console.log('  node scripts/createAdmin.js --list-casinos');
    console.log('  node scripts/createAdmin.js "<Name>" "<Email>" "<Password>" <CasinoObjectId>\n');
    console.log('Example:');
    console.log('  node scripts/createAdmin.js "Admin User" "admin@example.com" "StrongPass123" 68ba03d9fe9e39980fbe76f9\n');
    process.exit(1);
  }

  if (!mongoose.isValidObjectId(casinoId)) {
    console.error('❌ casinoId is not a valid ObjectId.');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);

  const casino = await Casino.findById(casinoId).lean();
  if (!casino) {
    console.error('❌ Casino not found for id:', casinoId);
    await mongoose.disconnect();
    process.exit(1);
  }

  let user = await User.findOne({ email });
  if (user) {
    console.log('ℹ️ User exists. Upgrading to admin and assigning casino…');
    const update = {
      $addToSet: { assignedCasinoIds: casino._id },
    };
    if (user.role !== 'admin') {
      update.$set = { role: 'admin', name };
    } else {
      update.$set = { name }; // keep admin, just update name
    }
    await User.updateOne({ _id: user._id }, update);
    user = await User.findById(user._id).lean();
  } else {
    console.log('🆕 Creating new admin user…');
    const passwordHash = await bcrypt.hash(password, 10);
    user = await User.create({
      name,
      email,
      passwordHash,
      role: 'admin',
      assignedCasinoIds: [casino._id],
    });
  }

  console.log('\n✅ Admin ready:');
  console.log({
    id: user._id?.toString?.() || user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    assignedCasinoIds: (user.assignedCasinoIds || []).map(String),
    casinoAssignedName: casino.name,
  });

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('❌ Error:', e.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
