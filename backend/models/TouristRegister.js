const mongoose = require('mongoose');

const TouristRegisterSchema = new mongoose.Schema({
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
    required: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  guestName: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  expectedArrivalTime: {
    type: String,
    default: '12:00 PM'
  },
  actualCheckInTime: {
    type: Date
  },
  checkOutDate: {
    type: String
  },
  adultsCount: {
    type: Number,
    default: 2
  },
  childrenCount: {
    type: Number,
    default: 0
  },
  roomAssigned: {
    type: String,
    default: 'Suite 101'
  },
  idVerified: {
    type: Boolean,
    default: true
  },
  govtIdType: {
    type: String,
    default: 'Aadhaar Card'
  },
  status: {
    type: String,
    enum: ['Registered', 'Arrived', 'Checked-Out'],
    default: 'Registered'
  },
  specialRequests: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('TouristRegister', TouristRegisterSchema);
