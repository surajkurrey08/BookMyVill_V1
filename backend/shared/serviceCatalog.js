// Single source of truth for the microservice split.
//
// Legacy-shared services list the routers they serve (`mounts`, backend/routes
// on the shared database). Independent services own their code under
// services/<name>/src (`app`), their public `paths` and their `database`. The API Gateway builds
// its routing table from the same data, and the legacy all-in-one server
// (index.js) mounts everything, so the three can never drift apart.
//
// Every existing public path (/api/auth, /api/properties, ...) keeps working
// unchanged through the gateway; /api/v1/<domain> aliases are the stable
// versioned entry points for new clients.
//
// `routes` entries are paths relative to backend/ and are only required by the
// process that serves them.

const SERVICES = {
  'auth-service': {
    port: 2101,
    purpose: 'Login, registration, mobile OTP, JWT, owner password setup',
    mounts: [['/api/auth', 'routes/auth'], ['/api/v1/auth', 'routes/auth']],
    seedsDefaultAccounts: true
  },
  'user-service': {
    port: 2102,
    purpose: 'Admin console, owners, customers, staff accounts, partner applications',
    mounts: [['/api/admin-console', 'routes/adminConsole'], ['/api/admin', 'routes/admin'], ['/api/partner', 'routes/partner'], ['/api/v1/users', 'routes/adminConsole'], ['/internal/users', 'routes/internal/users']]
  },
  'villa-service': {
    port: 2103,
    purpose: 'Villas, listings, data-entry onboarding, villa-manager and on-site operations',
    mounts: [
      ['/api/properties', 'routes/property'], ['/api/v1/villas', 'routes/property'],
      ['/api/villa-manager', 'routes/villaManager'], ['/api/owner-ops', 'routes/ownerOps'],
      ['/api/caretaker', 'routes/caretaker'], ['/api/caretaker-tasks', 'routes/caretakerTasks'],
      ['/api/guest-requirements', 'routes/guestRequirements'], ['/api/inventory', 'routes/inventory'],
      ['/api/tourist-register', 'routes/touristRegister'], ['/internal/villas', 'routes/internal/villas']
    ]
  },
  'booking-service': {
    port: 2104,
    purpose: 'Booking holds, checkout, confirmation, cancellations, guest stays, owner finance',
    mounts: [['/api/bookings', 'routes/booking'], ['/api/customer-booking', 'routes/customerBooking'], ['/api/stay', 'routes/customerStay'], ['/api/owner-finance', 'routes/ownerFinance'], ['/api/v1/bookings', 'routes/customerBooking'], ['/internal/bookings', 'routes/internal/bookings']],
    // payment.success -> confirm the booking (services/bookingConfirmation).
    consumers: ['services/bookingEvents']
  },
  'availability-service': {
    port: 2105,
    purpose: 'Rooms/units, calendars, date blocks and availability checks',
    mounts: [['/api/owner-pms', 'routes/ownerPms'], ['/api/v1/availability', 'routes/availabilityApi'], ['/internal/availability', 'routes/internal/availability']]
  },
  'pricing-service': {
    port: 2106,
    purpose: 'Quotations, pricing rules and the sales desk',
    mounts: [['/api/owner-quotes', 'routes/ownerQuotes'], ['/api/public/quotes', 'routes/publicQuotes'], ['/api/owner-crm', 'routes/ownerCrm'], ['/api/v1/pricing', 'routes/ownerQuotes'], ['/internal/pricing', 'routes/internal/pricing']]
  },
  'payment-service': {
    port: 2107,
    purpose: 'Payment orders, provider verification and payment records',
    // Independent: own code, models and database; publishes payment.success and
    // never writes booking data. Checkout verify paths are SPECIAL_ROUTES below.
    app: 'services/payment-service/src/app',
    // Own database: PAYMENT_MONGODB_URI / PAYMENT_DB_NAME (target bookmyvilla_payments).
    database: { key: 'PAYMENT', target: 'bookmyvilla_payments' },
    paths: ['/api/v1/payments']
  },
  'notification-service': {
    port: 2108,
    purpose: 'Consumes booking/payment events and records guest/owner notifications',
    // Independent: own code, models, database and event consumers.
    app: 'services/notification-service/src/app',
    // Own database: NOTIFICATION_MONGODB_URI / NOTIFICATION_DB_NAME (target bookmyvilla_notifications).
    database: { key: 'NOTIFICATION', target: 'bookmyvilla_notifications' },
    paths: ['/api/notifications', '/api/v1/notifications']
  },
  'search-service': {
    port: 2109,
    purpose: 'Public villa search with location, guests and date availability',
    // Independent: own derived index, synced from villa-service events.
    app: 'services/search-service/src/app',
    // Own database: SEARCH_MONGODB_URI / SEARCH_DB_NAME (target bookmyvilla_search).
    database: { key: 'SEARCH', target: 'bookmyvilla_search' },
    paths: ['/api/search', '/api/v1/search']
  },
  'review-service': {
    port: 2110,
    purpose: 'Guest ratings and reviews',
    // Independent: own code, models and database under services/review-service.
    app: 'services/review-service/src/app',
    // Own database: REVIEW_MONGODB_URI / REVIEW_DB_NAME (target bookmyvilla_reviews).
    database: { key: 'REVIEW', target: 'bookmyvilla_reviews' },
    paths: ['/api/feedback', '/api/v1/reviews']
  },
  'coupon-service': {
    port: 2111,
    purpose: 'Promotions, promo codes and add-ons',
    // Independent: own code, models (add-ons, promotions) and database.
    app: 'services/coupon-service/src/app',
    // Own database: COUPON_MONGODB_URI / COUPON_DB_NAME (target bookmyvilla_coupons).
    database: { key: 'COUPON', target: 'bookmyvilla_coupons' },
    paths: ['/api/owner-catalog', '/api/v1/coupons']
  },
  'media-service': {
    port: 2112,
    purpose: 'Property photos/videos and site hero images',
    mounts: [['/api/properties/media', 'routes/propertyMediaFiles'], ['/api/site-heroes', 'routes/siteHeroes'], ['/api/v1/media', 'routes/siteHeroes']]
  }
};

