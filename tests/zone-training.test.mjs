import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from 'cloudflare:workers';
import { ClientDatabase } from './fixtures/client-booking-db.mjs';
import { operateZoneTraining as write, readZoneTraining as read } from '../app/lib/zone-training.ts';
import { zoneTrainingResponse } from '../app/lib/zone-training-types.ts';
import { GET, POST } from '../app/api/zone-training/route.ts';

const learner = { userId: 'training-learner', email: 'learner@example.test', operations: false, owner: false };
const other = { ...learner, userId: 'training-other', email: 'other@example.test' };
const maker = { userId: 'training-assessor', email: 'assessor@example.test', operations: true, owner: false };
const checker = { userId: 'training-owner', email: 'owner@example.test', operations: true, owner: true };
const request = (patch = {}) => ({ action: 'request_enrolment', requestId: crypto.randomUUID(), courseId: 'firearms-competency', fullName: 'Thabo Mokoena', trainingAcknowledged: true, ...patch });
const row = async (db, id) => (await read(db, maker)).enrolments.find(row => row.id === id);
async function published(db, capacity = 2) {
  const session = await write(db, maker, { action: 'create_session', requestId: crypto.randomUUID(), courseId: 'firearms-competency', startsAt: '2090-11-14T06:00:00Z', endsAt: '2090-11-14T14:00:00Z', venue: 'Midrand training venue', capacity });
  await write(db, maker, { action: 'publish_session', id: session.id, expectedVersion: 1, feeCents: 42000, feeTerms: 'The paid course fee and the course agreement are confirmed with each applicant.', feeApproved: true });
  return session.id;
}
async function confirmed(db, sessionId, actor = learner) {
  const result = await write(db, actor, request({ sessionId }));
  await write(db, maker, { action: 'confirm_enrolment', id: result.id, expectedVersion: 1, sessionId, eligibilityReference: 'Eligibility and course agreement evidence', eligibilityChecked: true, feeAgreed: true });
  return result.id;
}
function pastSession(db, id) { db.sql.prepare("UPDATE zone_training_sessions SET starts_at='2020-11-14T06:00:00Z',ends_at='2020-11-14T14:00:00Z' WHERE id=?").run(id); }
const completion = (id, version) => ({ action: 'prepare_completion', id, expectedVersion: version, assessmentReference: 'Actual passed assessment record', evidenceSha256: 'a'.repeat(64), certificateNumber: 'LOKD-CERT-001', certificateReference: 'Approved certificate document record', assessmentPassed: true });

