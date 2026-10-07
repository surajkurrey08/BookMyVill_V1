const express = require('express');
const mongoose = require('mongoose');
const ownerAuth = require('../middleware/ownerAuth');
const Quotation = require('../models/Quotation');
const CrmActivity = require('../models/CrmActivity');
const Room = require('../models/Room');
const inventory = require('../services/inventory');
const { createWithCode } = require('../services/refCode');
const { logActivity, advanceInquiry } = require('../services/crm');
const { buildQuote, quoteInputs, sweepExpiredQuotes, convertQuote, newPublicToken, CONVERTIBLE, MAX_QUOTE_NIGHTS } = require('../services/quotes');
const paymentClient = require('../services/paymentClient');
const { requirePropertyAccess } = require('../services/propertyAccess');
const { validId, escapeRegex, cleanText, pagination, stayNights, HttpError, sendError } = require('../utils/validate');

const router = express.Router();
router.use(ownerAuth);
const fail = (res, err) => sendError(res, err, 'Owner quotations');
const SHARE_CHANNELS = ['whatsapp', 'email', 'link', 'sms', 'print'];

async function quoteForOwner(req, id, { withToken = false } = {}) {
  if (!validId(id)) throw new HttpError(400, 'Invalid quotation ID.');
  const query = Quotation.findOne({ _id: id, owner: req.user.id });
  if (withToken) query.select('+publicToken');
  const quote = await query;
  if (!quote) throw new HttpError(404, 'Quotation not found in your account.');
  if (!['GET', 'HEAD'].includes(req.method)) await requirePropertyAccess(req.user, quote.property);
  return quote;
}

async function detail(req, quoteId) {
  const quote = await Quotation.findOne({ _id: quoteId, owner: req.user.id }).select('+publicToken')
    .populate('property', 'name type location').populate('inquiry', 'code guestName status').populate('booking', 'status paymentStatus room totalPrice')
    .populate('revisionOf', 'code status').populate('revisedBy', 'code status').lean();
  const [activities, heldNights, onlinePayment] = await Promise.all([
    CrmActivity.find({ owner: req.user.id, quotation: quoteId }).sort({ createdAt: -1 }).limit(50).populate('actor', 'name').lean(),
    inventory.activeHoldCount(quote._id),
    paymentClient.online(req.id)
  ]);
  return { ...quote, publicPath: `/quote/${quote.publicToken}`, heldNights, activities, onlinePayment };
}

router.get('/', async (req, res) => {
  try {
    await sweepExpiredQuotes(req.user.id);
    const filter = { owner: req.user.id };
    if (req.query.status) {
      const statuses = String(req.query.status).split(',');
      if (statuses.some(status => !Quotation.STATUSES.includes(status))) throw new HttpError(400, 'Unknown status filter.');
      filter.status = { $in: statuses };
    }
    if (req.query.propertyId) {
      if (!validId(req.query.propertyId)) throw new HttpError(400, 'Invalid property filter.');
      filter.property = req.query.propertyId;
    }
    if (req.query.inquiryId) {
      if (!validId(req.query.inquiryId)) throw new HttpError(400, 'Invalid inquiry filter.');
      filter.inquiry = req.query.inquiryId;
    }
    const q = cleanText(req.query.q, 80);
    if (q) {
      const pattern = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ code: pattern }, { 'guest.name': pattern }, { 'guest.email': pattern }];
      const digits = q.replace(/\D/g, '');
      if (digits.length >= 3) filter.$or.push({ guestPhoneKey: { $regex: escapeRegex(digits) } });
    }
    const { page, limit, skip } = pagination(req.query);
    const [items, total, statusRows] = await Promise.all([
      Quotation.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit)
        .select('code status guest checkIn checkOut nights roomSnapshot.name property inquiry totals.total validUntil sentAt viewCount firstViewedAt acceptedAt holdInventory booking createdAt updatedAt')
        .populate('property', 'name').populate('inquiry', 'code').lean(),
      Quotation.countDocuments(filter),
      Quotation.aggregate([{ $match: { owner: new mongoose.Types.ObjectId(req.user.id) } }, { $group: { _id: '$status', count: { $sum: 1 } } }])
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), statusCounts: Object.fromEntries(statusRows.map(row => [row._id, row.count])) });
  } catch (err) { fail(res, err); }
});

// Rooms of a property with their quoting rate, for the builder.
router.get('/rooms/:propertyId', async (req, res) => {
  try {
    if (!validId(req.params.propertyId)) throw new HttpError(400, 'Invalid property.');
    const { ownerPropertyIds } = require('../services/crm');
    const ids = (await ownerPropertyIds(req.user.id)).map(String);
    if (!ids.includes(req.params.propertyId)) throw new HttpError(404, 'Property not found in your account.');
    res.json(await Room.find({ property: req.params.propertyId, active: true }).select('_id name number type capacity baseRate').sort({ number: 1 }).lean());
  } catch (err) { fail(res, err); }
});

