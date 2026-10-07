// notification-service: records the notifications an event needs, once per
// event, in its own database (no SMS/email is sent — that is not implemented).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('../../../test/helpers');

before(() => h.start());
after(() => h.stop());

test('each event is recorded once even when redelivered', async () => {
  const NotificationLog = require('../src/models/NotificationLog');
  assert.equal(NotificationLog.db.name.endsWith('_notification'), true, 'notification-service uses its own database in tests');
  const { handleEvent } = require('../src/services/notificationService');
  const message = { id: 'evt-1', event: 'booking.confirmed', data: {} };
  await handleEvent(message);
  await handleEvent(message); // redelivery
  assert.equal(await NotificationLog.countDocuments({ eventId: 'evt-1' }), 3, 'guest sms + guest email + operations');
});

test('events published on the bus reach the consumer', async () => {
  const NotificationLog = require('../src/models/NotificationLog');
  const bus = require('../../../messaging');
  const { Types } = require('mongoose');
  await bus.publish(bus.events.BOOKING_CANCELLED, { bookingId: String(new Types.ObjectId()), villaId: String(new Types.ObjectId()) });
  const end = Date.now() + 3000;
  while (Date.now() < end && !(await NotificationLog.exists({ event: 'booking.cancelled' }))) await new Promise(r => setTimeout(r, 50));
  assert.ok(await NotificationLog.exists({ event: 'booking.cancelled' }));
});
