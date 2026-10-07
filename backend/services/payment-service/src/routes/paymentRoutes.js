const express = require('express');
const controller = require('../controllers/paymentController');
const { customerAuth } = require('../../../../shared/remoteAuth');
const { requireInternal } = require('../../../../shared/internal');

// Public: the checkout verify endpoint keeps its original path
// (/api/customer-booking/holds/:id/verify); route-level auth only, so other
// /api/customer-booking requests fall through to booking-service untouched.
const publicRoutes = express.Router();
publicRoutes.post('/holds/:id/verify', customerAuth, controller.verifyBooking);

// Internal: used by booking-service (orders) and pricing-service (quotes).
const internalRoutes = express.Router();
internalRoutes.use(requireInternal);
internalRoutes.get('/config', controller.config);
internalRoutes.post('/orders', controller.createOrder);
internalRoutes.patch('/orders/:orderId/booking', controller.attachBooking);
internalRoutes.post('/quotes/verify', controller.verifyQuote);

module.exports = { publicRoutes, internalRoutes };
