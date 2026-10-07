# booking-service

Booking holds, checkout, confirmation, cancellations, guest stays, owner finance.

- Type: **legacy-shared** — routers in `backend/routes`, shared database (not yet extracted)
- Port: `2104` (internal; clients reach it only through the API Gateway on 2001)
- Health: `GET /health` · Readiness: `GET /ready` · Metrics: `GET /metrics`
- Start locally: `cd backend && node services/booking-service/src/server.js`
- Tests: `cd backend && node --test "services/booking-service/tests/*.test.js"`

| Public path | Code |
|---|---|
| `/api/bookings` | `backend/routes/booking.js` |
| `/api/customer-booking` | `backend/routes/customerBooking.js` |
| `/api/stay` | `backend/routes/customerStay.js` |
| `/api/owner-finance` | `backend/routes/ownerFinance.js` |
| `/api/v1/bookings` | `backend/routes/customerBooking.js` |
| `/internal/bookings` | `backend/routes/internal/bookings.js` |
