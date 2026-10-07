const NotificationLog = require('../models/NotificationLog');

module.exports = {
  // Idempotent insert: a duplicate (event, audience, channel) is ignored.
  async recordOnce(entry) {
    try { await NotificationLog.create(entry); return true; }
    catch (error) { if (error.code === 11000) return false; throw error; }
  },
  async page({ status, skip, limit }) {
    const filter = status ? { status } : {};
    const [items, total] = await Promise.all([NotificationLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), NotificationLog.countDocuments(filter)]);
    return { items, total };
  },
  countForEvent: eventId => NotificationLog.countDocuments({ eventId })
};
