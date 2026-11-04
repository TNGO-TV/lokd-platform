import { SignupError, readSignupRecords, writeSignup } from './signup-server';
import type { SigningActor } from './production-signing';
import { agreementHash } from './agreement-acceptance';
import { clientNotificationStatement, readClientNotificationFailures } from './quote-notifications';
import type { ClientBooking, ClientCoverDetails, ClientRequest, ClientShift, ClientSite, ClientWorkspace } from './booking-client-types';

export const cancellationPolicy = 'You can cancel an unpaid draft before its start when no quote has been accepted and no officer has been assigned. For an agreed or funded booking, send a change or cancellation request. Operations will confirm the terms and any refund.';
const clean = (value: unknown, label: string, min = 1, max = 200): string => {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw new SignupError(`Enter ${label}.`);
  return value.trim();
};
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SignupError('Enter valid details.');
  return value as Record<string, unknown>;
};
function requestKey(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new SignupError('Refresh the form before submitting.');
  return value.toLowerCase();
}
function own(actor: SigningActor) { if (actor.operations) throw new SignupError('Open your client account to make this request.', 403); }
function audit(db: D1Database, actor: SigningActor, event: string, type: string, id: string, detail: unknown, now: string) {
  return db.prepare('INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), 'client', actor.userId, event, type, id, JSON.stringify(detail), now);
}
function notices(db: D1Database, actor: SigningActor, sourceId: string, action: string, subject: string, message: string, now: string) {
  const ids = [`client:${sourceId}:${action}`, `operations:${sourceId}:${action}`];
  return { ids, statements: ids.map((id, index) => clientNotificationStatement(db, { id, sourceId, ownerUserId: actor.userId, recipient: index ? 'operations' : 'client', subject: `LOKD | ${subject}`, text: `${message}\n\nReference: ${sourceId}\nSign in to LOKD to view the details.\n\nLOKD Security`, createdAt: now })) };
}
async function account(db: D1Database, actor: SigningActor) {
  return db.prepare(`SELECT c.id,c.organisation_name AS organisationName,c.contact_name AS contactName,c.contact_email AS email,c.approval_status AS approvalStatus FROM clients c JOIN production_entity_links l ON l.kind='client' AND l.entity_id=c.id WHERE l.owner_user_id=? AND c.environment='production' ORDER BY l.prepared_at DESC LIMIT 1`).bind(actor.userId).first<NonNullable<ClientWorkspace['account']>>();
}
async function availableClientId(db: D1Database, actor: SigningActor) {
  const row = await db.prepare(`SELECT c.id FROM clients c JOIN production_entity_links l ON l.kind='client' AND l.entity_id=c.id WHERE l.owner_user_id=? AND c.environment='production' AND c.integrity_state='production_verified' ORDER BY l.prepared_at DESC LIMIT 1`).bind(actor.userId).first<{ id: string }>();
  return row?.id ?? null;
}
function parsedDetail(value: string) { try { return object(JSON.parse(value)); } catch { return { note: value }; } }
export async function readClientSites(db: D1Database, actor: SigningActor): Promise<ClientSite[]> {
  const [operational, submitted] = await Promise.all([
    db.prepare(`SELECT s.id,s.name,s.area,s.address_label AS address,s.latitude_e6/1000000.0 AS latitude,s.longitude_e6/1000000.0 AS longitude,s.version,s.status,NULL AS publicNote FROM operational_sites s JOIN production_entity_links l ON l.kind='client' AND l.entity_id=s.client_id WHERE l.owner_user_id=? AND s.environment='production' AND s.integrity_state='production_verified' AND s.status!='archived' ORDER BY s.created_at DESC LIMIT 100`).bind(actor.userId).all<ClientSite>(),
    db.prepare(`SELECT id,detail,version,status FROM service_requests WHERE requested_by_id=? AND requested_by_role='client' AND category='client_site' AND environment='production' AND status IN ('open','triaged','closed') ORDER BY created_at DESC LIMIT 100`).bind(actor.userId).all<{ id: string; detail: string; version: number; status: string }>(),
  ]);
  return [...operational.results.map(s => ({ ...s, editable: false })), ...submitted.results.map(s => { const detail = parsedDetail(s.detail); return { ...detail, id: s.id, version: s.version, status: s.status, publicNote: typeof detail.publicNote === 'string' ? detail.publicNote : null, editable: s.status === 'open' } as ClientSite; })];
}
export async function readClientShifts(db: D1Database, actor: SigningActor, shiftId: string | null = null): Promise<ClientShift[]> {
  const rows = await db.prepare(`SELECT s.id,s.booking_id AS bookingId,b.site_name AS siteName,COALESCE((SELECT r.service_date FROM roster_slots r JOIN roster_assignments a ON a.roster_slot_id=r.id WHERE a.shift_id=s.id AND a.environment='production' LIMIT 1),s.scheduled_date) AS scheduledDate,s.status,o.full_name AS officerName,o.psira_grade AS grade,p.passport_number AS passportNumber,s.passport_verification_status AS passportStatus,s.passport_verified_at AS passportVerifiedAt,s.check_in_at AS checkInAt,s.check_out_at AS checkOutAt,s.client_signoff_status AS clientSignoffStatus,t.version AS timesheetVersion,(SELECT json_extract(r.detail,'$.score') FROM service_requests r WHERE r.shift_id=s.id AND r.requested_by_id=? AND r.category='shift_rating' AND r.environment='production' LIMIT 1) AS feedbackScore FROM shifts s JOIN bookings b ON b.id=s.booking_id JOIN production_entity_links l ON l.kind='client' AND l.entity_id=b.client_id JOIN officers o ON o.id=s.officer_id LEFT JOIN officer_passports p ON p.officer_id=o.id AND p.environment='production' AND p.integrity_state='production_verified' LEFT JOIN shift_timesheets t ON t.shift_id=s.id AND t.active_key=s.id AND t.environment='production' WHERE l.owner_user_id=? AND b.environment='production' AND b.integrity_state='production_verified' AND s.environment='production' AND s.integrity_state='production_verified' AND (? IS NULL OR s.id=?) ORDER BY s.scheduled_date DESC,s.id DESC LIMIT 200`).bind(actor.userId, actor.userId, shiftId, shiftId).all<ClientShift>();
  return rows.results.map(s => ({ ...s, minutesOnSite: s.checkInAt ? Math.max(0, Math.floor(((s.checkOutAt ? Date.parse(s.checkOutAt) : Date.now()) - Date.parse(s.checkInAt)) / 60000)) : 0 }));
}
export async function readClientWorkspace(db: D1Database, actor: SigningActor): Promise<ClientWorkspace> {
  own(actor);
  const [a, intake, sites, bookings, requests, shifts, notifications, slots] = await Promise.all([
    account(db, actor), readSignupRecords(db, actor, 'client'), readClientSites(db, actor),
    db.prepare(`SELECT b.id,b.site_name AS siteName,b.site_area AS siteArea,b.service_type AS serviceType,b.start_date AS startDate,b.end_date AS endDate,b.shift_start AS shiftStart,b.shift_end AS shiftEnd,b.status,b.funding_status AS fundingStatus,b.client_price_cents AS totalCents,b.client_version AS version,b.shift_count AS plannedSlots,CASE WHEN b.status='draft' AND b.funding_status='unfunded' AND datetime(b.start_date||'T'||b.shift_start||':00','-2 hours')>datetime('now') AND NOT EXISTS(SELECT 1 FROM shifts s WHERE s.booking_id=b.id) AND NOT EXISTS(SELECT 1 FROM offers o WHERE o.booking_id=b.id AND o.status IN ('open','accepted')) AND NOT EXISTS(SELECT 1 FROM roster_assignments a JOIN roster_slots r ON r.id=a.roster_slot_id WHERE r.booking_id=b.id) AND NOT EXISTS(SELECT 1 FROM client_quote_offers q JOIN client_quote_receipts r ON r.quote_id=q.id WHERE q.order_id=b.id) AND NOT EXISTS(SELECT 1 FROM agreement_acceptance_receipts a JOIN roster_slots r ON r.id=json_extract(a.receipt_json,'$.context.transactionId') WHERE r.booking_id=b.id AND json_extract(a.receipt_json,'$.purpose')='client_service') AND NOT EXISTS(SELECT 1 FROM booking_collection_requests c WHERE c.order_id=b.id) THEN 1 ELSE 0 END AS canCancel FROM bookings b JOIN production_entity_links l ON l.kind='client' AND l.entity_id=b.client_id WHERE l.owner_user_id=? AND b.environment='production' AND b.integrity_state='production_verified' ORDER BY b.start_date DESC,b.id DESC LIMIT 100`).bind(actor.userId).all<ClientBooking & { plannedSlots: number }>(),
    db.prepare(`SELECT id,category,status,summary,detail,version,created_at AS createdAt,booking_id AS bookingId,shift_id AS shiftId FROM service_requests WHERE requested_by_id=? AND requested_by_role='client' AND environment='production' AND category!='client_site' ORDER BY created_at DESC LIMIT 100`).bind(actor.userId).all<Omit<ClientRequest, 'detail'> & { detail: string }>(),
    readClientShifts(db, actor),
    readClientNotificationFailures(db, actor.userId),
    db.prepare(`SELECT r.booking_id AS bookingId,r.id,
      EXISTS(SELECT 1 FROM roster_assignments a JOIN shifts s ON s.id=a.shift_id WHERE a.roster_slot_id=r.id AND a.environment='production' AND a.status='confirmed' AND a.active_key=r.id AND s.status IN ('confirmed','on_post','completed','verified')) AS staffed,
      EXISTS(SELECT 1 FROM roster_assignments a JOIN shifts s ON s.id=a.shift_id WHERE a.roster_slot_id=r.id AND a.environment='production' AND a.status='confirmed' AND a.active_key=r.id AND s.environment='production' AND s.status IN ('completed','verified')) AS completed,
      EXISTS(SELECT 1 FROM roster_assignments a JOIN shifts s ON s.id=a.shift_id WHERE a.roster_slot_id=r.id AND a.environment='production' AND a.active_key=r.id AND s.status='on_post') AS onPost
      FROM roster_slots r JOIN bookings b ON b.id=r.booking_id JOIN production_entity_links l ON l.kind='client' AND l.entity_id=b.client_id
      WHERE l.owner_user_id=? AND b.environment='production' AND r.environment='production' AND r.status!='cancelled'`).bind(actor.userId).all<{ bookingId: string; id: string; staffed: number; completed: number; onPost: number }>(),
  ]);
  const states = new Map<string, { scheduled: number; staffed: number; completed: number; onPost: number }>();
  for (const slot of slots.results) { const state = states.get(slot.bookingId) ?? { scheduled: 0, staffed: 0, completed: 0, onPost: 0 }; state.scheduled++; state.staffed += Number(slot.staffed); state.completed += Number(slot.completed); state.onPost += Number(slot.onPost); states.set(slot.bookingId, state); }
  return { account: a, enquiries: intake.records, sites, bookings: bookings.results.map(b => {
    const state = states.get(b.id), planned = b.plannedSlots;
    const displayStatus = b.status === 'cancelled' ? 'cancelled' : state?.onPost ? 'in_progress'
      : state && planned > 0 && state.scheduled >= planned && state.completed === state.scheduled ? 'completed'
      : state && planned > 0 && state.scheduled >= planned && state.staffed === state.scheduled ? 'confirmed'
      : state && (state.staffed > 0 || state.completed > 0) ? 'partially_staffed'
      : b.status === 'completed' ? 'awaiting_review' : b.status === 'active' ? 'awaiting_assignment' : b.status;
    return { ...b, displayStatus, canCancel: Boolean(b.canCancel), cancellationMessage: b.canCancel ? 'You can cancel this draft.' : cancellationPolicy };
  }), requests: requests.results.map(r => ({ ...r, detail: parsedDetail(r.detail) })), shifts, notifications, cancellationPolicy };
}

async function registerAccount(db: D1Database, actor: SigningActor, input: Record<string, unknown>) {
  const key = requestKey(input.requestId), id = 'ENQ-' + key.toUpperCase();
  if (input.privacyConsent !== true) throw new SignupError('Agree to the privacy notice to create your account.');
  const organisationName = clean(input.organisationName, 'your organisation name', 2, 120), contactName = clean(input.contactName, 'your contact name', 3, 100), siteArea = clean(input.siteArea, 'your site area', 2, 100), message = clean(input.message, 'a site brief of at least 20 characters', 20, 2000);
  const siteType = clean(input.siteType, 'your site type');
  if (!['commercial_property', 'logistics_industrial', 'construction', 'residential_estate', 'education', 'retail', 'other'].includes(siteType)) throw new SignupError('Choose a site type.');
  const digits = typeof input.mobile === 'string' ? input.mobile.replace(/\D/g, '') : '';
  if (digits && !/^(0\d{9}|27\d{9})$/.test(digits)) throw new SignupError('Enter a South African mobile number.');
  const mobile = digits.startsWith('0') ? '+27' + digits.slice(1) : digits ? '+' + digits : null;
  const payload = JSON.stringify({ organisationName, contactName, email: actor.email.toLowerCase(), mobile, siteArea, siteType, message });
  const keyHash = await agreementHash('client-account:' + actor.userId + ':' + key), hash = await agreementHash(payload);
  const existing = await db.prepare('SELECT enquiry_id,payload_hash FROM client_enquiry_receipts WHERE request_key_hash=?').bind(keyHash).first<{ enquiry_id: string; payload_hash: string }>();
  if (existing) { if (existing.payload_hash !== hash) throw new SignupError('This form was already submitted with different details.', 409); return { id: existing.enquiry_id, notificationIds: [] }; }
  const prior = await readSignupRecords(db, actor, 'client');
  if (prior.records.some(r => r.accountLinked && r.status !== 'withdrawn')) throw new SignupError('Your account already has an enquiry. Use its account details to make changes.', 409);
  const now = new Date().toISOString(), event = crypto.randomUUID();
  const mail = notices(db, actor, id, 'registered', 'Your account is ready', 'Your organisation details have been saved. You can now add sites and request cover. Our team will review your service requirements.', now);
  await db.batch([
    db.prepare(`INSERT INTO client_enquiries(id,organisation_name,contact_name,email_normalized,mobile_normalized,site_area,site_type,required_start,message,privacy_notice_version,privacy_acknowledged_at,retention_review_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'planning',?,'client-account-2026-11',?,?,?,?)`).bind(id, organisationName, contactName, actor.email.toLowerCase(), mobile, siteArea, siteType, message, now, new Date(Date.now() + 365 * 86400000).toISOString(), now, now),
    db.prepare(`INSERT INTO signup_cases(kind,source_id,owner_user_id,status,public_note,corrections_json,version,latest_event_id,updated_at) VALUES('client',?,?,'awaiting_review','Your details have been received.','{}',1,?,?)`).bind(id, actor.userId, event, now),
    db.prepare(`INSERT INTO signup_events(id,kind,source_id,version,action,actor_user_id,public_note,details_json,recorded_at) VALUES(?,'client',?,1,'link',?,'Account created.','{}',?)`).bind(event, id, actor.userId, now),
    db.prepare('INSERT INTO client_enquiry_receipts(request_key_hash,payload_hash,enquiry_id,created_at) VALUES(?,?,?,?)').bind(keyHash, hash, id, now),
    audit(db, actor, 'client_account_registered', 'client_enquiry', id, { privacyNoticeVersion: 'client-account-2026-11' }, now), ...mail.statements,
  ]);
  return { id, notificationIds: mail.ids };
}

function siteDetails(input: Record<string, unknown>) {
  const missing = (v: unknown) => v === undefined || v === null || v === '';
  const latitude = missing(input.latitude) ? null : Number(input.latitude), longitude = missing(input.longitude) ? null : Number(input.longitude);
  if ((latitude === null) !== (longitude === null) || latitude !== null && (!Number.isFinite(latitude) || latitude < -35 || latitude > -22) || longitude !== null && (!Number.isFinite(longitude) || longitude < 16 || longitude > 33)) throw new SignupError('Enter both South African site coordinates, or leave them blank.');
  return { name: clean(input.name, 'a site name', 2), area: clean(input.area, 'a site area', 2), address: clean(input.address, 'the street address', 5, 500), latitude, longitude };
}
export function validateCoverDetails(input: Record<string, unknown>, site: ClientSite, now = Date.now()): ClientCoverDetails {
  if (!['Unarmed', 'Armed', 'VIP'].includes(String(input.serviceType))) throw new SignupError('Choose unarmed guarding, armed response or VIP protection.');
  const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const clock = (value: unknown) => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!date(input.startDate) || !date(input.endDate) || !clock(input.shiftStart) || !clock(input.shiftEnd)) throw new SignupError('Choose valid service dates and times.');
  const startDate = input.startDate as string, endDate = input.endDate as string, shiftStart = input.shiftStart as string, shiftEnd = input.shiftEnd as string;
  if (Date.parse(startDate + 'T' + shiftStart + ':00+02:00') <= now || endDate < startDate || Date.parse(endDate) - Date.parse(startDate) > 366 * 86400000 || shiftStart === shiftEnd) throw new SignupError('Choose a future start, an end within one year, and different start and end times.');
  const headcount = input.headcount;
  if (typeof headcount !== 'number' || !Number.isSafeInteger(headcount) || headcount < 1 || headcount > 500) throw new SignupError('Choose between 1 and 500 officers.');
  return { siteId: site.id, siteName: site.name, siteArea: site.area, address: site.address, serviceType: input.serviceType as ClientCoverDetails['serviceType'], startDate, endDate, shiftStart, shiftEnd, headcount, note: clean(input.note, 'service instructions', 3, 2000) };
}
async function insertRequest(db: D1Database, actor: SigningActor, input: { id: string; category: string; summary: string; detail: Record<string, unknown>; bookingId?: string; shiftId?: string; clientId?: string | null; priority?: string; subject: string; message: string }) {
  const detail = JSON.stringify(input.detail), existing = await db.prepare('SELECT requested_by_id,detail,category,client_id,booking_id,shift_id FROM service_requests WHERE id=?').bind(input.id).first<{ requested_by_id: string; detail: string; category: string; client_id: string | null; booking_id: string | null; shift_id: string | null }>();
  if (existing) {
    if (existing.requested_by_id !== actor.userId || existing.detail !== detail || existing.category !== input.category || existing.client_id !== (input.clientId ?? null) || existing.booking_id !== (input.bookingId ?? null) || existing.shift_id !== (input.shiftId ?? null)) throw new SignupError('This submission reference is already in use.', 409);
    return { id: input.id, notificationIds: [] };
  }
  const now = new Date().toISOString(), mail = notices(db, actor, input.id, 'received', input.subject, input.message, now);
  await db.batch([
    db.prepare(`INSERT INTO service_requests(id,client_id,booking_id,shift_id,requested_by_role,requested_by_id,category,summary,detail,priority,status,environment,integrity_state,created_at,updated_at) VALUES(?,?,?,?,'client',?,?,?,?,?,'open','production','production_verified',?,?)`).bind(input.id, input.clientId ?? null, input.bookingId ?? null, input.shiftId ?? null, actor.userId, input.category, input.summary, detail, input.priority ?? 'normal', now, now),
    audit(db, actor, 'client_' + input.category + '_received', 'service_request', input.id, input.detail, now), ...mail.statements,
  ]);
  return { id: input.id, notificationIds: mail.ids };
}
async function ownRequest(db: D1Database, actor: SigningActor, input: Record<string, unknown>, category: string) {
  const id = clean(input.id, 'a request reference');
  const row = await db.prepare(`SELECT id,detail,version,status FROM service_requests WHERE id=? AND requested_by_id=? AND requested_by_role='client' AND category=? AND environment='production'`).bind(id, actor.userId, category).first<{ id: string; detail: string; version: number; status: string }>();
  if (!row) throw new SignupError('Request not found.', 404);
  if (input.expectedVersion !== row.version || row.status !== 'open') throw new SignupError('This request has changed. Refresh before continuing.', 409);
  return row;
}
async function changeRequest(db: D1Database, actor: SigningActor, row: { id: string; version: number }, event: string, detail: Record<string, unknown>, status = 'open') {
  const now = new Date().toISOString(), mail = notices(db, actor, row.id, `${event}:${row.version + 1}`, status === 'cancelled' ? 'Request cancelled' : 'Request updated', status === 'cancelled' ? 'Your request has been cancelled.' : 'Your updated details have been saved for our team.', now);
  await db.batch([audit(db, actor, event, 'service_request', row.id, { expectedVersion: row.version, details: detail }, now), db.prepare(`UPDATE service_requests SET detail=?,status=?,version=version+1,updated_at=? WHERE id=? AND version=?`).bind(JSON.stringify(detail), status, now, row.id, row.version), ...mail.statements]);
  return { id: row.id, notificationIds: mail.ids };
}

