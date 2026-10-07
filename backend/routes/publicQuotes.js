const express = require('express');
const Quotation = require('../models/Quotation');
const Room = require('../models/Room');
const RoomNight = require('../models/RoomNight');
const inventory = require('../services/inventory');
const paymentClient = require('../services/paymentClient');
const rateLimit = require('../middleware/rateLimit');
const { logActivity, advanceInquiry } = require('../services/crm');
const { sweepExpiredQuotes, convertQuote, MAX_QUOTE_NIGHTS } = require('../services/quotes');
const Inquiry = require('../models/Inquiry');
const { cleanText, stayNights, indiaDate, HttpError, sendError } = require('../utils/validate');

// Guest-facing quotation link. The 256-bit token in the URL is the only
// credential, so responses expose just what the guest needs: no internal
// notes, no room numbers, no other guests' data.
const router = express.Router();
router.use(rateLimit({ windowMs: 60000, max: 60, keyPrefix: 'quote-view' }));
const actionLimit = rateLimit({ windowMs: 10 * 60000, max: 20, keyPrefix: 'quote-action', message: 'Too many attempts. Please wait a few minutes and try again.' });
const fail = (res, err) => sendError(res, err, 'Public quotation');
const PAYMENT_HOLD_MINUTES = 20;

const publicUrl = value => (typeof value === 'string' && /^https?:\/\//i.test(value) ? value : '');
const PUBLIC_UNITS = { per_stay: 'per stay', per_night: 'per night', per_guest: 'per guest', per_guest_per_night: 'per guest per night', per_unit: 'each' };

async function loadQuote(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new HttpError(404, 'This quotation link is not valid.');
  let quote = await Quotation.findOne({ publicToken: token }).select('_id owner status');
  if (!quote || quote.status === 'draft') throw new HttpError(404, 'This quotation link is not valid.');
  await sweepExpiredQuotes(quote.owner);
  quote = await Quotation.findOne({ _id: quote._id })
    .populate('property', 'name type location photos mapLink')
    .populate('owner', 'name phone')
    .populate('booking', 'status paymentStatus')
    .populate({ path: 'revisedBy', select: 'status +publicToken' });
  return quote;
}

// `online`: whether payment-service can take payments (paymentClient.online).
function view(quote, online) {
  const payable = quote.status === 'accepted' && online && quote.checkIn >= indiaDate();
  const revision = quote.revisedBy;
  return {
    code: quote.code,
    status: quote.status,
    validUntil: quote.validUntil,
    property: {
      name: quote.property?.name, type: quote.property?.type, location: quote.property?.location,
      photo: publicUrl(quote.property?.photos?.[0]), mapLink: publicUrl(quote.property?.mapLink)
    },
    room: { name: quote.roomSnapshot?.name, type: quote.roomSnapshot?.type, capacity: quote.roomSnapshot?.capacity },
    guestName: quote.guest.name,
    stay: { checkIn: quote.checkIn, checkOut: quote.checkOut, nights: quote.nights, adults: quote.adults, children: quote.children, infants: quote.infants, pets: quote.pets },
    nightlyRate: quote.nightlyRate,
    addOns: quote.addOns.map(line => ({ name: line.name, unit: PUBLIC_UNITS[line.pricingUnit] || '', quantity: line.quantity, unitPrice: line.unitPrice, amount: line.amount })),
    fees: quote.fees.map(line => ({ label: line.label, amount: line.amount })),
    discounts: [
      quote.promotion?.discountAmount > 0 && { label: `Offer ${quote.promotion.code}${quote.promotion.name ? ` · ${quote.promotion.name}` : ''}`, amount: quote.promotion.discountAmount },
      quote.manualDiscount?.amount > 0 && { label: 'Special discount', amount: quote.manualDiscount.amount }
    ].filter(Boolean),
    taxMode: quote.taxMode,
    accommodationTaxRate: quote.accommodationTaxRate,
    totals: quote.totals,
    securityDeposit: quote.securityDeposit,
    advancePercent: quote.advancePercent,
    schedule: quote.schedule,
    cancellationText: quote.cancellationText,
    notesToGuest: quote.notesToGuest,
    host: { name: quote.owner?.name || 'Your host', phone: quote.owner?.phone || '' },
    acceptedAt: quote.acceptedAt, acceptedName: quote.acceptedName, rejectedAt: quote.rejectedAt,
    booking: quote.status === 'converted' && quote.booking ? { status: quote.booking.status, paymentStatus: quote.booking.paymentStatus } : null,
    replacedBy: revision && ['sent', 'viewed', 'accepted'].includes(revision.status) ? `/quote/${revision.publicToken}` : null,
    replaced: Boolean(revision),
    onlinePayment: payable
  };
}

router.get('/:token', async (req, res) => {
  try {
    const quote = await loadQuote(req.params.token);
    const now = new Date();
    if (['sent', 'viewed', 'accepted'].includes(quote.status)) {
      const firstView = await Quotation.findOneAndUpdate({ _id: quote._id, status: 'sent' }, { $set: { status: 'viewed', firstViewedAt: now } });
      await Quotation.updateOne({ _id: quote._id }, { $inc: { viewCount: 1 }, $set: { lastViewedAt: now } });
      if (firstView) {
        quote.status = 'viewed';
        await logActivity({ owner: quote.owner._id, inquiry: quote.inquiry, quotation: quote._id, type: 'quote_viewed', actorType: 'guest', direction: 'inbound', body: `${quote.guest.name} opened ${quote.code}.` });
      }
    }
    res.set('Cache-Control', 'no-store');
    res.json(view(quote, await paymentClient.online(req.id)));
  } catch (err) { fail(res, err); }
});

router.post('/:token/accept', actionLimit, async (req, res) => {
  try {
    const quote = await loadQuote(req.params.token);
    if (quote.status === 'accepted' || quote.status === 'converted') return res.json(view(quote, await paymentClient.online(req.id)));
    if (quote.status === 'expired') throw new HttpError(410, 'This quotation has expired. Ask your host for an updated quote.');
    if (!['sent', 'viewed'].includes(quote.status)) throw new HttpError(409, 'This quotation can no longer be accepted.');
    const name = cleanText(req.body?.name, 100);
    if (!name || name.length < 2) throw new HttpError(400, 'Type your full name to accept the quotation.');
    if (req.body?.agree !== true) throw new HttpError(400, 'Please confirm you have read the cancellation policy.');
    const now = new Date();
    const updated = await Quotation.findOneAndUpdate(
      { _id: quote._id, status: { $in: ['sent', 'viewed'] }, validUntil: { $gt: now } },
      { $set: { status: 'accepted', acceptedAt: now, acceptedName: name } }, { new: true }
    );
    if (!updated) throw new HttpError(409, 'This quotation expired or changed just now. Refresh the page.');
    await logActivity({ owner: quote.owner._id, inquiry: quote.inquiry, quotation: quote._id, type: 'quote_accepted', actorType: 'guest', direction: 'inbound', body: `${name} accepted ${quote.code} (₹${quote.totals.total.toLocaleString('en-IN')}).` });
    if (quote.inquiry) await advanceInquiry({ owner: quote.owner._id, inquiryId: quote.inquiry, target: 'payment_pending', actorType: 'guest', reason: `Guest accepted ${quote.code}.` });
    res.json(view(await loadQuote(req.params.token), await paymentClient.online(req.id)));
  } catch (err) { fail(res, err); }
});

router.post('/:token/reject', actionLimit, async (req, res) => {
  try {
    const quote = await loadQuote(req.params.token);
    if (!['sent', 'viewed'].includes(quote.status)) throw new HttpError(409, 'This quotation can no longer be declined.');
    const reason = cleanText(req.body?.reason, 300);
    if (reason === null) throw new HttpError(400, 'Please keep the reason under 300 characters.');
    const updated = await Quotation.findOneAndUpdate({ _id: quote._id, status: { $in: ['sent', 'viewed'] } }, { $set: { status: 'rejected', rejectedAt: new Date(), rejectReason: reason } }, { new: true });
    if (!updated) throw new HttpError(409, 'This quotation changed just now. Refresh the page.');
    await inventory.releaseHolds(quote._id);
    await logActivity({ owner: quote.owner._id, inquiry: quote.inquiry, quotation: quote._id, type: 'quote_rejected', actorType: 'guest', direction: 'inbound', body: `${quote.guest.name} declined ${quote.code}${reason ? `: ${reason}` : '.'}` });
    if (quote.inquiry) await Inquiry.updateOne({ _id: quote.inquiry, owner: quote.owner._id, status: 'quotation_sent' }, { $set: { status: 'follow_up' } });
    res.json(view(await loadQuote(req.params.token), await paymentClient.online(req.id)));
  } catch (err) { fail(res, err); }
});

// Creates a Razorpay order for the full quoted amount after securing the room
// for the payment window.
router.post('/:token/pay', actionLimit, async (req, res) => {
  try {
    if (!await paymentClient.online(req.id)) throw new HttpError(503, 'Online payment is not available for this quotation. Please contact your host to pay.');
    const quote = await loadQuote(req.params.token);
    if (quote.status === 'converted') throw new HttpError(409, 'This quotation is already booked.');
    if (quote.status !== 'accepted') throw new HttpError(409, 'Accept the quotation before paying.');
    if (quote.checkIn < indiaDate()) throw new HttpError(409, 'The check-in date has passed. Ask your host for a new quotation.');
    const dates = stayNights(quote.checkIn, quote.checkOut, MAX_QUOTE_NIGHTS);
    const room = await Room.findOne({ _id: quote.room, active: true });
    if (!room || !dates) throw new HttpError(409, 'This stay can no longer be booked online. Please contact your host.');
    const holdUntil = new Date(Date.now() + PAYMENT_HOLD_MINUTES * 60000);
    if (await inventory.activeHoldCount(quote._id) === dates.length) {
      await RoomNight.updateMany({ kind: 'hold', reference: quote._id }, { $max: { expiresAt: holdUntil } });
    } else {
      await inventory.releaseHolds(quote._id);
      await inventory.reserveNights(room, dates, 'hold', quote._id, { reason: `Payment in progress for ${quote.code}`, expiresAt: holdUntil, conflictMessage: 'These dates are no longer available. Please contact your host for alternatives.' });
    }
    let order;
    try {
      order = await paymentClient.createOrder({ purpose: 'quote', amount: quote.totals.total, receipt: quote.code, quoteId: String(quote._id), notes: { quotation: String(quote._id) } }, req.id);
    } catch (err) {
      console.error('Quotation order creation error:', err);
      throw new HttpError(502, 'The payment provider is unavailable. No payment was taken; please try again shortly.');
    }
    await Quotation.updateOne({ _id: quote._id }, { $push: { paymentOrders: { orderId: order.order_id, amount: order.amount } } });
    res.json({
      order_id: order.order_id, amount: order.amount, currency: 'INR', key_id: order.key_id,
      description: `${quote.property?.name || 'Stay'} · ${quote.code}`,
      prefill: { name: quote.guest.name, email: quote.guest.email, contact: quote.guest.phone }
    });
  } catch (err) { fail(res, err); }
});

router.post('/:token/verify', actionLimit, async (req, res) => {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (typeof orderId !== 'string' || !/^order_[A-Za-z0-9]+$/.test(orderId) || typeof paymentId !== 'string' || !/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
      throw new HttpError(400, 'Complete the payment in the Razorpay window first.');
    }
    const quote = await loadQuote(req.params.token);
    const order = quote.paymentOrders.find(item => item.orderId === orderId);
    if (!order) throw new HttpError(404, 'This payment does not belong to this quotation.');
    // payment-service checks the signature and the captured amount with the provider.
    let payment;
    try { payment = await paymentClient.verifyQuote({ orderId, paymentId, signature }, req.id); }
    catch (err) {
      if (err.status === 503) throw new HttpError(502, 'We could not confirm the payment with Razorpay yet. If money was deducted, it is safe — please refresh in a minute.');
      throw err;
    }
    if (payment.amount !== order.amount) throw new HttpError(409, 'Payment details do not match this quotation.');

    if (quote.status === 'converted') {
      const Booking = require('../models/Booking');
      const booking = await Booking.findById(quote.booking?._id || quote.booking).select('razorpayPaymentId');
      if (booking?.razorpayPaymentId === paymentId) return res.json({ msg: 'Payment already confirmed.', quote: view(quote, true) });
      await logActivity({ owner: quote.owner._id, inquiry: quote.inquiry, quotation: quote._id, type: 'payment', actorType: 'system', direction: 'inbound', body: `Second payment ${paymentId} (₹${(payment.amount / 100).toLocaleString('en-IN')}) captured for ${quote.code}, which was already booked. Refund the duplicate payment.` });
      throw new HttpError(409, 'This quotation was already paid. Your host has been notified and will refund the duplicate payment.');
    }
    const result = await convertQuote(quote._id, { actorType: 'system', payment: { orderId, paymentId, amount: payment.amount, mode: payment.mode } });
    res.json({ msg: result.roomAssigned ? 'Payment received. Your stay is confirmed.' : 'Payment received. Your host will confirm your room shortly.', quote: view(await loadQuote(req.params.token), true) });
  } catch (err) { fail(res, err); }
});

module.exports = router;
