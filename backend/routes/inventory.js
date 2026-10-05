const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/ownerAuth');
const Inventory = require('../models/Inventory');
const ownerOperation = require('../middleware/legacyOwnerOperation')(Inventory);

// Default fallback items when DB is offline
// @route   GET api/inventory/owner
// @desc    Get owner's material inventory stock
router.get('/owner', auth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ msg: 'Database unavailable.' });
  }
  try {
    let items = await Inventory.find({ ownerId: req.user.id }).sort({ lastRestocked: -1 });
    if (items.length === 0) {
      items = defaultInventoryList;
    }
    res.json(items);
  } catch (err) {
    console.error('Inventory GET Error:', err.message);
    res.status(503).json({ msg: 'Could not load records.' });
  }
});

// @route   POST api/inventory
// @desc    Add a material stock item
router.post('/', auth, ownerOperation, async (req, res) => {
  try {
    const { itemName, category, quantity, unit, minThreshold, propertyName } = req.body;
    const newItem = new Inventory({
      ownerId: req.user.id,
      propertyId: req.body.propertyId || undefined,
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
router.put('/:id/restock', auth, ownerOperation, async (req, res) => {
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
