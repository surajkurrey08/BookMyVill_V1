const express = require('express');
const mongoose = require('mongoose');
const { adminConsoleAuth, requirePermission } = require('../middleware/adminConsoleAuth');
const User = require('../models/User');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const PartnerApplication = require('../models/PartnerApplication');
const PartnerInquiry = require('../models/PartnerInquiry');
const { seriousIssue, operationQueue } = require('../services/operationQueue');
const GuestRequest = require('../models/GuestRequest');
const AdminAudit = require('../models/AdminAudit');
const { effectivePermissions, PERMISSIONS, ROLE_PERMISSIONS, ROLE_LABELS } = require('../services/adminRbac');
const { reviewProperty, setAccountStatus, setAdminRole, setPropertyManagement, recordAudit, propertyImpact } = require('../services/adminActions');
const { managementFilters, managementMode, MANAGEMENT_SELECT } = require('../services/propertyAccess');
const { validId, validEmail, validPhone, escapeRegex, cleanText, pagination, addDays, daysBetween, indiaDate, indiaDayStart, DAY_MS, HttpError, sendError } = require('../utils/validate');

const router = express.Router();
router.use(adminConsoleAuth);
const fail = (res, err) => sendError(res, err, 'Admin console');
const oid = id => new mongoose.Types.ObjectId(id);
const PAID = { paymentStatus: 'paid', paymentMode: { $in: ['live', 'manual'] } };
const ESTIMATED_COMMISSION = 0.15;
const populateManagement = query => query
  .populate('assignedVillaManager', 'name email phone role status')
  .populate('assignedDataEntryUser', 'name email phone role status');

router.get('/property-management-staff', requirePermission('properties.manage'), async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ['villa_manager', 'data_entry'] }, status: { $in: ['active', 'approved'] } })
      .select('_id name email phone role').sort({ name: 1 }).lean();
    res.json({ villaManagers: users.filter(user => user.role === 'villa_manager'), dataEntryUsers: users.filter(user => user.role === 'data_entry') });
  } catch (err) { fail(res, err); }
});

router.get('/staff-accounts', requirePermission('team.manage'), async (req, res) => {
  try { res.json(await User.find({ role: { $in: ['data_entry', 'villa_manager'] } }).select('_id name email phone role status createdAt').sort({ createdAt: -1 }).lean()); }
  catch (err) { fail(res, err); }
});
router.post('/staff-accounts', requirePermission('team.manage'), async (req, res) => {
  try {
    const body = req.body || {};
    const name = cleanText(body.name, 100), email = cleanText(body.email, 120)?.toLowerCase();
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['data_entry', 'villa_manager'].includes(body.role) ||
        typeof body.password !== 'string' || body.password.length < 10 || Buffer.byteLength(body.password) > 72) throw new HttpError(400, 'Enter name, valid work email, staff role and a password of 10–72 bytes.');
    if (await User.exists({ email }) || await PartnerApplication.exists({ email })) throw new HttpError(409, 'This email is already in use.');
    const staff = await User.create({ name, email, password: body.password, phone: cleanText(body.phone || '', 20) || '', role: body.role, status: 'active' });
    await recordAudit(req.admin, { action: 'team.staff_created', entityType: 'staff', entityId: staff._id, entityLabel: name, after: { role: staff.role, email, status: 'active' }, ip: req.ip });
    res.status(201).json({ _id: staff._id, name, email, role: staff.role, status: staff.status });
  } catch (err) { if (err.code === 11000) return res.status(409).json({ msg: 'This email is already in use.' }); fail(res, err); }
});
router.patch('/staff-accounts/:id', requirePermission('team.manage'), async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(404, 'Staff account not found.');
    const staff = await User.findOne({ _id: req.params.id, role: { $in: ['data_entry', 'villa_manager'] } });
    if (!staff) throw new HttpError(404, 'Staff account not found.');
    const before = { status: staff.status };
    if (!['active', 'suspended'].includes(req.body.status)) throw new HttpError(400, 'Choose active or suspended.');
    staff.status = req.body.status; await staff.save();
    await recordAudit(req.admin, { action: 'team.staff_status', entityType: 'staff', entityId: staff._id, entityLabel: staff.name, before, after: { status: staff.status }, ip: req.ip });
    res.json({ _id: staff._id, status: staff.status });
  } catch (err) { fail(res, err); }
});

