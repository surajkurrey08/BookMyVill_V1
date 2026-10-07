const mongoose = require('mongoose');
const { database } = require('../config');

// Notifications owed to people after booking/payment events. No SMS/e-mail/
// WhatsApp provider exists yet, so entries stay 'pending_provider'; a provider
// integration only has to send them and mark them 'sent'.
const NotificationLogSchema = new mongoose.Schema({
  eventId: { type: String, required: true },
  event: { type: String, required: true },
  audience: { type: String, enum: ['guest', 'owner', 'operations'], required: true },
  channel: { type: String, enum: ['email', 'sms', 'whatsapp', 'in_app'], required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, default: null },
  property: { type: mongoose.Schema.Types.ObjectId, default: null },
  title: { type: String, required: true, maxlength: 200 },
  status: { type: String, enum: ['pending_provider', 'sent', 'failed'], default: 'pending_provider' },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'notificationlogs' });
// One notification per event, audience and channel, even if an event is redelivered.
NotificationLogSchema.index({ eventId: 1, audience: 1, channel: 1 }, { unique: true });
NotificationLogSchema.index({ createdAt: -1 });

module.exports = database.connection.model('NotificationLog', NotificationLogSchema);