export async function operateClientWorkspace(db: D1Database, actor: SigningActor, input: Record<string, unknown>) {
  own(actor);
  if (input.action === 'register_account') return registerAccount(db, actor, input);
  if (input.action === 'claim_enquiry' || input.action === 'update_account') {
    await writeSignup(db, actor, { ...input, kind: 'client', action: input.action === 'claim_enquiry' ? 'link' : 'correct' });
    return { id: String(input.id), notificationIds: [] };
  }
  if (input.action === 'save_site') {
    const detail = siteDetails(input);
    if (input.id) return changeRequest(db, actor, await ownRequest(db, actor, input, 'client_site'), 'client_site_changed', detail);
    return insertRequest(db, actor, { id: 'SITE-REQUEST-' + requestKey(input.requestId), category: 'client_site', summary: 'Site: ' + detail.name, detail, subject: 'Site saved', message: `Your site ${detail.name} has been saved.` });
  }
  if (input.action === 'request_cover' || input.action === 'change_request') {
    const site = (await readClientSites(db, actor)).find(s => s.id === input.siteId);
    if (!site) throw new SignupError('Choose one of your saved sites.', 404);
    const detail = validateCoverDetails(input, site);
    if (input.action === 'change_request') return changeRequest(db, actor, await ownRequest(db, actor, input, 'booking_request'), 'client_cover_changed', detail);
    return insertRequest(db, actor, { id: 'COVER-' + requestKey(input.requestId), category: 'booking_request', summary: `${detail.serviceType} cover at ${site.name}`, detail, clientId: await availableClientId(db, actor), subject: 'Cover requested', message: `We received your request for ${detail.serviceType.toLowerCase()} cover at ${site.name}, starting ${detail.startDate}. Our team will review it and send your quote.` });
  }
  if (input.action === 'cancel_request') { const row = await ownRequest(db, actor, input, 'booking_request'); return changeRequest(db, actor, row, 'client_cover_cancelled', { ...parsedDetail(row.detail), cancellationReason: clean(input.reason, 'a cancellation reason', 3, 1200) }, 'cancelled'); }
  if (input.action === 'cancel_booking' || input.action === 'request_booking_change' || input.action === 'change_booking' || input.action === 'request_cancellation') {
    const workspace = await readClientWorkspace(db, actor), booking = workspace.bookings.find(b => b.id === input.id);
    if (!booking) throw new SignupError('Booking not found.', 404);
    if (input.expectedVersion !== booking.version) throw new SignupError('The booking changed. Refresh before continuing.', 409);
    if (['completed', 'cancelled'].includes(booking.displayStatus)) throw new SignupError('This booking is closed. Raise a service issue if you need help.', 409);
    const reason = clean(input.reason, 'the requested change or cancellation reason', 3, 2000);
    if (input.action !== 'cancel_booking') return insertRequest(db, actor, { id: 'CHANGE-' + requestKey(input.requestId), category: input.action === 'request_cancellation' ? 'booking_cancellation' : 'booking_change', summary: input.action === 'request_cancellation' ? 'Booking cancellation requested' : 'Booking change requested', detail: { reason, bookingVersion: booking.version }, bookingId: booking.id, clientId: await availableClientId(db, actor), subject: 'Booking request received', message: 'Your booking request has been sent to Operations. We will confirm the terms and any price or refund before making the change.' });
    if (!booking.canCancel) throw new SignupError('Send a cancellation request so Operations can confirm your agreed terms.', 409);
    const now = new Date().toISOString(), mail = notices(db, actor, booking.id, 'cancelled', 'Booking cancelled', `Your draft booking for ${booking.siteName} has been cancelled.`, now);
    await db.batch([audit(db, actor, 'client_booking_cancelled', 'booking', booking.id, { reason, expectedVersion: booking.version }, now), db.prepare("UPDATE bookings SET status='cancelled' WHERE id=? AND client_version=?").bind(booking.id, booking.version), db.prepare("UPDATE roster_slots SET status='cancelled',version=version+1,updated_at=? WHERE booking_id=? AND status='scheduled'").bind(now, booking.id), ...mail.statements]);
    return { id: booking.id, notificationIds: mail.ids };
  }
  if (input.action === 'confirm_service' || input.action === 'dispute_service') return decideService(db, actor, input);
  throw new SignupError('Choose a supported client action.');
}

