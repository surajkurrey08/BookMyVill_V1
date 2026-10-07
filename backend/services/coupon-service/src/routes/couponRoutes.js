const express = require('express');
const controller = require('../controllers/catalogController');
const { ownerAuth } = require('../../../../shared/remoteAuth');
const { requireInternal } = require('../../../../shared/internal');

// Owner panel "Offers & Add-ons" (paths unchanged).
const ownerRoutes = express.Router();
ownerRoutes.use(ownerAuth);
ownerRoutes.get('/add-ons', controller.listAddOns);
ownerRoutes.post('/add-ons', controller.createAddOn);
ownerRoutes.patch('/add-ons/:id', controller.updateAddOn);
ownerRoutes.delete('/add-ons/:id', controller.deleteAddOn);
ownerRoutes.get('/promotions', controller.listPromotions);
ownerRoutes.post('/promotions', controller.createPromotion);
ownerRoutes.patch('/promotions/:id', controller.updatePromotion);

// Internal API for booking-service and pricing-service.
const internalRoutes = express.Router();
internalRoutes.use(requireInternal);
internalRoutes.get('/addons/offered', controller.offeredAddOns);
internalRoutes.get('/addons', controller.addOnsByIds);
internalRoutes.post('/promotions/evaluate', controller.evaluatePromotion);
internalRoutes.post('/promotions/:id/redeem', controller.redeem);
internalRoutes.post('/promotions/:id/release', controller.release);

module.exports = { ownerRoutes, internalRoutes };
