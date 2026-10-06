// Explicit public allowlists: listing drafts and account/operations fields never
// cross the customer boundary, including future fields added to the models.
// What customers may see and book: admin-approved AND switched on for the
// website (the Villa Manager can hide an approved property). Use this filter
// everywhere a property is read for customers.
const PUBLIC_LISTING = Object.freeze({ status: 'approved', websiteVisible: { $ne: false } });
const isPublicListing = property => Boolean(property) && property.status === 'approved' && property.websiteVisible !== false;

// Blue tick: BookMyVilla-managed villas, or self-managed ones Admin has verified.
const isVerified = p => p.managementMode === 'BOOKMYVILLA_MANAGED' || p.verification?.status === 'verified';
const pick = (source, keys) => Object.fromEntries(keys.filter(key => source?.[key] !== undefined && source[key] !== '' && source[key] !== null).map(key => [key, source[key]]));

function publicProperty(property) {
  if (!property) return null;
  const p = property.toObject ? property.toObject() : property;
  const view = Object.fromEntries(['_id', 'name', 'type', 'location', 'price', 'mapLink', 'amenities', 'facilities', 'photos', 'videos', 'status', 'bookingMode'].map(key => [key, p[key]]));
  // Listing details guests may see; address, Wi-Fi and contacts stay private.
  const details = pick(p.listingData?.details, ['guestCapacity', 'bedrooms', 'bathrooms', 'floors', 'shortDescription', 'description', 'highlights']);
  if (Object.keys(details).length) view.details = details;
  if (details.description) view.description = details.description;
  // Named 'arrival' (not stayInfo): the full stayInfo also holds Wi-Fi details.
  if (p.stayInfo) view.arrival = pick(p.stayInfo, ['checkInTime', 'checkOutTime', 'houseRules']);
  if (p.managementMode !== undefined || p.verification) view.verified = isVerified(p);
  return view;
}
function customerBooking(booking) {
  const raw = booking.toObject ? booking.toObject() : booking;
  const fields = ['_id','property','room','guest','guestDetails','checkIn','checkOut','stayType','guests','adults','children','infants','pets','status','paymentStatus','stayStatus','actualCheckIn','actualCheckOut','totalPrice','securityDepositAmount','lineItems','taxAmount','discountAmount','cancellationPolicy','refundStatus','refundAmount','paymentMode','paymentSource','paidAt','paymentPlan','onlineAmount','balanceDue','balanceCollectedAt','guide','razorpayPaymentId','razorpayOrderId','source','createdAt'];
  const b = Object.fromEntries(fields.map(key => [key,raw[key]]));
  if (b.guest) b.guest = { name:b.guest.name, phone:b.guest.phone, email:b.guest.email };
  if (b.property && typeof b.property === 'object' && b.property.name) b.property = publicProperty(b.property);
  // Guest sees that a guide was requested, never which guide record was assigned.
  b.guide = raw.guide?.requested ? { requested: true, days: raw.guide.days, dailyRate: raw.guide.dailyRate, amount: raw.guide.amount, assigned: Boolean(raw.guide.assigned) } : undefined;
  delete b.actionHistory;
  delete b.operations;
  delete b.adminNotes;
  if (b.guestDetails) { b.guestDetails = { ...b.guestDetails, idUploaded: Boolean(b.guestDetails.idProof) }; delete b.guestDetails.idProof; }
  return b;
}
module.exports = { PUBLIC_LISTING, isPublicListing, publicProperty, customerBooking };