router.get('/unassigned-operations', requirePermission('properties.manage'), async (req,res) => {
 try { const properties = await Property.find({ managementMode: 'BOOKMYVILLA_MANAGED', assignedVillaManager: null }).select('_id name'); res.json({ properties, ...await operationQueue(properties.map(p => p._id)) }); } catch(err) { fail(res,err); }
});
router.get('/operations-issues', requirePermission('bookings.view'), async (req,res) => {
 try { res.json(await GuestRequest.find({ ...seriousIssue, status: { $in: GuestRequest.OPEN_STATUSES } }).select('code property booking kind category description status escalated').populate('property','name').limit(100).lean()); } catch(err) { fail(res,err); }
});
router.get('/properties/:id/availability', requirePermission('properties.view'), async (req,res) => {
 try { if (!validId(req.params.id) || !await Property.exists({ _id: req.params.id })) throw new HttpError(404,'Property not found.'); const dates = require('../utils/validate').stayNights(req.query.start,req.query.end,366); if (!dates) throw new HttpError(400,'Choose a valid date range.'); res.json(await require('../services/availability').calendar(req.params.id,dates)); } catch(err) { fail(res,err); }
});

router.get('/partner-requests', requirePermission('owners.view'), async (req, res) => {
  try {
    const [applications, inquiries] = await Promise.all([
      PartnerApplication.find({ partnerType: { $in: ['Property Owner', 'Villa Host'] } }).sort({ appliedAt: -1 }).lean(),
      PartnerInquiry.find().sort({ createdAt: -1 }).lean(),
    ]);
    res.json({ applications, inquiries });
  } catch (err) { fail(res, err); }
});

router.patch('/partner-inquiries/:id', requirePermission('owners.manage'), async (req, res) => {
  try {
    if (!validId(req.params.id) || !['new', 'contacted', 'closed'].includes(req.body.status)) throw new HttpError(400, 'Choose a valid inquiry status.');
    const inquiry = await PartnerInquiry.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
    if (!inquiry) throw new HttpError(404, 'Inquiry not found.');
    res.json(inquiry);
  } catch (err) { fail(res, err); }
});

router.get('/me', (req, res) => {
  res.json({
    id: req.admin._id, name: req.admin.name, email: req.admin.email,
    adminRole: req.admin.adminRole || 'super_admin',
    permissions: req.adminPermissions, roleLabel: ROLE_LABELS[req.admin.adminRole || 'super_admin']
  });
});

