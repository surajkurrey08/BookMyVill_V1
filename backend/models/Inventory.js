const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property'
  },
  propertyName: {
    type: String,
    default: 'Mahabaleshwar Luxury Stay'
  },
  itemName: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['Toiletries', 'Linen & Towels', 'Kitchen & Beverage', 'Cleaning Supplies', 'Maintenance Kits', 'Safety Equipment'],
    default: 'Toiletries'
  },
  quantity: {
    type: Number,
    required: true,
    default: 10
  },
  unit: {
    type: String,
    default: 'Units'
  },
  minThreshold: {
    type: Number,
    default: 5
  },
  status: {
    type: String,
    enum: ['In Stock', 'Low Stock', 'Out of Stock'],
    default: 'In Stock'
  },
  lastRestocked: {
    type: Date,
    default: Date.now
  }
});

InventorySchema.pre('save', function (next) {
  if (this.quantity <= 0) {
    this.status = 'Out of Stock';
  } else if (this.quantity <= this.minThreshold) {
    this.status = 'Low Stock';
  } else {
    this.status = 'In Stock';
  }
  next();
});

module.exports = mongoose.model('Inventory', InventorySchema);
