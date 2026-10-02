const express = require('express');
const mongoose = require('mongoose');
const ownerAuth = require('../middleware/ownerAuth');
const Inquiry = require('../models/Inquiry');
const FollowUp = require('../models/FollowUp');
const CrmActivity = require('../models/CrmActivity');
const Property = require('../models/Property');
const StaffMember = require('../models/StaffMember');
const Quotation = require('../models/Quotation');
const { createWithCode } = require('../services/refCode');
const { logActivity, recomputeNextFollowUp, resolveStaff, guestHistory, ownerPropertyIds } = require('../services/crm');
const { sweepExpiredQuotes } = require('../services/quotes');
const {
  DAY_MS, validId, validDate, daysBetween, indiaDate, indiaDayStart, addDays, cleanText, cleanMultiline,
  validPhone, phoneKey, validEmail, intInRange, escapeRegex, pagination, HttpError, sendError
} = require('../utils/validate');

const router = express.Router();
router.use(ownerAuth);

const { SOURCES, STATUSES, LOST_REASONS, STAGE_RANK } = Inquiry;
const CHANNELS = FollowUp.CHANNELS;
const OPEN_STATUSES = STATUSES.filter(status => !['booked', 'lost'].includes(status));
const fail = (res, err) => sendError(res, err, 'Owner CRM');

async function inquiryForOwner(req, id, select) {
  if (!validId(id)) throw new HttpError(400, 'Invalid inquiry ID.');
  const query = Inquiry.findOne({ _id: id, owner: req.user.id });
  if (select) query.select(select);
  const inquiry = await query;
  if (!inquiry) throw new HttpError(404, 'Inquiry not found in your account.');
  return inquiry;
}

async function ownedPropertyId(owner, value) {
  if (value === null || value === '' || value === undefined) return null;
  if (!validId(String(value))) throw new HttpError(400, 'Invalid property.');
  const property = await Property.exists({ _id: value, owner });
  if (!property) throw new HttpError(404, 'Property not found in your account.');
  return property._id;
}