// ----------------------------------------------------------------- overview
router.get('/overview', requirePermission('dashboard.view'), async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const now = new Date();
    const windowStart = new Date(+now - days * DAY_MS);
    const prevStart = new Date(+now - 2 * days * DAY_MS);
    const soon = new Date(+now + 7 * DAY_MS);

    const gmvAgg = async (from, to) => {
      const rows = await Booking.aggregate([{ $match: { ...PAID, paidAt: { $gte: from, $lt: to } } }, { $group: { _id: null, gmv: { $sum: '$totalPrice' }, count: { $sum: 1 } } }]);
      return rows[0] || { gmv: 0, count: 0 };
    };

    const [
      windowGmv, prevGmv, bookingsInWindow, prevBookings,
      activeProperties, pendingReviews, suspendedProperties,
      activeOwners, totalCustomers, pendingApplications,
      activeStays, confirmedUpcoming,
      pendingPayAgg, refundAgg, openIssues, safetyIssues, openRequests, newPartnerInquiries, managementRows
    ] = await Promise.all([
      gmvAgg(windowStart, now), gmvAgg(prevStart, windowStart),
      Booking.countDocuments({ createdAt: { $gte: windowStart, $lt: now } }),
      Booking.countDocuments({ createdAt: { $gte: prevStart, $lt: windowStart } }),
      Property.countDocuments({ status: 'approved' }),
      Property.countDocuments({ status: { $in: ['pending', 'under_review'] } }),
      Property.countDocuments({ status: 'suspended' }),
      User.countDocuments({ role: 'owner', status: { $in: ['active', 'approved'] } }),
      User.countDocuments({ role: 'user' }),
      PartnerApplication.countDocuments({ status: 'pending' }),
      Booking.countDocuments({ status: 'confirmed', stayStatus: 'in_house' }),
      Booking.countDocuments({ status: 'confirmed', checkIn: { $gte: now } }),
      Booking.aggregate([{ $match: { paymentStatus: 'pending', status: { $ne: 'cancelled' } } }, { $group: { _id: null, count: { $sum: 1 }, value: { $sum: '$totalPrice' } } }]),
      Booking.aggregate([{ $match: { status: 'cancelled', ...PAID, refundStatus: { $ne: 'processed' } } }, { $group: { _id: null, count: { $sum: 1 }, value: { $sum: '$totalPrice' } } }]),
      GuestRequest.countDocuments({ ...seriousIssue, status: { $in: GuestRequest.OPEN_STATUSES } }),
      GuestRequest.countDocuments({ kind: 'issue', category: 'safety', status: { $in: GuestRequest.OPEN_STATUSES } }),
      GuestRequest.countDocuments({ kind: 'request', status: { $in: GuestRequest.OPEN_STATUSES } }),
      PartnerInquiry.countDocuments({ status: 'new' }),
      Property.aggregate([{ $group: {
        _id: { $ifNull: ['$managementMode', 'SELF_MANAGED'] }, count: { $sum: 1 },
        unassigned: { $sum: { $cond: [{ $eq: [{ $ifNull: ['$assignedVillaManager', null] }, null] }, 1, 0] } }
      } }])
    ]);

    const pendingPay = pendingPayAgg[0] || { count: 0, value: 0 };
    const refunds = refundAgg[0] || { count: 0, value: 0 };
    const pct = (cur, prev) => (prev > 0 ? Math.round((cur - prev) / prev * 1000) / 10 : (cur > 0 ? 100 : 0));

    const attention = [];
    if (safetyIssues > 0) attention.push({ severity: 'critical', title: `${safetyIssues} open safety issue${safetyIssues === 1 ? '' : 's'} reported by guests`, detail: 'Guest-reported safety concerns need immediate review.', link: { type: 'issues' } });
    if (refunds.count > 0) attention.push({ severity: 'critical', title: `₹${refunds.value.toLocaleString('en-IN')} across ${refunds.count} cancelled paid booking${refunds.count === 1 ? '' : 's'} need refund review`, detail: 'These bookings were cancelled after payment and have not been marked refunded.', link: { type: 'refund_review' } });
    if (pendingReviews > 0) attention.push({ severity: 'high', title: `${pendingReviews} propert${pendingReviews === 1 ? 'y' : 'ies'} awaiting review`, detail: 'New or edited listings cannot go live until approved.', link: { type: 'property_review' } });
    if (pendingApplications > 0) attention.push({ severity: 'high', title: `${pendingApplications} owner application${pendingApplications === 1 ? '' : 's'} pending`, detail: 'Partner applications waiting for onboarding review.', link: { type: 'applications' } });
    if (newPartnerInquiries > 0) attention.push({ severity: 'medium', title: `${newPartnerInquiries} new partnership inquir${newPartnerInquiries === 1 ? 'y' : 'ies'}`, detail: 'Owners have questions about joining BookMyVilla.', link: { type: 'partner_inquiries' } });
    const unassigned = managementRows.find(row => row._id === 'BOOKMYVILLA_MANAGED')?.unassigned || 0;
    if (unassigned) attention.push({ severity: 'high', title: `${unassigned} managed properties need a Villa Manager`, detail: 'Open operational work is retained in the unassigned operations queue.', link: { type: 'unassigned_operations' } });
    if (openIssues > safetyIssues) attention.push({ severity: 'high', title: `${openIssues} open guest issue${openIssues === 1 ? '' : 's'}`, detail: 'Guests have reported problems that are not yet resolved.', link: { type: 'issues' } });
    if (pendingPay.count > 0) attention.push({ severity: 'medium', title: `₹${pendingPay.value.toLocaleString('en-IN')} across ${pendingPay.count} unpaid booking${pendingPay.count === 1 ? '' : 's'}`, detail: 'Bookings awaiting payment.', link: { type: 'unpaid' } });

    res.json({
      period: { days, from: windowStart, to: now },
      kpis: {
        gmv: { value: windowGmv.gmv, changePct: pct(windowGmv.gmv, prevGmv.gmv), note: 'Captured live & owner-recorded payments' },
        estimatedPlatformRevenue: { value: Math.round(windowGmv.gmv * ESTIMATED_COMMISSION), rate: ESTIMATED_COMMISSION, estimate: true, note: `Estimated at ${ESTIMATED_COMMISSION * 100}% — commission is not yet configured` },
        bookings: { value: bookingsInWindow, changePct: pct(bookingsInWindow, prevBookings) },
        paidBookings: { value: windowGmv.count, changePct: pct(windowGmv.count, prevGmv.count) },
        activeStays: { value: activeStays },
        confirmedUpcoming: { value: confirmedUpcoming },
        activeProperties: { value: activeProperties },
        activeOwners: { value: activeOwners },
        totalCustomers: { value: totalCustomers },
        pendingPropertyReviews: { value: pendingReviews },
        selfManagedProperties: { value: managementRows.find(row => row._id === 'SELF_MANAGED')?.count || 0 },
        companyManagedProperties: { value: managementRows.find(row => row._id === 'BOOKMYVILLA_MANAGED')?.count || 0 },
        unassignedManagedProperties: { value: managementRows.find(row => row._id === 'BOOKMYVILLA_MANAGED')?.unassigned || 0 },
        pendingApplications: { value: pendingApplications },
        suspendedProperties: { value: suspendedProperties },
        pendingPayments: { value: pendingPay.count, amount: pendingPay.value },
        refundReviews: { value: refunds.count, amount: refunds.value },
        openIssues: { value: openIssues },
        openRequests: { value: openRequests }
      },
      attention
    });
  } catch (err) { fail(res, err); }
});

