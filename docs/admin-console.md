# BookMyVilla Super Admin — Console (Phase 1 spine)

This document describes the new **Super Admin Console**: a single, role-based
control centre for the marketplace. It is added *alongside* the existing admin
app (the legacy owner-onboarding / KYC screens are untouched and still reachable
under **Classic admin tools**). Every number on screen comes from the same
backend that serves the customer, owner and caretaker apps — nothing is faked.

The console lives under `/console` in the admin app and talks to a dedicated API
namespace, `/api/admin-console/*`.

## Design rules this phase holds to

- **One panel, many roles.** Roles are *permission bundles*, not separate panels.
  An admin sees only the sections their permissions allow; the backend enforces
  every permission on every request (the frontend only hides).
- **Admins never write entity status directly.** Routes call shared domain
  services (`services/adminActions.js`) so the state machine, the customer-impact
  check and the audit entry are identical for any caller.
- **The audit log is append-only.** `AdminAudit` rejects every update/delete at
  the model layer, so an action, once recorded, cannot be edited or removed.
- **Strict admin auth.** The console uses `adminConsoleAuth` — a real JWT, role
  `admin`, no dev fallback — separate from the loose `auth` used elsewhere.

## What an admin can do

| Admin question | Where | What it does |
|---|---|---|
| "What needs me right now?" | **Control Center** | Real KPIs (GMV, est. platform revenue, bookings, active properties, pending reviews, open refund-reviews, unpaid bookings) with period-over-period change, plus a prioritised **Needs Attention** list (properties awaiting review, refunds to action, suspended accounts, unpaid confirmed stays) at High/Medium severity. |
| "Who are my owners?" | **Owners** | Search + status filter, per-owner aggregates (properties, bookings, revenue), a 360° drawer (properties, recent bookings, admin history) and suspend / restrict / reactivate. |
| "Is this listing fit to go live?" | **Properties → review queue** | Tabs by state, a review drawer with a readiness checklist, a **customer-impact preview** (future confirmed bookings, check-ins within 7 days) and the review actions below. |
| "Who booked what?" | **Bookings** | Search + views (all / refund review / unpaid), a booking drawer, and an internal note (audited). |
| "Deal with this guest account" | **Customers** | Search + status filter, a 360° drawer, suspend / restrict / reactivate. |
| "What has the team done?" | **Audit Log** | Every admin action, filterable by entity, with before→after, the reason, and the acting admin. Append-only. |
| "Who can do what?" | **Admin Team** | List of admins, their role and permission count, and a role/permission editor. |
| "Jump to anything" | **⌘K / Ctrl-K** | Global search across owners, properties, bookings and customers, scoped to the admin's permissions. |

## State machines

**Property status** `pending → under_review → approved`, with `rejected` and
`suspended`. Transitions (`services/adminActions.js`):

| Action | From | To | Reason required |
|---|---|---|---|
| Approve | pending, under_review, suspended, rejected | approved | no |
| Request changes | pending, under_review, approved | under_review | **yes** |
| Reject | pending, under_review, approved | rejected | **yes** |
| Suspend | approved | suspended | **yes** |
| Unsuspend | suspended | approved | no |

Only **approved** properties are public — the public listing (`/api/properties/all`)
and search filter on `status: 'approved'`, so suspending or rejecting a listing
removes it from the guest site immediately. Each transition takes an optimistic
status guard (`findOneAndUpdate` on the expected current status) so two admins
cannot apply conflicting transitions, records the customer impact at the moment
of the decision, and writes one audit entry.

**Account status** (owners and customers) `active ⇄ restricted ⇄ suspended`.
`suspend` / `restrict` require a reason; `activate` returns to active. A
suspended account is denied at login/`accountAuth` (the deny list is
`pending`, `rejected`, `suspended`), so suspending locks the user out at once.
Admin accounts cannot be changed here — they are managed under **Admin Team**.

## RBAC

Permissions are the unit of authorization (`services/adminRbac.js`):

```
dashboard.view
owners.view        owners.manage
properties.view    properties.approve    properties.suspend
bookings.view      bookings.note
customers.view     customers.manage
audit.view
team.manage
```

Roles bundle them:

| Role | Permissions |
|---|---|
| **Super Admin** | everything (`*`) |
| **Operations** | dashboard, owners (view+manage), properties (view+approve+suspend), bookings (view+note), customers (view), audit |
| **Finance** | dashboard, owners (view), bookings (view), audit |
| **Support** | dashboard, owners (view), bookings (view+note), customers (view+manage) |
| **Risk & Fraud** | dashboard, owners (view), properties (view+suspend), customers (view), audit |
| **Content** | dashboard, properties (view) |
| **Read Only** | dashboard, owners/properties/bookings/customers/audit (view) |

A role bundle can be topped up with explicit extra permissions per admin.
Property review splits by permission: *approve / request changes / reject* need
`properties.approve`; *suspend / unsuspend* need `properties.suspend` — so a Risk
admin can take a live listing down without being able to approve new ones.

Backward compatibility: a user with `role: 'admin'` and no `adminRole` (the
originally seeded `admin@gmail.com`) is treated as **Super Admin**. An admin
cannot demote themselves out of super_admin (so the panel can't be locked out).

## Audit log

`models/AdminAudit.js` stores `actor`, `actorName`, `action`, `entityType`,
`entityId`, `entityLabel`, `before`, `after`, `reason`, `meta`, `ip`,
`createdAt`. Mongoose `pre` hooks throw on `findOneAndUpdate`, `updateOne`,
`updateMany` and on re-saving an existing document, so entries are immutable.
Every status change, property review, booking note and role change writes one
entry through `recordAudit`.

## API surface (`/api/admin-console`, all behind `adminConsoleAuth`)

| Method & path | Permission | Purpose |
|---|---|---|
| `GET /me` | (any admin) | Identity + effective permissions (drives the nav). |
| `GET /overview` | dashboard.view | KPIs, period comparison, Needs Attention. |
| `GET /owners`, `/owners/:id` | owners.view | List + 360°. |
| `POST /owners/:id/status` | owners.manage | Suspend / restrict / activate. |
| `GET /properties`, `/properties/:id` | properties.view | Queue + detail (checks + impact). |
| `POST /properties/:id/review` | approve *or* suspend (per action) | Run a state transition. |
| `GET /bookings`, `/bookings/:id` | bookings.view | List (views) + detail. |
| `POST /bookings/:id/note` | bookings.note | Add an audited internal note. |
| `GET /customers`, `/customers/:id` | customers.view | List + 360°. |
| `POST /customers/:id/status` | customers.manage | Suspend / restrict / activate. |
| `GET /audit` | audit.view | Filterable audit trail. |
| `GET /team`, `POST /team/:id/role` | team.manage | List admins; set role + permissions. |
| `GET /search` | dashboard.view | Global search, permission-scoped. |

## Metrics: what's real vs. labelled

- **GMV** = sum of `totalPrice` on paid bookings (`paymentStatus: 'paid'`,
  `paymentMode ∈ {live, manual}`). This is actual money, from the booking
  records.
- **Estimated platform revenue** = GMV × 15 %. This is a *placeholder commission
  model* and is labelled "estimate" in the UI — the real commission engine is a
  deferred finance phase (below). No commission is stored or charged by this.
- All other KPIs (bookings, active properties, pending reviews, refund-reviews,
  unpaid bookings) are live counts/queries against the same collections.

## Built this phase vs. deferred

**Built & tested (this phase):** strict admin auth, granular RBAC, immutable
audit log, Control Center dashboard, property review state machine with
impact preview, owner & customer account actions, bookings oversight with notes,
admin team management, and global command search.

**Deferred (explicitly not built yet — no stubs pretending to work):**

- Finance ops: real commission configuration, payouts/settlements, reconciliation.
- Disputes & chargebacks.
- Risk / fraud scoring engine (the Risk *role* exists; the scoring engine does not).
- Reviews & content moderation, CMS / marketing.
- System health, integrations & webhooks, incident management.
- Scheduled / exported reports.
- Admin MFA.

**Left in the legacy admin app (unchanged):** owner onboarding / KYC approval
flow. The console links to it as **Classic admin tools**; it was not migrated or
altered.

## Tests

`backend/test/adminConsole.test.js` (node:test, against a real MongoDB replica
set) covers: strict auth rejection, `/me` permission shape, overview metrics,
RBAC enforcement (403 with the missing permission named), the property state
machine + audit + public-hiding, owner suspension locking login, owner
aggregates & 360°, customer actions + booking notes, audit immutability, team
RBAC with no self-demotion, and permission-scoped search.