// Validates inquiry fields. With `partial`, only supplied fields are checked.
async function parseInquiry(req, { partial }) {
  const body = req.body || {};
  const values = {};
  // Name and source are required when creating; everything else is optional.
  const required = new Set(partial ? [] : ['guestName', 'source']);
  const has = key => required.has(key) || body[key] !== undefined;

  if (has('guestName')) {
    const name = cleanText(body.guestName, 100);
    if (!name) throw new HttpError(400, 'Enter the guest name (up to 100 characters).');
    values.guestName = name;
  }
  if (has('guestPhone')) {
    const phone = cleanText(body.guestPhone, 20);
    if (phone === null || (phone && !validPhone(phone))) throw new HttpError(400, 'Enter a valid phone number.');
    values.guestPhone = phone;
    values.guestPhoneKey = phoneKey(phone);
  }
  if (has('guestEmail')) {
    const email = cleanText(body.guestEmail, 120);
    if (email === null || (email && !validEmail(email))) throw new HttpError(400, 'Enter a valid email address.');
    values.guestEmail = email.toLowerCase();
  }
  if (has('source')) {
    if (!SOURCES.includes(body.source)) throw new HttpError(400, 'Choose where this inquiry came from.');
    values.source = body.source;
  }
  if (has('sourceDetail')) {
    const detail = cleanText(body.sourceDetail, 120);
    if (detail === null) throw new HttpError(400, 'Source detail must be under 120 characters.');
    values.sourceDetail = detail;
  }
  if (has('priority')) {
    if (!['low', 'normal', 'high'].includes(body.priority)) throw new HttpError(400, 'Invalid priority.');
    values.priority = body.priority;
  }
  if (has('propertyId')) values.property = await ownedPropertyId(req.user.id, body.propertyId);
  if (has('checkIn') || has('checkOut')) {
    const checkIn = body.checkIn || null;
    const checkOut = body.checkOut || null;
    if (checkIn || checkOut) {
      if (!validDate(checkIn) || !validDate(checkOut) || checkOut <= checkIn || daysBetween(checkIn, checkOut) > 365) {
        throw new HttpError(400, 'Enter a check-in date and a later check-out date (up to 365 nights).');
      }
      if (!partial && checkIn < addDays(indiaDate(), -1)) throw new HttpError(400, 'Check-in date is in the past.');
    }
    values.checkIn = checkIn;
    values.checkOut = checkOut;
  }
  if (has('flexibleDates')) values.flexibleDates = body.flexibleDates === true;
  for (const [key, max] of [['adults', 50], ['children', 50], ['infants', 20], ['pets', 10]]) {
    if (!has(key)) continue;
    const count = intInRange(body[key] ?? 0, 0, max);
    if (count === null) throw new HttpError(400, `Enter a valid number of ${key} (0–${max}).`);
    values[key] = count;
  }
  for (const key of ['budgetMin', 'budgetMax']) {
    if (!has(key)) continue;
    const amount = body[key] === '' || body[key] === null || body[key] === undefined ? null : intInRange(body[key], 0, 100000000);
    if (amount === null && body[key] !== '' && body[key] !== null && body[key] !== undefined) throw new HttpError(400, 'Budget must be a whole rupee amount.');
    values[key] = amount;
  }
  if (has('destination')) {
    const destination = cleanText(body.destination, 80);
    if (destination === null) throw new HttpError(400, 'Destination must be under 80 characters.');
    values.destination = destination;
  }
  if (has('requirements')) {
    const list = Array.isArray(body.requirements) ? body.requirements : [];
    const cleaned = [...new Set(list.map(item => cleanText(item, 60)).filter(Boolean))];
    if (cleaned.length > 15 || list.some(item => cleanText(item, 60) === null)) throw new HttpError(400, 'Add up to 15 requirements of 60 characters each.');
    values.requirements = cleaned;
  }
  if (has('message')) {
    const message = cleanMultiline(body.message, 2000);
    if (message === null) throw new HttpError(400, 'Inquiry message must be under 2000 characters.');
    values.message = message;
  }
  if (has('assignedTo')) values.assignedTo = (await resolveStaff(req.user.id, body.assignedTo))?._id || null;
  if (has('marketingConsent')) values.marketingConsent = body.marketingConsent === true;
  return values;
}

function assertInquiryShape(inquiry) {
  if (!inquiry.guestPhone && !inquiry.guestEmail) throw new HttpError(400, 'Add a phone number or email so the guest can be contacted.');
  if ((inquiry.adults || 0) + (inquiry.children || 0) < 1) throw new HttpError(400, 'Add at least one adult or child.');
  if (inquiry.budgetMin !== null && inquiry.budgetMax !== null && inquiry.budgetMin !== undefined && inquiry.budgetMax !== undefined && inquiry.budgetMin > inquiry.budgetMax) {
    throw new HttpError(400, 'Minimum budget cannot be above the maximum budget.');
  }
}

const listPopulate = query => query.populate('property', 'name').populate('assignedTo', 'name role');

