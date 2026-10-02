const express = require('express');
const mongoose = require('mongoose');
const ownerAuth = require('../middleware/ownerAuth');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const OwnerExpense = require('../models/OwnerExpense');

const router = express.Router();
router.use(ownerAuth);

const validId = value => mongoose.Types.ObjectId.isValid(value);
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const nextDate = value => new Date(Date.parse(`${value}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
const periodContains = (value, from, until) => value && value >= from && value < until;

function fail(res, err) {
  console.error('Owner finance error:', err);
  if (!res.headersSent) res.status(500).json({ msg: 'Could not complete this financial action.' });
}

async function reportData(req, res) {
  const start = req.query.start;
  const end = req.query.end;
  if (!validDate(start) || !validDate(end) || start > end || (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 > 366) {
    res.status(400).json({ msg: 'Choose a valid reporting period up to 366 days.' });
    return null;
  }
  const allProperties = await Property.find({ owner: req.user.id }).select('_id name').lean();
  let properties = allProperties;
  if (req.query.propertyId && req.query.propertyId !== 'all') {
    if (!validId(req.query.propertyId)) { res.status(400).json({ msg: 'Invalid property filter.' }); return null; }
    properties = allProperties.filter(item => String(item._id) === req.query.propertyId);
    if (!properties.length) { res.status(404).json({ msg: 'Property not found in your account.' }); return null; }
  }
  const propertyIds = properties.map(item => item._id);
  const startDate = new Date(`${start}T00:00:00Z`);
  const until = nextDate(end);
  const untilDate = new Date(`${until}T00:00:00Z`);
  const [bookings, expenses] = await Promise.all([
    Booking.find({ property: { $in: propertyIds }, $or: [
      { createdAt: { $gte: startDate, $lt: untilDate } },
      { paidAt: { $gte: startDate, $lt: untilDate } }
    ] }).select('property user guest checkIn checkOut totalPrice status paymentStatus paymentMode paymentSource manualPaymentMethod manualPaymentReference razorpayOrderId razorpayPaymentId paidAt refundStatus refundAmount createdAt').populate('user', 'name email').lean(),
    OwnerExpense.find({ property: { $in: propertyIds }, incurredOn: { $gte: start, $lte: end } }).sort({ incurredOn: -1, createdAt: -1 }).lean()
  ]);
  const propertyName = new Map(properties.map(item => [String(item._id), item.name]));
  const totals = { liveCaptured: 0, manualRecorded: 0, testCaptured: 0, legacyUnverified: 0, pendingValue: 0, activeExpenses: 0, refundReviewCount: 0 };
  const byProperty = new Map(properties.map(item => [String(item._id), { propertyId: item._id, name: item.name, liveCaptured: 0, manualRecorded: 0, testCaptured: 0, expenses: 0, paidBookings: 0, pendingBookings: 0 }]));
  const months = new Map();
  for (const booking of bookings) {
    const row = byProperty.get(String(booking.property));
    const created = booking.createdAt?.toISOString().slice(0, 10);
    const paid = booking.paidAt?.toISOString().slice(0, 10);
    if (booking.paymentStatus === 'pending' && periodContains(created, start, until)) {
      totals.pendingValue += booking.totalPrice || 0;
      row.pendingBookings++;
    }
    if (booking.paymentStatus !== 'paid') continue;
    if (!booking.paymentMode && periodContains(created, start, until)) totals.legacyUnverified += booking.totalPrice || 0;
    if (!periodContains(paid, start, until)) continue;
    const amount = booking.totalPrice || 0;
    if (booking.paymentMode === 'live') { totals.liveCaptured += amount; row.liveCaptured += amount; row.paidBookings++; }
    if (booking.paymentMode === 'manual') { totals.manualRecorded += amount; row.manualRecorded += amount; row.paidBookings++; }
    if (booking.paymentMode === 'test') { totals.testCaptured += amount; row.testCaptured += amount; }
    if (booking.status === 'cancelled' && booking.paymentMode !== 'test' && booking.refundStatus !== 'processed') totals.refundReviewCount++;
    const key = paid.slice(0, 7);
    const month = months.get(key) || { month: key, liveCaptured: 0, manualRecorded: 0, testCaptured: 0 };
    if (booking.paymentMode === 'live') month.liveCaptured += amount;
    if (booking.paymentMode === 'manual') month.manualRecorded += amount;
    if (booking.paymentMode === 'test') month.testCaptured += amount;
    months.set(key, month);
  }
  for (const expense of expenses) {
    if (expense.status !== 'active') continue;
    totals.activeExpenses += expense.amount;
    byProperty.get(String(expense.property)).expenses += expense.amount;
  }
  const bookingRows = bookings.map(item => ({
    ...item, propertyName: propertyName.get(String(item.property)) || 'Property',
    verification: item.paymentStatus !== 'paid' ? 'pending' : item.paymentMode === 'live' ? 'gateway_live' : item.paymentMode === 'test' ? 'gateway_test' : item.paymentMode === 'manual' ? 'owner_recorded' : 'legacy_unverified'
  }));
  return { start, end, properties, totals, byProperty: [...byProperty.values()], monthly: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)), bookings: bookingRows, expenses };
}

router.get('/summary', async (req, res) => {
  try {
    const report = await reportData(req, res);
    if (report) res.json(report);
  } catch (err) { fail(res, err); }
});

function csvCell(value) {
  const raw = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

router.get('/report.csv', async (req, res) => {
  try {
    const report = await reportData(req, res);
    if (!report) return;
    const rows = [['Record type', 'Date', 'Property', 'Reference', 'Description', 'Amount INR', 'Classification', 'Status']];
    for (const booking of report.bookings) rows.push(['Booking', booking.paidAt?.toISOString().slice(0, 10) || booking.createdAt?.toISOString().slice(0, 10), booking.propertyName, booking.razorpayPaymentId || booking.manualPaymentReference || booking.razorpayOrderId || booking._id, `Booking ${booking._id}`, booking.totalPrice, booking.verification, booking.status]);
    for (const expense of report.expenses) rows.push(['Expense', expense.incurredOn, report.properties.find(item => String(item._id) === String(expense.property))?.name || 'Property', expense._id, `${expense.category}: ${expense.description}`, expense.amount, 'owner_logged', expense.status]);
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="owner-finance-${report.start}-to-${report.end}.csv"`);
    res.send(`\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`);
  } catch (err) { fail(res, err); }
});

