import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from 'cloudflare:workers';
import { GET } from '../app/api/client-bookings/service-record/route.ts';
import { ClientDatabase, client, otherClient, seedClient, seedBooking, seedShift, clientRequest } from './fixtures/client-booking-db.mjs';

test('service records contain only the signed-in client’s production shifts', async () => {
  const db = new ClientDatabase(); env.DB = db;
  try {
    seedClient(db); seedBooking(db); seedShift(db);
    seedClient(db, otherClient, 'CLIENT-FIXTURE-B'); seedBooking(db, 'CLIENT-FIXTURE-B', 'BOOKING-FIXTURE-B'); seedShift(db, 'BOOKING-FIXTURE-B', 'SHIFT-FIXTURE-B');
    const response = await GET(clientRequest('/api/client-bookings/service-record'));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /private.*no-store/);
    const body = await response.json();
    assert.deepEqual(body.records.map(r => r.id), ['SHIFT-FIXTURE-A']);
    assert.equal(body.records[0].officerName, 'Local fixture officer');
    assert.equal(body.records[0].grade, 'Grade C');
    assert.equal(body.records[0].minutesOnSite, 90);
    assert.equal(body.records[0].passportStatus, 'not_checked');
    assert.equal((await GET(clientRequest('/api/client-bookings/service-record?shift=SHIFT-FIXTURE-B'))).status, 404);
    assert.equal((await GET(clientRequest('/api/client-bookings/service-record', null))).status, 401);
    const empty = await GET(clientRequest('/api/client-bookings/service-record', { ...client, userId: 'unlinked-client' }));
    assert.deepEqual((await empty.json()).records, []);
  } finally { db.sql.close(); delete env.DB; }
});

test('service records reject email-only identity and the wrong portal', async () => {
  const request = new Request('https://portal.lokd.co.za/api/client-bookings/service-record', { headers: { 'x-lokd-verified-email': client.email } });
  assert.equal((await GET(request)).status, 401);
  const wrong = new Request('https://officers.lokd.co.za/api/client-bookings/service-record', { headers: { 'x-lokd-verified-email': client.email, 'x-lokd-verified-user-id': client.userId } });
  assert.equal((await GET(wrong)).status, 403);
});
