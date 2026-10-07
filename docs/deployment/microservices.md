# Running and deploying the microservices

## Local, without Docker
```bash
cd backend
npm install
npm run dev:all          # gateway on :2001 + 12 services on :2101-2112 (uses backend/.env)
npm run smoke            # isolated end-to-end check on an in-memory MongoDB (gateway :3001)
npm test                 # unit + integration tests
npm start                # legacy all-in-one server on :2001 (rollback / quick debugging)
```

## Docker Compose (VPS)
```bash
docker compose up -d --build          # gateway, 12 services, RabbitMQ, Redis, Mongo, web apps
docker compose ps
docker compose logs -f api-gateway booking-service
curl -fsS http://127.0.0.1:2001/api/health
docker compose -f docker-compose.yaml -f docker-compose.monitoring.yaml up -d   # + Prometheus/Grafana
```
`docker-compose.yaml` is generated: `node infrastructure/scripts/generate-compose.js`.
Secrets come from `backend/.env` (created by the deploy workflow from the `BACKEND_ENV` secret); nothing is baked into images.

Capacity note: the stack runs 13 Node processes (~70–120 MB each) plus RabbitMQ (~150 MB) and Redis. Check VPS memory before the first deploy; `npm start` (single process) remains available as a fallback by changing the gateway command in compose.

## Kubernetes
```bash
cd infrastructure && npm install && npm run validate      # offline manifest checks
# Build and push images (registry of your choice), then:
kubectl create namespace bookmyvilla
kubectl -n bookmyvilla create secret generic bookmyvilla-backend-secrets --from-env-file=backend/.env
kubectl apply -k infrastructure/kubernetes/overlays/production --dry-run=client
kubectl apply -k infrastructure/kubernetes/overlays/production
kubectl -n bookmyvilla rollout status deploy/api-gateway
kubectl -n bookmyvilla get pods,svc,ingress,hpa
kubectl -n bookmyvilla rollout undo deploy/booking-service    # rollback one service
```
Images: `bookmyvilla/backend` (backend/Dockerfile — gateway and all services), `bookmyvilla/<app>` (each web app's `Dockerfile.prod`, nginx on 8080). Set `REGISTRY` and `IMAGE_TAG` in `overlays/production/kustomization.yaml`.
Requirements: an nginx ingress controller, cert-manager (`letsencrypt-prod` ClusterIssuer) or an existing `bookmyvilla-tls` secret, metrics-server (HPA), and a ReadWriteMany storage class for `bookmyvilla-uploads`.
Manifests are generated: `node infrastructure/scripts/generate-k8s.js`.
