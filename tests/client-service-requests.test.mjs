import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from 'cloudflare:workers';
import { ClientDatabase, client, clientRequest } from './fixtures/client-booking-db.mjs';
import { operateClientWorkspace, readClientWorkspace } from '../app/lib/booking-client.ts';
import { readOperationsClientRequests, reviewClientRequest } from '../app/lib/booking-client-requests.ts';
import { matchesWorkspaceCommand } from '../app/lib/workspace-command-receipt.ts';
import { GET, POST } from '../app/api/client-bookings/route.ts';

const operator = { userId: 'request-reviewer', email: 'reviewer@example.test', operations: true, owner: false };
const colleague = { userId: 'request-colleague', email: 'colleague@example.test', operations: true, owner: false };
const owner = { userId: 'request-owner', email: 'owner@example.test', operations: true, owner: true };
function opsRequest(body, actor = operator, mfa = true) {
  return new Request('https://operations.lokd.co.za/api/client-bookings?scope=operations', { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', origin: 'https://operations.lokd.co.za', 'x-lokd-verified-user-id': actor.userId, 'x-lokd-verified-email': actor.email, ...(mfa ? { 'x-lokd-verified-mfa-enrolled': 'true', 'x-lokd-verified-second-factor-at': new Date().toISOString() } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function seed(db) {
  const registration = await operateClientWorkspace(db, client, { action: 'register_account', requestId: crypto.randomUUID(), organisationName: 'Queue fixture organisation', contactName: 'Queue fixture contact', mobile: '0821234567', siteArea: 'Cape Town', siteType: 'commercial_property', message: 'Cover requested for our main office building.', privacyConsent: true });
  const site = await operateClientWorkspace(db, client, { action: 'save_site', requestId: crypto.randomUUID(), name: 'Main office', area: 'Cape Town', address: '12 Main Road, Cape Town' });
  const cover = await operateClientWorkspace(db, client, { action: 'request_cover', requestId: crypto.randomUUID(), siteId: site.id, serviceType: 'Armed', startDate: '2090-01-01', endDate: '2090-01-02', shiftStart: '06:00', shiftEnd: '18:00', headcount: 2, note: 'Control access to the office gate.' });
  return { registration, site, cover };
}
const command = (id, expectedVersion = 1, status = 'triaged') => ({ action: 'review_request', id, expectedVersion, status, note: 'We are reviewing your requirements and will send a quote.' });
const count = (db, table) => db.sql.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;

test('Operations queue includes real client, site and service details while regular accounts cannot read it', async () => {
  const db = new ClientDatabase();
  try {
    const { registration, cover } = await seed(db);
    await operateClientWorkspace(db, client, { action: 'update_account', id: registration.id, expectedVersion: 1, changes: { organisationName: 'Updated queue organisation' } });
    const queue = await readOperationsClientRequests(db, operator), item = queue.serviceRequests.find(r => r.id === cover.id);
    assert.equal(queue.viewerUserId, operator.userId); assert.equal(queue.isOwner, false);
    assert.equal(item.organisationName, 'Updated queue organisation'); assert.equal(item.contactName, 'Queue fixture contact');
    assert.equal(item.email, client.email); assert.equal(item.mobile, '+27821234567');
    assert.equal(item.siteName, 'Main office'); assert.equal(item.address, '12 Main Road, Cape Town');
    assert.equal(item.detail.serviceType, 'Armed'); assert.equal(item.detail.headcount, 2); assert.equal(item.clientOwnerUserId, client.userId);
    assert.ok(queue.serviceRequests.some(r => r.category === 'client_site'));
    await assert.rejects(() => readOperationsClientRequests(db, client), /Operations access/);
  } finally { db.sql.close(); }
});

test('triage and closure persist public notes, owner, version, audit and client email without creating or changing a booking', async () => {
  const db = new ClientDatabase();
  try {
    const { cover, site } = await seed(db), bookings = count(db, 'bookings');
    const triaged = await reviewClientRequest(db, operator, command(cover.id));
    assert.equal(triaged.version, 2); assert.equal(triaged.notificationIds.length, 2);
    let item = (await readClientWorkspace(db, client)).requests.find(r => r.id === cover.id);
    assert.equal(item.status, 'triaged'); assert.equal(item.detail.publicNote, command(cover.id).note);
    assert.equal(db.sql.prepare('SELECT owner_id FROM service_requests WHERE id=?').get(cover.id).owner_id, operator.userId);
    assert.equal(db.sql.prepare("SELECT count(*) AS n FROM audit_events WHERE entity_id=? AND event_type='client_service_request_reviewed'").get(cover.id).n, 1);
    assert.ok(db.sql.prepare("SELECT owner_user_id FROM client_notification_jobs WHERE id=?").get(triaged.notificationIds[0]).owner_user_id === client.userId);
    await assert.rejects(() => reviewClientRequest(db, colleague, command(cover.id, 2, 'closed')), /another operator/);
    await reviewClientRequest(db, owner, { ...command(cover.id, 2, 'closed'), note: 'Your updated quote has been issued for review.' });
    item = (await readClientWorkspace(db, client)).requests.find(r => r.id === cover.id);
    assert.equal(item.status, 'closed'); assert.equal(item.version, 3); assert.equal(item.detail.note, 'Control access to the office gate.');
    assert.equal(item.detail.publicNote, 'Your updated quote has been issued for review.');
    assert.equal(count(db, 'bookings'), bookings);
    await reviewClientRequest(db, operator, command(site.id));
    await reviewClientRequest(db, operator, command(site.id, 2, 'closed'));
    const savedSite = (await readClientWorkspace(db, client)).sites.find(s => s.id === site.id);
    assert.equal(savedSite.address, '12 Main Road, Cape Town'); assert.equal(savedSite.editable, false, 'reviewing a site must not erase it');
    assert.equal(savedSite.status, 'closed'); assert.equal(savedSite.publicNote, command(site.id).note);
    await assert.rejects(() => reviewClientRequest(db, owner, command(cover.id, 3, 'triaged')), /changed/);
  } finally { db.sql.close(); }
});

test('stale, self and racing request reviews cannot commit an audit or email', async () => {
  const db = new ClientDatabase();
  try {
    const { cover } = await seed(db), beforeAudit = count(db, 'audit_events'), beforeEmail = count(db, 'client_notification_jobs');
    await assert.rejects(() => reviewClientRequest(db, { ...client, operations: true, owner: true }, command(cover.id)), /Another operator/);
    await assert.rejects(() => reviewClientRequest(db, operator, command(cover.id, 0)), /changed/);
    db.beforeBatch = () => db.sql.prepare("UPDATE service_requests SET status='triaged',owner_id=?,version=version+1 WHERE id=?").run(colleague.userId, cover.id);
    await assert.rejects(() => reviewClientRequest(db, operator, command(cover.id)), /client_service_request_review_changed/);
    assert.equal(count(db, 'audit_events'), beforeAudit); assert.equal(count(db, 'client_notification_jobs'), beforeEmail);
    const row = db.sql.prepare('SELECT owner_id,version FROM service_requests WHERE id=?').get(cover.id);
    assert.equal(row.owner_id, colleague.userId); assert.equal(row.version, 2);
  } finally { db.sql.close(); }
});

test('Operations API requires its allowlist and fresh MFA, acknowledges the exact saved review, and surfaces email errors', async () => {
  const db = new ClientDatabase(), prior = { DB: env.DB, LOKD_OPERATIONS_ACCESS_JSON: env.LOKD_OPERATIONS_ACCESS_JSON, LOKD_OWNER_ACCESS_JSON: env.LOKD_OWNER_ACCESS_JSON };
  Object.assign(env, { DB: db, LOKD_OPERATIONS_ACCESS_JSON: JSON.stringify([operator.email]), LOKD_OWNER_ACCESS_JSON: JSON.stringify([owner.email]) });
  try {
    const { cover } = await seed(db), input = command(cover.id);
    assert.equal((await GET(opsRequest(undefined, colleague))).status, 403);
    assert.equal((await GET(clientRequest('/api/client-bookings?scope=operations'))).status, 403);
    const queue = await GET(opsRequest()); assert.equal(queue.status, 200); assert.equal((await queue.json()).serviceRequests.length, 2);
    assert.equal((await POST(opsRequest({ action: 'retry_notifications' }))).status, 400);
    assert.equal((await POST(opsRequest(input, operator, false))).status, 403);
    const response = await POST(opsRequest(input)), body = await response.json();
    assert.equal(response.status, 200); assert.equal(body.ok, true); assert.equal(body.result.version, 2);
    assert.equal(await matchesWorkspaceCommand(body, 'client-enquiries', input), true);
    assert.equal(await matchesWorkspaceCommand(body, 'client-enquiries', { ...input, id: 'different-request' }), false);
    assert.equal(body.emailDelivery.blocked, 2); assert.match(body.emailDelivery.errors.join(' '), /not configured/);
    const stale = await POST(opsRequest(input)); assert.equal(stale.status, 409); assert.equal('commandReceipt' in await stale.json(), false);
    assert.equal((await POST(clientRequest('/api/client-bookings', client, input))).status, 403);
  } finally { db.sql.close(); Object.assign(env, prior); }
});
