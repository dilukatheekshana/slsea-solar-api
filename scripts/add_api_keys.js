require('dotenv').config();
const mongoose = require('mongoose');
const { SolarInstallation } = require('../models');

async function migrate() {
  let mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI environment variable is missing.');
    process.exit(1);
  }

  if (mongoUri.includes('#') && !mongoUri.includes('%23')) {
    mongoUri = mongoUri.replace('#', '%23');
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const installations = await SolarInstallation.find({
    $or: [{ api_key: { $exists: false } }, { api_key: null }]
  }).select('+api_key');

  for (const inst of installations) {
    inst.api_key = `key_inst_${inst.id}`;
    await inst.save();
  }

  console.log(`Successfully updated ${installations.length} installations with api_keys.`);
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
