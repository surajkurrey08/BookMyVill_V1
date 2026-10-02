const mongoose = require('mongoose');

const StaffMemberSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  role: { type: String, enum: ['caretaker', 'front_desk', 'housekeeping', 'maintenance', 'manager'], required: true },
  phone: { type: String, default: '', trim: true, maxlength: 20 },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('StaffMember', StaffMemberSchema);
