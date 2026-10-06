# Owner, villa and local-guide workflow

Claude's pasted work log stopped after wiring the Data Entry Owners & Villas and Local Guides pages and starting its build. The existing backend included onboarding APIs, local-guide pricing and assignment APIs, a whole-villa migration and initial integration tests.

The continuation connects guest guide selection and pricing, confirmation and Trip contact details, Villa Manager assignment from Bookings and Owners, and Admin setup links after self-managed villa approval. Admin operations can also assign guides to self-managed bookings, since Villa Managers cannot operate those properties. Admin has a Guide requests booking view. Guest checkout shows a checkbox, daily rate and number of days, without a guide directory or profiles.

New Data Entry and owner listings automatically get one Entire villa unit. Guest booking no longer has a room-selection page; old room URLs preserve date/guest parameters and redirect to the villa page. Owners and Data Entry cannot add rooms. Historical room records remain available to internal operations and existing bookings. Public availability excludes inactive historical rooms. Unconverted properties with multiple active rooms cannot accept new customer holds until migration.

Guide charges are included in both the total and the 30% advance. Once a payment order is created, its guide choice and payment schedule remain fixed when checkout resumes. An active guide and area rate are required before checkout offers the option. Assigned contacts are returned only to the guest who owns the confirmed booking.

## Owner setup links

Approve the self-managed villa in Admin → Properties, then open its details and use **Create owner setup link**. Copy and share the link with the owner. It expires after 24 hours and works once. Automatic email delivery is not configured; the UI creates a link for manual sharing. BookMyVilla-managed owners do not have Owner Portal login.

The deployment's existing `VITE_OWNER_APP_URL` points to the guest site's `/owner-setup` page. The owner app also serves `/owner-setup`; the Admin development fallback uses port 5175. Both consume the same one-time backend token.

## Migration rollout

From `backend`, run:

```powershell
node scripts/migrate-entire-villa.js
```

This is read-only, including collection/index auto-creation being disabled. It lists the properties, guest capacities, nightly rates and future nights affected. Rate is the highest active-room/property rate. Capacity is the combined active-room capacity or property capacity. Apply refuses properties above the current 50-guest limit instead of silently truncating their capacity; review those properties separately.

The attempted live dry-run in this continuation failed with MongoDB SRV DNS `ETIMEOUT`. No live migration was applied. Re-run after database DNS/network access is working, review the actual report with the user, and obtain the approval required by the original plan before using `--apply`.

Before apply, back up MongoDB and pause booking, payment, quote, block and room-edit writes. Let current payment/quotation holds finish or expire. Then:

```powershell
node scripts/migrate-entire-villa.js --apply
```

Old rooms and bookings are retained. Future reservations/blocks are carried to the new unit. Availability and inventory also consult the legacy room ledger so overlapping historical reservations stay blocked after one is cancelled. A failed property migration removes its partial new unit and restores the legacy rooms for a retry. Already converted properties are skipped.

## Verification

Backend integration tests cover owner approval/setup, onboarding, guide privacy, full and advance pricing, frozen payment choices, manager/admin permissions, guide assignment, guest Trip contacts, overlapping legacy bookings/blocks and migration failure recovery. Frontend, Data Entry, Villa Manager, Admin and Owner production builds are checked.

The connected browser surface was unavailable in this session, so desktop/mobile visual verification remains to be performed in a browser.
