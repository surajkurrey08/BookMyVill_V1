const mongoose = require('mongoose');

const OwnerExpenseSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
  category: { type: String, enum: ['housekeeping', 'maintenance', 'supplies', 'utilities', 'staff', 'other'], required: true },
  amount: { type: Number, required: true, min: 1 },
  incurredOn: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  description: { type: String, required: true, trim: true, maxlength: 200 },
  status: { type: String, enum: ['active', 'void'], default: 'active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  voidedAt: { type: Date, default: null },
  voidReason: { type: String, default: '', maxlength: 200 },
  createdAt: { type: Date, default: Date.now }
});

OwnerExpenseSchema.index({ property: 1, incurredOn: 1 });
module.exports = mongoose.model('OwnerExpense', OwnerExpenseSchema);