// ------------------------------------------------------------------- owners
async function ownerAggregates(ownerIds) {
  if (!ownerIds.length) return new Map();
  const props = await Property.aggregate([{ $match: { owner: { $in: ownerIds } } }, { $group: { _id: '$owner', total: { $sum: 1 }, approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } }, ids: { $push: '$_id' } } }]);
  const propToOwner = new Map();
  const map = new Map();
  for (const row of props) {
    map.set(String(row._id), { properties: row.total, approvedProperties: row.approved, bookings: 0, gmv: 0 });
    for (const pid of row.ids) propToOwner.set(String(pid), String(row._id));
  }
  const allPropIds = [...propToOwner.keys()].map(oid);
  if (allPropIds.length) {
    const bookRows = await Booking.aggregate([
      { $match: { property: { $in: allPropIds } } },
      { $group: { _id: '$property', count: { $sum: 1 }, gmv: { $sum: { $cond: [{ $and: [{ $eq: ['$paymentStatus', 'paid'] }, { $in: ['$paymentMode', ['live', 'manual']] }] }, '$totalPrice', 0] } } } }
    ]);
    for (const row of bookRows) {
      const ownerKey = propToOwner.get(String(row._id));
      const entry = map.get(ownerKey);
      if (entry) { entry.bookings += row.count; entry.gmv += row.gmv; }
    }
  }
  return map;
}

router.post('/owners', requirePermission('owners.manage'), async (req, res) => {
  try {
    const body = req.body || {};
    const name = cleanText(body.name, 100), email = cleanText(body.email, 120)?.toLowerCase();
    const phone = cleanText(body.phone, 20);
    if (typeof body.name !== 'string' || !name || name.length < 2 || typeof body.email !== 'string' || !validEmail(email) ||
        phone === null || (phone && !validPhone(phone)) || typeof body.password !== 'string' ||
        body.password.length < 10 || Buffer.byteLength(body.password) > 72) {
      throw new HttpError(400, 'Enter a name, valid email, optional phone number and a password of at least 10 characters (maximum 72 bytes).');
    }
    const existingEmail = new RegExp(`^${escapeRegex(email)}$`, 'i');
    if (await User.exists({ email: existingEmail }) || await PartnerApplication.exists({ email: existingEmail })) {
      throw new HttpError(409, 'This email is already in use. Use the existing owner or review their Owner Request.');
    }
    const owner = await User.create({ name, email, phone, password: body.password, role: 'owner', status: 'active', ownerPasswordSetAt: new Date() });
    await recordAudit(req.admin, { action: 'owner.created', entityType: 'owner', entityId: owner._id, entityLabel: name,
      after: { name, email, phone, role: 'owner', status: 'active' }, ip: req.ip });
    res.status(201).json({ _id: owner._id, name, email, phone, role: owner.role, status: owner.status, createdAt: owner.createdAt });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ msg: 'This email is already in use.' });
    fail(res, err);
  }
});

