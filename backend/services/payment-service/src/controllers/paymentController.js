const service = require('../services/paymentService');
const { validId, HttpError } = require('../../../../utils/validate');
const { asyncHandler: handle } = require('../../../../shared/http');


module.exports = {
  // Guest checkout: verify the payment, publish payment.success, return the booking result.
  verifyBooking: handle('Payment verification')(async (req, res) => {
    if (!validId(req.params.id)) throw new HttpError(404, 'Room hold not found.');
    res.json(await service.verifyBookingPayment(req.user, req.params.id, req.body || {}, req.id));
  }),
  config: handle('Payment config')(async (req, res) => res.json(service.providerConfig())),
  createOrder: handle('Payment order')(async (req, res) => res.status(201).json(await service.createOrder(req.body || {}))),
  attachBooking: handle('Payment order')(async (req, res) => { await service.attachBooking(req.params.orderId, req.body?.bookingId); res.json({ ok: true }); }),
  verifyQuote: handle('Quote payment')(async (req, res) => res.json(await service.verifyQuotePayment(req.body || {})))
};
