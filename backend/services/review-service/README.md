# review-service

Guest ratings and reviews.

- Type: **independent** — own code in `src/`, own database (`REVIEW_MONGODB_URI` / `REVIEW_DB_NAME`, target `bookmyvilla_reviews`)
- Port: `2110` (internal; clients reach it only through the API Gateway on 2001)
- Health: `GET /health` · Readiness: `GET /ready` · Metrics: `GET /metrics`
- Start locally: `cd backend && node services/review-service/src/server.js`
- Tests: `cd backend && node --test "services/review-service/tests/*.test.js"`

| Public path | Code |
|---|---|
| `/api/feedback` | `backend/services/review-service/src` |
| `/api/v1/reviews` | `backend/services/review-service/src` |
