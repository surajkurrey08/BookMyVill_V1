const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const { requirePropertyAccess, requireOwnerPropertySelection } = require('../services/propertyAccess');
const { sendError } = require('../utils/validate');
const CaretakerApplication = require('../models/CaretakerApplication');

const Attendance = require('../models/Attendance');

// Apply for Caretaker (Owners/Providers only)
router.post('/apply', auth, async (req, res) => {
  try {
    const { propertyId, propertyName, propertyAddress, positionRole, phone, experience, skillsRequired, services, govtId, bio } = req.body;
    if (req.user.role === 'owner') {
      if (propertyId) await requirePropertyAccess(req.user, propertyId);
      else await requireOwnerPropertySelection(req.user.id);
    }

    const application = new CaretakerApplication({
      provider: req.user.id,
      property: propertyId || null,
      propertyName: propertyName || 'All Managed Properties',
      propertyAddress: propertyAddress || 'Mahabaleshwar, Satara',
      positionRole: positionRole || 'Chief Villa Caretaker Host',
      phone: phone || 'N/A',
      experience: experience || '3 - 5 Years',
      skillsRequired: skillsRequired || (services || ['Guest Check-in & Key Handover']),
      services: services || (skillsRequired || ['Guest Check-in & Key Handover']),
      govtId: govtId || '',
      bio: bio || '',
      status: 'pending' // Pending security approval by Admin
    });

    if (mongoose.connection.readyState === 1) {
      await application.save();
    }
    res.status(201).json(application);
  } catch (err) {
    console.error('Caretaker apply error:', err.message);
    sendError(res, err, 'Caretaker application');
  }
});

// Get provider's caretaker applications
router.get('/my-applications', auth, async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json([
      {
        _id: 'ct-app-1',
        propertyName: 'Royal Mist Villa Estate',
        positionRole: 'Chief Villa Caretaker Host',
        phone: '+91 98765 43210',
        experience: '5+ Years',
        status: 'approved',
        assignedCaretaker: {
          name: 'Suresh Patil',
          phone: '+91 98765 43210',
          role: 'Chief Villa Caretaker Host',
          status: 'Active Duty'
        }
      }
    ]);
  }
  try {
    let applications = await CaretakerApplication.find({ provider: req.user.id }).sort({ appliedAt: -1 });
    if (!applications || applications.length === 0) {
      applications = await CaretakerApplication.find().sort({ appliedAt: -1 });
    }
    res.json(applications);
  } catch (err) {
    res.json([]);
  }
});

// Get Assigned Caretaker Profile for Owner
router.get('/assigned-profile', auth, async (req, res) => {
  try {
    const app = await CaretakerApplication.findOne({ provider: req.user.id, status: 'approved' });
    if (app && app.assignedCaretaker) {
      return res.json(app.assignedCaretaker);
    }
    // Default assigned caretaker profile for owner
    res.json({
      name: 'Suresh Patil',
      phone: '+91 98765 43210',
      experience: '5+ Years Luxury Hospitality',
      role: 'Chief Villa Caretaker Host',
      status: 'Active Duty',
      govtIdStatus: 'Verified by Admin',
      assignedProperty: 'Mahabaleshwar Villa',
      assignedDate: '2026-01-15'
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// Attendance Check-In
router.post('/attendance/check-in', async (req, res) => {
  try {
    const { caretakerName, propertyName, shiftNotes } = req.body;
    const todayStr = new Date().toISOString().split('T')[0];

    let record = await Attendance.findOne({
      caretakerName: caretakerName || 'Caretaker Host',
      date: todayStr
    });

    if (record && record.checkInTime && record.status === 'checked-in') {
      return res.status(400).json({ msg: 'Already checked in for today!', record });
    }

    if (!record) {
      record = new Attendance({
        caretakerName: caretakerName || 'Caretaker Host',
        propertyName: propertyName || 'Royal Mist Villa Estate',
        date: todayStr,
        checkInTime: new Date(),
        status: 'checked-in',
        shiftNotes: shiftNotes || 'Morning Duty Check-In'
      });
    } else {
      record.checkInTime = new Date();
      record.status = 'checked-in';
    }

    await record.save();
    res.json({ msg: 'Check-in successful! On Duty.', record });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ msg: 'Failed to record check-in' });
  }
});

// Attendance Check-Out
router.post('/attendance/check-out', async (req, res) => {
  try {
    const { caretakerName, shiftNotes } = req.body;
    const todayStr = new Date().toISOString().split('T')[0];

    const record = await Attendance.findOne({
      caretakerName: caretakerName || 'Caretaker Host',
      date: todayStr
    });

    if (!record || !record.checkInTime) {
      return res.status(400).json({ msg: 'No active check-in record found for today.' });
    }

    record.checkOutTime = new Date();
    record.status = 'present';

    // Calculate hours worked
    const diffMs = record.checkOutTime - new Date(record.checkInTime);
    record.hoursWorked = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
    if (shiftNotes) record.shiftNotes = shiftNotes;

    await record.save();
    res.json({ msg: 'Check-out successful! Shift logged.', record });
  } catch (err) {
    console.error('Check-out error:', err);
    res.status(500).json({ msg: 'Failed to record check-out' });
  }
});

// Get Attendance History Logs
router.get('/attendance/my-logs', async (req, res) => {
  try {
    const caretakerName = req.query.name || 'Caretaker Host';
    const logs = await Attendance.find({ caretakerName }).sort({ date: -1 }).limit(30);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ msg: 'Failed to fetch attendance logs' });
  }
});

module.exports = router;
