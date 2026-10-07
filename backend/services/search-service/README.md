# search-service

Public villa search with location, guests and date availability.

- Type: **independent** — own code in `src/`, own database (`SEARCH_MONGODB_URI` / `SEARCH_DB_NAME`, target `bookmyvilla_search`)
- Port: `2109` (internal; clients reach it only through the API Gateway on 2001)
- Health: `GET /health` · Readiness: `GET /ready` · Metrics: `GET /metrics`
- Start locally: `cd backend && node services/search-service/src/server.js`
- Tests: `cd backend && node --test "services/search-service/tests/*.test.js"`

| Public path | Code |
|---|---|
| `/api/search` | `backend/services/search-service/src` |
| `/api/v1/search` | `backend/services/search-service/src` |
