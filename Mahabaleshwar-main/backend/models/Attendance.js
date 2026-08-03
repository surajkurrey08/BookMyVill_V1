const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  caretaker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  caretakerName: {
    type: String,
    required: true
  },
  propertyName: {
    type: String,
    default: 'Royal Mist Villa Estate'
  },
  date: {
    type: String, // YYYY-MM-DD
    required: true
  },
  checkInTime: {
    type: Date
  },
  checkOutTime: {
    type: Date
  },
  hoursWorked: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'half-day', 'checked-in'],
    default: 'present'
  },
  shiftNotes: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Attendance', AttendanceSchema);
