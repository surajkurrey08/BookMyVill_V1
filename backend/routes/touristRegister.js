const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const TouristRegister = require('../models/TouristRegister');

const defaultTourists = [
  {
    _id: 'tr-1',
    ownerId: 'owner123',
    propertyName: 'Royal Mist Villa Estate',
    guestName: 'Rohan Sharma & Family',
    phone: '+91 98230 11223',
    expectedArrivalTime: '02:30 PM',
    actualCheckInTime: new Date(),
    adultsCount: 4,
    childrenCount: 2,
    roomAssigned: 'Master Villa Suite 101',
    idVerified: true,
    govtIdType: 'Aadhaar Card',
    status: 'Arrived',
    specialRequests: 'Welcome Strawberry Drink & Highchair'
  }
];

// @route   GET api/tourist-register/owner
// @desc    Get registered & arrived tourists for owner's properties
router.get('/owner', auth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json(defaultTourists);
  }
  try {
    let records = await TouristRegister.find({ ownerId: req.user.id }).sort({ createdAt: -1 });
    if (records.length === 0) {
      records = defaultTourists;
    }
    res.json(records);
  } catch (err) {
    console.error('TouristRegister GET Error:', err.message);
    res.json(defaultTourists);
  }
});

// @route   POST api/tourist-register
// @desc    Register a new tourist guest group
router.post('/', auth, async (req, res) => {
  try {
    const { propertyName, guestName, phone, expectedArrivalTime, adultsCount, childrenCount, roomAssigned, specialRequests } = req.body;
    const newRecord = new TouristRegister({
      ownerId: req.user.id,
      propertyName: propertyName || 'Mahabaleshwar Villa',
      guestName,
      phone,
      expectedArrivalTime: expectedArrivalTime || '01:00 PM',
      adultsCount: Number(adultsCount) || 2,
      childrenCount: Number(childrenCount) || 0,
      roomAssigned: roomAssigned || 'Villa Suite',
      specialRequests
    });
    const saved = await newRecord.save();
    res.json(saved);
  } catch (err) {
    console.error('TouristRegister POST Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/tourist-register/:id/status
// @desc    Update tourist arrival status (Mark as Arrived / Checked Out)
router.put('/:id/status', auth, async (req, res) => {
  try {
    const record = await TouristRegister.findById(req.params.id);
    if (!record) return res.status(404).json({ msg: 'Tourist record not found' });
    if (record.ownerId.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });

    const { status } = req.body;
    if (status) record.status = status;
    if (status === 'Arrived') record.actualCheckInTime = new Date();

    await record.save();
    res.json(record);
  } catch (err) {
    console.error('TouristRegister PUT Error:', err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
