# media-service

Property photos/videos and site hero images.

- Type: **legacy-shared** — routers in `backend/routes`, shared database (not yet extracted)
- Port: `2112` (internal; clients reach it only through the API Gateway on 2001)
- Health: `GET /health` · Readiness: `GET /ready` · Metrics: `GET /metrics`
- Start locally: `cd backend && node services/media-service/src/server.js`

| Public path | Code |
|---|---|
| `/api/properties/media` | `backend/routes/propertyMediaFiles.js` |
| `/api/site-heroes` | `backend/routes/siteHeroes.js` |
| `/api/v1/media` | `backend/routes/siteHeroes.js` |
