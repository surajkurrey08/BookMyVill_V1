# villa-service

Villas, listings, data-entry onboarding, villa-manager and on-site operations.

- Type: **legacy-shared** — routers in `backend/routes`, shared database (not yet extracted)
- Port: `2103` (internal; clients reach it only through the API Gateway on 2001)
- Health: `GET /health` · Readiness: `GET /ready` · Metrics: `GET /metrics`
- Start locally: `cd backend && node services/villa-service/src/server.js`

| Public path | Code |
|---|---|
| `/api/properties` | `backend/routes/property.js` |
| `/api/v1/villas` | `backend/routes/property.js` |
| `/api/villa-manager` | `backend/routes/villaManager.js` |
| `/api/owner-ops` | `backend/routes/ownerOps.js` |
| `/api/caretaker` | `backend/routes/caretaker.js` |
| `/api/caretaker-tasks` | `backend/routes/caretakerTasks.js` |
| `/api/guest-requirements` | `backend/routes/guestRequirements.js` |
| `/api/inventory` | `backend/routes/inventory.js` |
| `/api/tourist-register` | `backend/routes/touristRegister.js` |
| `/internal/villas` | `backend/routes/internal/villas.js` |
