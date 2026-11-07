import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from 'cloudflare:workers';
import { ClientDatabase, seedClient, seedBooking, seedRoster, client } from './fixtures/client-booking-db.mjs';
import { readZoneOperations } from '../app/lib/zone-operations.ts';
import { rankDispatchRequests, dispatchCandidates } from '../app/lib/zone-dispatch.ts';
import { zoneOperationsResponse } from '../app/lib/zone-operations-types.ts';
import { reviewedShiftWindow } from '../app/lib/zone-shift-window.ts';
import { officerZoneResponse } from '../app/lib/officer-zone-state.ts';
import { GET, POST } from '../app/api/zone-operations/route.ts';
import { readClientWorkspace } from '../app/lib/booking-client.ts';
import { prepareProductionOrder } from '../app/lib/production-orders.ts';
const ops = { userId: 'controller', email: 'controller@example.test', operations: true };
test('Dispatch uses real requests and roster gaps; contracts aggregate their actual upcoming positions', async () => {
  const db = new ClientDatabase(); try {
    await assert.rejects(() => readZoneOperations(db, client), /Operations access/);
    seedClient(db); seedBooking(db); seedRoster(db, { assigned: false });
    db.sql.exec("UPDATE bookings SET engagement_model='fixed',contract_months=3,roster_pattern='weekdays'");
    const state = await readZoneOperations(db, ops); assert.equal(state.contracts[0].gaps, 1); assert.equal(state.contracts[0].upcoming, 1); assert.equal(state.rosters[0].assignment_id, null); assert.equal(state.points.length, 0); assert.equal(state.requests.length, 0);
    assert.equal(zoneOperationsResponse({ state }), true); assert.equal(zoneOperationsResponse({ state: { ...state, rosters: [{}] } }), false);
    assert.equal((await readClientWorkspace(db, client)).bookings[0].priceConfirmed, false);
  } finally { db.sql.close(); }
});
test('urgency follows requested starts; nearest ranking requires actual consented points and matching grade and availability', () => {
  const item = (id, startsAt) => ({ id, startsAt, requestedAt: '2026-11-01T00:00:00Z' });
  assert.deepEqual(rankDispatchRequests([item('later', '2026-11-08'), item('unknown', null), item('now', '2026-11-07')]).map(r => r.id), ['now', 'later', 'unknown']);
  const slot = { minimum_grade: 'Grade C', starts_at: '2090-01-01T04:00:00Z', ends_at: '2090-01-01T16:00:00Z', latitude: -26.1, longitude: 28.05 };
  const officer = (id, extra = {}) => ({ id, full_name: id, psira_grade: 'Grade B', starts_at: '2090-01-01T00:00:00Z', ends_at: '2090-01-02T00:00:00Z', ...extra });
  const available = dispatchCandidates(slot, [officer('no-location'), officer('far'), officer('near'), officer('grade-low', { psira_grade: 'Grade E' }), officer('too-short', { ends_at: slot.starts_at })], [{ id: 'far', latitude: -26.3, longitude: 28.2 }, { id: 'near', latitude: -26.1, longitude: 28.05 }]);
  assert.deepEqual(available.map(o => o.id), ['near', 'far', 'no-location']); assert.equal(available[2].distance, null);
});
test('same-day Flex has a reviewed future start and retains the selected day or night shift end', () => {
  const now = Date.parse('2026-11-07T09:00:00+02:00'), base = { startDate: '2026-11-07', shift: 'day', engagementModel: 'flex' };
  assert.throws(() => reviewedShiftWindow(base, now), /actual first shift start/);
  const window = reviewedShiftWindow({ ...base, firstShiftStartsAt: '2026-11-07T10:00:00+02:00' }, now);
  assert.equal(window.startsAt, '2026-11-07T08:00:00.000Z'); assert.equal(window.endsAt, '2026-11-07T16:00:00.000Z');
  for (const firstShiftStartsAt of ['2026-11-07T09:00:00+02:00', '2026-11-07T18:00:00+02:00', '2026-11-07T10:00:30+02:00']) assert.throws(() => reviewedShiftWindow({ ...base, firstShiftStartsAt }, now));
  assert.throws(() => reviewedShiftWindow({ ...base, engagementModel: 'fixed', firstShiftStartsAt: '2026-11-07T10:00:00+02:00' }, now), /LOKD Flex/);
  assert.equal(reviewedShiftWindow({ ...base, shift: 'night', firstShiftStartsAt: '2026-11-07T23:00:00+02:00' }, now).endsAt, '2026-11-08T04:00:00.000Z');
});
test('a reviewed first start binds the service-order quote hash without changing price-book amounts', async () => {
  const db = new ClientDatabase(); try {
    const quoteRequest = { serviceType: 'Unarmed', engagementModel: 'flex', term: 'single', purposeCode: 'commercial_access', startDate: '2090-01-01', shift: 'day', rosterPattern: 'daily', riskInput: { assetExposure: 'standard', publicAccess: 'controlled', incidentHistory: 'none', existingControls: 'strong', nightOperation: false, vulnerablePeople: false } };
    const full = await prepareProductionOrder(db, ops, { action: 'quote_order', quoteRequest });
    const partial = await prepareProductionOrder(db, ops, { action: 'quote_order', quoteRequest: { ...quoteRequest, firstShiftStartsAt: '2090-01-01T06:30:00+02:00' } });
    assert.equal(partial.quote.clientPriceCents, full.quote.clientPriceCents); assert.notEqual(partial.quoteHash, full.quoteHash);
    assert.equal(db.sql.prepare('SELECT count(*) n FROM production_order_setups').get().n, 0);
    await assert.rejects(() => prepareProductionOrder(db, ops, { action: 'quote_order', quoteRequest: { ...quoteRequest, firstShiftStartsAt: '2090-01-01T18:00:00+02:00' } }), /inside the requested shift/);
  } finally { db.sql.close(); }
});
test('Officer state guards keep unapproved access separate and reject malformed work or pay records', () => {
  const state = { officer: null, applications: [], offers: [], shifts: [], timesheets: [], statements: [], notifications: [], emailEnabled: true };
  assert.ok(officerZoneResponse({ state })); assert.equal(officerZoneResponse({ state: { ...state, offers: [{ id: 'missing-offer-fields' }] } }), false); assert.equal(officerZoneResponse({ state: { ...state, statements: [{ netCents: 'unverified' }] } }), false);
});
test('Dispatch API requires a named operator, fresh second factor, same-origin JSON and a supported action', async () => {
  const db = new ClientDatabase(); env.DB = db; try {
    assert.equal((await GET(new Request('https://ops.lokd.co.za/api/zone-operations'))).status, 401);
    const headers = { origin: 'https://ops.lokd.co.za', 'content-type': 'application/json', 'x-lokd-verified-user-id': ops.userId, 'x-lokd-verified-email': ops.email };
    const request = (body, extra = {}) => new Request('https://ops.lokd.co.za/api/zone-operations', { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) });
    assert.equal((await POST(request({}, { origin: 'https://untrusted.example' }))).status, 403);
    assert.equal((await GET(new Request('https://ops.lokd.co.za/api/zone-operations', { headers }))).status, 403);
  } finally { db.sql.close(); }
});
