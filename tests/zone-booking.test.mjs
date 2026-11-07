import assert from 'node:assert/strict';
import test from 'node:test';
import { validateZoneCover } from '../app/lib/zone-booking-validation.ts';
import { zoneServices, bookingStage, sastDate } from '../app/lib/zone-booking.ts';
import { ClientDatabase, client, otherClient, seedClient, seedBooking } from './fixtures/client-booking-db.mjs';
import { operateClientWorkspace, readClientWorkspace } from '../app/lib/booking-client.ts';

const now = Date.parse('2026-11-07T09:00:00+02:00');
const intent = { coverType: 'bolt', engagementModel: 'bolt', serviceCode: 'standard_unarmed', serviceType: 'Unarmed', startDate: '2026-11-07', shift: 'day', headcount: 2, contractMonths: 0, rosterPattern: 'daily' };
test('on-demand intent accepts a current shift without promising arrival and rejects an ended shift', () => {
  const value = validateZoneCover(intent, now);
  assert.equal(value.engagementModel, 'bolt'); assert.equal(value.startDate, value.endDate);
  assert.equal(value.shiftStart, '06:00'); assert.equal(value.shiftEnd, '18:00');
  assert.throws(() => validateZoneCover(intent, Date.parse('2026-11-07T18:01:00+02:00')), /future shift/);
  assert.equal(validateZoneCover({ ...intent, shift: 'night' }, Date.parse('2026-11-07T23:00:00+02:00')).shiftEnd, '06:00');
  assert.equal('eta' in value, false); assert.equal('price' in value, false);
});
test('Bolt uses the exact SAST notice window; weekly Flex keeps seven days of planned cover', () => {
 assert.equal(sastDate(new Date('2026-11-07T23:30:00Z')), '2026-11-08');
 assert.throws(()=>validateZoneCover({...intent,startDate:'2026-11-11'},now),/72 hours/);
 const value=validateZoneCover({...intent,coverType:'flex',engagementModel:'flex',durationWeeks:1,startDate:'2026-11-11'},now);
 assert.equal(value.engagementModel,'flex');assert.equal(value.endDate,'2026-11-17');
 assert.throws(()=>validateZoneCover({...intent,startDate:'2026-02-30'},now),/valid/);
});
test('six services retain their precise intent and reject service-category substitution', () => {
  for (const service of zoneServices) {
    assert.equal(validateZoneCover({ ...intent, serviceCode: service.code, serviceType: service.serviceType }, now).serviceLabel, service.label);
  }
  assert.throws(() => validateZoneCover({ ...intent, serviceCode: 'armed_movement' }, now), /service/);
});
test('Fixed validates all approved terms and roster patterns while rejecting forged model combinations', () => {
  for (const contractMonths of [3, 6, 12]) for (const rosterPattern of ['weekdays', 'monday_saturday', 'daily']) {
    const value = validateZoneCover({ ...intent, coverType: 'fixed', engagementModel: 'fixed', contractMonths, rosterPattern, startDate: '2026-12-01' }, now);
    assert.equal(value.contractMonths, contractMonths); assert.equal(value.rosterPattern, rosterPattern); assert.ok(value.endDate > value.startDate);
  }
  for (const patch of [{ engagementModel: 'fixed' }, { contractMonths: 6 }, { headcount: 1.2 }, { shift: 'afternoon' }]) assert.throws(() => validateZoneCover({ ...intent, ...patch }, now));
  assert.throws(() => validateZoneCover({ ...intent, coverType: 'fixed', engagementModel: 'fixed', contractMonths: 2, startDate:'2026-12-01' }, now), /three months/);
});
test('Zone requests persist their model and exact service, replay once and stay owner scoped', async () => {
  const db = new ClientDatabase();
  try {
    const saved = await operateClientWorkspace(db, client, { action: 'save_site', requestId: crypto.randomUUID(), name: 'Sandton offices', area: 'Sandton', address: 'Katherine Street, Sandton' });
    const body = { ...intent, startDate: sastDate(new Date(Date.now()+86400000)), action: 'request_cover', requestId: crypto.randomUUID(), siteId: saved.id, note: 'Visitor access and perimeter patrols.' };
    const first = await operateClientWorkspace(db, client, body), replay = await operateClientWorkspace(db, client, body);
    assert.equal(first.id, replay.id);
    const requests = (await readClientWorkspace(db, client)).requests;
    assert.equal(requests.length, 1); assert.equal(requests[0].detail.engagementModel, 'bolt'); assert.equal(requests[0].detail.serviceCode, 'standard_unarmed');
    assert.equal((await readClientWorkspace(db, otherClient)).requests.length, 0);
    await assert.rejects(() => operateClientWorkspace(db, client, { ...body, headcount: 3 }), /reference/);
  } finally { db.sql.close(); }
});
test('contract swaps create reviewed requests, preserve the roster and reject stale or unowned changes', async () => {
  const db = new ClientDatabase();
  try {
    seedClient(db); seedBooking(db); db.sql.prepare("UPDATE bookings SET engagement_model='fixed',contract_months=6,roster_pattern='daily' WHERE id='BOOKING-FIXTURE-A'").run();
    const contract = (await readClientWorkspace(db, client)).bookings[0];
    assert.equal(contract.engagementModel, 'fixed'); assert.equal(contract.contractMonths, 6);
    const body = { action: 'request_contract_change', id: contract.id, expectedVersion: contract.version, requestId: crypto.randomUUID(), changeKind: 'officer_swap', reason: 'Please discuss a change to the day roster.' };
    await assert.rejects(() => operateClientWorkspace(db, otherClient, body), /not found/);
    await assert.rejects(() => operateClientWorkspace(db, client, { ...body, expectedVersion: 99 }), /changed/);
    const result = await operateClientWorkspace(db, client, body);
    const row = db.sql.prepare('SELECT detail,category FROM service_requests WHERE id=?').get(result.id);
    assert.equal(row.category, 'booking_change'); assert.equal(JSON.parse(row.detail).changeKind, 'officer_swap');
    assert.equal(db.sql.prepare('SELECT status FROM bookings WHERE id=?').get(contract.id).status, 'draft');
    db.sql.prepare("UPDATE bookings SET engagement_model='flex' WHERE id=?").run(contract.id);
    await assert.rejects(() => operateClientWorkspace(db, client, { ...body, requestId: crypto.randomUUID() }), /ongoing contract/);
  } finally { db.sql.close(); }
});
test('matching labels never turn a partially staffed request into confirmed cover', () => {
  assert.equal(bookingStage('partially_staffed'), 'Finding your officers');
  assert.equal(bookingStage('confirmed'), 'Officers confirmed'); assert.equal(bookingStage('draft'), 'Booking under review');
});
