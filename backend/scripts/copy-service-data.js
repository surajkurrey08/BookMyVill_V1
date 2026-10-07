#!/usr/bin/env node
// Copies an independent service's collections from the shared database into
// its own logical database. NON-DESTRUCTIVE: the source is only read, nothing
// is ever deleted, and the service keeps using the shared database until you
// set <KEY>_DB_NAME (and <KEY>_MONGODB_URI if it is another cluster) yourself.
//
//   node scripts/copy-service-data.js REVIEW                 dry run (counts only)
//   node scripts/copy-service-data.js REVIEW --apply         copy (upsert by _id)
//   node scripts/copy-service-data.js REVIEW --apply --to bookmyvilla_reviews --uri <target-uri>
//
// Cut-over: stop writes to the service (scale it to 0), run --apply once more
// so the copy is current, set <KEY>_DB_NAME, start the service. The source
// collections stay untouched so you can roll back by unsetting the variable.
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { SERVICES } = require('../shared/serviceCatalog');
const { resolveMongoUri } = require('../services/databaseConfig');

const args = process.argv.slice(2);
const key = String(args[0] || '').toUpperCase();
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const apply = args.includes('--apply');
const entry = Object.entries(SERVICES).find(([, def]) => def.database?.key === key);
if (!entry) {
  console.error(`Usage: node scripts/copy-service-data.js <${Object.values(SERVICES).filter(d => d.database).map(d => d.database.key).join('|')}> [--apply] [--to <db>] [--uri <target-uri>]`);
  process.exit(1);
}
const [name, def] = entry;
const target = { uri: option('--uri') || process.env[`${key}_MONGODB_URI`] || resolveMongoUri(), dbName: option('--to') || def.database.target };

// The service's own models tell us which collections it owns.
const modelsDir = path.join(__dirname, '..', 'services', name, 'src', 'models');
const collections = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js')).map(f => require(path.join(modelsDir, f)).collection.collectionName);

(async () => {
  if (process.env[`${key}_DB_NAME`] === target.dbName && !args.includes('--force')) {
    throw new Error(`${name} already uses ${target.dbName} (${key}_DB_NAME). Copying again could overwrite newer data; pass --force only if you are sure.`);
  }
  const source = await mongoose.createConnection(resolveMongoUri(), { serverSelectionTimeoutMS: 15000 }).asPromise();
  const destination = await mongoose.createConnection(target.uri, { dbName: target.dbName, serverSelectionTimeoutMS: 15000 }).asPromise();
  if (source.name === destination.name && source.host === destination.host) throw new Error('Source and target are the same database.');
  console.log(`${name}: ${source.name} -> ${destination.name} · ${apply ? 'APPLY' : 'DRY RUN (no changes)'}`);
  for (const collection of collections) {
    const from = source.db.collection(collection);
    const total = await from.countDocuments();
    const existing = await destination.db.collection(collection).countDocuments();
    let copied = 0;
    if (apply && total) {
      let batch = [];
      const flush = async () => { if (batch.length) { await destination.db.collection(collection).bulkWrite(batch, { ordered: false }); copied += batch.length; batch = []; } };
      for await (const doc of from.find()) {
        batch.push({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } });
        if (batch.length === 500) await flush();
      }
      await flush();
    }
    console.log(`  ${collection}: ${total} in source, ${existing} already in target${apply ? `, ${copied} copied` : ''}`);
  }
  if (apply) console.log(`Done. Indexes are built by ${name} on start. To switch: set ${key}_DB_NAME=${target.dbName}${option('--uri') ? ` and ${key}_MONGODB_URI` : ''}, then restart ${name}.`);
  else console.log('Run again with --apply to copy.');
  await Promise.all([source.close(), destination.close()]);
})().catch(async error => { console.error('Copy failed:', error.message); await mongoose.disconnect().catch(() => {}); process.exit(1); });