test('training requests require explicit acknowledgement, replay once, stay private and do not confirm a place', async () => {
  const db = new ClientDatabase(); try {
    await assert.rejects(() => write(db, learner, request({ trainingAcknowledged: false })), /Acknowledge/);
    const input = request(), saved = await write(db, learner, input), replay = await write(db, learner, input);
    assert.equal(saved.id, replay.id); assert.equal((await read(db, learner)).enrolments[0].status, 'requested');
    assert.equal((await read(db, other)).enrolments.length, 0); assert.equal((await read(db, learner)).certificates.length, 0);
    assert.equal(db.sql.prepare("SELECT count(*) AS n FROM officer_email_outbox WHERE id LIKE 'zone-training:%'").get().n, 1);
    await assert.rejects(() => write(db, learner, { ...input, courseId: 'grade-e' }), /different details/);
    assert.ok(zoneTrainingResponse({ state: await read(db, learner) }));
    assert.equal(zoneTrainingResponse({ state: { ...await read(db, learner), sessions: [{}] } }), false);
  } finally { db.sql.close(); }
});
test('session drafts have no fee and cannot be published without a reviewed paid-course agreement', async () => {
  const db = new ClientDatabase(); try {
    const input = { action: 'create_session', requestId: crypto.randomUUID(), courseId: 'grade-e', startsAt: '2090-12-01T06:00:00Z', endsAt: '2090-12-01T14:00:00Z', venue: 'Johannesburg training venue', capacity: 12 };
    await assert.rejects(() => write(db, learner, input), /Operations/);
    const saved = await write(db, maker, input); assert.equal((await write(db, maker, input)).id, saved.id);
    const draft = (await read(db, maker)).sessions[0]; assert.equal(draft.feeCents, null); assert.equal((await read(db, learner)).sessions.length, 0);
    await assert.rejects(() => write(db, maker, { action: 'publish_session', id: saved.id, expectedVersion: 1, feeCents: 42000, feeTerms: 'Reviewed course agreement' }), /reviewed/);
    assert.throws(() => db.sql.prepare("UPDATE zone_training_sessions SET status='published' WHERE id=?").run(saved.id), /CHECK/);
  } finally { db.sql.close(); }
});
test('confirmation requires eligibility and agreement evidence; session capacity is enforced at commit', async () => {
  const db = new ClientDatabase(); try {
    const session = await published(db, 1), first = await confirmed(db, session), next = await write(db, other, request({ sessionId: session }));
    await assert.rejects(() => write(db, maker, { action: 'confirm_enrolment', id: next.id, expectedVersion: 1, sessionId: session, eligibilityReference: 'Checked documents', eligibilityChecked: true, feeAgreed: false }), /agreement/);
    const emails = db.sql.prepare('SELECT count(*) AS n FROM officer_email_outbox').get().n;
    await assert.rejects(() => write(db, maker, { action: 'confirm_enrolment', id: next.id, expectedVersion: 1, sessionId: session, eligibilityReference: 'Checked documents', eligibilityChecked: true, feeAgreed: true }), /full/);
    assert.equal((await row(db, next.id)).status, 'requested'); assert.equal(db.sql.prepare('SELECT count(*) AS n FROM officer_email_outbox').get().n, emails);
    assert.equal((await row(db, first)).status, 'confirmed');
    const own = await write(db, { ...maker, operations: false }, request());
    await assert.rejects(() => write(db, maker, { action: 'confirm_enrolment', id: own.id, expectedVersion: 1, sessionId: session, eligibilityChecked: true, feeAgreed: true, eligibilityReference: 'Checked documents' }), /Another operator/);
    assert.equal('feeCents' in (await read(db, learner)).sessions[0], false);
  } finally { db.sql.close(); }
});
test('racing attendance updates do not create an audit receipt for a lost write', async () => {
  const db = new ClientDatabase(); try {
    const session = await published(db), id = await confirmed(db, session); pastSession(db, session);
    const before = db.sql.prepare('SELECT count(*) AS n FROM audit_events').get().n;
    db.beforeBatch = () => db.sql.prepare('UPDATE zone_training_enrolments SET version=version+1 WHERE id=?').run(id);
    await assert.rejects(() => write(db, maker, { action: 'record_attendance', id, expectedVersion: 2, attendance: 'present', reference: 'Signed attendance register' }), /changed/);
    assert.equal((await row(db, id)).attendance, 'unrecorded'); assert.equal(db.sql.prepare('SELECT count(*) AS n FROM audit_events').get().n, before);
  } finally { db.sql.close(); }
});
test('a certificate needs passed assessment evidence and an independent owner; it never grants work eligibility', async () => {
  const db = new ClientDatabase(); try {
    const session = await published(db), id = await confirmed(db, session); pastSession(db, session);
    await assert.rejects(() => write(db, maker, completion(id, 2)), /attendance/);
    await write(db, maker, { action: 'record_attendance', id, expectedVersion: 2, attendance: 'present', reference: 'Signed attendance register' });
    const review = await write(db, maker, completion(id, 3));
    assert.equal((await read(db, learner)).certificates.length, 0);
    const decision = { action: 'decide_completion', id: review.id, expectedVersion: 1, decision: 'approved', independentlyInspected: true, reason: 'Assessment and actual certificate independently inspected.' };
    await assert.rejects(() => write(db, { ...maker, owner: true }, decision), /independent reviewer/);
    await assert.rejects(() => write(db, { ...checker, owner: false }, decision), /owner/);
    const before = db.sql.prepare('SELECT count(*) AS n FROM officers').get().n;
    await write(db, checker, decision);
    const state = await read(db, learner); assert.equal(state.enrolments[0].status, 'completed'); assert.equal(state.certificates[0].certificateNumber, 'LOKD-CERT-001');
    assert.equal(db.sql.prepare('SELECT count(*) AS n FROM officers').get().n, before);
    await assert.rejects(() => write(db, checker, decision), /changed/);
    assert.equal((await read(db, learner)).certificates.length, 1);
    assert.throws(() => db.sql.prepare("UPDATE zone_training_certificates SET certificate_number='changed'").run(), /immutable/);
  } finally { db.sql.close(); }
});
test('renewal support is owner scoped and independent of official verification', async () => {
  const db = new ClientDatabase(); try {
    const input = { action: 'request_renewal_help', requestId: crypto.randomUUID(), note: 'Please help me understand the required renewal documents.' };
    const result = await write(db, learner, input); assert.equal((await write(db, learner, input)).id, result.id);
    assert.equal((await read(db, other)).renewals.length, 0);
    await write(db, maker, { action: 'review_renewal', id: result.id, expectedVersion: 1, status: 'under_review', publicNote: 'The training team will contact you about the renewal process.' });
    assert.equal((await read(db, learner)).renewals[0].status, 'under_review');
    assert.equal(db.sql.prepare('SELECT count(*) AS n FROM psira_verification_cases').get().n, 0);
  } finally { db.sql.close(); }
});
test('the training HTTP boundary requires sign-in, the correct workspace and same-origin JSON', async () => {
  const db = new ClientDatabase(); const oldDb = env.DB; env.DB = db;
  try {
    assert.equal((await GET(new Request('https://officers.lokd.co.za/api/zone-training'))).status, 401);
    const headers = { 'x-lokd-verified-user-id': learner.userId, 'x-lokd-verified-email': learner.email, 'content-type': 'application/json' };
    assert.equal((await GET(new Request('https://portal.lokd.co.za/api/zone-training', { headers }))).status, 403);
    assert.equal((await POST(new Request('https://officers.lokd.co.za/api/zone-training', { method: 'POST', headers: { ...headers, origin: 'https://unrelated.invalid' }, body: JSON.stringify(request()) }))).status, 403);
    const response = await POST(new Request('https://officers.lokd.co.za/api/zone-training', { method: 'POST', headers: { ...headers, origin: 'https://officers.lokd.co.za' }, body: JSON.stringify(request()) }));
    assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.ok, true); assert.equal(body.commandReceipt.kind, 'zone-training'); assert.equal(body.state.enrolments[0].status, 'requested');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  } finally { env.DB = oldDb; db.sql.close(); }
});
