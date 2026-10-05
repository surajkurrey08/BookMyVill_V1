const express = require('express');
const accountAuth = require('../middleware/accountAuth');
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const GuestRequest = require('../models/GuestRequest');
const { createWithCode } = require('../services/refCode');
const { validId, cleanText, cleanMultiline, DAY_MS, HttpError, sendError } = require('../utils/validate');

// Customer-facing "My Stay" API: the trip detail a guest sees, plus the guest
// requests and issues they raise during their stay. Everything is scoped to
// the signed-in guest's own bookings.
const router = express.Router();
router.use(accountAuth);
const fail = (res, err) => sendError(res, err, 'Customer stay');

const { KINDS, REQUEST_CATEGORIES, ISSUE_CATEGORIES, OPEN_STATUSES } = GuestRequest;
const PHOTO_MAX = 2_000_000; // ~1.4 MB as a data URL
const ISSUE_GRACE_MS = 3 * DAY_MS;

async function bookingForGuest(req, id) {
  if (!validId(id)) throw new HttpError(400, 'Invalid booking.');
  const booking = await Booking.findById(id).populate('property', 'name type location photos mapLink assignedCaretaker stayInfo owner').populate('room', 'name type');
  if (!booking || String(booking.user || '') !== req.user.id) throw new HttpError(404, 'Booking not found in your account.');
  return booking;
}

