const express = require('express');
const controller = require('../controllers/reviewController');
const { ownerAuth, customerAuth, adminConsoleAuth, requirePermission } = require('../../../../shared/remoteAuth');

// Public paths kept from the original API: /api/feedback/... (and /api/v1/reviews/...).
const router = express.Router();
const objectId = (req, res, next) => (/^[a-f\d]{24}$/i.test(req.params.propertyId) ? next() : res.status(404).json({ msg: 'Published property not found.' }));

router.get('/owner', ownerAuth, controller.forOwner);
router.get('/admin', adminConsoleAuth, requirePermission('customers.view'), controller.forAdmin);
router.get('/property/:propertyId', objectId, controller.forProperty);
router.put('/:id/toggle-select', ownerAuth, controller.toggleSelected);
router.delete('/:id', ownerAuth, controller.remove);
router.post('/', customerAuth, controller.create);

module.exports = router;
