# notification-service

Consumes booking/payment events and records guest/owner notifications.

- Type: **independent** — own code in `src/`, own database (`NOTIFICATION_MONGODB_URI` / `NOTIFICATION_DB_NAME`, target `bookmyvilla_notifications`)
- Port: `2108` (internal; clients reach it only through the API Gateway on 2001)
- Health: `GET /health` · Readiness: `GET /ready` · Metrics: `GET /metrics`
- Start locally: `cd backend && node services/notification-service/src/server.js`
- Tests: `cd backend && node --test "services/notification-service/tests/*.test.js"`

| Public path | Code |
|---|---|
| `/api/notifications` | `backend/services/notification-service/src` |
| `/api/v1/notifications` | `backend/services/notification-service/src` |
