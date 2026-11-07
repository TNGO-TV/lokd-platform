import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from 'cloudflare:workers';
import { complete, applicant, maker, checker, assessor, decision, prepareReadinessPassport } from './fixtures/production-identity-journey.mjs';
import { D1Adapter, seedEnvironment, seedOfficerSupport, moveCandidateToCheckInWindow, request as activationRequest, activateAssignment } from './fixtures/identity-activation-environment.mjs';
import { manageProductionEvidence } from '../app/lib/production-evidence.ts';
import { operateZoneLocation as write, ownLocationConsent, readDispatchLocations, readClientRoute, validateSharedLocation, purgeExpiredZoneLocations } from '../app/lib/zone-location.ts';
import { GET, POST } from '../app/api/zone-location/route.ts';
import { mapPixel, mapTileRequest } from '../app/lib/zone-map.ts';
import { GET as tile } from '../app/api/map-tile/route.ts';
const point = () => ({ action: 'publish_location', latitude: -26.1, longitude: 28.05, accuracy: 15, capturedAt: new Date().toISOString() });
async function start(db, input = {}) { await write(db, applicant, { action: 'start_sharing', locationConsent: true, mode: 'dispatch', expectedRevision: (await ownLocationConsent(db, applicant))?.revision ?? 0, ...input }); return ownLocationConsent(db, applicant); }
async function publish(db, consent) { return write(db, applicant, { ...point(), revision: consent.revision, sessionId: consent.sessionId }); }

