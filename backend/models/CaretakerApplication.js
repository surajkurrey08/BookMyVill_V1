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
  propertyAddress: { type: String, default: 'Mahabaleshwar, Satara' },
  positionRole: { type: String, default: 'Chief Villa Caretaker Host' },
  phone: { type: String, required: true },
  experience: { type: String, required: true },
  skillsRequired: [{ type: String }],
  services: [{ type: String }],
  govtId: { type: String },
  bio: { type: String },
  assignedCaretakerName: { type: String, default: '' },
  assignedCaretakerPhone: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  appliedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CaretakerApplication', CaretakerApplicationSchema);