async function ownedShift(db: D1Database, actor: SigningActor, shiftId: unknown) {
  const id = clean(shiftId, 'a shift reference');
  const shift = await db.prepare(`SELECT s.id,s.booking_id AS bookingId,s.status,b.client_id AS clientId FROM shifts s JOIN bookings b ON b.id=s.booking_id JOIN production_entity_links l ON l.kind='client' AND l.entity_id=b.client_id WHERE s.id=? AND l.owner_user_id=? AND b.environment='production' AND b.integrity_state='production_verified' AND s.environment='production' AND s.integrity_state='production_verified'`).bind(id, actor.userId).first<{ id: string; bookingId: string; status: string; clientId: string }>();
  if (!shift) throw new SignupError('Shift not found for your account.', 404);
  return shift;
}
export async function writeClientFeedback(db: D1Database, actor: SigningActor, input: Record<string, unknown>) {
  own(actor);
  const shift = await ownedShift(db, actor, input.shiftId), note = clean(input.note, 'a short note', 3, 2000);
  if (!['rate_shift', 'raise_issue'].includes(String(input.action))) throw new SignupError('Choose a rating or an issue.');
  const rating = input.action === 'rate_shift', score = input.score;
  if (rating && (!['completed', 'verified'].includes(shift.status) || typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5)) throw new SignupError('Rate a completed shift from 1 to 5.');
  return insertRequest(db, actor, { id: 'FEEDBACK-' + requestKey(input.requestId), category: rating ? 'shift_rating' : 'service_issue', summary: rating ? `Shift rating: ${score}/5` : 'Client service issue', detail: { note, ...(rating ? { score } : {}) }, clientId: shift.clientId, bookingId: shift.bookingId, shiftId: shift.id, priority: rating ? 'normal' : 'high', subject: rating ? 'Thank you for your feedback' : 'Your issue has been received', message: rating ? 'Your shift rating and comments have been shared with Operations.' : 'Your service issue has been sent to Operations for review. For an immediate emergency, call the emergency services.' });
}
export async function readClientFeedback(db: D1Database, actor: SigningActor) {
  const rows = await db.prepare(`SELECT id,client_id AS clientId,booking_id AS bookingId,shift_id AS shiftId,category,summary,detail,status,priority,version,created_at AS createdAt FROM service_requests WHERE environment='production' AND category IN ('shift_rating','service_issue') ${actor.operations ? '' : 'AND requested_by_id=?'} ORDER BY created_at DESC LIMIT 100`).bind(...(actor.operations ? [] : [actor.userId])).all<{ detail: string }>();
  return { feedback: rows.results.map(r => ({ ...r, detail: parsedDetail(r.detail) })) };
}
async function decideService(db: D1Database, actor: SigningActor, input: Record<string, unknown>) {
  const shift = await ownedShift(db, actor, input.shiftId), note = clean(input.note, 'your service comments', 3, 2000);
  const t = await db.prepare(`SELECT id,version,client_evidence_status,operations_status FROM shift_timesheets WHERE shift_id=? AND active_key=shift_id AND environment='production'`).bind(shift.id).first<{ id: string; version: number; client_evidence_status: string; operations_status: string }>();
  if (!t || !['completed', 'verified'].includes(shift.status)) throw new SignupError('The officer must complete this shift before you confirm it.', 409);
  if (t.version !== input.expectedVersion || t.client_evidence_status !== 'pending' || t.operations_status !== 'awaiting_review') throw new SignupError('This shift has changed or already has a decision. Refresh before continuing.', 409);
  const confirmed = input.action === 'confirm_service', now = new Date().toISOString(), status = confirmed ? 'confirmed' : 'disputed';
  const mail = notices(db, actor, shift.id, status, confirmed ? 'Service confirmed' : 'Service dispute received', confirmed ? 'Your completed shift has been confirmed.' : 'Your service dispute has been sent to Operations for review.', now);
  await db.batch([
    db.prepare('INSERT INTO production_service_events(id,shift_id,action,actor_id,detail,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), shift.id, confirmed ? 'client_signoff' : 'client_dispute', actor.userId, JSON.stringify({ note, expectedVersion: t.version }), now),
    db.prepare(`UPDATE shift_timesheets SET client_evidence_status=?,version=version+1,updated_at=? WHERE id=? AND version=? AND client_evidence_status='pending'`).bind(status, now, t.id, t.version),
    db.prepare(`UPDATE shifts SET status=CASE WHEN ? THEN 'verified' ELSE status END,client_signoff_status=?,signed_off_at=CASE WHEN ? THEN ? ELSE signed_off_at END WHERE id=?`).bind(confirmed ? 1 : 0, confirmed ? 'approved' : 'disputed', confirmed ? 1 : 0, now, shift.id),
    audit(db, actor, 'client_service_' + status, 'shift', shift.id, { note, expectedVersion: t.version }, now), ...mail.statements,
  ]);
  return { id: shift.id, notificationIds: mail.ids };
}