router.get('/owners', requirePermission('owners.view'), async (req, res) => {
  try {
    const filter = { role: 'owner' };
    if (req.query.status && ['active', 'approved', 'suspended', 'restricted', 'pending', 'rejected'].includes(req.query.status)) filter.status = req.query.status;
    const q = cleanText(req.query.q, 80);
    if (q) { const p = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ name: p }, { email: p }, { phone: p }]; }
    const { page, limit, skip } = pagination(req.query);
    const [owners, total] = await Promise.all([
      User.find(filter).select('name email phone status adminRole createdAt').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter)
    ]);
    const aggregates = await ownerAggregates(owners.map(o => o._id));
    const apps = await PartnerApplication.find({ email: { $in: owners.map(o => (o.email || '').toLowerCase()).filter(Boolean) } }).select('email status').lean();
    const kycByEmail = new Map(apps.map(a => [(a.email || '').toLowerCase(), a.status]));
    res.json({
      items: owners.map(owner => ({ ...owner, ...(aggregates.get(String(owner._id)) || { properties: 0, approvedProperties: 0, bookings: 0, gmv: 0 }), kyc: kycByEmail.get((owner.email || '').toLowerCase()) || 'not_submitted' })),
      total, page, pages: Math.max(1, Math.ceil(total / limit))
    });
  } catch (err) { fail(res, err); }
});

router.get('/owners/:id', requirePermission('owners.view'), async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(400, 'Invalid owner ID.');
    const owner = await User.findOne({ _id: req.params.id, role: 'owner' }).select('-password').lean();
    if (!owner) throw new HttpError(404, 'Owner not found.');
    const properties = await Property.find({ owner: owner._id }).select(`name type location status price createdAt managementMode ${MANAGEMENT_SELECT}`).sort({ createdAt: -1 }).lean();
    const propIds = properties.map(p => p._id);
    const [bookingAgg, recentBookings, application, audit] = await Promise.all([
      propIds.length ? Booking.aggregate([{ $match: { property: { $in: propIds } } }, { $group: { _id: null, total: { $sum: 1 }, gmv: { $sum: { $cond: [{ $and: [{ $eq: ['$paymentStatus', 'paid'] }, { $in: ['$paymentMode', ['live', 'manual']] }] }, '$totalPrice', 0] } }, cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } } } }]) : [],
      propIds.length ? Booking.find({ property: { $in: propIds } }).populate('property', 'name').populate('user', 'name').sort({ createdAt: -1 }).limit(10).lean() : [],
      owner.email ? PartnerApplication.findOne({ email: owner.email.toLowerCase() }).select('status partnerType appliedAt govtId').lean() : null,
      AdminAudit.find({ entityType: 'owner', entityId: owner._id }).sort({ createdAt: -1 }).limit(20).lean()
    ]);
    const stats = bookingAgg[0] || { total: 0, gmv: 0, cancelled: 0 };
    res.json({ owner, properties, stats: { ...stats, estimatedPayable: Math.round(stats.gmv * (1 - ESTIMATED_COMMISSION)) }, recentBookings, application, audit });
  } catch (err) { fail(res, err); }
});

router.post('/owners/:id/status', requirePermission('owners.manage'), async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(400, 'Invalid owner ID.');
    const updated = await setAccountStatus(req.admin, req.params.id, req.body.action, req.body.reason, { ip: req.ip });
    res.json(updated);
  } catch (err) { fail(res, err); }
});

// --------------------------------------------------------------- properties
router.get('/properties', requirePermission('properties.view'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.view === 'review') filter.status = { $in: ['pending', 'under_review'] };
    else if (req.query.status && ['pending', 'under_review', 'approved', 'rejected', 'suspended'].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.ownerId) { if (!validId(req.query.ownerId)) throw new HttpError(400, 'Invalid owner filter.'); filter.owner = req.query.ownerId; }
    const q = cleanText(req.query.q, 80);
    if (q) { const p = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ name: p }, { location: p }]; }
    filter.$and = [managementFilters(req.query)];
    const { page, limit, skip } = pagination(req.query);
    const [items, total, statusRows] = await Promise.all([
      populateManagement(Property.find(filter).select(`name type location status price photos owner createdAt managementMode ${MANAGEMENT_SELECT}`).populate('owner', 'name email')).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Property.countDocuments(filter),
      Property.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    ]);
    res.json({
      items: items.map(p => ({ ...p, managementMode: managementMode(p), assignedVillaManager: p.assignedVillaManager || null, assignedDataEntryUser: p.assignedDataEntryUser || null, photoCount: p.photos?.length || 0, cover: p.photos?.[0] && /^https?:/.test(p.photos[0]) ? p.photos[0] : null, photos: undefined })),
      total, page, pages: Math.max(1, Math.ceil(total / limit)),
      statusCounts: Object.fromEntries(statusRows.map(r => [r._id, r.count]))
    });
  } catch (err) { fail(res, err); }
});

