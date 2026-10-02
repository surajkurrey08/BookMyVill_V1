# Customer Platform — Stay Experience (Trip page, Guest Requests)

This is the first slice of the BookMyVilla customer platform built on top of the
existing booking flow (search → property → book → pay → My Bookings, all of
which already work). It adds the **post-booking stay experience** and connects
it to the owner/caretaker operations panel so a guest can self-serve instead of
calling.

## What a guest gets

Opened from **My Bookings → Manage Stay**, the Trip page (`/trips/:id`) shows:

- **Booking timeline** in plain language (Booked → Payment received → Confirmed
  → Checked in → Checked out → Deposit), or a cancellation + refund track.
- **Stay pass**: check-in/out times, one-tap **Directions**, **caretaker** call
  & WhatsApp, **Wi-Fi** (revealed only to a confirmed booking), **house rules**,
  arrival notes and food info. All of this is owner-configured (property
  `stayInfo`) with sensible fallbacks, so nothing is hardcoded.
- **Payment & deposit**: total, paid, amount due, the refundable **security
  deposit** status (held → processing), and a **refund tracker** for cancelled
  paid bookings.
- **Guest requests & issues**: raise a service request (towels, water, food,
  taxi…) or report an issue (AC, cleaning, Wi-Fi…), with optional photos. Track
  the live status, the property's ETA and any reply. Cancel an open request.
- **Review** prompt after checkout (posts to the existing feedback system).

Everything is customer-scoped: a guest only ever sees and acts on their own
bookings and requests.

## The operations loop (owner/caretaker effect)

A guest request is a real entity, not a message:

```
Guest raises request  →  appears in Owner → Guest Operations (open count on the
board)  →  owner acknowledges / sets in-progress with an ETA & note / completes
→  the guest sees the new status, ETA and note on their trip page.
```

This reuses the Guest Operations tab built in the sales/ops phase, and the ops
board summary now carries an **Open guest requests** count.

## Request state machine

`open → acknowledged → in_progress → completed`, plus `declined` (owner) and
`cancelled` (guest, only while still open/acknowledged). Issues default to high
priority and get a short grace window to be raised after checkout; service
requests close at checkout. A duplicate submission within a minute is folded
into the existing request (double-tap safe).

## API

Customer (`accountAuth`, scoped to `booking.user`):

| Route | Purpose |
|---|---|
| `GET /api/stay/trips/:id` | Customer-safe trip detail (booking, stay pass, deposit/refund, timeline, requests, capabilities) |
| `POST /api/stay/requests` | Raise a request or issue (validated by kind/category/window) |
| `GET /api/stay/requests?bookingId=` | List own requests for a booking |
| `POST /api/stay/requests/:id/cancel` | Cancel an open request |

Owner (`ownerAuth`, scoped to property owner), added to `owner-ops`:

| Route | Purpose |
|---|---|
| `GET /api/owner-ops/guest-requests/:propertyId` | List requests for a property + open count |
| `PATCH /api/owner-ops/guest-request/:id` | Acknowledge / progress / complete / decline with a note & ETA |

Property `stayInfo` is editable from the owner's property form and saved via the
existing `PUT /api/properties/:id`.

## Implemented vs. deferred

| Area | Status |
|---|---|
| Trip page, stay pass, deposit/refund display, guest requests end-to-end, owner loop, review | **Implemented**, integration-tested (8 cases) and browser-verified |
| Owner-editable stay pass (`stayInfo`) | **Implemented** in the property form |
| Pre check-in form / ID upload / arrival time | **Not yet** — the stay pass is read-only arrival info for now |
| Add-ons, extra-guest, early/late checkout, extend stay during the stay | **Not yet** on the customer side (the add-on catalogue exists on the owner side) |
| Complaint SLA/escalation | **Not yet** — issues are tracked, but without timers/escalation |
| **Availability source-of-truth on the paid booking path** | **Deliberately deferred.** The live website booking still books the whole property without reserving room-nights or checking owner blocks, so it can diverge from the `RoomNight` ledger. Making it availability-aware with exact-room selection is the highest-risk change to a working payment flow and should be its own PR (it needs the room-selection UI, room hold timer and the "room sold during checkout" recovery flow). Not touched this session. |
| Exact room selection, room hold timer, compare rooms, wishlist, map view, personalized recommendations | **Not yet** (later customer-platform phases) |

## Pre-existing bug fixed

`frontend/.../SignIn.jsx` used `fieldErrors`/`setFieldErrors` without declaring
the state, so the customer sign-in page threw on render. Declared the missing
state.

## Tests

`backend/test/stay.test.js` (8 cases): trip scoping and stay-pass exposure,
Wi-Fi only for confirmed bookings, request validation and windows, owner
visibility and scoping, status flow back to the guest, cancellation rules,
post-checkout behaviour, and refund tracking. Run with `npm test` in `backend/`.
