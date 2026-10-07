# API Gateway

Single public backend entry point on **port 2001** (`api.bookmyvilla.online`).

- Routing table: `backend/shared/serviceCatalog.js` (legacy `/api/...` paths and `/api/v1/<domain>` aliases).
- Streams requests to internal services (no body buffering), adds `X-Request-Id`, `X-Forwarded-*`.
- CORS, security headers, per-IP rate limits (Redis-backed when `REDIS_URL` is set), 55 MB body limit.
- Validates JWTs for logging/metrics and forwards `x-gateway-user-*`; services still enforce authorization.
- `GET /health` (gateway process), `GET /ready` and `GET /api/health` (critical services ready), `GET /metrics`.

Run locally (services on localhost): `cd backend && SERVICE_HOST=localhost node api-gateway/src/server.js`
