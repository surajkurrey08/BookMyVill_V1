const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, api, createOwner, createProperty, day } = require('./helpers');

let owner;
let token;
let otherToken;
let property;

test.before(async () => {
  await start();
  ({ user: owner, token } = await createOwner('crm'));
  ({ token: otherToken } = await createOwner('rival'));
  ({ property } = await createProperty(owner));
});
test.after(stop);

const lead = (overrides = {}) => ({ guestName: 'Rahul Mehta', guestPhone: '+91 98765 43210', source: 'whatsapp', propertyId: String(property._id), checkIn: day(20), checkOut: day(22), adults: 2, children: 1, budgetMax: 40000, message: 'Need a villa with pool for anniversary', ...overrides });

test('requires auth and validates input', async () => {
  assert.equal((await api('GET', '/api/owner-crm/inquiries')).status, 401);
  const missingContact = await api('POST', '/api/owner-crm/inquiries', { token, body: lead({ guestPhone: '' }) });
  assert.equal(missingContact.status, 400);
  assert.match(missingContact.data.msg, /phone number or email/);
  const badDates = await api('POST', '/api/owner-crm/inquiries', { token, body: lead({ checkIn: day(5), checkOut: day(4) }) });
  assert.equal(badDates.status, 400);
  const badSource = await api('POST', '/api/owner-crm/inquiries', { token, body: lead({ source: 'pigeon' }) });
  assert.equal(badSource.status, 400);
});

test('creates, detects duplicate open inquiries by phone, and scopes to the owner', async () => {
  const created = await api('POST', '/api/owner-crm/inquiries', { token, body: lead() });
  assert.equal(created.status, 201);
  assert.match(created.data.code, /^INQ-[2-9A-Z]{6}$/);
  assert.equal(created.data.guestPhoneKey, '9876543210');
  assert.equal(created.data.status, 'new');

  const duplicate = await api('POST', '/api/owner-crm/inquiries', { token, body: lead({ guestPhone: '09876543210' }) });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.data.duplicateOf.code, created.data.code);
  const forced = await api('POST', '/api/owner-crm/inquiries', { token, body: lead({ guestPhone: '9876543210', allowDuplicate: true }) });
  assert.equal(forced.status, 201);

  assert.equal((await api('GET', `/api/owner-crm/inquiries/${created.data._id}`, { token: otherToken })).status, 404);
  assert.equal((await api('PATCH', `/api/owner-crm/inquiries/${created.data._id}`, { token: otherToken, body: { priority: 'high' } })).status, 404);
  const rivalList = await api('GET', '/api/owner-crm/inquiries?view=all', { token: otherToken });
  assert.equal(rivalList.data.total, 0);
  // Another owner cannot attach a lead to this owner's property.
  assert.equal((await api('POST', '/api/owner-crm/inquiries', { token: otherToken, body: lead({ guestPhone: '9111111111' }) })).status, 404);
});

test('lists with search, filters and pagination', async () => {
  await api('POST', '/api/owner-crm/inquiries', { token, body: lead({ guestName: 'Priya Nair', guestPhone: '9123456780', source: 'instagram', priority: 'high' }) });
  const byPhone = await api('GET', '/api/owner-crm/inquiries?q=345678', { token });
  assert.equal(byPhone.data.total, 1);
  assert.equal(byPhone.data.items[0].guestName, 'Priya Nair');
  const bySource = await api('GET', '/api/owner-crm/inquiries?source=instagram', { token });
  assert.equal(bySource.data.total, 1);
  const paged = await api('GET', '/api/owner-crm/inquiries?limit=1&page=2', { token });
  assert.equal(paged.data.items.length, 1);
  assert.equal(paged.data.pages, paged.data.total);
  assert.equal(paged.data.statusCounts.new, 3);
});

test('status pipeline: lost needs a reason, cancels follow-ups, reopen clears it', async () => {
  const { data: inquiry } = await api('POST', '/api/owner-crm/inquiries', { token, body: lead({ guestName: 'Arjun Rao', guestPhone: '9000000001' }) });
  const due = new Date(Date.now() + 3600000).toISOString();
  const followUp = await api('POST', `/api/owner-crm/inquiries/${inquiry._id}/follow-ups`, { token, body: { dueAt: due, channel: 'call', note: 'Share villa photos' } });
  assert.equal(followUp.status, 201);
  let detail = await api('GET', `/api/owner-crm/inquiries/${inquiry._id}`, { token });
  assert.equal(new Date(detail.data.inquiry.nextFollowUpAt).toISOString(), due);

  const contacted = await api('POST', `/api/owner-crm/inquiries/${inquiry._id}/status`, { token, body: { status: 'contacted' } });
  assert.equal(contacted.data.status, 'contacted');
  assert.ok(contacted.data.firstResponseAt);
  assert.equal((await api('POST', `/api/owner-crm/inquiries/${inquiry._id}/status`, { token, body: { status: 'lost' } })).status, 400);
  const lost = await api('POST', `/api/owner-crm/inquiries/${inquiry._id}/status`, { token, body: { status: 'lost', lostReason: 'price', lostNote: 'Budget was 20k' } });
  assert.equal(lost.data.status, 'lost');
  assert.equal(lost.data.nextFollowUpAt, null);
  detail = await api('GET', `/api/owner-crm/inquiries/${inquiry._id}`, { token });
  assert.equal(detail.data.followUps[0].status, 'cancelled');
  assert.equal((await api('POST', `/api/owner-crm/inquiries/${inquiry._id}/follow-ups`, { token, body: { dueAt: due } })).status, 409);

  const reopened = await api('POST', `/api/owner-crm/inquiries/${inquiry._id}/status`, { token, body: { status: 'follow_up' } });
  assert.equal(reopened.data.lostReason, null);
  assert.equal(reopened.data.furthestStage, 3);
  const types = detail.data.activities.map(item => item.type);
  assert.ok(types.includes('status_change') && types.includes('follow_up') && types.includes('created'));
});

