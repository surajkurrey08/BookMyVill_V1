# coupon-service

Promotions, promo codes and add-ons.

- Type: **independent** — own code in `src/`, own database (`COUPON_MONGODB_URI` / `COUPON_DB_NAME`, target `bookmyvilla_coupons`)
- Port: `2111` (internal; clients reach it only through the API Gateway on 2001)
- Health: `GET /health` · Readiness: `GET /ready` · Metrics: `GET /metrics`
- Start locally: `cd backend && node services/coupon-service/src/server.js`
- Tests: `cd backend && node --test "services/coupon-service/tests/*.test.js"`

| Public path | Code |
|---|---|
| `/api/owner-catalog` | `backend/services/coupon-service/src` |
| `/api/v1/coupons` | `backend/services/coupon-service/src` |
