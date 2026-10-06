require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Province, District, GridSubstation, SolarInstallation, GenerationReading, User } = require('./models');

async function seed() {
  let mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is missing in .env');
    process.exit(1);
  }

  if (mongoUri.includes('#') && !mongoUri.includes('%23')) {
    mongoUri = mongoUri.replace('#', '%23');
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB.');

  const seedPath = path.join(__dirname, 'seed.json');
  if (!fs.existsSync(seedPath)) {
    console.error('seed.json file not found.');
    process.exit(1);
  }

  console.log('Reading seed.json...');
  const rawData = fs.readFileSync(seedPath, 'utf8');
  const data = JSON.parse(rawData);

  if (data.users && data.users.length > 0) {
    await User.deleteMany({});
    await User.insertMany(data.users);
    console.log(`Seeded ${data.users.length} users.`);
  }

  if (data.provinces && data.provinces.length > 0) {
    await Province.deleteMany({});
    await Province.insertMany(data.provinces);
    console.log(`Seeded ${data.provinces.length} provinces.`);
  }

  if (data.districts && data.districts.length > 0) {
    await District.deleteMany({});
    await District.insertMany(data.districts);
    console.log(`Seeded ${data.districts.length} districts.`);
  }

  if (data.gridSubstations && data.gridSubstations.length > 0) {
    await GridSubstation.deleteMany({});
    await GridSubstation.insertMany(data.gridSubstations);
    console.log(`Seeded ${data.gridSubstations.length} grid substations.`);
  }

  if (data.solarInstallations && data.solarInstallations.length > 0) {
    await SolarInstallation.deleteMany({});
    await SolarInstallation.insertMany(data.solarInstallations);
    console.log(`Seeded ${data.solarInstallations.length} solar installations.`);
  }

  if (data.generationReadings && data.generationReadings.length > 0) {
    await GenerationReading.deleteMany({});
    await GenerationReading.insertMany(data.generationReadings);
    console.log(`Seeded ${data.generationReadings.length} generation readings.`);
  }

  console.log('All seed data inserted successfully!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
