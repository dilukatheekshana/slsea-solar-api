require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../models');

async function seedUsers() {
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

  await User.deleteMany({});
  await User.insertMany([
    { id: 1, username: 'national_admin', role: 'national', jurisdiction_id: null },
    { id: 2, username: 'provincial_officer', role: 'provincial', jurisdiction_id: 1 },
    { id: 3, username: 'district_operator', role: 'district', jurisdiction_id: 1 }
  ]);

  const users = await User.find({});
  console.log('Seeded Users in DB:', JSON.stringify(users, null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

seedUsers().catch(err => {
  console.error('Seeding users failed:', err);
  process.exit(1);
});
