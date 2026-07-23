const mongoose = require('mongoose');

const PropertySchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['Villa', 'Hotel', 'Cabin', 'Resort'], default: 'Villa' },
  location: { type: String, required: true },
  price: { type: Number, default: 10000 },
  mapLink: { type: String, default: '' },
  photos: [{ type: String }],
  videos: [{ type: String }],
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Property', PropertySchema);