test('follow-ups: complete and chain the next one, views and counts', async () => {
  const { data: inquiry } = await api('POST', '/api/owner-crm/inquiries', { token, body: lead({ guestName: 'Meera Iyer', guestPhone: '9000000002' }) });
  const overdueAt = new Date(Date.now() - 2 * 3600000).toISOString();
  const { data: overdue } = await api('POST', `/api/owner-crm/inquiries/${inquiry._id}/follow-ups`, { token, body: { dueAt: overdueAt, channel: 'whatsapp' } });
  const list = await api('GET', '/api/owner-crm/follow-ups?view=overdue', { token });
  assert.ok(list.data.items.some(item => item._id === overdue._id));
  assert.ok(list.data.counts.overdue >= 1);
  const nextDue = new Date(Date.now() + 2 * 86400000).toISOString();
  const done = await api('PATCH', `/api/owner-crm/follow-ups/${overdue._id}`, { token, body: { action: 'complete', outcome: 'Guest wants Diwali dates', nextDueAt: nextDue } });
  assert.equal(done.status, 200);
  assert.equal(done.data.followUp.status, 'done');
  assert.ok(done.data.next);
  assert.equal((await api('PATCH', `/api/owner-crm/follow-ups/${overdue._id}`, { token, body: { action: 'complete' } })).status, 409);
  const detail = await api('GET', `/api/owner-crm/inquiries/${inquiry._id}`, { token });
  assert.equal(new Date(detail.data.inquiry.nextFollowUpAt).toISOString(), nextDue);
  assert.equal((await api('PATCH', `/api/owner-crm/follow-ups/${overdue._id}`, { token: otherToken, body: { action: 'cancel' } })).status, 404);
});

test('manual conversation log and optimistic concurrency on edits', async () => {
  const { data: inquiry } = await api('POST', '/api/owner-crm/inquiries', { token, body: lead({ guestName: 'Kabir Shah', guestPhone: '9000000003' }) });
  const call = await api('POST', `/api/owner-crm/inquiries/${inquiry._id}/activities`, { token, body: { type: 'call', direction: 'outbound', body: 'Explained pool timings' } });
  assert.equal(call.status, 201);
  assert.equal((await api('POST', `/api/owner-crm/inquiries/${inquiry._id}/activities`, { token, body: { type: 'status_change', direction: 'outbound', body: 'x' } })).status, 400);
  const first = await api('PATCH', `/api/owner-crm/inquiries/${inquiry._id}`, { token, body: { priority: 'high', expectedRevision: inquiry.revision } });
  assert.equal(first.status, 200);
  const stale = await api('PATCH', `/api/owner-crm/inquiries/${inquiry._id}`, { token, body: { priority: 'low', expectedRevision: inquiry.revision } });
  assert.equal(stale.status, 409);
  const detail = await api('GET', `/api/owner-crm/inquiries/${inquiry._id}`, { token });
  assert.ok(detail.data.inquiry.firstResponseAt, 'outbound call counts as first response');
});

test('summary reports pipeline, funnel and sources', async () => {
  const { data: gone } = await api('POST', '/api/owner-crm/inquiries', { token, body: lead({ guestName: 'Lost Lead', guestPhone: '9000000009' }) });
  await api('POST', `/api/owner-crm/inquiries/${gone._id}/status`, { token, body: { status: 'lost', lostReason: 'price' } });
  const summary = await api('GET', '/api/owner-crm/summary?days=30', { token });
  assert.equal(summary.status, 200);
  assert.ok(summary.data.funnel.total >= 6);
  assert.ok(summary.data.funnel.contacted >= 1);
  assert.ok(summary.data.sources.some(row => row.source === 'whatsapp'));
  assert.ok(summary.data.lostReasons.some(row => row.reason === 'price'));
  assert.ok(summary.data.followUps.dueToday + summary.data.followUps.overdue >= 0);
  const csv = await api('GET', '/api/owner-crm/inquiries/export.csv?view=all', { token });
  assert.equal(csv.status, 200);
  assert.match(csv.data, /"Reference","Created","Guest"/);
  assert.match(csv.data, /"'\+91 98765 43210"/, "phone cells starting with + are neutralised for spreadsheets");
});
