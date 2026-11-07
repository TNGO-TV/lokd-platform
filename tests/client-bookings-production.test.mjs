import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from 'cloudflare:workers';
import { ClientDatabase, client, otherClient, seedClient, seedBooking, seedShift, seedTimesheet, seedRoster, clientRequest } from './fixtures/client-booking-db.mjs';
import { operateClientWorkspace, readClientWorkspace, validateCoverDetails, writeClientFeedback, readClientFeedback } from '../app/lib/booking-client.ts';
import { GET, POST } from '../app/api/client-bookings/route.ts';
import { POST as feedbackPost } from '../app/api/client-bookings/feedback/route.ts';

const registration = () => ({ action: 'register_account', requestId: crypto.randomUUID(), organisationName: 'Local fixture company', contactName: 'Local fixture contact', mobile: '0821234567', siteArea: 'Cape Town', siteType: 'commercial_property', message: 'Security cover for the main office building.', privacyConsent: true });
const siteInput = () => ({ action: 'save_site', requestId: crypto.randomUUID(), name: 'Main office', area: 'Cape Town', address: '12 Main Road, Cape Town' });
const coverInput = siteId => ({ action: 'request_cover', requestId: crypto.randomUUID(), siteId, coverType:'fixed', engagementModel:'fixed', serviceCode:'standard_unarmed', contractMonths:3, durationWeeks:0, shift:'day', rosterPattern:'daily', serviceType: 'Unarmed', startDate: '2090-01-01', endDate: '2090-01-02', shiftStart: '06:00', shiftEnd: '18:00', headcount: 2, note: 'Control entry at the main gate.' });
const count = (db, table) => db.sql.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;

test('registration links the signed-in account atomically and preserves consent, audit and email outbox on replay', async () => {
  const db = new ClientDatabase();
  try {
    const input = registration();
    await assert.rejects(() => operateClientWorkspace(db, client, { ...input, privacyConsent: false }), /privacy/);
    const before = count(db, 'clients');
    const saved = await operateClientWorkspace(db, client, input);
    const replay = await operateClientWorkspace(db, client, input);
    assert.equal(replay.id, saved.id);
    assert.equal(count(db, 'clients'), before, 'registration cannot approve an operational client');
    const records = (await readClientWorkspace(db, client)).enquiries;
    assert.equal(records.length, 1); assert.equal(records[0].accountLinked, true); assert.equal(records[0].status, 'awaiting_review');
    assert.equal(db.sql.prepare('SELECT count(*) AS n FROM audit_events WHERE entity_id=?').get(saved.id).n, 1);
    assert.equal(db.sql.prepare('SELECT count(*) AS n FROM client_notification_jobs WHERE source_id=?').get(saved.id).n, 2);
    assert.equal((await readClientWorkspace(db, { ...otherClient, email: client.email })).enquiries.length, 0, 'reusing an email does not transfer ownership');
    await assert.rejects(() => operateClientWorkspace(db, client, { ...input, organisationName: 'Changed' }), /already submitted/);
  } finally { db.sql.close(); }
});

test('sites and all service types are saved without invented coordinates and cannot be read or changed by another client', async () => {
  const db = new ClientDatabase();
  try {
    const input = siteInput(), site = await operateClientWorkspace(db, client, input);
    assert.equal((await operateClientWorkspace(db, client, input)).id, site.id);
    const workspace = await readClientWorkspace(db, client);
    assert.equal(workspace.sites[0].latitude, null); assert.equal(workspace.sites[0].longitude, null);
    assert.equal((await readClientWorkspace(db, otherClient)).sites.length, 0);
    for (const serviceType of ['Unarmed', 'Armed', 'VIP']) await operateClientWorkspace(db, client, { ...coverInput(site.id), serviceType,serviceCode:serviceType==='Armed'?'armed_static':serviceType==='VIP'?'vip_unarmed':'standard_unarmed' });
    assert.equal((await readClientWorkspace(db, client)).requests.length, 3);
    await assert.rejects(() => operateClientWorkspace(db, otherClient, coverInput(site.id)), /saved sites/);
    await assert.rejects(() => operateClientWorkspace(db, otherClient, { ...input, id: site.id, expectedVersion: 1 }), /not found/);
    await assert.rejects(() => operateClientWorkspace(db, client, { ...siteInput(), latitude: -26 }), /both/);
    assert.throws(() => validateCoverDetails({ ...coverInput(site.id), startDate: '2090-02-30' }, workspace.sites[0]), /valid/);
    assert.throws(() => validateCoverDetails({ ...coverInput(site.id), headcount: 1.5 }, workspace.sites[0]), /between/);
  } finally { db.sql.close(); }
});

