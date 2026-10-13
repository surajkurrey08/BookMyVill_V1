// Moves property photos/videos that were saved to a server's local upload
// folder (…/api/properties/media/<uuid>.<ext>) to Cloudinary and rewrites the
// links, so they load in every environment.
//
//   node scripts/migrate-media-to-cloudinary.js            # dry run: report only
//   node scripts/migrate-media-to-cloudinary.js --apply    # upload + update links
//   node scripts/migrate-media-to-cloudinary.js --apply --drop-missing
//       also removes links whose file exists neither here nor on the live API
//
// Run it on each machine that holds uploads (the VPS and any local backend
// that was used against the shared database). A JSON backup of every changed
// property's old photos/videos is written next to this script before saving.
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { mediaDirectory, cloudinary, uploadToCloudinary } = require('../services/propertyMedia');

const APPLY = process.argv.includes('--apply');
const DROP_MISSING = process.argv.includes('--drop-missing');
const LOCAL_FILE = /\/(?:api\/properties\/media|uploads\/properties)\/([a-f0-9-]{36}\.(png|jpg|webp|mp4|webm|mov))(?:[?#].*)?$/i;
const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };

async function reachable(url) {
  try { return (await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) })).ok; } catch { return false; }
}

(async () => {
  const config = cloudinary();
  if (!config) throw new Error('Cloudinary is not configured (CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET).');
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const properties = mongoose.connection.db.collection('properties');
  const rows = await properties.find({ $or: [{ photos: LOCAL_FILE }, { videos: LOCAL_FILE }] }, { projection: { name: 1, photos: 1, videos: 1 } }).toArray();
  const summary = { moved: 0, servedByLiveApi: 0, missing: 0, dropped: 0 };
  const backup = [];

  for (const property of rows) {
    const next = {};
    for (const field of ['photos', 'videos']) {
      const list = [];
      for (const url of property[field] || []) {
        const match = LOCAL_FILE.exec(url || '');
        if (!match) { list.push(url); continue; }
        const file = path.join(mediaDirectory, match[1]);
        if (fs.existsSync(file)) {
          summary.moved++;
          console.log(`${APPLY ? 'move' : 'would move'}  ${property.name}: ${match[1]}`);
          if (APPLY) {
            const kind = field === 'videos' ? 'video' : 'image';
            const dataUrl = `data:${MIME[match[2].toLowerCase()]};base64,${fs.readFileSync(file).toString('base64')}`;
            list.push((await uploadToCloudinary(config, dataUrl, kind)).url);
          } else list.push(url);
        } else if (await reachable(url)) {
          summary.servedByLiveApi++; list.push(url); // lives on another server: run this script there
        } else {
          summary.missing++;
          console.log(`missing     ${property.name}: ${match[1]} (not here, not on the live API${DROP_MISSING ? ' — link removed' : ''})`);
          if (DROP_MISSING) summary.dropped++; else list.push(url);
        }
      }
      if (JSON.stringify(list) !== JSON.stringify(property[field] || [])) next[field] = list;
    }
    if (APPLY && Object.keys(next).length) {
      backup.push({ _id: String(property._id), name: property.name, photos: property.photos, videos: property.videos });
      fs.writeFileSync(path.join(__dirname, `media-migration-backup-${process.pid}.json`), JSON.stringify(backup, null, 2));
      await properties.updateOne({ _id: property._id }, { $set: next });
    }
  }

  console.log('\n', summary, APPLY ? '' : '\nDry run — nothing changed. Re-run with --apply to upload and update links.');
  if (summary.servedByLiveApi) console.log(`${summary.servedByLiveApi} file(s) live on another server — run this script there too.`);
  await mongoose.disconnect();
})().catch(async err => { console.error(err.message); await mongoose.disconnect().catch(() => {}); process.exitCode = 1; });
