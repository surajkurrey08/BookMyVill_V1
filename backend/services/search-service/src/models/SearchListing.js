const mongoose = require('mongoose');
const { database } = require('../config');

// Derived, searchable copy of one public villa (rebuilt from villa-service).
const SearchListingSchema = new mongoose.Schema({
  villaId: { type: String, required: true, unique: true },
  name: { type: String, default: '' },
  type: { type: String, default: '' },
  location: { type: String, default: '' },
  price: { type: Number, default: 0 },
  guestCapacity: { type: Number, default: null },
  createdAt: { type: Date, default: null },
  view: { type: mongoose.Schema.Types.Mixed, required: true }, // public listing as served to guests
  syncedAt: { type: Date, default: Date.now }
}, { collection: 'search_listings' });

module.exports = database.connection.model('SearchListing', SearchListingSchema);
