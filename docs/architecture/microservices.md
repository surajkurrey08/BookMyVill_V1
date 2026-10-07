# BookMyVilla microservices architecture

```
Website · Admin · Owner · Data Entry · Villa Manager · Caretaker
                         │  (https://api.bookmyvilla.online, local :2001)
                         ▼
                 API Gateway :2001  ── CORS · rate limits (Redis) · request IDs · JWT pre-check
                         │             security headers · 55 MB limit · health aggregation
   ┌──────────┬──────────┼───────────┬────────────┬────────────┬──────────┐
 auth 2101  user 2102  villa 2103  booking 2104  availability 2105  pricing 2106
 payment 2107  notification 2108  search 2109  review 2110  coupon 2111  media 2112
                         │
   RabbitMQ (topic exchange bookmyvilla.events, retry + DLQ per queue)
   Redis (rate limits, caches, temporary booking holds)      MongoDB (permanent data)
```

## Key decisions

- **Port 2001 is the gateway.** Websites, panels, host nginx and the deploy health check are unchanged.
- **One catalog** — `backend/shared/serviceCatalog.js` — drives the gateway, every service process, `docker-compose.yaml`, the Kubernetes manifests and `docs/api/gateway-routes.md` (all generated).
- **Legacy paths preserved.** `/api/properties`, `/api/auth`, `/api/customer-booking/...` keep their exact behaviour; `/api/v1/<domain>` aliases exist for new clients.
- **One backend image**, many processes. Each container runs `node services/<name>/src/server.js`.
- **Every process** exposes `/health`, `/ready` (its database connected), `/metrics`, structured JSON logs with request IDs and secret redaction (`LOG_LEVEL`), and graceful shutdown.

## Two kinds of service (honest status)

| Kind | Services | What it means |
|---|---|---|
| **Independent** | payment, notification, search, review, coupon | Own code in `services/<name>/src` (config, models, repositories, services, controllers, routes, validators, clients, events), own database connection (`<KEY>_MONGODB_URI` / `<KEY>_DB_NAME`), own tests in `services/<name>/tests`. They never import another domain's models; they call other services' `/internal/*` APIs or consume events. |
| **Legacy-shared** | auth, user, villa, booking, availability, pricing, media | Routers in `backend/routes` on the shared database and shared models in `backend/models`. Each route is served by exactly one service, but these domains still read/write each other's collections inside single flows (booking ↔ rooms/nights ↔ properties ↔ users). |

The independent services default to the shared database (where the data is today). Moving one to its own database is an explicit, non-destructive step: `node backend/scripts/copy-service-data.js <KEY> --apply`, then set `<KEY>_DB_NAME`.

## Service-to-service communication

- **Internal HTTP** (`backend/shared/internal.js`): `/internal/users`, `/internal/villas`, `/internal/bookings`, `/internal/availability`, `/internal/pricing`, `/internal/payments`, `/internal/coupons`. Never routed by the gateway; protected by `INTERNAL_SERVICE_TOKEN` when set. 4xx answers pass through; network errors and 5xx become 503.
- **Identity** (`backend/shared/remoteAuth.js`): independent services verify the JWT locally and get the account's current role/status from user-service (cached `IDENTITY_CACHE_SECONDS`).
- **Events** (`backend/messaging`, contracts in `backend/shared/contracts/events.js`): versioned envelope `{ id, event, version, occurredAt, requestId, data }`; durable queues, persistent messages, manual ack, retry queue with back-off, dead-letter queue after 5 attempts, reconnect and clean shutdown. Without `RABBITMQ_URL` events are delivered in-process with the same retry semantics.

## Checkout and payment flow

1. `POST /api/customer-booking/holds` (booking-service): validates the villa and the permanent nights in MongoDB, then takes an **atomic Redis hold** (`services/holdLocks.js`: one Lua script locks every night or none, TTL 10 min, token = hold id). Without `REDIS_URL` an in-process store gives the same semantics; with `REDIS_URL` set but Redis down, new holds are refused (503) instead of risking double booking.
2. `POST /holds/:id/pay` (booking-service): extends the hold to 20 min, creates the pending booking and asks payment-service for a provider order (`/internal/payments/orders`).
3. `POST /holds/:id/verify` (**payment-service**, gateway special route): checks the signature and the captured amount with Razorpay, records the payment in its own `payments` collection and publishes **`payment.success`**. It never writes booking data.
4. booking-service consumes `payment.success` (`services/bookingConfirmation.js`): idempotent (same payment → no-op), lease-protected against concurrent workers, converts the hold into booked nights, confirms the booking, releases the Redis hold, publishes `booking.confirmed` / `availability.changed` (or `booking.confirmation_failed` with a reason for refund review).
5. payment-service waits up to `PAYMENT_CONFIRM_WAIT_MS` for the outcome so the guest gets the answer in the same request; otherwise it answers `processing` and the confirmation page keeps checking.
6. coupon-service counts the promo-code use from `booking.confirmed` (once per booking); notification-service records the notifications.

## Still shared (next steps)

| Today | Next step |
|---|---|
| auth/user, villa, booking, availability, pricing, media share `backend/models` and one database | Extract one domain at a time behind internal APIs, starting with the ones others only read (media, then availability) |
| Quotation conversion (pricing-service) and owner finance (booking-service) write bookings directly | Move behind booking-service internal APIs / events |
| Guest promo rules that need booking/quote history run in booking/pricing | Expose guest history from booking-service and move the check into coupon-service |
| Notifications are recorded with status `pending_provider` | Plug in an SMS/e-mail provider (not implemented on purpose) |

The legacy all-in-one server (`node index.js`) still mounts every service from the same catalog for quick local work and as a rollback path.
