const provider = require('../providers/razorpay');
const repo = require('../repositories/paymentRepository');
const config = require('../config');
const { publish, events } = require('../../../../messaging');
const { internalRequest } = require('../../../../shared/internal');
const { HttpError } = require('../../../../utils/validate');

// Payment business rules. payment-service never writes booking data: it
// records the payment and publishes payment.success; booking-service confirms.

function providerConfig() {
  return { available: provider.available(), keyId: provider.available() ? provider.keyId() : '', mode: provider.mode(), currency: 'INR' };
}

async function createOrder({ purpose, amount, receipt, bookingId, holdId, quoteId, userId, notes }) {
  if (!provider.available()) throw new HttpError(503, 'Online payment is not configured. No booking has been confirmed.');
  if (!['booking', 'quote'].includes(purpose) || !Number.isSafeInteger(amount) || amount <= 0) throw new HttpError(400, 'Invalid payment order.');
  const order = await provider.createOrder({ amountPaise: amount * 100, receipt: String(receipt || '').slice(0, 40), notes: notes || {} });
  await repo.create({ orderId: order.id, purpose, amountPaise: order.amount ?? amount * 100, bookingId: bookingId ? String(bookingId) : null, holdId: holdId ? String(holdId) : null, quoteId: quoteId ? String(quoteId) : null, userId: userId ? String(userId) : null, mode: provider.mode() });
  return { order_id: order.id, amount: order.amount ?? amount * 100, currency: 'INR', key_id: provider.keyId() };
}

// Signature + provider confirmation of a captured payment for this order.
async function confirmWithProvider(payment, { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = {}) {
  if (orderId !== payment.orderId || typeof paymentId !== 'string' || !/^pay_[A-Za-z0-9]+$/.test(paymentId) || !provider.validSignature(orderId, paymentId, signature)) throw new HttpError(400, 'Payment details could not be verified.');
  if (payment.status === 'captured') {
    if (payment.paymentId === paymentId) return paymentId; // retry of an already recorded payment
    throw new HttpError(409, 'Payment is already recorded. Contact support for room conflict or refund review.');
  }
  const fetched = await provider.fetchPayment(paymentId);
  if (fetched.order_id !== orderId || fetched.status !== 'captured' || fetched.currency !== 'INR' || fetched.amount !== payment.amountPaise) {
    throw new HttpError(409, 'Payment is not captured for this booking.');
  }
  await repo.markCaptured(orderId, paymentId, provider.mode());
  return paymentId;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Waits (bounded) for booking-service to act on payment.success, so the
// guest's checkout gets the final answer in the same request as before.
async function awaitBookingOutcome(bookingId, paymentId, requestId) {
  const until = Date.now() + config.confirmWaitMs;
  while (Date.now() < until) {
    const state = await internalRequest('booking-service', `/internal/bookings/${bookingId}/payment-outcome`, { requestId }).catch(() => null);
    if (state?.status === 'confirmed' && state.paymentId === paymentId) return { bookingId, status: 'confirmed' };
    if (state?.outcome && state.outcome.paymentId === paymentId && state.outcome.code !== 'confirmed') throw new HttpError(409, state.outcome.message);
    await sleep(config.confirmPollMs);
  }
  return { bookingId, status: 'processing', msg: 'Payment received. Your booking confirmation is being finalised — it will appear in My Trips shortly.' };
}

// POST /api/customer-booking/holds/:holdId/verify
async function verifyBookingPayment(user, holdId, body, requestId) {
  const payment = await repo.latestForHold(holdId, user.id);
  if (!payment || !payment.bookingId) throw new HttpError(404, 'Payment order not found.');
  const paymentId = await confirmWithProvider(payment, body);
  // Published on every successful verify (also retries): booking-service is
  // idempotent, and this heals a lost event.
  await publish(events.PAYMENT_SUCCESS, { paymentId, orderId: payment.orderId, bookingId: payment.bookingId, holdId: payment.holdId, amount: payment.amountPaise / 100, currency: payment.currency, mode: provider.mode() }, { requestId });
  return awaitBookingOutcome(payment.bookingId, paymentId, requestId);
}

// Provider check used by the quotation flow (pricing-service). Messages match
// the original quotation endpoint.
async function verifyQuotePayment({ orderId, paymentId, signature }) {
  const payment = await repo.byOrderId(orderId);
  if (!payment || payment.purpose !== 'quote') throw new HttpError(404, 'This payment does not belong to this quotation.');
  if (typeof paymentId !== 'string' || !/^pay_[A-Za-z0-9]+$/.test(paymentId) || !provider.validSignature(orderId, paymentId, signature)) throw new HttpError(400, 'Payment signature could not be verified.');
  const result = { orderId, paymentId, amount: payment.amountPaise, mode: provider.mode(), quoteId: payment.quoteId };
  if (payment.status === 'captured') {
    if (payment.paymentId === paymentId) return result;
    throw new HttpError(409, 'Payment details do not match this quotation.');
  }
  let fetched;
  try { fetched = await provider.fetchPayment(paymentId); }
  catch { throw new HttpError(502, 'We could not confirm the payment with Razorpay yet. If money was deducted, it is safe — please refresh in a minute.'); }
  if (fetched.order_id !== orderId || fetched.currency !== 'INR' || fetched.amount !== payment.amountPaise) throw new HttpError(409, 'Payment details do not match this quotation.');
  if (fetched.status !== 'captured') throw new HttpError(409, 'Payment is not captured yet. Please refresh in a minute.');
  await repo.markCaptured(orderId, paymentId, provider.mode());
  return result;
}

module.exports = { providerConfig, createOrder, verifyBookingPayment, verifyQuotePayment, attachBooking: repo.attachBooking };
