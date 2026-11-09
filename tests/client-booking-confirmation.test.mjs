import assert from 'node:assert/strict';
import test from 'node:test';
import { complete, applicant, maker, checker, assessor, decision, prepareReadinessPassport } from './fixtures/production-identity-journey.mjs';
import { D1Adapter, seedEnvironment, seedOfficerSupport, moveCandidateToCheckInWindow, request, activateAssignment, passDueScheduledCheckpoints, revalidateAssignment } from './fixtures/identity-activation-environment.mjs';
import { manageProductionEvidence } from '../app/lib/production-evidence.ts';
import { reviewProductionClient } from '../app/lib/production-client-review.ts';
import { writeSignup } from '../app/lib/signup-server.ts';
import { operateClientWorkspace, readClientWorkspace } from '../app/lib/booking-client.ts';
import { client } from './fixtures/client-booking-db.mjs';

test('a fully committed production assignment queues exactly one client and Operations shift confirmation', async () => {
  const x = await complete(), database = x.db.sql;
  try {
    await seedEnvironment(database);
    const registration = await operateClientWorkspace(x.db, client, { action: 'register_account', requestId: crypto.randomUUID(), organisationName: 'Fixture Client', contactName: 'Client Contact', mobile: '0821234567', siteArea: 'Johannesburg', siteType: 'commercial_property', message: 'Cover for the local fixture office site.', privacyConsent: true });
    await writeSignup(x.db, maker, { action: 'review', kind: 'client', id: registration.id, expectedVersion: 1, status: 'reviewed', note: 'Local fixture client has been independently reviewed.' });
    database.prepare("INSERT INTO production_entity_links VALUES('client',?,2,?,'CL-1','fixture',?)").run(registration.id, client.userId, new Date().toISOString());
    const review = await reviewProductionClient(x.db, maker, { action: 'prepare_client_review', clientId: 'CL-1', caseVersion: 2, documentsActuallyReviewed: true, checkedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), identityReference: 'Local fixture identity document', companyReference: 'Local fixture company document', authorityReference: 'Local fixture signing mandate', note: 'Reviewed local fixture documents independently.' });
    await reviewProductionClient(x.db, checker, { action: 'decide_client_review', reviewId: review.reviewId, decision: 'approve', evidenceIndependentlyChecked: true, reason: 'Independent local fixture review confirmed.' });
    const fields = { engagementId: 'CONFIRM-ENGAGEMENT', officerId: x.officerId, employerId: 'EMP-1', payBasis: 'monthly', agreedHourlyRateCents: '0', payCadence: 'monthly', payCadenceRequestReference: '', termsVersion: 'TERMS-v1', engagementReference: 'private:fixture-engagement', weeklyHourCap: '24', payrollReference: 'private:fixture-payroll', benefitsReference: 'private:fixture-benefits' };
    const engagement = await manageProductionEvidence(x.db, maker, { action: 'prepare_evidence', kind: 'engagement', fields, sourceDocumentsReviewed: true, expiresAt: new Date(Date.now() + 86400000).toISOString() });
    await manageProductionEvidence(x.db, checker, { action: 'decide_evidence', reviewId: engagement.reviewId, decision: 'approve', evidenceIndependentlyChecked: true, reason: 'Independently checked local fixture employment.' });
    seedOfficerSupport(database, x.officerId, fields.engagementId, 'CONFIRM-TERMS');
    database.prepare("UPDATE officers SET banking_status='verified',flex_available=1,external_work_acknowledged=1,rest_window_confirmed=1 WHERE id=?").run(x.officerId);
    const passport = await prepareReadinessPassport(x.db, assessor, x.passportInput); await decision(x.db, 'passport', passport.id);
    const times = await moveCandidateToCheckInWindow(database, x.officerId);
    const db = new D1Adapter(database), command = request('client-confirmation-fixture', x.officerId);
    assert.equal(database.prepare("SELECT count(*) AS n FROM client_notification_jobs WHERE id LIKE 'assignment:%'").get().n, 0);
    const activated = await activateAssignment(db, command, 'fixture-operator');
    assert.equal(activated.state, 'activated');
    const emails = database.prepare('SELECT * FROM client_notification_jobs WHERE source_id=? ORDER BY recipient_type').all(activated.shiftId);
    assert.equal(emails.length, 2); assert.deepEqual(emails.map(j => j.recipient_type), ['client', 'operations']);
    assert.ok(emails.every(j => j.state === 'queued' && j.owner_user_id === client.userId));
    assert.match(emails[0].message_text, /Your shift at Fixture Site is confirmed/);
    assert.match(emails[0].message_text, /Officer: /); assert.match(emails[0].message_text, /SAST/);
    const date = new Date(Date.parse(times.starts) + 2 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
    assert.ok(emails[0].message_text.includes('Starts: ' + date));
    assert.equal((await readClientWorkspace(db, client)).bookings.find(b => b.id === 'BK-1').displayStatus, 'confirmed');
    await activateAssignment(db, command, 'fixture-operator');
    assert.equal(database.prepare('SELECT count(*) AS n FROM client_notification_jobs WHERE source_id=?').get(activated.shiftId).n, 2);
    await passDueScheduledCheckpoints(db);
    assert.equal((await revalidateAssignment(db, activated.shiftId, 'check_in', applicant.userId, true)).ready, true);
    assert.equal((await readClientWorkspace(db, client)).bookings.find(b => b.id === 'BK-1').displayStatus, 'in_progress');
  } finally { database.close(); }
});
