const mongoose = require('mongoose');

const PartnerApplicationSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  applicationType: { type: String, enum: ['owner-registration', 'property-listing'], default: 'property-listing' },
  partnerType: { 
    type: String, 
    enum: ['Property Owner', 'Caretaker', 'Travel Agent', 'Villa Host'], 
    default: 'Property Owner' 
  },
  propertyName: { type: String, default: 'N/A' },
  propertyType: { type: String, default: 'Villa' },
  price: { type: String, default: '' },
  city: { type: String, default: 'Mahabaleshwar' },
  mapLink: { type: String, default: '' },
  photos: [{ type: String }],
  videos: [{ type: String }],
  govtId: { type: String, default: '' },
  experience: { type: String, default: '' },
  services: { type: String, default: '' },
  message: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  caretakerStatus: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  appliedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PartnerApplication', PartnerApplicationSchema);
