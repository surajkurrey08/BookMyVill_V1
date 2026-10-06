const mongoose = require('mongoose');

// A local guide BookMyVilla can send with a booking. Guests never browse guides;
// they only ask for "a local guide" at checkout and the Villa Manager assigns one.
const LocalGuideSchema = new mongoose.Schema({
  area: { type: mongoose.Schema.Types.ObjectId, ref: 'GuideArea', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  languages: { type: [String], default: [] },
  notes: { type: String, default: '', maxlength: 500 },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LocalGuide', LocalGuideSchema);
