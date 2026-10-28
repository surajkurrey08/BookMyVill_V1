const mongoose = require('mongoose');

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI must be provided through the environment.');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const collection = mongoose.connection.collection('properties');
  const properties = await collection.find({}).toArray();

  let updatedCount = 0;
  for (const p of properties) {
    if (!Array.isArray(p.photos) || p.photos.length === 0) continue;

    let modified = false;
    const newPhotos = p.photos.map(url => {
      if (typeof url !== 'string') return url;

      // Extract filename from /api/properties/media/<file>
      const match = /(?:\/api\/properties\/media\/|\/uploads\/properties\/)([a-f0-9-]{36}\.(?:png|jpg|webp|mp4|webm|mov))/i.exec(url);
      if (match) {
        const filename = match[1];
        const correctUrl = `https://api.bookmyvilla.online/api/properties/media/${filename}`;
        if (url !== correctUrl) {
          modified = true;
          return correctUrl;
        }
      }
      return url;
    });

    if (modified) {
      console.log(`Fixing photos for: "${p.name}" (${p._id})`);
      console.log('Old:', p.photos);
      console.log('New:', newPhotos);
      await collection.updateOne({ _id: p._id }, { $set: { photos: newPhotos } });
      updatedCount++;
    }
  }

  console.log(`Migration complete. Updated ${updatedCount} properties.`);
  process.exit(0);
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
