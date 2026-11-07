import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { bookingModelSchedule as schedule, BOOKING_MODEL_VERSION, sastDate, dateAfterDays } from '../app/lib/booking-models.ts';
import { publicBooking, validateBookingStart } from '../app/lib/public-booking.ts';
import { ClientDatabase, seedClient } from './fixtures/client-booking-db.mjs';
import { bookingWorkforceRouteDecision } from '../app/lib/workforce-core.ts';
import { normalizeSpecialistConfiguration } from '../app/lib/specialist-pricing.ts';
import { operatePaymentRecovery } from '../app/lib/payment-recovery.ts';
import { operatePaymentExecution } from '../app/lib/payment-execution.ts';
import { workforceReadinessStatuses } from '../app/lib/workforce-core.ts';
import { prepareProductionOrder } from '../app/lib/production-orders.ts';
import { prepareFinanceDocument } from '../app/lib/finance-documents.ts';
const start = '2026-11-16', instant = Date.parse(start + 'T06:00:00+02:00');
const input = (model, patch = {}) => ({ model, startDate: start, shift: 'day', durationWeeks: model === 'flex' ? 1 : 0, contractMonths: model === 'fixed' ? 3 : 0, ...patch });
test('Bolt is strictly below 72 hours, while Flex includes the exact 72-hour boundary', () => {
  assert.equal(schedule(input('bolt'), instant - 72 * 3600000 + 1).model, 'bolt');
  assert.throws(() => schedule(input('bolt'), instant - 72 * 3600000), /less than 72/);
  assert.equal(schedule(input('flex'), instant - 72 * 3600000).model, 'flex');
  assert.throws(() => schedule(input('flex'), instant - 72 * 3600000 + 1), /at least 72/);
});
test('Flex measures a week as seven calendar days and Fixed starts at three months', () => {
  for (const weeks of [1, 2, 12, 52]) { const s = schedule(input('flex', { durationWeeks: weeks }), instant - 100 * 3600000); assert.equal(Date.parse(s.endDate) - Date.parse(s.startDate), (weeks * 7 - 1) * 86400000); }
  for (const durationWeeks of [0, -1, 1.5, 53, '1']) assert.throws(() => schedule(input('flex', { durationWeeks }), instant - 100 * 3600000), /seven days/);
  for (const contractMonths of [0, 1, 2, 4, '3']) assert.throws(() => schedule(input('fixed', { contractMonths }), instant - 100 * 3600000), /three months/);
  assert.equal(schedule(input('fixed'), instant - 24 * 3600000).endDate, '2027-02-15');
});
test('notice uses the SAST shift instant across midnight and current Bolt cover requires an unended shift', () => {
  assert.equal(schedule(input('bolt', { shift: 'night' }), Date.parse('2026-11-13T16:00:00.001Z')).model, 'bolt');
  assert.throws(() => schedule(input('bolt', { shift: 'night' }), Date.parse('2026-11-13T16:00:00Z')), /less than 72/);
  assert.equal(schedule(input('bolt'), instant + 3600000, true).noticeHours, 0);
  assert.throws(() => schedule(input('bolt'), instant + 12 * 3600000, true), /future shift/);
});
test('public intent keeps the authoritative model, weeks and rate snapshot private', () => {
  const now = new Date(instant - 72 * 3600000), base = { siteType: 'commercial_property', siteAddress: '135 West Street, Sandton', serviceType: 'scheduled_unarmed_fixed_site', booking: { coverType: 'flex', startDate: start, shift: 'day', officers: 2, term: 'week', durationWeeks: 2, rosterPattern: 'weekdays' } };
  const b = publicBooking(base, now); validateBookingStart(b, now);
  assert.equal(b.engagementModel, 'flex'); assert.equal(b.modelVersion, BOOKING_MODEL_VERSION); assert.equal(b.schedule.endDate, '2026-11-29'); assert.equal(b.draftPrice.serviceDayCount, 10);
  assert.throws(() => validateBookingStart(b, new Date(now.getTime() + 1)), /at least 72/);
  assert.deepEqual(publicBooking(base, new Date(now.getTime() + 1)).intent, b.intent, 'exact saved receipt replay is checked before the advancing notice clock');
  assert.throws(() => publicBooking({ ...base, booking: { ...base.booking, coverType: 'fixed', term: '1' } }, now), /three months/);
});
function insertProduct(db, model, patch = {}) {
  const now = new Date(), date = dateAfterDays(sastDate(now), model === 'bolt' ? 1 : 4), s = schedule({ model, startDate: date, shift: 'day', durationWeeks: model === 'flex' ? 1 : 0, contractMonths: model === 'fixed' ? 3 : 0 }, now.getTime()), row = { id: crypto.randomUUID(), client_id: 'CLIENT-FIXTURE-A', site_name: 'Sandton offices', site_area: 'Sandton', post_name: 'Gate', service_type: 'Unarmed', minimum_grade: 'Grade C', contract_months: s.contractMonths, start_date: s.startDate, end_date: s.endDate, shift_start: '06:00', shift_end: '18:00', client_price_cents: 100000, officer_rate_cents: 50000, release_cadence: 'Weekly', status: 'draft', environment: 'production', integrity_state: 'production_verified', engagement_model: model, model_version: BOOKING_MODEL_VERSION, requested_at: now.toISOString(), duration_weeks: s.durationWeeks, ...patch };
  db.sql.prepare(`INSERT INTO bookings(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row)); return row.id;
}
test('storage rechecks product terms and freezes the original notice evidence', () => {
  const db = new ClientDatabase(); try {
    seedClient(db); const bolt = insertProduct(db, 'bolt'); insertProduct(db, 'flex'); insertProduct(db, 'fixed');
    assert.throws(() => insertProduct(db, 'fixed', { contract_months: 1 }), /booking_product_model_invalid/);
    assert.throws(() => insertProduct(db, 'flex', { duration_weeks: 0 }), /booking_product_model_invalid/);
    assert.throws(() => insertProduct(db, 'bolt', { start_date: '2090-01-01', end_date: '2090-01-01' }), /booking_product_model_invalid/);
    assert.throws(() => db.sql.prepare('UPDATE bookings SET requested_at=? WHERE id=?').run(new Date().toISOString() + 'changed', bolt), /immutable/);
  } finally { db.sql.close(); }
});
test('all three products reject external security-firm employment and obsolete confirmations', () => {
  for (const model of ['bolt', 'flex', 'fixed']) assert.equal(bookingWorkforceRouteDecision(model, 'partner').ready, false);
  assert.throws(() => workforceReadinessStatuses('partner'), /LOKD employment/);
  const db = new ClientDatabase(); try {
    assert.throws(() => db.sql.exec("INSERT INTO workforce_employers(id,legal_name,employer_type,environment,status) VALUES('firm','Other firm','partner_company','production','current')"), /lokd_employer_required/);
    for (const table of ['partner_destination_reviews', 'partner_payment_instructions', 'production_partner_payable_reviews', 'specialist_partners']) assert.throws(() => db.sql.exec(`INSERT INTO ${table} DEFAULT VALUES`), /external_firm_work_retired/);
  } finally { db.sql.close(); }
});
test('the retirement migration suspends old firm routes without deleting their history', () => {
  const sql = new DatabaseSync(':memory:'); try {
    for (const file of fs.readdirSync('drizzle').filter(f => f.endsWith('.sql') && f < '0191').sort()) sql.exec(fs.readFileSync('drizzle/' + file, 'utf8'));
    sql.exec("INSERT INTO workforce_employers(id,legal_name,employer_type,environment,status) VALUES('old-firm','Historical firm','partner_company','production','current')");
    sql.exec(fs.readFileSync('drizzle/0191_lokd_direct_workforce_only.sql', 'utf8'));
    assert.equal(sql.prepare("SELECT status FROM workforce_employers WHERE id='old-firm'").get().status, 'suspended');
    assert.equal(sql.prepare("SELECT count(*) n FROM audit_events WHERE event_type='workforce_route_retired'").get().n, 1);
    assert.throws(() => sql.exec("UPDATE workforce_employers SET status='current' WHERE id='old-firm'"), /lokd_employer_required/);
  } finally { sql.close(); }
});
test('financial execution/recovery and specialist selection cannot revive removed firm work', async () => {
  const db = new ClientDatabase(), actor = { userId: 'operator', email: 'operator@example.test', operations: true }; try {
    await assert.rejects(() => operatePaymentRecovery(db, actor, { kind: 'partner' }, new Headers()), /employee/);
    await assert.rejects(() => operatePaymentExecution(db, actor, { action: 'verify_live_payment', kind: 'partner' }, new Headers()), /employee/);
    await assert.rejects(() => prepareFinanceDocument(db, actor, { kind: 'remittance' }, new Headers()), /document type/);
    assert.throws(() => db.sql.exec("INSERT INTO finance_document_versions(kind) VALUES('remittance')"), /external_firm_work_retired/);
    assert.throws(() => normalizeSpecialistConfiguration('Armed', { serviceCode: 'armed_movement', vehicleClass: 'armoured_partner' }), /support|vehicle/i);
  } finally { db.sql.close(); }
});
test('a delayed Flex order uses only its own saved, matching request as notice evidence', async () => {
  const db = new ClientDatabase(), actor = { userId: 'operator', email: 'operator@example.test', operations: true };
  try {
    const clientId = seedClient(db), startDate = dateAfterDays(sastDate(), 1), receivedAt = new Date(Date.parse(startDate+'T06:00:00+02:00')-100*3600000).toISOString();
    const detail = {modelVersion:BOOKING_MODEL_VERSION,engagementModel:'flex',startDate,shift:'day',durationWeeks:1,contractMonths:0,rosterPattern:'daily',headcount:2,serviceCode:'standard_unarmed'};
    const owner = db.sql.prepare('SELECT owner_user_id FROM production_entity_links WHERE entity_id=?').get(clientId).owner_user_id;
    db.sql.prepare("INSERT INTO service_requests(id,client_id,requested_by_role,requested_by_id,category,summary,detail,status,environment,integrity_state,created_at,updated_at) VALUES('COVER-notice',?,'client',?,'booking_request','Weekly cover',?,'open','production','production_verified',?,?)").run(clientId,owner,JSON.stringify(detail),receivedAt,receivedAt);
    const quoteRequest = {serviceType:'Unarmed',engagementModel:'flex',term:'week',durationWeeks:1,purposeCode:'commercial_access',startDate,shift:'day',rosterPattern:'daily',specialistConfiguration:{teamSize:2},riskInput:{assetExposure:'standard',publicAccess:'controlled',incidentHistory:'none',existingControls:'strong',nightOperation:false,vulnerablePeople:false}};
    const base = {action:'quote_order',clientId,quoteRequest};
    await assert.rejects(() => prepareProductionOrder(db,actor,{...base,requestedAt:receivedAt}), /at least 72/);
    db.sql.prepare("UPDATE service_requests SET updated_at=?,version=version+1 WHERE id='COVER-notice'").run(new Date().toISOString());
    const saved = await prepareProductionOrder(db,actor,{...base,sourceRequestId:'COVER-notice'});
    assert.equal(saved.quote.engagementModel,'flex'); assert.equal(saved.quote.headcount,2);
    await assert.rejects(() => prepareProductionOrder(db,actor,{...base,clientId:'another-client',sourceRequestId:'COVER-notice'}), /does not belong/);
    await assert.rejects(() => prepareProductionOrder(db,actor,{...base,sourceRequestId:'COVER-notice',quoteRequest:{...quoteRequest,durationWeeks:2}}), /exact saved request scope/);
    await assert.rejects(() => prepareProductionOrder(db,actor,{...base,sourceRequestId:'COVER-notice',quoteRequest:{...quoteRequest,term:'single'}}), /term and roster/);
    db.sql.prepare("UPDATE service_requests SET status='cancelled' WHERE id='COVER-notice'").run();
    await assert.rejects(() => prepareProductionOrder(db,actor,{...base,sourceRequestId:'COVER-notice'}), /does not belong/);
  } finally { db.sql.close(); }
});
