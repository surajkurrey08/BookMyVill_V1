# Property management (Phase 1)

Ownership stays in `Property.owner`. `managementMode` is `SELF_MANAGED` or
`BOOKMYVILLA_MANAGED`; missing legacy values behave as `SELF_MANAGED` without
a database migration. Nullable assignments reference the existing User model.
Its existing roles remain; `villa_manager` and `data_entry` are internal roles.
Public registration cannot create either role. Existing login handles them.

## Admin control

`PATCH /api/admin-console/properties/:id/management` requires a verified admin
with `properties.manage` (Super Admin or Operations, or an explicit grant).
Send any combination of these fields; omitted fields remain unchanged:

```json
{
  "managementMode": "BOOKMYVILLA_MANAGED",
  "assignedVillaManager": "<villa_manager User ID>",
  "assignedDataEntryUser": "<data_entry User ID>"
}
```

Assignment IDs must belong to active/approved accounts of the matching role.
Send `null` to remove an assignment. Switching to `SELF_MANAGED` clears the
Villa Manager assignment. A non-null manager assignment on self-managed
properties is rejected. Ownership, rooms and bookings remain unchanged.
Changes use an optimistic guard and the existing immutable AdminAudit log:
`property.management_change`, actor, property, before/after values and timestamp.
No-op requests do not add duplicate audit entries.

## Access and responses

`services/propertyAccess.js` centralizes predicates, scopes and resource checks.
Owners operate only their own self-managed villas; they retain ownership-based
reporting reads for company-managed villas. Assigned Villa Managers can use
the existing property update, booking status, PMS and guest-operation APIs for
company-managed properties. Managers cannot import owner listings or delete
properties. Revocation/mode changes take effect on subsequent requests.

Assigned Data Entry users use existing `GET /api/properties/my-properties`,
`GET /api/properties/:id` and `PUT /api/properties/:id`. Their responses and
updates are limited to listing content: name, type, location, mapLink,
amenities, facilities, photos and videos. Rates, guest stay details, ownership,
statuses, management assignments and operational/financial/admin APIs are
unavailable. Public property responses omit internal assignment references.

Admin property lists, scoped property lists and PMS property lists accept
`managementMode`, `assignedVillaManager` and `assignedDataEntryUser` query
filters. Filters always intersect the authenticated account's allowed scope;
SELF_MANAGED also matches legacy documents missing the field.

Existing owner finance, CRM, quotation and catalog mutations check property
management too. Global owner catalog entries affect the whole portfolio, so
an owner with company-managed villas must use explicit self-managed selections
for new entries; they cannot change global entries affecting managed villas.
Customer booking/payment processing and historical quotes remain intact.

Legacy auth now delegates to the existing verified account authentication.
Expired/forged JWTs, JWT role spoofing, raw IDs and anonymous fallback identities
do not grant access. New staff roles cannot use unscoped legacy endpoints.

## Files changed in Phase 1

All paths below are relative to `backend/`:

- Models: `models/Property.js`, `models/User.js`, `models/GuestRequest.js`.
- Middleware: `middleware/accountAuth.js`, `middleware/auth.js`,
  `middleware/propertyOperatorAuth.js`.
- Services: `services/propertyAccess.js`, `services/adminActions.js`,
  `services/adminRbac.js`, `services/crm.js`, `services/quotes.js`.
- Routes: `routes/property.js`, `routes/adminConsole.js`, `routes/admin.js`,
  `routes/booking.js`, `routes/ownerPms.js`, `routes/ownerOps.js`,
  `routes/ownerFinance.js`, `routes/ownerCrm.js`, `routes/ownerQuotes.js`,
  `services/coupon-service/src` (offers & add-ons).
- Tests: `test/helpers.js`, `test/management.test.js`.
- Documentation: `docs/property-management.md`.
