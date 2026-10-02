# Owner Panel — Phase 3: Sales (Inquiries, Quotations, Follow-ups, Offers)

This document describes the sales layer added to the BookMyVilla Owner Panel:
how a lead becomes a quotation and then a confirmed booking, what is fully
working today, and what still needs an external integration.

## What an owner can do

| Owner question | Where | What it does |
|---|---|---|
| "Which inquiry can convert?" | **Inquiries & Quotes → Pipeline** | KPIs, a *Needs attention* list (unanswered leads > 1 h, overdue follow-ups, accepted quotes, quotes expiring in 24 h), conversion funnel with the biggest drop-off, bookings by source, lost reasons, average first-reply time. |
| "Who are my leads?" | **Leads** | Search (name, phone, email, code), filters (source, property, staff, priority), sort, pagination, CSV export. Views: Open, Needs first reply, Follow-up due, Booked, Lost, All. Duplicate open leads are detected by phone. |
| "What did we last say?" | **Lead drawer** | Stay request, guest history (returning guest, cancellations), quotations, follow-ups, and a timeline of calls/WhatsApp/email/notes plus automatic events (quote viewed, accepted, booking created). Call / WhatsApp / Email buttons open on the device. |
| "Who do I contact today?" | **Follow-ups** | Overdue / Today / Upcoming / Done; complete with outcome and chain the next follow-up; reschedule. |
| "Send a professional quote" | **Quotation builder** | Room, dates, guests, custom rate, add-ons, extra charges, promotion code, extra discount (with internal reason), tax mode, advance %, balance due date, refundable deposit, cancellation policy, notes, validity (30 min – 7 days) and an optional room hold (max 72 h). Prices are computed by the server live as you type. |
| "Did the guest open it?" | **Quotation drawer** | Status, live countdown, hold status, view count; share via WhatsApp / email / copy link / print-to-PDF (each share is logged); withdraw, revise, convert to booking. |
| Guest side | `https://<site>/quote/<token>` | Guest sees the price breakdown, schedule, deposit and policy, then accepts (typed name + policy confirmation) or declines. Pays online when Razorpay is configured. |
| "What extras and offers do I sell?" | **Offers & Add-ons** | Add-on catalogue (per stay / night / guest / guest-night / unit, tax rate, property scope, pause). Promotions with rules and usage stats. |

## State machines

**Lead (Inquiry)** `new → contacted → qualified → quotation_sent ⇄ follow_up → payment_pending → booked`, and `lost` (reason required) from any open stage; lost/booked leads can be reopened.
Automatic moves only go forward: sending a quote → `quotation_sent`, guest accepts → `payment_pending`, quote converted → `booked`. A guest decline moves `quotation_sent → follow_up`. `furthestStage` feeds the funnel so reopening or losing a lead never rewrites history.

**Quotation** `draft → sent → viewed → accepted → converted`, with `rejected` (guest), `expired` (validity passed), `withdrawn` (owner, or replaced by a revision).
Only drafts are editable; what a guest saw never changes. *Revise* copies the inputs into a new draft at today's rates and withdraws the open original. Expiry is applied lazily whenever quotes are read.

**Room night ledger (`RoomNight`)** one document per room per night, unique on `{room, date}`:
`block` (owner), `booking`, and the new `hold` (quotation, with `expiresAt`). A lapsed hold is treated as free immediately and purged on the next conflicting write (a TTL index cleans up the rest). This unique index is the double-booking guarantee; no multi-document transactions are needed, so it works on a standalone MongoDB.

**Conversion** takes a 60-second lock on the quote, redeems the promotion (atomic `usedCount < maxUses`), moves the held nights onto the booking (or reserves lapsed ones), creates the booking, then finalises the quote. Every step is compensated on failure. A captured online payment always produces a booking: if the room was lost meanwhile, the booking is created unassigned and flagged for the owner.

## Pricing rules (`backend/services/quotePricing.js`)

- Accommodation = nightly rate × nights. Promotions and the extra discount apply to accommodation only and can never exceed it.
- Add-ons: per stay × qty, per night × qty × nights, per guest × guests, per guest-night × guests × nights, per unit × qty.
- Tax modes: *none* (not GST registered), *GST hotel slabs* (5 % when the tariff after discounts is ≤ ₹7,500/night, otherwise 18 %), or a custom accommodation rate. Add-ons and extra charges use their own rates. Slab values live in one table; confirm current rates with a tax advisor.
- Advance % and balance due date (never in the past). Security deposit is shown separately and is not part of the total.
- All amounts are whole rupees and always recomputed by the server.

## API

All owner routes require an owner session (`ownerAuth`) and are scoped to the signed-in owner.

