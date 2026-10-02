const crypto = require('crypto');
const Razorpay = require('razorpay');

// Razorpay access for quotation payments. Configuration rules match
// routes/payment.js: without real keys online payment is reported as
// unavailable rather than simulated. Methods are looked up on this module at
// call time so tests can substitute them.
const gateway = {
  keyId() { return process.env.RAZORPAY_KEY_ID || ''; },
  keySecret() { return process.env.RAZORPAY_KEY_SECRET || ''; },
  available() {
    const keyId = gateway.keyId();
    const secret = gateway.keySecret();
    return /^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId) && secret.length >= 10 && !/fake|placeholder|your_/i.test(secret);
  },
  mode() { return gateway.keyId().startsWith('rzp_live_') ? 'live' : 'test'; },
  client() {
    if (!gateway._client) gateway._client = new Razorpay({ key_id: gateway.keyId(), key_secret: gateway.keySecret() });
    return gateway._client;
  },
  async createOrder({ amountPaise, receipt, notes }) {
    return gateway.client().orders.create({ amount: amountPaise, currency: 'INR', receipt, notes });
  },
  async fetchPayment(paymentId) {
    return gateway.client().payments.fetch(paymentId);
  },
  validSignature(orderId, paymentId, signature) {
    if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
    const expected = crypto.createHmac('sha256', gateway.keySecret()).update(`${orderId}|${paymentId}`).digest();
    const supplied = Buffer.from(signature, 'hex');
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  }
};

module.exports = gateway;
