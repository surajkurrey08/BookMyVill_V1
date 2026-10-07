# payment-service

Payment orders, provider verification and payment records.

- Type: **independent** — own code in `src/`, own database (`PAYMENT_MONGODB_URI` / `PAYMENT_DB_NAME`, target `bookmyvilla_payments`)
- Port: `2107` (internal; clients reach it only through the API Gateway on 2001)
- Health: `GET /health` · Readiness: `GET /ready` · Metrics: `GET /metrics`
- Start locally: `cd backend && node services/payment-service/src/server.js`
- Tests: `cd backend && node --test "services/payment-service/tests/*.test.js"`

| Public path | Code |
|---|---|
| `/api/v1/payments` | `backend/services/payment-service/src` |