function inquiryFilter(req) {
  const owner = req.user.id;
  const filter = { owner };
  const view = req.query.view || 'open';
  const endOfToday = indiaDayStart(addDays(indiaDate(), 1));
  if (view === 'open') filter.status = { $in: OPEN_STATUSES };
  else if (view === 'lost') filter.status = 'lost';
  else if (view === 'booked') filter.status = 'booked';
  else if (view === 'followups') { filter.status = { $in: OPEN_STATUSES }; filter.nextFollowUpAt = { $ne: null, $lt: endOfToday }; }
  else if (view === 'unanswered') filter.status = 'new';
  else if (view !== 'all') throw new HttpError(400, 'Unknown view.');
  if (req.query.status) {
    if (!STATUSES.includes(req.query.status)) throw new HttpError(400, 'Unknown status filter.');
    filter.status = req.query.status;
  }
  if (req.query.source) {
    if (!SOURCES.includes(req.query.source)) throw new HttpError(400, 'Unknown source filter.');
    filter.source = req.query.source;
  }
  if (req.query.priority) {
    if (!['low', 'normal', 'high'].includes(req.query.priority)) throw new HttpError(400, 'Unknown priority filter.');
    filter.priority = req.query.priority;
  }
  if (req.query.propertyId) {
    if (!validId(req.query.propertyId)) throw new HttpError(400, 'Invalid property filter.');
    filter.property = req.query.propertyId;
  }
  if (req.query.assignedTo) {
    if (req.query.assignedTo === 'unassigned') filter.assignedTo = null;
    else if (validId(req.query.assignedTo)) filter.assignedTo = req.query.assignedTo;
    else throw new HttpError(400, 'Invalid staff filter.');
  }
  const q = cleanText(req.query.q, 80);
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    const or = [{ guestName: pattern }, { guestEmail: pattern }, { code: pattern }];
    const digits = q.replace(/\D/g, '');
    if (digits.length >= 3) or.push({ guestPhoneKey: { $regex: escapeRegex(digits) } });
    filter.$or = or;
  }
  return filter;
}

const SORTS = {
  recent: { lastActivityAt: -1 },
  newest: { createdAt: -1 },
  followup: { nextFollowUpAt: 1, lastActivityAt: -1 },
  checkin: { checkIn: 1, createdAt: -1 }
};

router.get('/meta', async (req, res) => {
  try {
    const propertyIds = await ownerPropertyIds(req.user.id);
    const [properties, staff] = await Promise.all([
      Property.find({ owner: req.user.id }).select('_id name type location status').sort({ name: 1 }).lean(),
      StaffMember.find({ property: { $in: propertyIds }, active: true }).select('_id name role property').sort({ name: 1 }).lean()
    ]);
    res.json({ sources: SOURCES, statuses: STATUSES, lostReasons: LOST_REASONS, channels: CHANNELS, properties, staff });
  } catch (err) { fail(res, err); }
});