test('stale and racing cover changes roll back audit and notifications instead of confirming a lost write', async () => {
  const db = new ClientDatabase();
  try {
    const site = await operateClientWorkspace(db, client, siteInput()), cover = await operateClientWorkspace(db, client, coverInput(site.id));
    const beforeAudit = count(db, 'audit_events'), beforeEmail = count(db, 'client_notification_jobs');
    db.beforeBatch = () => db.sql.prepare('UPDATE service_requests SET version=version+1 WHERE id=?').run(cover.id);
    await assert.rejects(() => operateClientWorkspace(db, client, { action: 'cancel_request', id: cover.id, expectedVersion: 1, reason: 'Dates changed.' }), /client_request_changed/);
    assert.equal(count(db, 'audit_events'), beforeAudit); assert.equal(count(db, 'client_notification_jobs'), beforeEmail);
    assert.equal(db.sql.prepare('SELECT status FROM service_requests WHERE id=?').get(cover.id).status, 'open');
    await assert.rejects(() => operateClientWorkspace(db, client, { action: 'cancel_request', id: cover.id, expectedVersion: 1, reason: 'Dates changed.' }), /changed/);
    await operateClientWorkspace(db, client, { action: 'cancel_request', id: cover.id, expectedVersion: 2, reason: 'Dates changed.' });
    assert.equal(db.sql.prepare('SELECT status FROM service_requests WHERE id=?').get(cover.id).status, 'cancelled');
  } finally { db.sql.close(); }
});

test('only an unallocated unpaid draft can be cancelled immediately; an agreed booking records a request', async () => {
  const db = new ClientDatabase();
  try {
    seedClient(db); seedBooking(db);
    let booking = (await readClientWorkspace(db, client)).bookings[0]; assert.equal(booking.canCancel, true);
    await assert.rejects(() => operateClientWorkspace(db, otherClient, { action: 'cancel_booking', id: booking.id, expectedVersion: booking.version, reason: 'Not mine.' }), /not found/);
    await operateClientWorkspace(db, client, { action: 'cancel_booking', id: booking.id, expectedVersion: booking.version, reason: 'Dates changed.' });
    booking = (await readClientWorkspace(db, client)).bookings[0]; assert.equal(booking.status, 'cancelled'); assert.equal(booking.version, 2);
    seedBooking(db, 'CLIENT-FIXTURE-A', 'BOOKING-FIXTURE-ALLOCATED'); seedShift(db, 'BOOKING-FIXTURE-ALLOCATED', 'SHIFT-FIXTURE-ALLOCATED', 'confirmed');
    booking = (await readClientWorkspace(db, client)).bookings.find(b => b.id === 'BOOKING-FIXTURE-ALLOCATED'); assert.equal(booking.canCancel, false);
    await assert.rejects(() => operateClientWorkspace(db, client, { action: 'cancel_booking', id: booking.id, expectedVersion: booking.version, reason: 'Dates changed.' }), /Operations/);
    const change = await operateClientWorkspace(db, client, { action: 'request_cancellation', requestId: crypto.randomUUID(), id: booking.id, expectedVersion: booking.version, reason: 'Please confirm cancellation terms.' });
    assert.equal(db.sql.prepare('SELECT status FROM bookings WHERE id=?').get(booking.id).status, 'draft');
    assert.equal(db.sql.prepare('SELECT category FROM service_requests WHERE id=?').get(change.id).category, 'booking_cancellation');
  } finally { db.sql.close(); }
});