router.get('/properties/:id', requirePermission('properties.view'), async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(400, 'Invalid property ID.');
    const property = await populateManagement(Property.findById(req.params.id).select(MANAGEMENT_SELECT).populate('owner', 'name email phone status')).lean();
    if (!property) throw new HttpError(404, 'Property not found.');
    property.managementMode = managementMode(property);
    property.assignedVillaManager ||= null;
    property.assignedDataEntryUser ||= null;
    const [impact, audit, bookingCount] = await Promise.all([
      propertyImpact(property._id),
      AdminAudit.find({ entityType: 'property', entityId: property._id }).sort({ createdAt: -1 }).limit(20).lean(),
      Booking.countDocuments({ property: property._id })
    ]);
    // Data-quality checks surfaced to the reviewer.
    const checks = {
      hasCover: Boolean(property.photos?.length), hasLocation: Boolean(property.location), hasMap: Boolean(property.mapLink),
      hasAmenities: (property.amenities?.length || 0) > 0, hasOwner: Boolean(property.owner), validPrice: Number(property.price) > 0
    };
    const operations = (req.adminPermissions.includes('*') || req.adminPermissions.includes('bookings.view')) && property.managementMode === 'BOOKMYVILLA_MANAGED' && !property.assignedVillaManager ? await operationQueue([property._id]) : null;
    res.json({ property, impact, audit, bookingCount, checks, operations });
  } catch (err) { fail(res, err); }
});

router.post('/properties/:id/review', async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(400, 'Invalid property ID.');
    const action = req.body.action;
    const needed = action === 'suspend' || action === 'unsuspend' ? 'properties.suspend' : 'properties.approve';
    if (!(req.adminPermissions.includes('*') || req.adminPermissions.includes(needed))) {
      return res.status(403).json({ msg: `Your admin role cannot ${String(action).replace('_', ' ')} properties.` });
    }
    const result = await reviewProperty(req.admin, req.params.id, action, req.body.reason, { ip: req.ip });
    res.json(result);
  } catch (err) { fail(res, err); }
});

router.patch('/properties/:id/management', requirePermission('properties.manage'), async (req, res) => {
  try {
    res.json(await setPropertyManagement(req.admin, req.params.id, req.body, { ip: req.ip }));
  } catch (err) { fail(res, err); }
});

// ----------------------------------------------------------------- bookings
async function ownerPropertyIds(ownerId) {
  return Property.find({ owner: ownerId }).distinct('_id');
}

router.get('/bookings', requirePermission('bookings.view'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.status && ['pending', 'confirmed', 'cancelled'].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.paymentStatus && ['pending', 'paid', 'failed'].includes(req.query.paymentStatus)) filter.paymentStatus = req.query.paymentStatus;
    if (req.query.stayStatus && ['expected', 'in_house', 'checked_out'].includes(req.query.stayStatus)) filter.stayStatus = req.query.stayStatus;
    if (req.query.propertyId) { if (!validId(req.query.propertyId)) throw new HttpError(400, 'Invalid property filter.'); filter.property = req.query.propertyId; }
    if (req.query.ownerId) { if (!validId(req.query.ownerId)) throw new HttpError(400, 'Invalid owner filter.'); filter.property = { $in: await ownerPropertyIds(req.query.ownerId) }; }
    if (req.query.view === 'refund_review') Object.assign(filter, { status: 'cancelled', paymentStatus: 'paid', paymentMode: { $in: ['live', 'manual'] }, refundStatus: { $ne: 'processed' } });
    if (req.query.view === 'unpaid') Object.assign(filter, { paymentStatus: 'pending', status: { $ne: 'cancelled' } });
    const q = cleanText(req.query.q, 80);
    if (q) {
      const or = [{ 'guest.name': new RegExp(escapeRegex(q), 'i') }, { razorpayPaymentId: q }];
      if (validId(q)) or.push({ _id: q });
      const digits = q.replace(/\D/g, '');
      if (digits.length >= 4) or.push({ 'guest.phoneKey': { $regex: escapeRegex(digits) } });
      filter.$or = or;
    }
    const { page, limit, skip } = pagination(req.query);
    const [items, total] = await Promise.all([
      Booking.find(filter).populate('user', 'name email').populate('property', 'name location').populate('room', 'name number').sort({ createdAt: -1 }).skip(skip).limit(limit)
        .select('user guest property room checkIn checkOut status paymentStatus stayStatus totalPrice source createdAt refundStatus').lean(),
      Booking.countDocuments(filter)
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) { fail(res, err); }
});

