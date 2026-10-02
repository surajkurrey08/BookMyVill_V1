const mongoose = require('mongoose');

const PropertySchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sourceApplication: { type: mongoose.Schema.Types.ObjectId, ref: 'PartnerApplication', unique: true, sparse: true },
  name: { type: String, required: true },
  type: { type: String, default: 'Villa' },
  location: { type: String, required: true },
  price: { type: Number, default: 10000 },
  mapLink: { type: String, default: '' },
  amenities: [{ type: String }],
  facilities: [{ type: String }],
  photos: [{ type: String }],
  videos: [{ type: String }],
  assignedCaretaker: {
    name: String,
    phone: String,
    experience: String,
    role: String,
    govtIdStatus: { type: String, default: 'Verified' },
    assignedDate: { type: Date, default: Date.now }
  },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Property', PropertySchema);
