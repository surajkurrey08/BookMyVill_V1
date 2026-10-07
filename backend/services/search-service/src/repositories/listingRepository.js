const SearchListing = require('../models/SearchListing');

const row = view => ({
  villaId: String(view._id), name: view.name || '', type: view.type || '', location: view.location || '',
  price: Number(view.price) || 0, guestCapacity: view.details?.guestCapacity ?? null,
  createdAt: view.createdAt || null, view, syncedAt: new Date()
});

module.exports = {
  upsert: view => SearchListing.updateOne({ villaId: String(view._id) }, { $set: row(view) }, { upsert: true }),
  remove: villaId => SearchListing.deleteOne({ villaId: String(villaId) }),
  // Replace the whole index with the given public views (full resync).
  async replaceAll(views) {
    const ids = views.map(v => String(v._id));
    if (views.length) await SearchListing.bulkWrite(views.map(v => ({ updateOne: { filter: { villaId: String(v._id) }, update: { $set: row(v) }, upsert: true } })));
    await SearchListing.deleteMany({ villaId: { $nin: ids } });
  },
  all: () => SearchListing.find().lean(),
  count: () => SearchListing.countDocuments()
};
