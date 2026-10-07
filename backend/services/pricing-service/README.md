# pricing-service

Quotations, pricing rules and the sales desk.

- Type: **legacy-shared** — routers in `backend/routes`, shared database (not yet extracted)
- Port: `2106` (internal; clients reach it only through the API Gateway on 2001)
- Health: `GET /health` · Readiness: `GET /ready` · Metrics: `GET /metrics`
- Start locally: `cd backend && node services/pricing-service/src/server.js`

| Public path | Code |
|---|---|
| `/api/owner-quotes` | `backend/routes/ownerQuotes.js` |
| `/api/public/quotes` | `backend/routes/publicQuotes.js` |
| `/api/owner-crm` | `backend/routes/ownerCrm.js` |
| `/api/v1/pricing` | `backend/routes/ownerQuotes.js` |
| `/internal/pricing` | `backend/routes/internal/pricing.js` |
