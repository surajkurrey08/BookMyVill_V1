const express = require('express');
const { guestCount, unavailableListings } = require('../../services/availabilitySearch');
const { requireInternal } = require('../../shared/internal');
const { validId, sendError } = require('../../utils/validate');

// availability-service internal API: which listings are booked for a range.
const router = express.Router();
router.use(requireInternal);

router.get('/unavailable', async (req, res) => {
  try {
    const propertyIds = String(req.query.propertyIds || '').split(',').filter(validId);
    const { unavailable } = await unavailableListings({ checkIn: req.query.checkIn, checkOut: req.query.checkOut, guests: guestCount(req.query.guests), propertyIds: propertyIds.length ? propertyIds : undefined });
    res.json({ unavailable: [...unavailable] });
  } catch (err) { sendError(res, err, 'Internal availability'); }
});

module.exports = router;