test('completed shift ratings are owner scoped and unique, while service issues reach the Operations queue', async () => {
  const db = new ClientDatabase();
  try {
    seedClient(db); seedBooking(db); seedShift(db);
    const body = { action: 'rate_shift', requestId: crypto.randomUUID(), shiftId: 'SHIFT-FIXTURE-A', score: 4, note: 'Service was on time.' };
    await assert.rejects(() => writeClientFeedback(db, otherClient, body), /not found/);
    await assert.rejects(() => writeClientFeedback(db, client, { ...body, score: 2.5 }), /1 to 5/);
    await writeClientFeedback(db, client, body);
    await writeClientFeedback(db, client, body);
    seedShift(db, 'BOOKING-FIXTURE-A', 'SHIFT-FIXTURE-SECOND');
    await assert.rejects(() => writeClientFeedback(db, client, { ...body, shiftId: 'SHIFT-FIXTURE-SECOND' }), /reference is already in use/);
    assert.equal(db.sql.prepare("SELECT count(*) AS n FROM service_requests WHERE shift_id='SHIFT-FIXTURE-SECOND'").get().n, 0);
    await assert.rejects(() => writeClientFeedback(db, client, { ...body, requestId: crypto.randomUUID() }), /UNIQUE/);
    await writeClientFeedback(db, client, { ...body, action: 'raise_issue', requestId: crypto.randomUUID(), note: 'Please review the arrival time.' });
    const queue = await readClientFeedback(db, { ...otherClient, operations: true });
    assert.equal(queue.feedback.length, 2); assert.equal(queue.feedback.find(r => r.category === 'service_issue').priority, 'high');
    assert.equal((await readClientFeedback(db, otherClient)).feedback.length, 0);
    assert.equal((await readClientWorkspace(db, client)).shifts.find(s => s.id === body.shiftId).feedbackScore, 4);
    const before = count(db, 'audit_events');
    seedShift(db, 'BOOKING-FIXTURE-A', 'SHIFT-FIXTURE-FUTURE', 'confirmed');
    await assert.rejects(() => writeClientFeedback(db, client, { ...body, requestId: crypto.randomUUID(), shiftId: 'SHIFT-FIXTURE-FUTURE' }), /completed/);
    assert.equal(count(db, 'audit_events'), before);
  } finally { db.sql.close(); }
});

test('client APIs require verified identity and same-origin JSON, persist writes and expose missing email configuration', async () => {
  const db = new ClientDatabase(); env.DB = db;
  try {
    assert.equal((await GET(clientRequest('/api/client-bookings', null))).status, 401);
    const cross = clientRequest('/api/client-bookings', client, registration()); cross.headers.set('origin', 'https://elsewhere.example');
    assert.equal((await POST(cross)).status, 403);
    const response = await POST(clientRequest('/api/client-bookings', client, registration())); const body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.ok, true); assert.equal(body.enquiries.length, 1);
    assert.equal(body.emailDelivery.blocked, 2); assert.match(body.emailDelivery.errors.join(' '), /not configured/);
    assert.equal(body.notifications.length, 2);
    const malformed = new Request('https://portal.lokd.co.za/api/client-bookings/feedback', { method: 'POST', headers: clientRequest('/api/client-bookings').headers, body: '{' });
    assert.equal((await feedbackPost(malformed)).status, 400);
  } finally { db.sql.close(); delete env.DB; }
});

test('completed service confirmation updates the real timesheet and shift once with an immutable event and notifications', async () => {
  const db = new ClientDatabase();
  try {
    seedClient(db); seedBooking(db); seedShift(db); seedTimesheet(db);
    const input = { action: 'confirm_service', shiftId: 'SHIFT-FIXTURE-A', expectedVersion: 1, note: 'The recorded service was completed.' };
    await assert.rejects(() => operateClientWorkspace(db, otherClient, input), /not found/);
    const result = await operateClientWorkspace(db, client, input);
    assert.equal(result.notificationIds.length, 2);
    assert.equal(db.sql.prepare('SELECT client_evidence_status FROM shift_timesheets WHERE shift_id=?').get(input.shiftId).client_evidence_status, 'confirmed');
    assert.equal(db.sql.prepare('SELECT status,client_signoff_status FROM shifts WHERE id=?').get(input.shiftId).status, 'verified');
    assert.equal(db.sql.prepare('SELECT count(*) AS n FROM production_service_events WHERE shift_id=?').get(input.shiftId).n, 1);
    await assert.rejects(() => operateClientWorkspace(db, client, input), /changed/);
    assert.equal(db.sql.prepare('SELECT count(*) AS n FROM production_service_events WHERE shift_id=?').get(input.shiftId).n, 1);
  } finally { db.sql.close(); }
});