router.get('/bookings/:id', requirePermission('bookings.view'), async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(400, 'Invalid booking ID.');
    const booking = await Booking.findById(req.params.id)
      .populate('user', 'name email phone status').populate('room', 'name number type')
      .populate({ path: 'property', select: 'name location owner', populate: { path: 'owner', select: 'name email phone' } }).lean();
    if (!booking) throw new HttpError(404, 'Booking not found.');
    const [requests, audit] = await Promise.all([
      GuestRequest.find({ booking: booking._id }).select('code kind category status createdAt').sort({ createdAt: -1 }).lean(),
      AdminAudit.find({ entityType: 'booking', entityId: booking._id }).sort({ createdAt: -1 }).limit(20).lean()
    ]);
    res.json({ booking, requests, audit });
  } catch (err) { fail(res, err); }
});

router.post('/bookings/:id/note', requirePermission('bookings.note'), async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(400, 'Invalid booking ID.');
    const note = cleanText(req.body.note, 500);
    if (!note) throw new HttpError(400, 'Write a note (kept in the admin audit trail).');
    const booking = await Booking.findById(req.params.id).select('_id guest user');
    if (!booking) throw new HttpError(404, 'Booking not found.');
    const entry = await recordAudit(req.admin, { action: 'booking.note', entityType: 'booking', entityId: booking._id, entityLabel: booking.guest?.name || String(booking._id), reason: note, ip: req.ip });
    res.status(201).json(entry);
  } catch (err) { fail(res, err); }
});

// ----------------------------------------------------------------- customers
router.get('/customers', requirePermission('customers.view'), async (req, res) => {
  try {
    const filter = { role: 'user' };
    if (req.query.status && ['active', 'suspended', 'restricted'].includes(req.query.status)) filter.status = req.query.status;
    const q = cleanText(req.query.q, 80);
    if (q) { const p = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ name: p }, { email: p }, { phone: p }]; }
    const { page, limit, skip } = pagination(req.query);
    const [customers, total] = await Promise.all([
      User.find(filter).select('name email phone status createdAt').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter)
    ]);
    const ids = customers.map(c => c._id);
    const bookingRows = ids.length ? await Booking.aggregate([
      { $match: { user: { $in: ids } } },
      { $group: { _id: '$user', bookings: { $sum: 1 }, spend: { $sum: { $cond: [{ $and: [{ $eq: ['$paymentStatus', 'paid'] }, { $in: ['$paymentMode', ['live', 'manual']] }] }, '$totalPrice', 0] } }, cancellations: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } } } }
    ]) : [];
    const byId = new Map(bookingRows.map(r => [String(r._id), r]));
    res.json({
      items: customers.map(c => ({ ...c, bookings: byId.get(String(c._id))?.bookings || 0, spend: byId.get(String(c._id))?.spend || 0, cancellations: byId.get(String(c._id))?.cancellations || 0 })),
      total, page, pages: Math.max(1, Math.ceil(total / limit))
    });
  } catch (err) { fail(res, err); }
});

router.get('/customers/:id', requirePermission('customers.view'), async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(400, 'Invalid customer ID.');
    const customer = await User.findOne({ _id: req.params.id, role: 'user' }).select('-password').lean();
    if (!customer) throw new HttpError(404, 'Customer not found.');
    const [bookings, audit] = await Promise.all([
      Booking.find({ user: customer._id }).populate('property', 'name location').sort({ createdAt: -1 }).limit(20).select('property checkIn checkOut status paymentStatus totalPrice createdAt').lean(),
      AdminAudit.find({ entityType: 'customer', entityId: customer._id }).sort({ createdAt: -1 }).limit(20).lean()
    ]);
    res.json({ customer, bookings, audit });
  } catch (err) { fail(res, err); }
});

