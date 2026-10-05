// Explicit public allowlists: listing drafts and account/operations fields never
// cross the customer boundary, including future fields added to the models.
function publicProperty(property) {
  if (!property) return null;
  const p = property.toObject ? property.toObject() : property;
  return Object.fromEntries(['_id', 'name', 'type', 'location', 'price', 'mapLink', 'amenities', 'facilities', 'photos', 'videos', 'status'].map(key => [key, p[key]]));
}
function customerBooking(booking) {
  const raw = booking.toObject ? booking.toObject() : booking;
  const fields = ['_id','property','room','guest','guestDetails','checkIn','checkOut','stayType','guests','adults','children','infants','pets','status','paymentStatus','stayStatus','actualCheckIn','actualCheckOut','totalPrice','securityDepositAmount','lineItems','taxAmount','discountAmount','cancellationPolicy','refundStatus','refundAmount','paymentMode','paymentSource','paidAt','razorpayPaymentId','razorpayOrderId','source','createdAt'];
  const b = Object.fromEntries(fields.map(key => [key,raw[key]]));
  if (b.guest) b.guest = { name:b.guest.name, phone:b.guest.phone, email:b.guest.email };
  if (b.property && typeof b.property === 'object' && b.property.name) b.property = publicProperty(b.property);
  delete b.actionHistory;
  delete b.operations;
  delete b.adminNotes;
  if (b.guestDetails) { b.guestDetails = { ...b.guestDetails, idUploaded: Boolean(b.guestDetails.idProof) }; delete b.guestDetails.idProof; }
  return b;
}
module.exports = { publicProperty, customerBooking };