test('sharing needs explicit permission, fresh approval and a precise current South African point', async () => {
  const x = await complete(); try {
    await assert.rejects(() => start(x.db, { locationConsent: false }), /explicitly/);
    await assert.rejects(() => write(x.db, applicant, point()), /ended or changed/);
    for (const change of [{ latitude: 0 }, { longitude: NaN }, { accuracy: 151 }, { capturedAt: '2000-01-01' }, { capturedAt: new Date(Date.now() + 60000).toISOString() }]) assert.throws(() => validateSharedLocation({ ...point(), ...change }));
    const c = await start(x.db); await publish(x.db, c); assert.equal((await readDispatchLocations(x.db)).length, 1);
    assert.equal((await ownLocationConsent(x.db, { ...applicant, userId: 'someone-else' })), null);
    x.db.sql.prepare("UPDATE officers SET approval_status='suspended' WHERE id=?").run(x.officerId);
    assert.equal((await readDispatchLocations(x.db)).length, 0);
    await assert.rejects(() => publish(x.db, c), /zone_location_consent_changed/);
    await write(x.db, applicant, { action: 'stop_sharing' });
    assert.equal(x.db.sql.prepare('SELECT count(*) n FROM officer_dispatch_locations').get().n, 0);
  } finally { x.db.sql.close(); }
});
test('revocation wins over an in-flight old point and a new audience invalidates the previous session', async () => {
  const x = await complete(); try {
    const c = await start(x.db); await publish(x.db, c);
    const original = x.db.prepare.bind(x.db); let revoked = false;
    x.db.prepare = sql => { const p = original(sql); if (!sql.startsWith('INSERT INTO officer_dispatch_locations')) return p; return { ...p, bind(...args) { const s = p.bind(...args); return { ...s, async run() { revoked = true; await write(x.db, applicant, { action: 'stop_sharing' }); return s.run(); } }; } }; };
    await assert.rejects(() => publish(x.db, c), /zone_location_consent_changed/); assert.equal(revoked, true); x.db.prepare = original;
    assert.equal((await readDispatchLocations(x.db)).length, 0); assert.equal((await ownLocationConsent(x.db, applicant)).active, false);
    const next = await start(x.db); assert.notEqual(c.sessionId, next.sessionId);
    await assert.rejects(() => publish(x.db, c), /ended or changed/); await publish(x.db, next);
    assert.equal((await readDispatchLocations(x.db)).length, 1);
    await assert.rejects(() => start(x.db, { expectedRevision: next.revision - 1 }), /Sharing changed/);
  } finally { x.db.sql.close(); }
});
test('expired or stale points disappear and scheduled maintenance removes stored coordinates', async () => {
  const x = await complete(); try {
    const c = await start(x.db); await publish(x.db, c);
    x.db.sql.exec("UPDATE officer_dispatch_locations SET expires_at='2000-01-01T00:00:00Z'");
    assert.equal((await readDispatchLocations(x.db)).length, 0); await purgeExpiredZoneLocations(x.db);
    assert.equal(x.db.sql.prepare('SELECT count(*) n FROM officer_dispatch_locations').get().n, 0);
    await assert.rejects(() => start(x.db, { mode: 'en_route', shiftId: 'someone-elses-shift' }), /zone_location_assignment_changed/);
  } finally { x.db.sql.close(); }
});
test('a client sees only their assigned en-route officer, and only with that audience selected', async () => {
  const x = await complete(), sql = x.db.sql; try {
    await seedEnvironment(sql);
    const fields = { engagementId: 'LOCATION-ENGAGEMENT', officerId: x.officerId, employerId: 'EMP-1', model: 'direct_flex', termsVersion: 'TERMS-v1', engagementReference: 'private:fixture-engagement', weeklyHourCap: '24', payrollReference: 'private:fixture-payroll', benefitsReference: 'private:fixture-benefits' };
    const e = await manageProductionEvidence(x.db, maker, { action: 'prepare_evidence', kind: 'engagement', fields, sourceDocumentsReviewed: true, expiresAt: new Date(Date.now() + 86400000).toISOString() });
    await manageProductionEvidence(x.db, checker, { action: 'decide_evidence', reviewId: e.reviewId, decision: 'approve', evidenceIndependentlyChecked: true, reason: 'Independent isolated fixture evidence review' });
    seedOfficerSupport(sql, x.officerId, fields.engagementId, 'LOCATION-TERMS'); sql.prepare("UPDATE officers SET banking_status='verified',flex_available=1,external_work_acknowledged=1,rest_window_confirmed=1 WHERE id=?").run(x.officerId);
    const p = await prepareReadinessPassport(x.db, assessor, x.passportInput); await decision(x.db, 'passport', p.id); await moveCandidateToCheckInWindow(sql, x.officerId);
    const db = new D1Adapter(sql), activated = await activateAssignment(db, activationRequest('location-client-route', x.officerId), 'ops-fixture');
    const booking = sql.prepare('SELECT b.client_id FROM shifts s JOIN bookings b ON b.id=s.booking_id WHERE s.id=?').get(activated.shiftId);
    const client = { userId: 'route-client', email: 'client@example.test', operations: false };
    sql.prepare("INSERT INTO production_entity_links(kind,case_id,case_version,owner_user_id,entity_id,prepared_by,prepared_at) VALUES('client','location-client-case',1,?,?,?,?)").run(client.userId, booking.client_id, 'fixture', new Date().toISOString());
    await publish(db, await start(db)); assert.equal((await readClientRoute(db, client, activated.shiftId)).points.length, 0);
    const c = await start(db, { mode: 'en_route', shiftId: activated.shiftId }); await publish(db, c);
    assert.equal((await readClientRoute(db, client, activated.shiftId)).points[0].id, x.officerId);
    await assert.rejects(() => readClientRoute(db, { ...client, userId: 'different-client' }, activated.shiftId), /not found/);
    await write(db, applicant, { action: 'stop_sharing' }); assert.equal((await readClientRoute(db, client, activated.shiftId)).points.length, 0);
  } finally { sql.close(); }
});
test('location routes reject anonymous, wrong workspace, cross-origin and oversized writes', async () => {
  const x = await complete(); env.DB = x.db; try {
    assert.equal((await GET(new Request('https://officers.lokd.co.za/api/zone-location'))).status, 401);
    const headers = { origin: 'https://officers.lokd.co.za', 'content-type': 'application/json', 'x-lokd-verified-user-id': applicant.userId, 'x-lokd-verified-email': applicant.email };
    assert.equal((await POST(new Request('https://officers.lokd.co.za/api/zone-location', { method: 'POST', headers: { ...headers, origin: 'https://untrusted.example' }, body: '{}' }))).status, 403);
    assert.equal((await POST(new Request('https://officers.lokd.co.za/api/zone-location', { method: 'POST', headers, body: 'x'.repeat(3001) }))).status, 413);
    assert.equal((await GET(new Request('https://portal.lokd.co.za/api/zone-location', { headers }))).status, 403);
  } finally { x.db.sql.close(); }
});
test('map tiles are bounded public paths and never forward private request headers', async () => {
  const p = mapPixel(-26.1, 28.05, 12), url = `https://lokd.co.za/api/map-tile?z=12&x=${Math.floor(p.x / 256)}&y=${Math.floor(p.y / 256)}`;
  assert.match(mapTileRequest(url), /^https:\/\/tile\.openstreetmap\.org\//);
  for (const q of ['z=99&x=1&y=1', 'z=12&x=1&y=1', 'z=12&x=../../secret&y=1', 'z=12&x=NaN&y=1']) assert.equal(mapTileRequest('https://lokd.co.za/api/map-tile?' + q), null);
  const previous = globalThis.fetch; let sent;
  globalThis.fetch = async (url, init) => { sent = { url, init }; return new Response(new Uint8Array([1, 2]), { headers: { 'content-type': 'image/png' } }); };
  try { const response = await tile(new Request(url, { headers: { authorization: 'private', cookie: 'private' } })); assert.equal(response.status, 200); assert.equal(new Headers(sent.init.headers).has('cookie'), false); assert.equal(new Headers(sent.init.headers).has('authorization'), false); assert.match(response.headers.get('cache-control'), /public/); } finally { globalThis.fetch = previous; }
});
