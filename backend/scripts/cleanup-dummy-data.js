const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function cleanup() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in backend/.env');
    process.exit(1);
  }

  const isDryRun = !process.argv.includes('--delete');

  console.log(`Connecting to MongoDB Atlas...`);
  await mongoose.connect(uri);
  console.log(`✅ Connected to database: "${mongoose.connection.name}"`);

  if (isDryRun) {
    console.log(`\n🔍 RUNNING IN PREVIEW (DRY-RUN) MODE. Pass --delete to execute deletion.\n`);
  } else {
    console.log(`\n⚠️  DELETION MODE ACTIVATED.\n`);
  }

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);
  console.log(`Available collections:`, collectionNames);

  // 1. Check for any 'packages' or travel packages collection
  const packageColls = collectionNames.filter(n => n.toLowerCase().includes('package'));
  if (packageColls.length > 0) {
    for (const colName of packageColls) {
      const col = db.collection(colName);
      const count = await col.countDocuments({});
      console.log(`\nFound collection "${colName}" with ${count} items.`);
      if (isDryRun) {
        const items = await col.find({}).limit(5).toArray();
        console.log(`Preview of items to delete:`, items.map(i => i.title || i.name || i._id));
      } else {
        const res = await col.deleteMany({});
        console.log(`🗑️ Deleted ${res.deletedCount} items from "${colName}".`);
      }
    }
  } else {
    console.log(`\nℹ️ No collection explicitly named "packages" exists in this database.`);
  }

  // 2. Check for dummy / test properties in 'properties' collection
  if (collectionNames.includes('properties')) {
    const col = db.collection('properties');
    const dummyFilter = {
      $or: [
        { name: { $regex: /dummy|test|example|pending villa/i } },
        { location: { $regex: /test|dummy/i } },
        { _id: { $regex: /^dummy-/i } }
      ]
    };
    const dummyCount = await col.countDocuments(dummyFilter);
    console.log(`\nFound ${dummyCount} dummy/test records in "properties" collection.`);
    if (dummyCount > 0) {
      if (isDryRun) {
        const sample = await col.find(dummyFilter).project({ name: 1, location: 1, type: 1 }).toArray();
        console.log(`Preview of dummy properties:`, sample);
      } else {
        const res = await col.deleteMany(dummyFilter);
        console.log(`🗑️ Deleted ${res.deletedCount} dummy properties from "properties".`);
      }
    }
  }

  // 3. Check for dummy site offers
  if (collectionNames.includes('siteoffers')) {
    const col = db.collection('siteoffers');
    const dummyFilter = { title: { $regex: /dummy|test/i } };
    const count = await col.countDocuments(dummyFilter);
    console.log(`\nFound ${count} dummy offers in "siteoffers".`);
    if (count > 0 && !isDryRun) {
      const res = await col.deleteMany(dummyFilter);
      console.log(`🗑️ Deleted ${res.deletedCount} dummy offers.`);
    }
  }

  await mongoose.disconnect();
  console.log(`\nDone!`);
}

cleanup().catch(err => {
  console.error('Error during cleanup:', err.message);
  process.exit(1);
});