test('a concurrent completed-service decision aborts all notices and the losing decision', async () => {
  const db = new ClientDatabase();
  try {
    seedClient(db); seedBooking(db); seedShift(db); seedTimesheet(db);
    const before = count(db, 'client_notification_jobs');
    db.beforeBatch = () => db.sql.prepare("UPDATE shift_timesheets SET client_evidence_status='confirmed',version=version+1 WHERE shift_id='SHIFT-FIXTURE-A'").run();
    await assert.rejects(() => operateClientWorkspace(db, client, { action: 'dispute_service', shiftId: 'SHIFT-FIXTURE-A', expectedVersion: 1, note: 'The arrival time needs review.' }), /changed/);
    assert.equal(count(db, 'production_service_events'), 0); assert.equal(count(db, 'client_notification_jobs'), before);
  } finally { db.sql.close(); }
});

test('booking display follows actual staffing and completed shifts across the whole planned roster', async () => {
  const db = new ClientDatabase();
  try {
    seedClient(db); seedBooking(db); seedShift(db, 'BOOKING-FIXTURE-A', 'SHIFT-FIXTURE-A', 'confirmed');
    db.sql.prepare("UPDATE bookings SET status='matching',shift_count=2 WHERE id='BOOKING-FIXTURE-A'").run();
    seedRoster(db);
    const booking = async () => (await readClientWorkspace(db, client)).bookings[0];
    assert.equal((await booking()).displayStatus, 'partially_staffed');
    seedShift(db, 'BOOKING-FIXTURE-A', 'SHIFT-FIXTURE-B', 'confirmed');
    seedRoster(db, { shiftId: 'SHIFT-FIXTURE-B', slotId: 'SLOT-FIXTURE-B', position: 2 });
    assert.equal((await booking()).displayStatus, 'confirmed');
    db.sql.prepare("UPDATE shifts SET status='completed' WHERE id='SHIFT-FIXTURE-A'").run();
    assert.equal((await booking()).displayStatus, 'confirmed', 'one completed shift cannot complete the entire booking');
    db.sql.prepare("UPDATE shifts SET status='completed' WHERE id='SHIFT-FIXTURE-B'").run();
    assert.equal((await booking()).displayStatus, 'completed');
    assert.equal((await booking()).status, 'matching', 'display projection must not rewrite source state');
    const change = { action: 'change_booking', id: 'BOOKING-FIXTURE-A', expectedVersion: (await booking()).version, requestId: crypto.randomUUID(), reason: 'Change the completed booking.' };
    await assert.rejects(() => operateClientWorkspace(db, client, change), /closed/);
    db.sql.prepare("UPDATE shifts SET status='confirmed' WHERE id='SHIFT-FIXTURE-B'").run();
    const priorAudit = count(db, 'audit_events'), priorEmail = count(db, 'client_notification_jobs');
    db.beforeBatch = () => db.sql.prepare("UPDATE shifts SET status='completed' WHERE id='SHIFT-FIXTURE-B'").run();
    await assert.rejects(() => operateClientWorkspace(db, client, change), /client_booking_already_closed/);
    assert.equal(count(db, 'audit_events'), priorAudit); assert.equal(count(db, 'client_notification_jobs'), priorEmail);
    db.sql.prepare("UPDATE roster_assignments SET status='replaced',active_key=NULL WHERE id='ASSIGNMENT-SLOT-FIXTURE-B'").run();
    assert.equal((await booking()).displayStatus, 'partially_staffed', 'a historical completed assignment cannot complete the current roster');
    db.sql.prepare("UPDATE roster_assignments SET status='confirmed',active_key=roster_slot_id WHERE id='ASSIGNMENT-SLOT-FIXTURE-B'").run();
    db.sql.prepare("UPDATE bookings SET shift_count=3 WHERE id='BOOKING-FIXTURE-A'").run();
    assert.equal((await booking()).displayStatus, 'partially_staffed', 'unprepared planned shifts must prevent completion');
    assert.equal(count(db, 'client_notification_jobs'), 0, 'assignment without completed activation cannot send confirmation');
  } finally { db.sql.close(); }
});