// Gateway rules more specific than a plain prefix. Checked before prefixes.
// Guest checkout verification lives under the booking prefixes but is served by payment-service.
const SPECIAL_ROUTES = [
  { method: 'POST', path: /^\/api\/customer-booking\/holds\/[^/]+\/verify\/?$/, service: 'payment-service' },
  { method: 'POST', path: /^\/api\/v1\/bookings\/holds\/[^/]+\/verify\/?$/, service: 'payment-service' }
];

// Paths the gateway may route to a service. /internal/* is never public.
const publicPaths = def => (def.paths || def.mounts.map(([mount]) => mount)).filter(mount => !mount.startsWith('/internal'));

// Longest prefix first, so /api/properties/media wins over /api/properties.
function prefixTable() {
  const rows = [];
  for (const [service, def] of Object.entries(SERVICES)) {
    for (const prefix of publicPaths(def)) {
      rows.push({ prefix, service });
    }
  }
  return rows.sort((a, b) => b.prefix.length - a.prefix.length);
}

function resolveService(method, pathname) {
  const special = SPECIAL_ROUTES.find(rule => rule.method === method && rule.path.test(pathname));
  if (special) return special.service;
  const row = prefixTable().find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}?`));
  return row ? row.service : null;
}

// Internal address of each service. Docker Compose and Kubernetes both use the
// service name as DNS host; override per service with <NAME>_URL
// (e.g. AUTH_SERVICE_URL=http://localhost:2101 for local runs).
function serviceUrl(service, env = process.env) {
  const key = `${service.replace(/-/g, '_').toUpperCase()}_URL`;
  return (env[key] || `http://${env.SERVICE_HOST || service}:${SERVICES[service].port}`).replace(/\/$/, '');
}

module.exports = { SERVICES, SPECIAL_ROUTES, prefixTable, resolveService, serviceUrl, publicPaths };