router.post('/customers/:id/status', requirePermission('customers.manage'), async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(400, 'Invalid customer ID.');
    const updated = await setAccountStatus(req.admin, req.params.id, req.body.action, req.body.reason, { ip: req.ip });
    res.json(updated);
  } catch (err) { fail(res, err); }
});

// --------------------------------------------------------------------- audit
router.get('/audit', requirePermission('audit.view'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.entityType) filter.entityType = req.query.entityType;
    if (req.query.entityId && validId(req.query.entityId)) filter.entityId = req.query.entityId;
    if (req.query.actorId && validId(req.query.actorId)) filter.actor = req.query.actorId;
    if (req.query.action) filter.action = new RegExp(`^${escapeRegex(String(req.query.action))}`);
    const { page, limit, skip } = pagination(req.query, 30);
    const [items, total] = await Promise.all([
      AdminAudit.find(filter).populate('actor', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AdminAudit.countDocuments(filter)
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) { fail(res, err); }
});

// ----------------------------------------------------------------- admin team
router.get('/team', requirePermission('team.manage'), async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('name email adminRole adminPermissions status createdAt').sort({ createdAt: 1 }).lean();
    res.json({
      items: admins.map(a => ({ ...a, effectiveRole: a.adminRole || 'super_admin', permissions: effectivePermissions({ ...a, role: 'admin' }) })),
      roles: Object.keys(ROLE_PERMISSIONS).map(role => ({ role, label: ROLE_LABELS[role], permissions: ROLE_PERMISSIONS[role] })),
      permissions: PERMISSIONS
    });
  } catch (err) { fail(res, err); }
});

router.post('/team/:id/role', requirePermission('team.manage'), async (req, res) => {
  try {
    if (!validId(req.params.id)) throw new HttpError(400, 'Invalid admin ID.');
    const adminRole = req.body.adminRole === null || req.body.adminRole === 'super_admin' ? 'super_admin' : req.body.adminRole;
    const updated = await setAdminRole(req.admin, req.params.id, adminRole, req.body.permissions, { ip: req.ip });
    res.json({ ...updated.toObject(), effectiveRole: updated.adminRole || 'super_admin', permissions: effectivePermissions({ ...updated.toObject(), role: 'admin' }) });
  } catch (err) { fail(res, err); }
});

// ----------------------------------------------- lightweight global search
router.get('/search', requirePermission('dashboard.view'), async (req, res) => {
  try {
    const q = cleanText(req.query.q, 80);
    if (!q || q.length < 2) return res.json({ results: [] });
    const p = new RegExp(escapeRegex(q), 'i');
    const canOwners = req.adminPermissions.includes('*') || req.adminPermissions.includes('owners.view');
    const canProps = req.adminPermissions.includes('*') || req.adminPermissions.includes('properties.view');
    const canBookings = req.adminPermissions.includes('*') || req.adminPermissions.includes('bookings.view');
    const canCustomers = req.adminPermissions.includes('*') || req.adminPermissions.includes('customers.view');
    const [owners, props, bookings, customers] = await Promise.all([
      canOwners ? User.find({ role: 'owner', $or: [{ name: p }, { email: p }, { phone: p }] }).select('name email').limit(5).lean() : [],
      canProps ? Property.find({ $or: [{ name: p }, { location: p }] }).select('name location status').limit(5).lean() : [],
      canBookings ? Booking.find(validId(q) ? { _id: q } : { 'guest.name': p }).select('guest user totalPrice status').populate('user', 'name').limit(5).lean() : [],
      canCustomers ? User.find({ role: 'user', $or: [{ name: p }, { email: p }, { phone: p }] }).select('name email').limit(5).lean() : []
    ]);
    res.json({ results: [
      ...owners.map(o => ({ type: 'owner', id: o._id, title: o.name, subtitle: o.email })),
      ...props.map(o => ({ type: 'property', id: o._id, title: o.name, subtitle: `${o.location} · ${o.status}` })),
      ...bookings.map(b => ({ type: 'booking', id: b._id, title: b.guest?.name || b.user?.name || 'Guest', subtitle: `₹${(b.totalPrice || 0).toLocaleString('en-IN')} · ${b.status}` })),
      ...customers.map(o => ({ type: 'customer', id: o._id, title: o.name, subtitle: o.email }))
    ] });
  } catch (err) { fail(res, err); }
});

module.exports = router;
