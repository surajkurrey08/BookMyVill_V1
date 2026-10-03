const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, createOwner, createCustomer, createProperty, day } = require('./helpers');
const gateway = require('../services/paymentGateway');

test('customer room availability, hold, server pricing, verified payment and confirmation', async () => {
  await start();
  const originals = Object.fromEntries(['available', 'keyId', 'mode', 'createOrder', 'fetchPayment', 'validSignature'].map(key => [key, gateway[key]]));
  try {
    const owner = await createOwner('booking-flow-owner');
    const customer = await createCustomer('booking-flow-guest');
    const other = await createCustomer('booking-flow-other');
    const { property, room } = await createProperty(owner.user, { price: 99999 });
    const AddOn = require('../models/AddOn');
    const Promotion = require('../models/Promotion');
    const addon = await AddOn.create({ owner: owner.user.id, property: property.id, name: 'Breakfast', category: 'meal', pricingUnit: 'per_night', price: 1500, createdBy: owner.user.id });
    await Promotion.create({ owner: owner.user.id, code: 'STAY10', name: 'Stay offer', type: 'promo_code', discountType: 'percent', discountValue: 10, createdBy: owner.user.id });
    const checkIn = day(3);
    const checkOut = day(6);
    const base = '/api/customer-booking';
    const availability = await api('GET', `${base}/properties/${property.id}/rooms?checkIn=${checkIn}&checkOut=${checkOut}&guests=2`);
    assert.equal(availability.status, 200);
    assert.equal(availability.data.rooms[0].status, 'available');

    const held = await api('POST', `${base}/holds`, { token: customer.token, body: { propertyId: property.id, roomId: room.id, checkIn, checkOut, guests: 2 } });
    assert.equal(held.status, 201);
    const holdId = held.data.holdId;
    assert.equal((await api('GET', `${base}/properties/${property.id}/rooms?checkIn=${checkIn}&checkOut=${checkOut}&guests=2`)).data.rooms[0].status, 'temporary_hold');
    assert.equal((await api('POST', `${base}/holds`, { token: other.token, body: { propertyId: property.id, roomId: room.id, checkIn, checkOut, guests: 2 } })).status, 409);
    assert.equal((await api('GET', `${base}/holds/${holdId}`, { token: other.token })).status, 404);

    const selection = { addOns: [{ addOnId: addon.id, quantity: 1 }], promoCode: 'STAY10' };
    const priced = await api('POST', `${base}/holds/${holdId}/price`, { token: customer.token, body: { ...selection, totalPrice: 1 } });
    assert.equal(priced.status, 200);
    assert.equal(priced.data.total, room.baseRate * 3 + 1500 * 3 - 3600);
    assert.equal(priced.data.addOns[0].amount, 4500);
    assert.equal(priced.data.discount, 3600);
    assert.equal(priced.data.tax, 0);
    assert.equal((await api('GET', `${base}/bookings/${holdId}/confirmation`, { token: customer.token })).status, 404);

    gateway.available = () => true;
    gateway.keyId = () => 'rzp_test_customer';
    gateway.mode = () => 'test';
    gateway.createOrder = async ({ amountPaise }) => ({ id: 'order_customer123', amount: amountPaise });
    gateway.fetchPayment = async () => ({ order_id: 'order_customer123', status: 'captured', currency: 'INR', amount: priced.data.total * 100 });
    gateway.validSignature = (_, __, signature) => signature === 'valid-test-signature';
    const pay = await api('POST', `${base}/holds/${holdId}/pay`, { token: customer.token, body: { guest: { name: 'Test Guest', phone: '9811111111', email: customer.user.email, idType: 'Passport', idNumber: 'AB123456' }, ...selection, totalPrice: 1 } });
    assert.equal(pay.status, 200);
    assert.equal(pay.data.amount, priced.data.total * 100);
    assert.equal((await api('GET', `${base}/bookings/${pay.data.bookingId}/confirmation`, { token: customer.token })).status, 404);
    assert.equal((await api('POST', `${base}/holds/${holdId}/verify`, { token: customer.token, body: { razorpay_order_id: pay.data.order_id, razorpay_payment_id: 'pay_customer123', razorpay_signature: 'bad' } })).status, 400);
    const verified = await api('POST', `${base}/holds/${holdId}/verify`, { token: customer.token, body: { razorpay_order_id: pay.data.order_id, razorpay_payment_id: 'pay_customer123', razorpay_signature: 'valid-test-signature' } });
    assert.equal(verified.status, 200);
    const confirmed = await api('GET', `${base}/bookings/${pay.data.bookingId}/confirmation`, { token: customer.token });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.data.booking.status, 'confirmed');
    assert.equal(String(confirmed.data.booking.room._id), String(room.id));
    assert.equal(confirmed.data.booking.totalPrice, priced.data.total);
    assert.equal(confirmed.data.booking.guestDetails.idLastFour, '3456');
    assert.equal((await api('GET', `${base}/properties/${property.id}/rooms?checkIn=${checkIn}&checkOut=${checkOut}&guests=2`)).data.rooms[0].status, 'booked');
    const precheckin = await api('POST', `${base}/bookings/${pay.data.bookingId}/precheckin`, { token: customer.token, body: { arrivalTime: '17:30', additionalGuests: ['Second Guest'] } });
    assert.equal(precheckin.status, 200);
    assert.equal(precheckin.data.guestDetails.arrivalTime, '17:30');
  } finally {
    Object.assign(gateway, originals);
    await stop();
  }
});
