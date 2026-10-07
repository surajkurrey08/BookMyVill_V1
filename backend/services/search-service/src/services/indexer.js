const repo = require('../repositories/listingRepository');
const clients = require('../clients');

// Keeps the search index in step with villa-service (the source of truth).

async function syncAll() {
  const views = await clients.publicVillas();
  await repo.replaceAll(views);
  return views.length;
}

// One villa changed: re-read it; it disappears from the index if it is no
// longer public (unapproved, hidden from the website or deleted).
async function syncOne(villaId) {
  const [view] = await clients.publicVillas([villaId]);
  if (view) await repo.upsert(view); else await repo.remove(villaId);
}

async function onVillaEvent(message) {
  const data = message.data || {};
  if (message.event === 'villa.deleted' && data.villaId) return repo.remove(data.villaId);
  if (data.bulk || !data.villaId) return syncAll();
  return syncOne(data.villaId);
}

module.exports = { syncAll, syncOne, onVillaEvent };
