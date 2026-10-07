# auth-service

Login, registration, mobile OTP, JWT, owner password setup.

- Type: **legacy-shared** — routers in `backend/routes`, shared database (not yet extracted)
- Port: `2101` (internal; clients reach it only through the API Gateway on 2001)
- Health: `GET /health` · Readiness: `GET /ready` · Metrics: `GET /metrics`
- Start locally: `cd backend && node services/auth-service/src/server.js`

| Public path | Code |
|---|---|
| `/api/auth` | `backend/routes/auth.js` |
| `/api/v1/auth` | `backend/routes/auth.js` |