router.post('/preview', async (req, res) => {
  try {
    const quoteId = req.body?.quoteId && validId(req.body.quoteId) ? req.body.quoteId : null;
    const built = await buildQuote(req.user.id, req.body || {}, { quoteId });
    res.json({ ...built.values, warnings: built.warnings, conflicts: built.conflicts, accommodationTax: built.pricing.accommodationTax, onlinePayment: await paymentClient.online(req.id) });
  } catch (err) { fail(res, err); }
});

router.post('/', async (req, res) => {
  try {
    const built = await buildQuote(req.user.id, req.body || {});
    const quote = await createWithCode(Quotation, 'QT', { ...built.values, owner: req.user.id, createdBy: req.user.id, publicToken: newPublicToken(), status: 'draft' });
    await logActivity({ owner: req.user.id, inquiry: quote.inquiry, quotation: quote._id, type: 'quote_created', actor: req.user.id, body: `${quote.code} drafted for ${built.room.name}, ${quote.checkIn} → ${quote.checkOut}.` });
    res.status(201).json({ ...(await detail(req, quote._id)), warnings: built.warnings });
  } catch (err) { fail(res, err); }
});

router.get('/:id', async (req, res) => {
  try {
    await sweepExpiredQuotes(req.user.id);
    const quote = await quoteForOwner(req, req.params.id);
    res.json(await detail(req, quote._id));
  } catch (err) { fail(res, err); }
});

router.put('/:id', async (req, res) => {
  try {
    const quote = await quoteForOwner(req, req.params.id);
    if (quote.status !== 'draft') throw new HttpError(409, 'Only a draft can be edited. Revise a sent quotation to change it.');
    const built = await buildQuote(req.user.id, req.body || {}, { quoteId: quote._id });
    const updated = await Quotation.findOneAndUpdate({ _id: quote._id, owner: req.user.id, status: 'draft' }, { $set: built.values }, { new: true });
    if (!updated) throw new HttpError(409, 'This quotation was sent or removed while you were editing.');
    res.json({ ...(await detail(req, quote._id)), warnings: built.warnings });
  } catch (err) { fail(res, err); }
});

router.delete('/:id', async (req, res) => {
  try {
    const quote = await quoteForOwner(req, req.params.id);
    if (quote.status !== 'draft') throw new HttpError(409, 'Only drafts can be deleted. Withdraw a sent quotation instead.');
    const removed = await Quotation.deleteOne({ _id: quote._id, owner: req.user.id, status: 'draft' });
    if (!removed.deletedCount) throw new HttpError(409, 'This quotation changed. Refresh and try again.');
    if (quote.inquiry) await logActivity({ owner: req.user.id, inquiry: quote.inquiry, type: 'system', actor: req.user.id, body: `Draft ${quote.code} deleted.` });
    res.json({ msg: 'Draft deleted.' });
  } catch (err) { fail(res, err); }
});

// Finalises a draft: freezes the price, starts the validity clock and,
// optionally, holds the room until the quote expires.
router.post('/:id/send', async (req, res) => {
  try {
    const quote = await quoteForOwner(req, req.params.id);
    if (quote.status !== 'draft') throw new HttpError(409, 'This quotation has already been sent.');
    // Re-validate against today's availability, rates and promotion rules.
    const overrides = {};
    if (req.body?.validityMinutes !== undefined) overrides.validityMinutes = req.body.validityMinutes;
    if (req.body?.holdInventory !== undefined) overrides.holdInventory = req.body.holdInventory === true;
    const built = await buildQuote(req.user.id, { ...quoteInputs(quote), nightlyRate: quote.nightlyRate, ...overrides }, { quoteId: quote._id });
    if (built.conflicts.length) throw new HttpError(409, `${built.room.name} is not free on ${built.conflicts.map(night => night.date).join(', ')}. Change the dates or room before sending.`);
    const now = new Date();
    const validUntil = new Date(+now + built.values.validityMinutes * 60000);
    let held = 0;
    if (built.values.holdInventory) {
      await inventory.reserveNights(built.room, built.dates, 'hold', quote._id, { reason: `Held for ${quote.code}`, expiresAt: validUntil, conflictMessage: `${built.room.name} was just taken for one of these nights.` });
      held = built.dates.length;
    }
    const updated = await Quotation.findOneAndUpdate(
      { _id: quote._id, owner: req.user.id, status: 'draft' },
      { $set: { ...built.values, status: 'sent', sentAt: now, validUntil } },
      { new: true }
    );
    if (!updated) {
      if (held) await inventory.releaseHolds(quote._id);
      throw new HttpError(409, 'This quotation changed while sending. Refresh and try again.');
    }
    const expiry = validUntil.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    await logActivity({ owner: req.user.id, inquiry: quote.inquiry, quotation: quote._id, type: 'quote_sent', direction: 'outbound', actor: req.user.id, body: `${quote.code} finalised for ₹${updated.totals.total.toLocaleString('en-IN')}, valid until ${expiry} IST${held ? ` with ${held} night${held === 1 ? '' : 's'} held` : ''}.` });
    if (quote.inquiry) await advanceInquiry({ owner: req.user.id, inquiryId: quote.inquiry, target: 'quotation_sent', actorType: 'owner', actor: req.user.id, reason: `Quotation ${quote.code} sent.` });
    res.json({ ...(await detail(req, quote._id)), warnings: built.warnings });
  } catch (err) { fail(res, err); }
});

