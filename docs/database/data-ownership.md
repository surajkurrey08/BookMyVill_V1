# Data ownership

Each collection has exactly one **owning** service. Independent services own their collections through their own Mongoose connection; legacy-shared services still use the shared database.

| Collection(s) | Owner | Database |
|---|---|---|
| payments | payment-service | `PAYMENT_MONGODB_URI` / `PAYMENT_DB_NAME` (target `bookmyvilla_payments`) |
| notificationlogs | notification-service | `NOTIFICATION_*` (target `bookmyvilla_notifications`) |
| search_listings (derived index, rebuilt from villa events) | search-service | `SEARCH_*` (target `bookmyvilla_search`) |
| feedbacks | review-service | `REVIEW_*` (target `bookmyvilla_reviews`) |
| promotions, addons, promotion_redemptions | coupon-service | `COUPON_*` (target `bookmyvilla_coupons`) |
| users, phoneotps | auth-service (identity) / user-service (profiles, admin console) | shared |
| properties, guideareas, localguides, staffmembers, housekeepingtasks, operationaltasks, inventories, touristregisters, guestrequests | villa-service | shared |
| bookings, customerholds, ownerexpenses | booking-service | shared |
| rooms, roomnights (permanent nights: bookings, blocks, quotation holds) | availability-service | shared |
| Redis `booking:hold:*` (temporary checkout holds, TTL) | availability/booking | Redis |
| quotations, inquiries, followups, crmactivities | pricing-service | shared |
| site hero images, property media files (`/app/uploads`) | media-service | files |
| adminaudits, partnerapplications, partnerinquiries | user-service | shared |

When `<KEY>_DB_NAME` is unset an independent service uses the shared database, so today's data keeps working with no migration.

Moving an independent service to its own database:

```bash
cd backend
node scripts/copy-service-data.js REVIEW            # dry run: counts only
node scripts/copy-service-data.js REVIEW --apply    # copy (upsert by _id); the source is never modified
# stop the service, run --apply once more, set REVIEW_DB_NAME=bookmyvilla_reviews, start it
```

Rules:
- Never drop or rename collections as part of a deploy; migrations are explicit scripts with a dry run (`scripts/migrate-entire-villa.js`, `scripts/copy-service-data.js`). Old data is never deleted automatically.
- Independent services never import another service's models; they use `/internal/*` APIs or events.
- Indexes are built at startup by each process for the models it loads (idempotent).
