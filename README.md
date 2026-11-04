# BookMyVilla

Whole-villa booking platform for Mahabaleshwar, Panchgani, Lonavala and nearby hill stations.

## Apps

| Folder | What it is | Dev port |
|---|---|---|
| `frontend/` | Customer website (bookmyvilla.online) | 5173 |
| `admin/` | Admin console | 5174 |
| `owner/` | Owner panel (self-managed owners) | 5175 |
| `caretaker/` | Caretaker app | 5176 |
| `data-entry/` | Data Entry panel (owners, villas, photos, local guides) | 5176* |
| `villa-manager/` | Villa Manager panel (BookMyVilla-managed villas) | 5177 |
| `backend/` | API Gateway + 12 microservices | 2001 (gateway) |

\* run one of caretaker/data-entry at a time locally, or use Docker Compose (data-entry on 5178).

All apps talk to the backend only through the **API Gateway on port 2001** (`https://api.bookmyvilla.online` in production).

## Backend

Customer website chat setup: [Omniflow Web Chat](docs/omniflow-webchat.md).

```
backend/
├── api-gateway/          public entry, port 2001
├── services/<name>-service/   auth · user · villa · booking · availability · pricing
│                               payment · notification · search · review · coupon · media
├── shared/               serviceCatalog (routing table), logger, metrics, database, cache
├── messaging/            RabbitMQ event bus + event names
├── routes/ models/ services/*.js   domain code, served by the owning service
└── index.js              legacy all-in-one server (same routes; rollback path)
```

```bash
cd backend && npm install
npm run dev:all     # gateway + all services locally
npm test            # tests
npm run smoke       # end-to-end check through the gateway (in-memory MongoDB)
```

## Infrastructure

- `docker-compose.yaml` — full stack (gateway, services, RabbitMQ, Redis, web apps); generated from the service catalog.
- `docker-compose.monitoring.yaml` — Prometheus + Grafana.
- `infrastructure/kubernetes/` — Kustomize base, ingress (real domains), HPA/PDB, development and production overlays.
- `nginx/` — live host nginx configuration used by the deploy workflow.

Docs: [architecture](docs/architecture/microservices.md) · [gateway routes](docs/api/gateway-routes.md) · [data ownership](docs/database/data-ownership.md) · [deployment](docs/deployment/microservices.md) · [VPS deploy](docs/deploy-bookmyvilla.md)
