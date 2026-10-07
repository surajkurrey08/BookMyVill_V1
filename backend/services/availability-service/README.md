# availability-service

Rooms/units, calendars, date blocks and availability checks.

- Type: **legacy-shared** — routers in `backend/routes`, shared database (not yet extracted)
- Port: `2105` (internal; clients reach it only through the API Gateway on 2001)
- Health: `GET /health` · Readiness: `GET /ready` · Metrics: `GET /metrics`
- Start locally: `cd backend && node services/availability-service/src/server.js`
- Tests: `cd backend && node --test "services/availability-service/tests/*.test.js"`

| Public path | Code |
|---|---|
| `/api/owner-pms` | `backend/routes/ownerPms.js` |
| `/api/v1/availability` | `backend/routes/availabilityApi.js` |
| `/internal/availability` | `backend/routes/internal/availability.js` |