router.post('/bookings/:bookingId/manual-payment', async (req, res) => {
  try {
    if (!validId(req.params.bookingId)) return res.status(400).json({ msg: 'Invalid booking ID.' });
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking || !(await Property.exists({ _id: booking.property, owner: req.user.id }))) return res.status(404).json({ msg: 'Booking not found in your account.' });
    if (booking.paymentStatus !== 'pending' || booking.status === 'cancelled' || booking.razorpayOrderId) return res.status(409).json({ msg: 'Only an unpaid booking without an online order can be recorded as paid manually.' });
    const method = req.body.method;
    const reference = String(req.body.reference || '').trim();
    const amount = Number(req.body.amount);
    if (!['cash', 'bank_transfer', 'upi'].includes(method) || !Number.isSafeInteger(amount) || amount !== booking.totalPrice || reference.length > 80 || (method !== 'cash' && reference.length < 3)) {
      return res.status(400).json({ msg: 'Record the exact booking amount, payment method, and transfer reference (unless cash).' });
    }
    const now = new Date();
    const updated = await Booking.findOneAndUpdate({ _id: booking._id, property: booking.property, paymentStatus: 'pending', status: { $ne: 'cancelled' }, razorpayOrderId: { $in: [null, ''] } }, {
      $set: { paymentStatus: 'paid', status: 'confirmed', paymentSource: 'manual', paymentMode: 'manual', manualPaymentMethod: method, manualPaymentReference: reference, manualPaymentRecordedBy: req.user.id, paidAt: now },
      $push: { actionHistory: { action: 'Manual Payment Recorded', performedBy: `Property Owner (${req.user.id})`, targetUser: `Booking ${booking._id}`, reason: `${method} payment of INR ${amount} recorded by owner${reference ? `, reference ${reference}` : ''}.`, timestamp: now } }
    }, { new: true });
    if (!updated) return res.status(409).json({ msg: 'Booking payment state changed. Refresh and try again.' });
    res.json(updated);
  } catch (err) { fail(res, err); }
});

router.post('/expenses', async (req, res) => {
  try {
    const { propertyId, category, incurredOn } = req.body;
    const amount = Number(req.body.amount);
    const description = String(req.body.description || '').trim();
    if (!validId(propertyId) || !['housekeeping', 'maintenance', 'supplies', 'utilities', 'staff', 'other'].includes(category) || !validDate(incurredOn) || !Number.isSafeInteger(amount) || amount < 1 || amount > 100000000 || !description || description.length > 200) {
      return res.status(400).json({ msg: 'Enter a property, category, date, positive whole-rupee amount, and description.' });
    }
    const property = await Property.findOne({ _id: propertyId, owner: req.user.id });
    if (!property) return res.status(404).json({ msg: 'Property not found in your account.' });
    res.status(201).json(await OwnerExpense.create({ property: property._id, category, incurredOn, amount, description, createdBy: req.user.id }));
  } catch (err) { fail(res, err); }
});

router.post('/expenses/:expenseId/void', async (req, res) => {
  try {
    if (!validId(req.params.expenseId)) return res.status(400).json({ msg: 'Invalid expense ID.' });
    const reason = String(req.body.reason || '').trim();
    if (reason.length < 3 || reason.length > 200) return res.status(400).json({ msg: 'Enter a short correction reason.' });
    const expense = await OwnerExpense.findById(req.params.expenseId);
    if (!expense || !(await Property.exists({ _id: expense.property, owner: req.user.id }))) return res.status(404).json({ msg: 'Expense not found in your account.' });
    const updated = await OwnerExpense.findOneAndUpdate({ _id: expense._id, status: 'active' }, { $set: { status: 'void', voidedBy: req.user.id, voidedAt: new Date(), voidReason: reason } }, { new: true });
    if (!updated) return res.status(409).json({ msg: 'Expense has already been voided.' });
    res.json(updated);
  } catch (err) { fail(res, err); }
});

module.exports = router;
