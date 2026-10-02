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
  // Optional stay-pass details the owner can fill so guests self-serve on
  // arrival instead of calling. Wi-Fi is only ever returned to a guest with a
  // confirmed booking (see the trip endpoint). Everything here is optional and
  // falls back to sensible defaults on the customer trip page.
  stayInfo: {
    checkInTime: { type: String, default: '', maxlength: 40 },
    checkOutTime: { type: String, default: '', maxlength: 40 },
    wifiName: { type: String, default: '', maxlength: 60 },
    wifiPassword: { type: String, default: '', maxlength: 60 },
    houseRules: { type: [String], default: [] },
    arrivalNotes: { type: String, default: '', maxlength: 1000 },
    foodInfo: { type: String, default: '', maxlength: 1000 }
  },
  // 'under_review' (changes requested) and 'suspended' (admin takedown) hide
  // the property from customers like 'pending'/'rejected' do — only 'approved'
  // is public — without deleting its bookings.
  status: { type: String, enum: ['pending', 'under_review', 'approved', 'rejected', 'suspended'], default: 'approved' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Property', PropertySchema);
