const express = require('express');
const { guestCount, unavailableListings } = require('../services/availabilitySearch');
const { validId, sendError, HttpError } = require('../utils/validate');

// Availability service public API (/api/v1/availability).
// Owner/manager calendars and blocks stay on /api/owner-pms (same service).
const router = express.Router();
const fail = (res, err) => sendError(res, err, 'Availability');

// GET /check?propertyId=&checkIn=&checkOut=&guests= → is this villa free?
router.get('/check', async (req, res) => {
  try {
    if (!validId(req.query.propertyId)) throw new HttpError(400, 'Choose a property.');
    const guests = guestCount(req.query.guests);
    const { unavailable, withUnits } = await unavailableListings({ checkIn: req.query.checkIn, checkOut: req.query.checkOut, guests, propertyIds: [req.query.propertyId] });
    const id = String(req.query.propertyId);
    if (!withUnits.has(id)) throw new HttpError(404, 'This property is not available for online booking.');
    res.set('Cache-Control', 'no-store');
    res.json({ propertyId: id, checkIn: req.query.checkIn, checkOut: req.query.checkOut, guests, available: !unavailable.has(id) });
  } catch (err) { fail(res, err); }
});

// GET /unavailable?checkIn=&checkOut=&guests= → public listings booked for the range.
router.get('/unavailable', async (req, res) => {
  try {
    const guests = guestCount(req.query.guests);
    const { unavailable } = await unavailableListings({ checkIn: req.query.checkIn, checkOut: req.query.checkOut, guests });
    res.set('Cache-Control', 'no-store');
    res.json({ checkIn: req.query.checkIn, checkOut: req.query.checkOut, guests, unavailable: [...unavailable] });
  } catch (err) { fail(res, err); }
});

module.exports = router;
