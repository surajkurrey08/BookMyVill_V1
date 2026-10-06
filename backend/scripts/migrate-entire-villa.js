#!/usr/bin/env node
// Turns every room-by-room property into a whole-villa listing.
//   node scripts/migrate-entire-villa.js          dry run: prints what would change
//   node scripts/migrate-entire-villa.js --apply  makes the changes
// Uses MONGODB_URI from backend/.env (the same database the backend uses).
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { resolveMongoUri } = require('../services/databaseConfig');
const { planMigration, applyMigration } = require('../services/entireVillaMigration');

(async () => {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(resolveMongoUri(), { serverSelectionTimeoutMS: 15000, connectTimeoutMS: 10000, autoCreate: false, autoIndex: false });
  console.log(`Database: ${mongoose.connection.name} · mode: ${apply ? 'APPLY' : 'DRY RUN (no changes)'}`);
  const rows = apply ? await applyMigration() : await planMigration();
  if (!rows.length) console.log('Every property is already a whole-villa listing. Nothing to do.');
  else console.table(rows.map(r => ({ name: r.name, status: r.status || '', action: r.action, rooms: r.rooms, guests: r.capacity, 'rate/night': r.rate, 'future nights carried': r.futureNights })));
  if (!apply && rows.length) console.log('Run again with --apply to make these changes.');
  await mongoose.disconnect();
})().catch(async err => { console.error('Migration failed:', err.message); await mongoose.disconnect().catch(() => {}); process.exit(1); });
