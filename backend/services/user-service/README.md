# user-service

Admin console, owners, customers, staff accounts, partner applications.

- Type: **legacy-shared** — routers in `backend/routes`, shared database (not yet extracted)
- Port: `2102` (internal; clients reach it only through the API Gateway on 2001)
- Health: `GET /health` · Readiness: `GET /ready` · Metrics: `GET /metrics`
- Start locally: `cd backend && node services/user-service/src/server.js`

| Public path | Code |
|---|---|
| `/api/admin-console` | `backend/routes/adminConsole.js` |
| `/api/admin` | `backend/routes/admin.js` |
| `/api/partner` | `backend/routes/partner.js` |
| `/api/v1/users` | `backend/routes/adminConsole.js` |
| `/internal/users` | `backend/routes/internal/users.js` |
