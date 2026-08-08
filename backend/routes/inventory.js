const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Inventory = require('../models/Inventory');

// Default fallback items when DB is offline
const defaultInventoryList = [
  { _id: 'inv-1', ownerId: 'owner123', itemName: 'Bath Towels & Linens', category: 'Linen & Towels', quantity: 24, unit: 'Sets', minThreshold: 10, status: 'In Stock' },
  { _id: 'inv-2', ownerId: 'owner123', itemName: 'Luxury Bath Shampoos & Soaps', category: 'Toiletries', quantity: 4, unit: 'Boxes', minThreshold: 8, status: 'Low Stock' },
  { _id: 'inv-3', ownerId: 'owner123', itemName: 'Fresh Strawberry Tea & Coffee', category: 'Kitchen & Beverage', quantity: 18, unit: 'Packs', minThreshold: 6, status: 'In Stock' },
  { _id: 'inv-4', ownerId: 'owner123', itemName: 'Disinfectant Floor Cleaners', category: 'Cleaning Supplies', quantity: 2, unit: 'Cans', minThreshold: 5, status: 'Low Stock' },
  { _id: 'inv-5', ownerId: 'owner123', itemName: 'First Aid & Emergency Kit', category: 'Safety Equipment', quantity: 5, unit: 'Kits', minThreshold: 2, status: 'In Stock' }
];

// @route   GET api/inventory/owner
// @desc    Get owner's material inventory stock
router.get('/owner', auth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json(defaultInventoryList);
  }
  try {
    let items = await Inventory.find({ ownerId: req.user.id }).sort({ lastRestocked: -1 });
    if (items.length === 0) {
      items = defaultInventoryList;
    }
    res.json(items);
  } catch (err) {
    console.error('Inventory GET Error:', err.message);
    res.json(defaultInventoryList);
  }
});

// @route   POST api/inventory
// @desc    Add a material stock item
router.post('/', auth, async (req, res) => {
  try {
    const { itemName, category, quantity, unit, minThreshold, propertyName } = req.body;
    const newItem = new Inventory({
      ownerId: req.user.id,
      propertyName: propertyName || 'Mahabaleshwar Luxury Stay',
      itemName,
      category,
      quantity: Number(quantity),
      unit: unit || 'Units',
      minThreshold: Number(minThreshold) || 5
    });
    const saved = await newItem.save();
    res.json(saved);
  } catch (err) {
    console.error('Inventory POST Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/inventory/:id/restock
// @desc    Restock quantity for a material item
router.put('/:id/restock', auth, async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: 'Item not found' });
    if (item.ownerId.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });

    const addQty = Number(req.body.quantity) || 10;
    item.quantity += addQty;
    item.lastRestocked = new Date();
    await item.save();

    res.json(item);
  } catch (err) {
    console.error('Inventory PUT Error:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
