// Stable domain event contracts shared by producers and consumers.
// Envelope (added by messaging.publish): { id, event, version, occurredAt, requestId, data }.
// Bump `version` only for breaking payload changes; consumers must ignore
// unknown fields. Payloads carry IDs and facts only — never credentials,
// tokens, card data or full documents.

const EXCHANGE = 'bookmyvilla.events';

const CONTRACTS = Object.freeze({
  'booking.created': { version: 1, fields: ['bookingId', 'villaId', 'userId', 'checkIn', 'checkOut', 'total'] },
  'booking.confirmed': { version: 1, fields: ['bookingId', 'villaId', 'userId', 'paymentId', 'amount', 'paymentPlan'], optional: ['promotion'] },
  'booking.confirmation_failed': { version: 1, fields: ['bookingId', 'paymentId', 'reason'] },
  'booking.cancelled': { version: 1, fields: ['bookingId', 'villaId'] },
  'payment.success': { version: 1, fields: ['paymentId', 'orderId', 'bookingId', 'holdId', 'amount', 'currency'] },
  'payment.failed': { version: 1, fields: ['orderId', 'bookingId', 'reason'] },
  'payment.refunded': { version: 1, fields: ['paymentId', 'bookingId', 'amount'] },
  'villa.created': { version: 1, fields: ['villaId'] },
  'villa.updated': { version: 1, fields: ['villaId'] },
  'villa.deleted': { version: 1, fields: ['villaId'] },
  'availability.changed': { version: 1, fields: ['villaId'] }
});

const names = Object.keys(CONTRACTS);
const EVENTS = Object.freeze({
  EXCHANGE,
  BOOKING_CREATED: 'booking.created',
  BOOKING_CONFIRMED: 'booking.confirmed',
  BOOKING_CONFIRMATION_FAILED: 'booking.confirmation_failed',
  BOOKING_CANCELLED: 'booking.cancelled',
  PAYMENT_SUCCESS: 'payment.success',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',
  VILLA_CREATED: 'villa.created',
  VILLA_UPDATED: 'villa.updated',
  VILLA_DELETED: 'villa.deleted',
  AVAILABILITY_CHANGED: 'availability.changed'
});

module.exports = { EVENTS, CONTRACTS, names, versionOf: event => CONTRACTS[event]?.version || 1 };