const nights = booking => Math.max(1, Math.round((new Date(booking.checkOut) - new Date(booking.checkIn)) / DAY_MS));
const firstUrl = value => (typeof value === 'string' && /^https?:\/\//i.test(value) ? value : '');

// Service requests can be raised until checkout; issues for a short grace
// window after, so a guest can still report a problem on their way out.
function requestWindow(booking) {
  const checkedOut = booking.stayStatus === 'checked_out';
  const afterCheckout = Date.now() - new Date(booking.checkOut).getTime();
  return {
    confirmed: booking.status === 'confirmed',
    service: booking.status === 'confirmed' && !checkedOut,
    issue: booking.status === 'confirmed' && (!checkedOut || afterCheckout < ISSUE_GRACE_MS)
  };
}

function timeline(booking) {
  const paid = booking.paymentStatus === 'paid';
  const stay = booking.stayStatus || 'expected';
  const checkedIn = stay === 'in_house' || stay === 'checked_out';
  const checkedOut = stay === 'checked_out';
  const hasDeposit = (booking.securityDepositAmount || 0) > 0;
  if (booking.status === 'cancelled') {
    const refundPaid = booking.refundStatus === 'processed';
    return [
      { key: 'booked', label: 'Booked', state: 'done' },
      { key: 'cancelled', label: 'Cancelled', state: 'done' },
      ...(paid ? [{ key: 'refund', label: refundPaid ? 'Refund completed' : 'Refund under review', state: refundPaid ? 'done' : 'current' }] : [])
    ];
  }
  const steps = [
    { key: 'booked', label: 'Booked', state: 'done' },
    { key: 'payment', label: paid ? 'Payment received' : 'Payment pending', state: paid ? 'done' : 'current' },
    { key: 'confirmed', label: 'Confirmed', state: booking.status === 'confirmed' ? 'done' : 'upcoming' },
    { key: 'checkin', label: 'Checked in', state: checkedIn ? 'done' : (booking.status === 'confirmed' && paid ? 'current' : 'upcoming') },
    { key: 'checkout', label: 'Checked out', state: checkedOut ? 'done' : 'upcoming' }
  ];
  if (hasDeposit) steps.push({ key: 'deposit', label: checkedOut ? 'Deposit refund in progress' : 'Security deposit held', state: checkedOut ? 'current' : 'upcoming' });
  return steps;
}

const requestView = item => ({
  _id: item._id, code: item.code, kind: item.kind, category: item.category, description: item.description,
  status: item.status, priority: item.priority, eta: item.eta,
  updates: (item.updates || []).map(u => ({ status: u.status, note: u.note, byRole: u.byRole, at: u.at })),
  photos: item.photos || [], createdAt: item.createdAt, resolvedAt: item.resolvedAt
});

router.get('/trips/:id', async (req, res) => {
  try {
    const booking = await bookingForGuest(req, req.params.id);
    const property = booking.property || {};
    const stayInfo = property.stayInfo || {};
    const window = requestWindow(booking);
    const checkedOut = booking.stayStatus === 'checked_out';
    const requests = await GuestRequest.find({ booking: booking._id }).sort({ createdAt: -1 }).limit(50).lean();

    res.set('Cache-Control', 'no-store');
    res.json({
      booking: {
        _id: booking._id, status: booking.status, paymentStatus: booking.paymentStatus, stayStatus: booking.stayStatus || 'expected',
        checkIn: booking.checkIn, checkOut: booking.checkOut, nights: nights(booking), stayType: booking.stayType,
        guests: booking.guests, adults: booking.adults, children: booking.children,
        totalPrice: booking.totalPrice, amountPaid: booking.paymentStatus === 'paid' ? booking.totalPrice : 0,
        roomLabel: booking.room ? `${booking.room.name}${booking.room.type ? ` · ${booking.room.type}` : ''}` : null,
        source: booking.source || 'website', createdAt: booking.createdAt
      },
      property: { _id: property._id, name: property.name, type: property.type, location: property.location, photo: firstUrl(property.photos?.[0]), mapLink: firstUrl(property.mapLink) },
      stay: {
        checkInTime: stayInfo.checkInTime || '2:00 PM', checkOutTime: stayInfo.checkOutTime || '11:00 AM',
        // Wi-Fi is only returned for a confirmed booking (the guest is eligible).
        wifi: window.confirmed && stayInfo.wifiName ? { name: stayInfo.wifiName, password: stayInfo.wifiPassword || '' } : null,
        houseRules: Array.isArray(stayInfo.houseRules) ? stayInfo.houseRules : [],
        arrivalNotes: stayInfo.arrivalNotes || '', foodInfo: stayInfo.foodInfo || '',
        caretaker: property.assignedCaretaker?.name ? { name: property.assignedCaretaker.name, phone: property.assignedCaretaker.phone || '' } : null
      },
      deposit: (booking.securityDepositAmount || 0) > 0 ? { amount: booking.securityDepositAmount, status: checkedOut ? 'processing' : 'held' } : null,
      refund: booking.status === 'cancelled' && booking.paymentStatus === 'paid'
        ? { status: booking.refundStatus === 'processed' ? 'completed' : 'under_review', amount: booking.refundAmount || booking.totalPrice }
        : null,
      timeline: timeline(booking),
      requests: requests.map(requestView),
      can: {
        request: window.service, reportIssue: window.issue,
        review: booking.status === 'confirmed' && (checkedOut || new Date(booking.checkOut) < new Date()),
        cancel: booking.status !== 'cancelled' && !['in_house', 'checked_out'].includes(booking.stayStatus) && booking.status === 'confirmed'
      }
    });
  } catch (err) { fail(res, err); }
});

function validatePhotos(photos) {
  if (photos === undefined) return [];
  if (!Array.isArray(photos) || photos.length > 3) throw new HttpError(400, 'Add up to 3 photos.');
  for (const photo of photos) {
    if (typeof photo !== 'string' || !/^(data:image\/|https?:\/\/)/.test(photo) || photo.length > PHOTO_MAX) {
      throw new HttpError(400, 'Each photo must be an image under 1.4 MB.');
    }
  }
  return photos;
}

router.post('/requests', async (req, res) => {
  try {
    const booking = await bookingForGuest(req, req.body.bookingId);
    const kind = req.body.kind;
    if (!KINDS.includes(kind)) throw new HttpError(400, 'Choose a request or an issue.');
    const window = requestWindow(booking);
    if (kind === 'request' && !window.service) throw new HttpError(409, booking.status !== 'confirmed' ? 'Requests are available once your booking is confirmed.' : 'Your stay is complete, so new requests are closed.');
    if (kind === 'issue' && !window.issue) throw new HttpError(409, booking.status !== 'confirmed' ? 'This is available once your booking is confirmed.' : 'The window to report an issue for this stay has closed. Please contact support.');
    const categories = kind === 'issue' ? ISSUE_CATEGORIES : REQUEST_CATEGORIES;
    const category = req.body.category;
    if (!categories.includes(category)) throw new HttpError(400, 'Choose a valid category.');
    const description = cleanMultiline(req.body.description, 1000);
    if (!description || description.length < 3) throw new HttpError(400, 'Tell us a little about what you need.');
    const photos = validatePhotos(req.body.photos);
    // Guard against accidental double-taps creating duplicate open requests.
    const recent = await GuestRequest.findOne({ booking: booking._id, kind, category, description, status: { $in: OPEN_STATUSES }, createdAt: { $gt: new Date(Date.now() - 60000) } }).lean();
    if (recent) return res.status(201).json(requestView(recent));
    const created = await createWithCode(GuestRequest, 'REQ', {
      booking: booking._id, property: booking.property._id, owner: booking.property.owner, customer: req.user.id,
      guestName: booking.guest?.name || '', kind, category, description, photos,
      priority: kind === 'issue' ? 'high' : 'normal', status: 'open',
      updates: [{ status: 'open', note: '', byRole: 'guest', at: new Date() }]
    });
    res.status(201).json(requestView(created.toObject()));
  } catch (err) { fail(res, err); }
});

router.get('/requests', async (req, res) => {
  try {
    const booking = await bookingForGuest(req, req.query.bookingId);
    const requests = await GuestRequest.find({ booking: booking._id }).sort({ createdAt: -1 }).limit(50).lean();
    res.json(requests.map(requestView));
  } catch (err) { fail(res, err); }
});

// A guest departure uses the same turnover record as the operations panel.
router.post('/trips/:id/check-out', async (req, res) => {
  try {
    const booking = await bookingForGuest(req, req.params.id);
    if (booking.stayStatus !== 'in_house' || !booking.room) throw new HttpError(409, 'Only an in-house booking can be checked out.');
    const Housekeeping = require('../models/HousekeepingTask');
    const { ensureModelIndexes } = require('../utils/modelIndexes');
    const { indiaDate } = require('../utils/validate');
    await ensureModelIndexes(Housekeeping);
    await Housekeeping.findOneAndUpdate({ dedupeKey: `checkout:${booking._id}` }, { $setOnInsert: { property: booking.property._id, room: booking.room._id, booking: booking._id, category: 'turnover', title: 'Clean room after guest checkout', dueDate: indiaDate(), status: 'open', stage: 'dirty' } }, { upsert: true, setDefaultsOnInsert: true });
    const updated = await Booking.findOneAndUpdate({ _id: booking._id, user: req.user.id, status: 'confirmed', stayStatus: 'in_house' }, { $set: { stayStatus: 'checked_out', actualCheckOut: new Date() }, $push: { actionHistory: { action: 'Guest Checked Out', performedBy: `Traveler (${req.user.id})`, targetUser: `Booking ${booking._id}`, reason: 'Turnover cleaning and inspection required.' } } }, { new: true });
    if (!updated) throw new HttpError(409, 'Booking changed. Refresh your stay.');
    res.json({ stayStatus: updated.stayStatus, housekeeping: 'dirty' });
  } catch (err) { fail(res, err); }
});

router.post('/requests/:id/cancel', async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(400, 'Invalid request.');
    const request = await GuestRequest.findById(req.params.id);
    if (!request || String(request.customer || '') !== req.user.id) throw new HttpError(404, 'Request not found in your account.');
    if (!OPEN_STATUSES.includes(request.status)) throw new HttpError(409, 'This request can no longer be cancelled.');
    if (request.status === 'in_progress') throw new HttpError(409, 'This is already being handled. Contact the property to change it.');
    const updated = await GuestRequest.findOneAndUpdate({ _id: request._id, status: request.status }, {
      $set: { status: 'cancelled', resolvedAt: new Date() },
      $push: { updates: { status: 'cancelled', note: 'Cancelled by guest', byRole: 'guest', at: new Date() } }
    }, { new: true });
    if (!updated) throw new HttpError(409, 'This request changed. Refresh and try again.');
    res.json(requestView(updated.toObject()));
  } catch (err) { fail(res, err); }
});

module.exports = router;
