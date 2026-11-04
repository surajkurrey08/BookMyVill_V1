# Omniflow Web Chat

The customer website loads the Omniflow widget once from the shared App shell.
The BookMyVilla theme adapter preserves the vendor's visitor identity, message
handlers and polling. The old AI widget source and data remain intact, with its
website mount and launchers disabled. No chat-history or AI migration is performed.

## Configure from admin

1. Open **Admin Control Center > Plugins > Omniflow Web Chat**. Direct local
   link: `http://localhost:5174/console?section=plugins`. Classic admin tools
   also have a Plugins shortcut to the same screen.
2. Enter the Omniflow frontend base URL, backend base URL **without /api/v1**,
   and BookMyVilla channel **public widget key** starting with `wc_`.
3. Use **Test connection** to check the script and the keyed config endpoint.
4. Select **Enable website chat**, then **Save settings**.
5. Refresh a customer website page to use the saved settings. Future URL/key
   rotations and enable/disable changes need no code edit or frontend rebuild.

The form masks the public key by default, supports Show/Hide, and preserves
inputs on failed saves. Only `plugins.manage` administrators can read/write
settings; Super Admin has this permission by default. Other roles can receive
an explicit permission through Team & Access. Updates are recorded in Audit
Log without storing the key value in audit snapshots. Stale saves return 409
instead of overwriting another administrator's update.

The local demo uses frontend `http://localhost:3000` and backend
`http://localhost:8000`. Enter the already supplied public key in admin; it is
not hardcoded or seeded into the database. A fresh database starts disabled.
Production requires public HTTPS URLs. Never enter a login token, password,
private API key, HTML snippet or full widget script URL in these fields.

The former `VITE_OMNIFLOW_*` values, including any old local env files or GitHub
Variables, are no longer read. Database settings are authoritative. A disabled
or unavailable API never falls back to an old environment key.

## Storage and runtime behavior

- `SitePlugin` is a singleton MongoDB record for `omniflow`, owned by user-service.
- Admin: authenticated `GET/PUT /api/admin-console/plugins/omniflow`, requiring
  `plugins.manage`. Enabled state, URLs and public key are the only writable
  config fields; revision provides optimistic concurrency control.
- Website: unauthenticated `GET /api/site-plugins/omniflow`, routed through the
  existing gateway. Returns only the public widget config when enabled, or
  `enabled: false` when disabled. Admin IDs and tokens are never published.
- The frontend requests settings once per document with an 8-second timeout,
  `no-store` and no credentials, then installs one async vendor script. Shared
  request and DOM guards cover StrictMode and SPA navigation.
- Existing open chats keep their session until a full page refresh. No live
  script replacement is attempted because Omniflow exposes no teardown API for
  its polling timers. New/reloaded documents pick up the saved config.
- Config/API/script failure keeps the rest of the website usable. Refresh to
  retry a failed configuration/script request.
- Connection checks run in the admin browser, send no admin authorization to
  Omniflow, and never execute the widget in admin. The backend makes no requests
  to admin-entered URLs. Backend config checks need CORS permission for the
  admin origin. If that succeeds but script availability cannot be read because
  of CORS/network, the form shows a partial-verification warning rather than
  falsely rejecting the public key. A normal script embed may still work.
- A successful test proves the script was reachable and the public key's config
  endpoint returned JSON at that moment. It does not prove Inbox round-trip
  delivery or guarantee future availability/key validity.

## Presentation

`OmniflowChat.css` scopes styling to `bmv-chat-*` classes on vendor elements.
Forest, gold, cream, sage and body font map to the shared CSS variables; the
wordmark follows BrandLogo's Playfair Display and mountain motif. The adapter
preserves the vendor title node hidden beneath the branded subtitle. Panel
geometry accounts for narrow widths, dynamic viewport height and safe areas;
chat stacks above the shared header and below cookie/login dialogs.

## Verification

Automated checks cover authenticated persistence, forbidden writes, public-field
projection, key rotation, disabling, stale-save conflicts, audit redaction,
production URL validation, runtime config failures and loader deduplication.

- Backend: `node --test test/sitePlugins.test.js test/adminConsole.test.js test/microservices.test.js`
- Website: `npm test --prefix frontend` and `npm run build --prefix frontend`
- Admin: `npm run build --prefix admin`
- Targeted ESLint on new frontend/admin files; `git diff --check`.

Current results: 7 plugin backend tests plus 15 admin/gateway regression tests
passed; all 24 website tests passed. Admin and website production builds passed.
Targeted lint on the plugin form and runtime loader passed (the existing console
has three unchanged warnings). After restarting the local backend, the public
endpoint returned HTTP 200 with disabled settings and `Cache-Control: no-store`;
an unauthenticated admin settings request returned HTTP 401. No real channel
configuration has been saved automatically; enter it in admin to enable chat.
The supplied local Omniflow script returned HTTP 200 without CORS read headers;
its keyed config endpoint returned HTTP 200 with an allowed origin of `*`.
Admin therefore supports a backend-verified/script-unverified warning for this
working embed scenario instead of reporting an invalid key.

The previous full website lint had 16 pre-existing errors (confirmed against
the pulled baseline). The supplemental Python design audit could not run
because Python is not installed; DESIGN.md CLI lint was unavailable offline.

Still verify in a real browser: save/reload and key rotation in admin, error and
unsaved-change states, desktop/mobile panel layout, one launcher after SPA
navigation, script/backend outages, and visitor message > Omniflow Inbox >
agent reply > same website conversation. Earlier native browser access could
read an accessibility snapshot, but URL identification blocked subsequent
interaction; no successful automated visual/Inbox verification is claimed.
