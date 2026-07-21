const mongoose = require('mongoose');

const CaretakerApplicationSchema = new mongoose.Schema({
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property'
  },
  propertyName: { type: String, required: true },
  phone: { type: String, required: true },
  experience: { type: String, required: true },
  services: [{ type: String }],
  govtId: { type: String },
  bio: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  appliedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CaretakerApplication', CaretakerApplicationSchema);
