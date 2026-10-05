const Inquiry = require('../models/Inquiry');
const FollowUp = require('../models/FollowUp');
const CrmActivity = require('../models/CrmActivity');
const StaffMember = require('../models/StaffMember');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { escapeRegex, HttpError, validId } = require('../utils/validate');
const { propertyScope } = require('./propertyAccess');

const { STAGE_RANK } = Inquiry;
const RESPONSE_TYPES = new Set(['call', 'whatsapp', 'email', 'sms', 'meeting']);

async function logActivity({ owner, inquiry = null, quotation = null, booking = null, type, direction = 'internal', body = '', meta, actorType = 'owner', actor = null, at = new Date() }) {
  const activity = await CrmActivity.create({ owner, inquiry, quotation, booking, type, direction, body, meta, actorType, actor, createdAt: at });
  if (inquiry) {
    const set = { lastActivityAt: at };
    await Inquiry.updateOne({ _id: inquiry, owner }, { $set: set });
    // The first outbound contact (or a sent quote) marks the response time.
    if ((RESPONSE_TYPES.has(type) && direction === 'outbound') || type === 'quote_sent') {
      await Inquiry.updateOne({ _id: inquiry, owner, firstResponseAt: null }, { $set: { firstResponseAt: at } });
    }
  }
  return activity;
}

// Automatic pipeline moves (quote sent, quote accepted, booking created) only
// ever move a lead forward; they never reopen a lost lead except to book it.
async function advanceInquiry({ owner, inquiryId, target, actorType = 'system', actor = null, reason = '' }) {
  if (!inquiryId) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const inquiry = await Inquiry.findOne({ _id: inquiryId, owner }).select('status furthestStage');
    if (!inquiry || inquiry.status === target || inquiry.status === 'booked') return inquiry;
    if (inquiry.status === 'lost' && target !== 'booked') return inquiry;
    if (target !== 'booked' && STAGE_RANK[target] <= STAGE_RANK[inquiry.status]) return inquiry;
    const set = { status: target, furthestStage: Math.max(inquiry.furthestStage || 0, STAGE_RANK[target] ?? 0) };
    if (target === 'booked') { set.lostReason = null; set.lostNote = ''; set.nextFollowUpAt = null; }
    const updated = await Inquiry.findOneAndUpdate({ _id: inquiryId, owner, status: inquiry.status }, { $set: set }, { new: true });
    if (!updated) continue;
    await logActivity({ owner, inquiry: inquiryId, type: 'status_change', actorType, actor, body: reason, meta: { from: inquiry.status, to: target } });
    if (target === 'booked') await FollowUp.updateMany({ owner, inquiry: inquiryId, status: 'pending' }, { $set: { status: 'cancelled', outcome: 'Lead booked' } });
    return updated;
  }
  return null;
}

async function recomputeNextFollowUp(owner, inquiryId) {
  const next = await FollowUp.findOne({ owner, inquiry: inquiryId, status: 'pending' }).sort({ dueAt: 1 }).select('dueAt').lean();
  await Inquiry.updateOne({ _id: inquiryId, owner }, { $set: { nextFollowUpAt: next ? next.dueAt : null } });
  return next ? next.dueAt : null;
}

async function ownerPropertyIds(owner) {
  return Property.find(propertyScope({ id: owner, role: 'owner' })).distinct('_id');
}

// Staff from any of the owner's properties can own a lead or follow-up.
async function resolveStaff(owner, staffId) {
  if (staffId === null || staffId === '' || staffId === undefined) return null;
  if (!validId(String(staffId))) throw new HttpError(400, 'Invalid staff member.');
  const propertyIds = await ownerPropertyIds(owner);
  const staff = await StaffMember.findOne({ _id: staffId, property: { $in: propertyIds }, active: true }).select('_id name role');
  if (!staff) throw new HttpError(404, 'Active staff member not found in your properties.');
  return staff;
}

// Past relationship with a guest, matched by phone or email across the
// owner's properties. Used to flag repeat guests and for promotion rules.
async function guestHistory(owner, { phoneKey = '', email = '' } = {}) {
  const empty = { inquiries: 0, bookings: 0, completedStays: 0, cancelled: 0, lastStayAt: null };
  if (!phoneKey && !email) return empty;
  const propertyIds = await ownerPropertyIds(owner);
  const userMatch = [];
  if (phoneKey.length >= 10) userMatch.push({ phone: { $regex: `${escapeRegex(phoneKey)}$` } });
  if (email) userMatch.push({ email: email.toLowerCase() });
  const users = userMatch.length ? await User.find({ $or: userMatch }).select('_id').limit(20).lean() : [];
  const bookingMatch = [];
  if (users.length) bookingMatch.push({ user: { $in: users.map(user => user._id) } });
  if (phoneKey) bookingMatch.push({ 'guest.phoneKey': phoneKey });
  if (email) bookingMatch.push({ 'guest.email': email.toLowerCase() });
  const inquiryMatch = [];
  if (phoneKey) inquiryMatch.push({ guestPhoneKey: phoneKey });
  if (email) inquiryMatch.push({ guestEmail: email.toLowerCase() });
  const [bookings, inquiries] = await Promise.all([
    bookingMatch.length ? Booking.find({ property: { $in: propertyIds }, $or: bookingMatch }).select('status stayStatus actualCheckOut checkOut').lean() : [],
    Inquiry.countDocuments({ owner, $or: inquiryMatch })
  ]);
  const completed = bookings.filter(item => item.stayStatus === 'checked_out');
  const last = completed.map(item => item.actualCheckOut || item.checkOut).filter(Boolean).sort((a, b) => b - a)[0] || null;
  return { inquiries, bookings: bookings.length, completedStays: completed.length, cancelled: bookings.filter(item => item.status === 'cancelled').length, lastStayAt: last };
}

module.exports = { logActivity, advanceInquiry, recomputeNextFollowUp, ownerPropertyIds, resolveStaff, guestHistory };
