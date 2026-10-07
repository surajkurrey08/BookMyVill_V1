const repo = require('../repositories/notificationRepository');
const { EVENTS } = require('../../../../shared/contracts/events');

// Which notifications each domain event creates (owned by notification-service).
const PLAN = {
  [EVENTS.BOOKING_CONFIRMED]: [['guest', 'sms', 'Your villa booking is confirmed'], ['guest', 'email', 'Booking confirmation and stay details'], ['operations', 'in_app', 'New confirmed booking']],
  [EVENTS.BOOKING_CANCELLED]: [['guest', 'sms', 'Your booking was cancelled'], ['operations', 'in_app', 'Booking cancelled']],
  [EVENTS.BOOKING_CONFIRMATION_FAILED]: [['operations', 'in_app', 'Paid booking could not be confirmed — refund review needed']],
  [EVENTS.PAYMENT_SUCCESS]: [['guest', 'email', 'Payment received']],
  [EVENTS.PAYMENT_FAILED]: [['guest', 'sms', 'Payment could not be completed']],
  [EVENTS.VILLA_CREATED]: [['operations', 'in_app', 'New villa waiting for approval']]
};

async function handleEvent(message) {
  const plan = PLAN[message.event];
  if (!plan) return 0;
  const data = message.data || {};
  let created = 0;
  for (const [audience, channel, title] of plan) {
    if (await repo.recordOnce({ eventId: message.id, event: message.event, audience, channel, title, booking: data.bookingId || null, property: data.villaId || data.propertyId || null })) created++;
  }
  return created;
}

module.exports = { handleEvent, list: repo.page, PLAN };
