const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const villasData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'villas_lonavala.json'), 'utf8')
);

async function seedLonavala() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI is missing from .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB Atlas');

    const Property = mongoose.connection.collection('properties');
    let inserted = 0;
    let updated = 0;

    for (const villa of villasData) {
      const result = await Property.updateOne(
        { name: villa.name },
        { $set: villa },
        { upsert: true }
      );
      if (result.upsertedCount > 0) inserted++;
      else if (result.modifiedCount > 0) updated++;
    }

    console.log(`Seeding complete: ${inserted} inserted, ${updated} updated.`);
    const total = await Property.countDocuments();
    console.log(`Total properties now in database: ${total}`);
  } catch (err) {
    console.error('Error seeding Lonavala villas:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seedLonavala();