| Route | Purpose |
|---|---|
| `GET /api/owner-crm/meta` | Properties, staff, enums for forms |
| `GET /api/owner-crm/summary?days=30` | Pipeline KPIs, attention lists, funnel, sources, lost reasons |
| `GET/POST /api/owner-crm/inquiries` · `GET/PATCH /inquiries/:id` | Leads (PATCH accepts `expectedRevision` to reject concurrent edits) |
| `POST /inquiries/:id/status` · `/activities` · `/follow-ups` | Stage change, conversation log, schedule follow-up |
| `GET /inquiries/export.csv` | Filtered CSV (spreadsheet formula-safe) |
| `GET /api/owner-crm/follow-ups` · `PATCH /follow-ups/:id` | Follow-up board; complete / cancel / reschedule |
| `GET /api/owner-crm/activities` | Recent conversation log across leads |
| `GET/POST /api/owner-quotes` · `GET/PUT/DELETE /:id` | Quotations (PUT/DELETE drafts only) |
| `POST /api/owner-quotes/preview` | Server pricing for the builder (no save) |
| `POST /:id/send` · `/share` · `/withdraw` · `/revise` · `/convert` | Lifecycle actions |
| `GET/POST/PATCH/DELETE /api/owner-catalog/add-ons` | Add-on catalogue (delete only if never quoted) |
| `GET/POST/PATCH /api/owner-catalog/promotions` | Promotions |
| `GET /api/public/quotes/:token` · `POST /accept` · `/reject` · `/pay` · `/verify` | Guest quotation page (rate limited; 256-bit token is the only credential) |

## Implemented vs. not yet integrated

| Area | Status |
|---|---|
| Leads, pipeline, follow-ups, timeline, quotations, holds, conversion, add-ons, promotions, guest quote page | **Implemented** and covered by integration tests |
| Sending WhatsApp / email / SMS | **Device hand-off**: buttons open WhatsApp or the mail app with the message ready and the share is logged. No WhatsApp Business API or email provider is connected yet. |
| Follow-up reminders | **In-app only** (Follow-ups board, Needs attention, overview strip). No push/SMS reminder is sent. |
| Online payment for quotations | **Implemented, gated on configuration**: works when real Razorpay keys are set (same rules as the existing checkout); otherwise the guest page says the host will collect payment. Tested with a stubbed gateway, not against live Razorpay. |
| Partial / advance payments | **Not yet**: the quote shows the advance/balance schedule, but the booking ledger still records a single full payment (existing Payments module). Needs a payment ledger (Phase 1 payments upgrade). |
| Multi-room / group quotations | **Not yet**: one room or whole-villa unit per quotation. |
| Promo codes on the public booking checkout | **Not yet**: promotions apply to owner quotations only. |
| Staff logins and role-based permissions | **Not yet**: staff are a directory used for assignment; only the owner signs in. |

## Fixes made while integrating (existing code)

- **Room-night writes always failed on the live server.** `index.js` disables Mongoose buffering, so each model's automatic `init()` ran before the database connected and cached a rejected promise; `RoomNight.init()` therefore rejected forever, breaking *Block dates*, room assignment, and checkout's automatic cleaning task — and the unique `{room, date}` index could be missing on a fresh database. Indexes are now built after connecting (`utils/modelIndexes.js`) and before ledger writes. The test harness reproduces the production startup so this cannot regress silently.
- Owner panel ignored `VITE_API_URL`, so production builds called `http://localhost:5001`. It now uses the build variable; listing preview / "View main site" links use the real guest site.
- *Caretakers* tab crashed the dashboard (`specialRequests` vs the API's `requests`); caretaker inventory used the wrong field names and restock sent `amount` instead of `quantity`.
- *Payments & Reports* crashed once a paid booking existed (`localDate` was undefined).
- Bookings tab now refreshes when opened, and every booking list shows the guest name for bookings that have no guest account.

## Known issues found but not changed

- `backend/middleware/auth.js` (used by several legacy routes such as inventory, tourist register and feedback) accepts unverified or expired tokens and falls back to the first owner. Routes written for the PMS use the strict `accountAuth`/`ownerAuth`. The legacy routes should be migrated.
- `caretaker-tasks` and `guest-requirements` keep data in process memory (lost on restart, shared across owners).
- `caretaker/src/config.js` points at port 5000 and ignores `VITE_API_URL`.
- Phase 2 items not present in the code yet: maintenance tickets, guest complaints with SLA, inspections, security deposit and damage settlement.

## Running the tests

```bash
cd backend
npm test                                          # downloads a MongoDB binary via mongodb-memory-server
TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm test   # or use an existing MongoDB
```

The suite covers concurrent reservations, hold expiry and conversion, pricing and tax, CRM validation and owner scoping, the full quotation lifecycle, guest-page data exposure, promotion limits, and payment idempotency.