router.get('/summary', async (req, res) => {
  try {
    const owner = req.user.id;
    const days = intInRange(req.query.days || 30, 1, 365) || 30;
    const today = indiaDate();
    const todayStart = indiaDayStart(today);
    const tomorrowStart = indiaDayStart(addDays(today, 1));
    const since = indiaDayStart(addDays(today, -(days - 1)));
    const now = new Date();
    await sweepExpiredQuotes(owner);
    const ownerId = new mongoose.Types.ObjectId(owner);

    const [statusCounts, newToday, staleNew, overdue, dueToday, dueList, funnelRows, sourceRows, lostRows, responseRows, quoteCounts, expiringSoon, acceptedQuotes] = await Promise.all([
      Inquiry.aggregate([{ $match: { owner: ownerId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Inquiry.countDocuments({ owner, createdAt: { $gte: todayStart } }),
      Inquiry.countDocuments({ owner, status: 'new', createdAt: { $lt: new Date(now - 60 * 60000) } }),
      FollowUp.countDocuments({ owner, status: 'pending', dueAt: { $lt: now } }),
      FollowUp.countDocuments({ owner, status: 'pending', dueAt: { $gte: now, $lt: tomorrowStart } }),
      FollowUp.find({ owner, status: 'pending', dueAt: { $lt: tomorrowStart } }).sort({ dueAt: 1 }).limit(8)
        .populate('inquiry', 'code guestName guestPhone status').populate('assignedTo', 'name').lean(),
      Inquiry.aggregate([{ $match: { owner: ownerId, createdAt: { $gte: since } } }, { $group: {
        _id: null, total: { $sum: 1 },
        contacted: { $sum: { $cond: [{ $gte: ['$furthestStage', 1] }, 1, 0] } },
        qualified: { $sum: { $cond: [{ $gte: ['$furthestStage', 2] }, 1, 0] } },
        quoted: { $sum: { $cond: [{ $gte: ['$furthestStage', 3] }, 1, 0] } },
        paymentPending: { $sum: { $cond: [{ $gte: ['$furthestStage', 4] }, 1, 0] } },
        booked: { $sum: { $cond: [{ $eq: ['$status', 'booked'] }, 1, 0] } },
        lost: { $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] } }
      } }]),
      Inquiry.aggregate([{ $match: { owner: ownerId, createdAt: { $gte: since } } }, { $group: { _id: '$source', count: { $sum: 1 }, booked: { $sum: { $cond: [{ $eq: ['$status', 'booked'] }, 1, 0] } } } }, { $sort: { count: -1 } }]),
      Inquiry.aggregate([{ $match: { owner: ownerId, status: 'lost', updatedAt: { $gte: since } } }, { $group: { _id: '$lostReason', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Inquiry.aggregate([{ $match: { owner: ownerId, createdAt: { $gte: since }, firstResponseAt: { $ne: null } } }, { $project: { minutes: { $divide: [{ $subtract: ['$firstResponseAt', '$createdAt'] }, 60000] } } }, { $group: { _id: null, avg: { $avg: '$minutes' }, count: { $sum: 1 } } }]),
      Quotation.aggregate([{ $match: { owner: ownerId } }, { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$totals.total' } } }]),
      Quotation.find({ owner, status: { $in: ['sent', 'viewed'] }, validUntil: { $gt: now, $lt: new Date(+now + DAY_MS) } }).sort({ validUntil: 1 }).limit(6).select('code guest.name status validUntil totals.total').lean(),
      Quotation.find({ owner, status: 'accepted' }).sort({ acceptedAt: 1 }).limit(6).select('code guest.name acceptedAt validUntil totals.total').lean()
    ]);

    const byStatus = Object.fromEntries(STATUSES.map(status => [status, 0]));
    for (const row of statusCounts) byStatus[row._id] = row.count;
    const quoteStatus = Object.fromEntries(quoteCounts.map(row => [row._id, { count: row.count, value: row.value }]));
    const funnel = funnelRows[0] || { total: 0, contacted: 0, qualified: 0, quoted: 0, paymentPending: 0, booked: 0, lost: 0 };
    delete funnel._id;
    res.json({
      days, today, byStatus,
      openLeads: OPEN_STATUSES.reduce((sum, status) => sum + byStatus[status], 0),
      newToday, staleNew,
      followUps: { overdue, dueToday, list: dueList },
      quotes: {
        awaiting: (quoteStatus.sent?.count || 0) + (quoteStatus.viewed?.count || 0),
        awaitingValue: (quoteStatus.sent?.value || 0) + (quoteStatus.viewed?.value || 0),
        viewed: quoteStatus.viewed?.count || 0,
        accepted: quoteStatus.accepted?.count || 0,
        acceptedValue: quoteStatus.accepted?.value || 0,
        drafts: quoteStatus.draft?.count || 0,
        expiringSoon, acceptedList: acceptedQuotes
      },
      funnel,
      sources: sourceRows.map(row => ({ source: row._id, count: row.count, booked: row.booked })),
      lostReasons: lostRows.map(row => ({ reason: row._id || 'other', count: row.count })),
      responseTime: responseRows[0] ? { averageMinutes: Math.round(responseRows[0].avg), sample: responseRows[0].count } : null
    });
  } catch (err) { fail(res, err); }
});

router.get('/inquiries', async (req, res) => {
  try {
    const filter = inquiryFilter(req);
    const { page, limit, skip } = pagination(req.query);
    const sort = SORTS[req.query.sort] || SORTS.recent;
    const ownerId = new mongoose.Types.ObjectId(req.user.id);
    const [items, total, statusRows] = await Promise.all([
      listPopulate(Inquiry.find(filter).sort(sort).skip(skip).limit(limit)).lean(),
      Inquiry.countDocuments(filter),
      Inquiry.aggregate([{ $match: { owner: ownerId } }, { $group: { _id: '$status', count: { $sum: 1 } } }])
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), statusCounts: Object.fromEntries(statusRows.map(row => [row._id, row.count])) });
  } catch (err) { fail(res, err); }
});

function csvCell(value) {
  const raw = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

router.get('/inquiries/export.csv', async (req, res) => {
  try {
    const filter = inquiryFilter(req);
    const items = await listPopulate(Inquiry.find(filter).sort(SORTS[req.query.sort] || SORTS.recent).limit(5000)).lean();
    const rows = [['Reference', 'Created', 'Guest', 'Phone', 'Email', 'Source', 'Status', 'Priority', 'Property', 'Check-in', 'Check-out', 'Adults', 'Children', 'Budget min', 'Budget max', 'Assigned to', 'Next follow-up', 'Lost reason']];
    for (const item of items) {
      rows.push([item.code, item.createdAt?.toISOString().slice(0, 10), item.guestName, item.guestPhone, item.guestEmail, item.source, item.status, item.priority, item.property?.name || '', item.checkIn || '', item.checkOut || '', item.adults, item.children, item.budgetMin ?? '', item.budgetMax ?? '', item.assignedTo?.name || '', item.nextFollowUpAt ? item.nextFollowUpAt.toISOString() : '', item.lostReason || '']);
    }
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="inquiries-${indiaDate()}.csv"`);
    res.send(`﻿${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`);
  } catch (err) { fail(res, err); }
});

router.post('/inquiries', async (req, res) => {
  try {
    const values = await parseInquiry(req, { partial: false });
    const inquiry = { adults: 2, children: 0, infants: 0, pets: 0, budgetMin: null, budgetMax: null, ...values };
    assertInquiryShape(inquiry);
    if (inquiry.guestPhoneKey && req.body.allowDuplicate !== true) {
      const existing = await Inquiry.findOne({ owner: req.user.id, guestPhoneKey: inquiry.guestPhoneKey, status: { $in: OPEN_STATUSES } }).select('_id code status guestName').lean();
      if (existing) return res.status(409).json({ msg: `${existing.guestName} already has an open inquiry (${existing.code}). Open it, or create a separate inquiry anyway.`, duplicateOf: existing });
    }
    const created = await createWithCode(Inquiry, 'INQ', { ...inquiry, owner: req.user.id, createdBy: req.user.id, status: 'new', furthestStage: 0, lastActivityAt: new Date() });
    await logActivity({ owner: req.user.id, inquiry: created._id, type: 'created', actor: req.user.id, body: inquiry.message ? `Inquiry received via ${inquiry.source}.` : '', meta: { source: inquiry.source }, direction: 'inbound' });
    res.status(201).json(await listPopulate(Inquiry.findById(created._id)).lean());
  } catch (err) { fail(res, err); }
});

router.get('/inquiries/:id', async (req, res) => {
  try {
    await sweepExpiredQuotes(req.user.id);
    const inquiry = await inquiryForOwner(req, req.params.id);
    await inquiry.populate([{ path: 'property', select: 'name type location' }, { path: 'assignedTo', select: 'name role' }, { path: 'booking', select: 'status paymentStatus checkIn checkOut totalPrice' }]);
    const [followUps, activities, quotes, history] = await Promise.all([
      FollowUp.find({ owner: req.user.id, inquiry: inquiry._id }).sort({ status: -1, dueAt: 1 }).limit(50).populate('assignedTo', 'name').lean(),
      CrmActivity.find({ owner: req.user.id, inquiry: inquiry._id }).sort({ createdAt: -1 }).limit(150).populate('actor', 'name').lean(),
      Quotation.find({ owner: req.user.id, inquiry: inquiry._id }).sort({ createdAt: -1 }).select('code status checkIn checkOut totals.total validUntil roomSnapshot.name property createdAt sentAt viewCount booking').populate('property', 'name').lean(),
      guestHistory(req.user.id, { phoneKey: inquiry.guestPhoneKey, email: inquiry.guestEmail })
    ]);
    // History includes this inquiry itself.
    res.json({ inquiry, followUps, activities, quotes, guestHistory: { ...history, otherInquiries: Math.max(0, history.inquiries - 1) } });
  } catch (err) { fail(res, err); }
});

router.patch('/inquiries/:id', async (req, res) => {
  try {
    const inquiry = await inquiryForOwner(req, req.params.id);
    const values = await parseInquiry(req, { partial: true });
    if (!Object.keys(values).length) throw new HttpError(400, 'No changes supplied.');
    const merged = { ...inquiry.toObject(), ...values };
    assertInquiryShape(merged);
    const filter = { _id: inquiry._id, owner: req.user.id };
    if (req.body.expectedRevision !== undefined) {
      const expected = intInRange(req.body.expectedRevision, 0, Number.MAX_SAFE_INTEGER);
      if (expected === null) throw new HttpError(400, 'Invalid revision marker.');
      filter.revision = expected;
    }
    const assignmentChanged = values.assignedTo !== undefined && String(values.assignedTo || '') !== String(inquiry.assignedTo || '');
    const updated = await Inquiry.findOneAndUpdate(filter, { $set: values, $inc: { revision: 1 } }, { new: true, runValidators: true });
    if (!updated) throw new HttpError(409, 'Someone else updated this inquiry. Refresh to see the latest details.');
    if (assignmentChanged) {
      const staff = values.assignedTo ? await StaffMember.findById(values.assignedTo).select('name').lean() : null;
      await logActivity({ owner: req.user.id, inquiry: inquiry._id, type: 'assignment', actor: req.user.id, body: staff ? `Assigned to ${staff.name}.` : 'Assignment removed.' });
    }
    res.json(await listPopulate(Inquiry.findById(updated._id)).lean());
  } catch (err) { fail(res, err); }
});

router.post('/inquiries/:id/status', async (req, res) => {
  try {
    const inquiry = await inquiryForOwner(req, req.params.id);
    const status = req.body?.status;
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Choose a valid status.');
    if (status === inquiry.status) throw new HttpError(409, `This inquiry is already ${status.replace('_', ' ')}.`);
    const note = cleanText(req.body.note, 300);
    if (note === null) throw new HttpError(400, 'Note must be under 300 characters.');
    const set = { status, furthestStage: Math.max(inquiry.furthestStage || 0, STAGE_RANK[status] ?? 0) };
    if (status === 'lost') {
      if (!LOST_REASONS.includes(req.body.lostReason)) throw new HttpError(400, 'Choose why this inquiry was lost.');
      const lostNote = cleanText(req.body.lostNote, 300);
      if (lostNote === null) throw new HttpError(400, 'Lost note must be under 300 characters.');
      set.lostReason = req.body.lostReason;
      set.lostNote = lostNote;
      set.nextFollowUpAt = null;
    } else {
      set.lostReason = null;
      set.lostNote = '';
    }
    if (status === 'booked') set.nextFollowUpAt = null;
    if (inquiry.status === 'new' && !inquiry.firstResponseAt) set.firstResponseAt = new Date();
    const updated = await Inquiry.findOneAndUpdate({ _id: inquiry._id, owner: req.user.id, status: inquiry.status }, { $set: set, $inc: { revision: 1 } }, { new: true });
    if (!updated) throw new HttpError(409, 'This inquiry changed while you were editing. Refresh and try again.');
    if (['lost', 'booked'].includes(status)) {
      await FollowUp.updateMany({ owner: req.user.id, inquiry: inquiry._id, status: 'pending' }, { $set: { status: 'cancelled', outcome: status === 'lost' ? 'Lead marked lost' : 'Lead booked' } });
    }
    const reasonText = status === 'lost' ? `Reason: ${req.body.lostReason.replace(/_/g, ' ')}${set.lostNote ? ` — ${set.lostNote}` : ''}` : note;
    await logActivity({ owner: req.user.id, inquiry: inquiry._id, type: 'status_change', actor: req.user.id, body: reasonText, meta: { from: inquiry.status, to: status } });
    res.json(await listPopulate(Inquiry.findById(updated._id)).lean());
  } catch (err) { fail(res, err); }
});

router.post('/inquiries/:id/activities', async (req, res) => {
  try {
    const inquiry = await inquiryForOwner(req, req.params.id, '_id');
    const type = req.body?.type;
    if (!CrmActivity.MANUAL_TYPES.includes(type)) throw new HttpError(400, 'Choose what kind of interaction this was.');
    const direction = type === 'note' ? 'internal' : req.body.direction;
    if (!['inbound', 'outbound', 'internal'].includes(direction)) throw new HttpError(400, 'Choose whether the guest contacted you or you contacted the guest.');
    const body = cleanMultiline(req.body.body, 2000);
    if (!body) throw new HttpError(400, 'Write what was discussed (up to 2000 characters).');
    const activity = await logActivity({ owner: req.user.id, inquiry: inquiry._id, type, direction, body, actor: req.user.id });
    await activity.populate('actor', 'name');
    res.status(201).json(activity);
  } catch (err) { fail(res, err); }
});

function parseDueAt(value) {
  const due = new Date(value);
  const now = Date.now();
  if (typeof value !== 'string' || Number.isNaN(+due) || due < now - DAY_MS || due > now + 365 * DAY_MS) {
    throw new HttpError(400, 'Choose a follow-up time within the next year.');
  }
  return due;
}

router.post('/inquiries/:id/follow-ups', async (req, res) => {
  try {
    const inquiry = await inquiryForOwner(req, req.params.id, '_id status');
    if (['lost', 'booked'].includes(inquiry.status)) throw new HttpError(409, 'Reopen this inquiry before scheduling a follow-up.');
    const body = req.body || {};
    const dueAt = parseDueAt(body.dueAt);
    const channel = body.channel || 'call';
    if (!CHANNELS.includes(channel)) throw new HttpError(400, 'Choose a follow-up channel.');
    const note = cleanText(body.note, 300);
    if (note === null) throw new HttpError(400, 'Note must be under 300 characters.');
    const assignedTo = (await resolveStaff(req.user.id, body.assignedTo))?._id || null;
    let quotation = null;
    if (body.quotationId) {
      if (!validId(body.quotationId) || !(await Quotation.exists({ _id: body.quotationId, owner: req.user.id, inquiry: inquiry._id }))) throw new HttpError(404, 'Quotation not found for this inquiry.');
      quotation = body.quotationId;
    }
    const followUp = await FollowUp.create({ owner: req.user.id, inquiry: inquiry._id, quotation, dueAt, channel, note, assignedTo, createdBy: req.user.id });
    await recomputeNextFollowUp(req.user.id, inquiry._id);
    await logActivity({ owner: req.user.id, inquiry: inquiry._id, type: 'follow_up', actor: req.user.id, body: `Follow-up scheduled by ${channel}${note ? `: ${note}` : '.'}`, meta: { dueAt } });
    await followUp.populate('assignedTo', 'name');
    res.status(201).json(followUp);
  } catch (err) { fail(res, err); }
});

router.get('/follow-ups', async (req, res) => {
  try {
    const owner = req.user.id;
    const now = new Date();
    const tomorrowStart = indiaDayStart(addDays(indiaDate(), 1));
    const views = {
      overdue: { filter: { status: 'pending', dueAt: { $lt: now } }, sort: { dueAt: 1 } },
      today: { filter: { status: 'pending', dueAt: { $gte: now, $lt: tomorrowStart } }, sort: { dueAt: 1 } },
      upcoming: { filter: { status: 'pending', dueAt: { $gte: tomorrowStart } }, sort: { dueAt: 1 } },
      done: { filter: { status: { $in: ['done', 'cancelled'] } }, sort: { updatedAt: -1 } }
    };
    const view = views[req.query.view || 'overdue'];
    if (!view) throw new HttpError(400, 'Unknown follow-up view.');
    const filter = { owner, ...view.filter };
    if (req.query.assignedTo) {
      if (req.query.assignedTo === 'unassigned') filter.assignedTo = null;
      else if (validId(req.query.assignedTo)) filter.assignedTo = req.query.assignedTo;
      else throw new HttpError(400, 'Invalid staff filter.');
    }
    const { page, limit, skip } = pagination(req.query);
    const [items, total, overdue, today, upcoming] = await Promise.all([
      FollowUp.find(filter).sort(view.sort).skip(skip).limit(limit).populate('inquiry', 'code guestName guestPhone guestEmail status checkIn checkOut').populate('assignedTo', 'name').populate('completedBy', 'name').lean(),
      FollowUp.countDocuments(filter),
      FollowUp.countDocuments({ owner, ...views.overdue.filter }),
      FollowUp.countDocuments({ owner, ...views.today.filter }),
      FollowUp.countDocuments({ owner, ...views.upcoming.filter })
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), counts: { overdue, today, upcoming } });
  } catch (err) { fail(res, err); }
});

router.patch('/follow-ups/:id', async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(400, 'Invalid follow-up ID.');
    const followUp = await FollowUp.findOne({ _id: req.params.id, owner: req.user.id });
    if (!followUp) throw new HttpError(404, 'Follow-up not found in your account.');
    if (followUp.status !== 'pending') throw new HttpError(409, 'This follow-up is already closed.');
    const body = req.body || {};
    const outcome = cleanText(body.outcome, 300);
    if (outcome === null) throw new HttpError(400, 'Outcome must be under 300 characters.');
    let set;
    let activity;
    if (body.action === 'complete') {
      set = { status: 'done', outcome, completedAt: new Date(), completedBy: req.user.id };
      activity = `Follow-up completed${outcome ? `: ${outcome}` : '.'}`;
    } else if (body.action === 'cancel') {
      set = { status: 'cancelled', outcome, completedAt: new Date(), completedBy: req.user.id };
      activity = `Follow-up cancelled${outcome ? `: ${outcome}` : '.'}`;
    } else if (body.action === 'reschedule') {
      set = { dueAt: parseDueAt(body.dueAt) };
      activity = 'Follow-up rescheduled.';
    } else throw new HttpError(400, 'Choose complete, cancel, or reschedule.');
    const updated = await FollowUp.findOneAndUpdate({ _id: followUp._id, owner: req.user.id, status: 'pending' }, { $set: set }, { new: true });
    if (!updated) throw new HttpError(409, 'This follow-up changed while you were editing. Refresh and try again.');
    let next = null;
    if (body.action === 'complete' && body.nextDueAt) {
      next = await FollowUp.create({ owner: req.user.id, inquiry: followUp.inquiry, quotation: followUp.quotation, dueAt: parseDueAt(body.nextDueAt), channel: CHANNELS.includes(body.nextChannel) ? body.nextChannel : followUp.channel, note: cleanText(body.nextNote, 300) || '', assignedTo: followUp.assignedTo, createdBy: req.user.id });
      activity += ' Next follow-up scheduled.';
    }
    await recomputeNextFollowUp(req.user.id, followUp.inquiry);
    await logActivity({ owner: req.user.id, inquiry: followUp.inquiry, type: 'follow_up', actor: req.user.id, body: activity, meta: { followUp: followUp._id } });
    res.json({ followUp: updated, next });
  } catch (err) { fail(res, err); }
});

// Recent sales conversation across all leads: the owner's unified log.
router.get('/activities', async (req, res) => {
  try {
    const { page, limit, skip } = pagination(req.query, 30);
    const filter = { owner: req.user.id };
    if (req.query.types === 'conversation') filter.type = { $in: CrmActivity.MANUAL_TYPES.filter(type => type !== 'note') };
    const [items, total] = await Promise.all([
      CrmActivity.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('inquiry', 'code guestName').populate('quotation', 'code').populate('actor', 'name').lean(),
      CrmActivity.countDocuments(filter)
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) { fail(res, err); }
});

module.exports = router;
