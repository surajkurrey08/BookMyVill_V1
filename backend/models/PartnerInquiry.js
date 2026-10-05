const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, required: true, maxlength: 15 },
  propertyName: { type: String, trim: true, maxlength: 150, default: '' },
  city: { type: String, trim: true, maxlength: 100, default: '' },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new' },
}, { timestamps: true });

module.exports = mongoose.model('PartnerInquiry', schema);