// Records that the owner shared the link (WhatsApp, email, copy, print).
router.post('/:id/share', async (req, res) => {
  try {
    const quote = await quoteForOwner(req, req.params.id);
    const channel = req.body?.channel;
    if (!SHARE_CHANNELS.includes(channel)) throw new HttpError(400, 'Unknown share channel.');
    if (!['sent', 'viewed', 'accepted'].includes(quote.status)) throw new HttpError(409, 'Send the quotation before sharing it.');
    await Quotation.updateOne({ _id: quote._id, owner: req.user.id }, { $addToSet: { sentVia: channel } });
    const label = { whatsapp: 'Shared on WhatsApp', email: 'Shared by email', link: 'Link copied', sms: 'Shared by SMS', print: 'Printed / saved as PDF' }[channel];
    await logActivity({ owner: req.user.id, inquiry: quote.inquiry, quotation: quote._id, type: channel === 'whatsapp' ? 'whatsapp' : channel === 'email' ? 'email' : channel === 'sms' ? 'sms' : 'system', direction: channel === 'print' || channel === 'link' ? 'internal' : 'outbound', actor: req.user.id, body: `${label}: ${quote.code}.` });
    res.json({ msg: 'Recorded.' });
  } catch (err) { fail(res, err); }
});

router.post('/:id/withdraw', async (req, res) => {
  try {
    const quote = await quoteForOwner(req, req.params.id);
    if (!CONVERTIBLE.includes(quote.status)) throw new HttpError(409, 'Only an open quotation can be withdrawn.');
    const reason = cleanText(req.body?.reason, 200);
    if (reason === null) throw new HttpError(400, 'Reason must be under 200 characters.');
    const now = new Date();
    const updated = await Quotation.findOneAndUpdate(
      { _id: quote._id, owner: req.user.id, status: { $in: CONVERTIBLE }, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] },
      { $set: { status: 'withdrawn', withdrawnAt: now } }, { new: true }
    );
    if (!updated) throw new HttpError(409, 'This quotation is being converted or has changed. Refresh and try again.');
    await inventory.releaseHolds(quote._id);
    await logActivity({ owner: req.user.id, inquiry: quote.inquiry, quotation: quote._id, type: 'quote_withdrawn', actor: req.user.id, body: `${quote.code} withdrawn${reason ? `: ${reason}` : '.'}` });
    res.json(await detail(req, quote._id));
  } catch (err) { fail(res, err); }
});

// Copies a quotation into a new draft with current rates. An open original is
// withdrawn so the guest can only act on the latest version.
router.post('/:id/revise', async (req, res) => {
  try {
    const quote = await quoteForOwner(req, req.params.id);
    if (quote.status === 'draft') throw new HttpError(409, 'Edit the draft directly instead of revising it.');
    if (quote.status === 'converted') throw new HttpError(409, 'This quotation is already a booking.');
    if (quote.revisedBy) throw new HttpError(409, 'This quotation already has a newer revision.');
    const built = await buildQuote(req.user.id, quoteInputs(quote), { dropInvalidPromotion: true });
    const now = new Date();
    if (CONVERTIBLE.includes(quote.status)) {
      const withdrawn = await Quotation.findOneAndUpdate(
        { _id: quote._id, status: { $in: CONVERTIBLE }, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] },
        { $set: { status: 'withdrawn', withdrawnAt: now } }
      );
      if (!withdrawn) throw new HttpError(409, 'This quotation is being converted or has changed. Refresh and try again.');
      await inventory.releaseHolds(quote._id);
    }
    const revision = await createWithCode(Quotation, 'QT', { ...built.values, owner: req.user.id, createdBy: req.user.id, publicToken: newPublicToken(), status: 'draft', revisionOf: quote._id });
    await Quotation.updateOne({ _id: quote._id }, { $set: { revisedBy: revision._id } });
    await logActivity({ owner: req.user.id, inquiry: quote.inquiry, quotation: revision._id, type: 'quote_created', actor: req.user.id, body: `${revision.code} drafted as a revision of ${quote.code}${CONVERTIBLE.includes(quote.status) ? ` (${quote.code} withdrawn)` : ''}.` });
    res.status(201).json({ ...(await detail(req, revision._id)), warnings: built.warnings });
  } catch (err) { fail(res, err); }
});

router.post('/:id/convert', async (req, res) => {
  try {
    const quote = await quoteForOwner(req, req.params.id);
    if (!CONVERTIBLE.includes(quote.status)) throw new HttpError(409, quote.status === 'converted' ? 'This quotation is already a booking.' : 'Only a sent, viewed or accepted quotation can be converted.');
    if (!stayNights(quote.checkIn, quote.checkOut, MAX_QUOTE_NIGHTS)) throw new HttpError(409, 'Quotation dates are invalid.');
    const result = await convertQuote(quote._id, { actorType: 'owner', actor: req.user.id });
    res.json({ quote: await detail(req, quote._id), booking: result.booking, warning: result.warning });
  } catch (err) { fail(res, err); }
});

module.exports = router;
