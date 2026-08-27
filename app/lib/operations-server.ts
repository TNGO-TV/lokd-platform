import type { PilotPrincipal } from "./pilot-runtime";
import { evaluateBookingReadiness } from "./passport-server";
import {
  ageInMinutes,
  coverageStateLabel,
  deriveCoverageState,
  deriveOperationalState,
  highestPriority,
  highestSeverity,
  nextOperationalAction,
  minutesUntil,
  operationalStateLabel,
  signalFreshness,
} from "./operations-core";
import type {
  CoverageState,
  OperationsAction,
  OperationsCommandState,
  OperationsEvent,
  OperationsException,
  OperationsIncident,
  OperationsPost,
  OperationsReliefDispatch,
  OperationsReserveOfficer,
  OperationsRosterSlot,
  OperationsSite,
} from "./operations-types";

const PILOT_CLIENT_ID = "CL-001";

export class OperationsError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function eventId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function isoOffset(now: Date, minutes: number) {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

function dateInJohannesburg(now: Date) {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

async function all<T>(statement: D1PreparedStatement) {
  const result = await statement.all<T>();
  return result.results ?? [];
}

type ReliefEligibilitySlot = {
  id: string;
  bookingId: string;
  serviceDate: string;
  startsAt: string;
  endsAt: string;
};

async function reliefCandidateEligibility(db: D1Database, officerId: string, slot: ReliefEligibilitySlot) {
  const base = await db.prepare(`SELECT id FROM officers WHERE id = ? AND approval_status = 'approved'
    AND flex_available = 1 AND external_work_acknowledged = 1 AND rest_window_confirmed = 1`)
    .bind(officerId).first<{ id: string }>();
  if (!base) return { eligible: false, reason: "Officer availability declarations are incomplete." };
  const readiness = await evaluateBookingReadiness(db, officerId, slot.bookingId, {
    assignmentDate: slot.serviceDate,
    requireServiceOptIn: true,
  });
  if (!readiness.eligible) return { eligible: false, reason: readiness.blockers[0] ?? "Readiness controls did not pass." };
  const available = await db.prepare(`SELECT id FROM officer_availability_windows
    WHERE officer_id = ? AND status = 'available' AND starts_at <= ? AND ends_at >= ?
    ORDER BY starts_at DESC LIMIT 1`).bind(officerId, slot.startsAt, slot.endsAt).first<{ id: string }>();
  if (!available) return { eligible: false, reason: "No declared availability window covers the full post." };
  const restWindowStart = new Date(new Date(slot.startsAt).getTime() - 8 * 60 * 60 * 1000).toISOString();
  const restWindowEnd = new Date(new Date(slot.endsAt).getTime() + 8 * 60 * 60 * 1000).toISOString();
  const conflictingAssignment = await db.prepare(`SELECT ra.id FROM roster_assignments ra
    JOIN roster_slots other_slot ON other_slot.id = ra.roster_slot_id
    WHERE ra.officer_id = ? AND ra.active_key IS NOT NULL AND other_slot.id <> ?
      AND ra.status NOT IN ('replaced', 'cancelled', 'completed')
      AND other_slot.starts_at < ? AND other_slot.ends_at > ? LIMIT 1`)
    .bind(officerId, slot.id, restWindowEnd, restWindowStart).first<{ id: string }>();
  if (conflictingAssignment) return { eligible: false, reason: "Another assignment conflicts with the demo overlap/rest policy." };
  const conflictingRelief = await db.prepare(`SELECT rd.id FROM relief_dispatches rd
    JOIN roster_slots other_slot ON other_slot.id = rd.roster_slot_id
    WHERE rd.replacement_officer_id = ? AND rd.active_key IS NOT NULL AND other_slot.id <> ?
      AND other_slot.starts_at < ? AND other_slot.ends_at > ? LIMIT 1`)
    .bind(officerId, slot.id, restWindowEnd, restWindowStart).first<{ id: string }>();
  if (conflictingRelief) return { eligible: false, reason: "Another relief case conflicts with the demo overlap/rest policy." };
  return { eligible: true, reason: "Readiness, availability, overlap and demo rest controls passed." };
}

export async function ensureOperationsDemoData(db: D1Database) {
  const now = new Date();
  const today = dateInJohannesburg(now);
  const endDate = isoOffset(now, 60 * 24 * 30).slice(0, 10);
  const signalRetention = isoOffset(now, 60 * 24 * 30);
  const incidentRetention = isoOffset(now, 60 * 24 * 90);

  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO clients
      (id, organisation_name, contact_name, contact_email, approval_status)
      VALUES (?, ?, ?, ?, 'approved')`)
      .bind(PILOT_CLIENT_ID, "Northbridge Property Services", "Nadia Jacobs", "nadia@northbridge.example"),
    db.prepare(`INSERT OR IGNORE INTO officers
      (id, full_name, mobile, email, city, psira_number, psira_grade, psira_expiry, approval_status, banking_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'verified', ?)`)
      .bind("OFF-001", "Lerato Khumalo", "+27 82 555 0184", "lerato@example.co.za", "Johannesburg North", "PSIRA-1842", "Grade B", "2027-05-31", now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO officers
      (id, full_name, mobile, email, city, psira_number, psira_grade, psira_expiry, approval_status, banking_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'verified', ?)`)
      .bind("OFF-002", "Ayanda Ncube", "+27 82 555 0202", "ayanda@example.co.za", "Midrand", "PSIRA-DEMO-202", "Grade C", "2027-06-30", now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO officers
      (id, full_name, mobile, email, city, psira_number, psira_grade, psira_expiry, approval_status, banking_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'verified', ?)`) 
      .bind("OFF-003", "Sibusiso Dlamini", "+27 82 555 0303", "sibusiso@example.co.za", "Johannesburg East", "PSIRA-DEMO-303", "Grade B", "2027-07-31", now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO officers
      (id, full_name, mobile, email, city, psira_number, psira_grade, psira_expiry, approval_status, banking_status,
       flex_available, external_work_acknowledged, rest_window_confirmed, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'verified', 1, 1, 1, ?)`) 
      .bind("OFF-004", "Thandi Mokoena", "+27 82 555 0404", "thandi@example.co.za", "Johannesburg North", "PSIRA-DEMO-404", "Grade B", "2027-08-31", now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO officers
      (id, full_name, mobile, email, city, psira_number, psira_grade, psira_expiry, approval_status, banking_status,
       flex_available, external_work_acknowledged, rest_window_confirmed, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'verified', 1, 1, 1, ?)`) 
      .bind("OFF-005", "Neo Molefe", "+27 82 555 0505", "neo@example.co.za", "Midrand", "PSIRA-DEMO-505", "Grade C", "2027-09-30", now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO officer_passports
      (officer_id, passport_number, public_token_hash, status, readiness_label, issued_at, last_reviewed_at, next_review_at, updated_at)
      VALUES (?, ?, ?, 'active', 'LOKD Ready', ?, ?, ?, ?)`) 
      .bind("OFF-004", "LOKD-DEMO-004", "demo-reserve-token-004", now.toISOString(), now.toISOString(), isoOffset(now, 60 * 24 * 90), now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO officer_passports
      (officer_id, passport_number, public_token_hash, status, readiness_label, issued_at, last_reviewed_at, next_review_at, updated_at)
      VALUES (?, ?, ?, 'active', 'LOKD Ready', ?, ?, ?, ?)`) 
      .bind("OFF-005", "LOKD-DEMO-005", "demo-reserve-token-005", now.toISOString(), now.toISOString(), isoOffset(now, 60 * 24 * 90), now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO officer_services
      (officer_id, service_type, qualified, opted_in, qualification_expiry)
      VALUES (?, 'Unarmed', 1, 1, ?)`)
      .bind("OFF-004", "2027-08-31"),
    db.prepare(`INSERT OR IGNORE INTO officer_services
      (officer_id, service_type, qualified, opted_in, qualification_expiry)
      VALUES (?, 'Unarmed', 1, 1, ?)`)
      .bind("OFF-005", "2027-09-30"),
    ...["OFF-004", "OFF-005"].flatMap((officerId) => [
      db.prepare(`INSERT OR IGNORE INTO officer_endorsements
        (id, officer_id, code, label, category, service_type, purpose_code, status, assessed_at, expires_at,
         next_due_at, assessor, client_visible)
        VALUES (?, ?, 'core_ready', 'Core LOKD Ready', 'core', NULL, NULL, 'current', ?, '2027-08-31',
         '2027-05-31', 'LOKD Academy demo', 1)`)
        .bind(`END-${officerId}-CORE`, officerId, now.toISOString()),
      db.prepare(`INSERT OR IGNORE INTO officer_endorsements
        (id, officer_id, code, label, category, service_type, purpose_code, status, assessed_at, expires_at,
         next_due_at, assessor, client_visible)
        VALUES (?, ?, 'service_unarmed', 'Unarmed readiness', 'service', 'Unarmed', NULL, 'current', ?, '2027-08-31',
         '2027-05-31', 'LOKD Academy demo', 1)`)
        .bind(`END-${officerId}-UNARMED`, officerId, now.toISOString()),
      db.prepare(`INSERT OR IGNORE INTO officer_endorsements
        (id, officer_id, code, label, category, service_type, purpose_code, status, assessed_at, expires_at,
         next_due_at, assessor, client_visible)
        VALUES (?, ?, 'purpose_construction', 'Construction sites', 'purpose', NULL, 'construction', 'current', ?, '2027-08-31',
         '2027-05-31', 'LOKD Academy demo', 1)`)
        .bind(`END-${officerId}-CONSTRUCTION`, officerId, now.toISOString()),
      db.prepare(`INSERT OR IGNORE INTO officer_endorsements
        (id, officer_id, code, label, category, service_type, purpose_code, status, assessed_at, expires_at,
         next_due_at, assessor, client_visible)
        VALUES (?, ?, 'purpose_secure_logistics', 'Secure logistics', 'purpose', NULL, 'secure_logistics', 'current', ?, '2027-08-31',
         '2027-05-31', 'LOKD Academy demo', 1)`)
        .bind(`END-${officerId}-LOGISTICS`, officerId, now.toISOString()),
      db.prepare(`INSERT OR IGNORE INTO officer_availability_windows
        (id, officer_id, starts_at, ends_at, source, status, rest_confirmed_at, version, created_at)
        VALUES (?, ?, ?, ?, 'demo_officer_declared', 'available', ?, 1, ?)`)
        .bind(`AVAIL-${officerId}-01`, officerId, isoOffset(now, -60), isoOffset(now, 60 * 24), now.toISOString(), now.toISOString()),
    ]),
    db.prepare(`INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date,
       shift_start, shift_end, client_price_cents, officer_rate_cents, funding_status, release_cadence, status)
      VALUES (?, ?, ?, ?, ?, 'Unarmed', 'Grade C', 1, ?, ?, '06:00', '18:00', 140000, 80000, 'paid_in_full', 'Weekly', 'active')`)
      .bind("BK-2081", PILOT_CLIENT_ID, "Northbridge Rosebank Offices", "Rosebank", "Main access", today, endDate),
    db.prepare(`INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date,
       shift_start, shift_end, client_price_cents, officer_rate_cents, funding_status, release_cadence, status)
      VALUES (?, ?, ?, ?, ?, 'Unarmed', 'Grade C', 1, ?, ?, '06:00', '18:00', 140000, 80000, 'paid_in_full', 'Weekly', 'staffed')`)
      .bind("BK-2084", PILOT_CLIENT_ID, "Metsi Midrand Depot", "Midrand", "Contractor access", today, endDate),
    db.prepare(`INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date,
       shift_start, shift_end, client_price_cents, officer_rate_cents, funding_status, release_cadence, status)
      VALUES (?, ?, ?, ?, ?, 'Unarmed', 'Grade C', 1, ?, ?, '18:00', '06:00', 140000, 80000, 'paid_in_full', 'Weekly', 'active')`)
      .bind("BK-2090", PILOT_CLIENT_ID, "Eastline Linbro Yard", "Linbro Park", "Vehicle gate", today, endDate),
    db.prepare(`INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, status, check_in_at, check_out_at, client_signoff_status, signed_off_at, earnings_cents)
      VALUES (?, ?, ?, ?, 'on_post', ?, NULL, 'not_due', NULL, 80000)`)
      .bind("SH-2081", "BK-2081", "OFF-001", today, isoOffset(now, -154)),
    db.prepare(`INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, status, check_in_at, check_out_at, client_signoff_status, signed_off_at, earnings_cents)
      VALUES (?, ?, ?, ?, 'confirmed', NULL, NULL, 'not_due', NULL, 80000)`)
      .bind("SH-2084", "BK-2084", "OFF-002", today),
    db.prepare(`INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, status, check_in_at, check_out_at, client_signoff_status, signed_off_at, earnings_cents)
      VALUES (?, ?, ?, ?, 'on_post', ?, NULL, 'not_due', NULL, 80000)`)
      .bind("SH-2090", "BK-2090", "OFF-003", today, isoOffset(now, -94)),
    db.prepare(`INSERT OR IGNORE INTO operational_sites
      (id, client_id, booking_id, name, area, address_label, latitude_e6, longitude_e6, timezone, risk_band,
       service_type, geofence_radius_meters, geofence_version, telemetry_mode, sensitivity_classification, status, version, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Africa/Johannesburg', ?, 'Unarmed', ?, 1, 'simulated', 'operational', 'active', 1, 'demo-seed', ?, ?)`)
      .bind("SITE-RSB", PILOT_CLIENT_ID, "BK-2081", "Northbridge Rosebank Offices", "Rosebank", "Pilot address withheld · Rosebank", -26146800, 28041700, "Standard", 120, now.toISOString(), now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO operational_sites
      (id, client_id, booking_id, name, area, address_label, latitude_e6, longitude_e6, timezone, risk_band,
       service_type, geofence_radius_meters, geofence_version, telemetry_mode, sensitivity_classification, status, version, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Africa/Johannesburg', ?, 'Unarmed', ?, 1, 'simulated', 'operational', 'active', 1, 'demo-seed', ?, ?)`)
      .bind("SITE-MID", PILOT_CLIENT_ID, "BK-2084", "Metsi Midrand Depot", "Midrand", "Pilot address withheld · Midrand", -25999200, 28126300, "Enhanced", 140, now.toISOString(), now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO operational_sites
      (id, client_id, booking_id, name, area, address_label, latitude_e6, longitude_e6, timezone, risk_band,
       service_type, geofence_radius_meters, geofence_version, telemetry_mode, sensitivity_classification, status, version, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Africa/Johannesburg', ?, 'Unarmed', ?, 1, 'simulated', 'operational', 'active', 1, 'demo-seed', ?, ?)`)
      .bind("SITE-LIN", PILOT_CLIENT_ID, "BK-2090", "Eastline Linbro Yard", "Linbro Park", "Pilot address withheld · Linbro Park", -26084700, 28122400, "Enhanced", 160, now.toISOString(), now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO site_posts
      (id, site_id, booking_id, name, service_type, purpose_code, minimum_grade, post_orders_version, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'Unarmed', ?, 'Grade C', ?, 'active', ?, ?)`)
      .bind("POST-RSB-01", "SITE-RSB", "BK-2081", "Main access", "commercial_access", "PO-RSB-01.3", now.toISOString(), now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO site_posts
      (id, site_id, booking_id, name, service_type, purpose_code, minimum_grade, post_orders_version, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'Unarmed', ?, 'Grade C', ?, 'active', ?, ?)`)
      .bind("POST-MID-01", "SITE-MID", "BK-2084", "Contractor access", "construction", "PO-MID-02.1", now.toISOString(), now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO site_posts
      (id, site_id, booking_id, name, service_type, purpose_code, minimum_grade, post_orders_version, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'Unarmed', ?, 'Grade C', ?, 'active', ?, ?)`) 
      .bind("POST-LIN-01", "SITE-LIN", "BK-2090", "Vehicle gate", "secure_logistics", "PO-LIN-01.6", now.toISOString(), now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO site_posts
      (id, site_id, booking_id, name, service_type, purpose_code, minimum_grade, post_orders_version, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'Unarmed', ?, 'Grade C', ?, 'active', ?, ?)`) 
      .bind("POST-LIN-02", "SITE-LIN", "BK-2090", "Perimeter rover", "secure_logistics", "PO-LIN-02.2", now.toISOString(), now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO roster_slots
      (id, site_id, post_id, booking_id, service_date, starts_at, ends_at, arrival_due_at, check_in_due_at,
       status, absence_reason, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', NULL, 1, ?, ?)`) 
      .bind("SLOT-RSB-01", "SITE-RSB", "POST-RSB-01", "BK-2081", today,
        isoOffset(now, -154), isoOffset(now, 566), isoOffset(now, -169), isoOffset(now, -144), now.toISOString(), now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO roster_slots
      (id, site_id, post_id, booking_id, service_date, starts_at, ends_at, arrival_due_at, check_in_due_at,
       status, absence_reason, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', NULL, 1, ?, ?)`) 
      .bind("SLOT-MID-01", "SITE-MID", "POST-MID-01", "BK-2084", today,
        isoOffset(now, 24), isoOffset(now, 744), isoOffset(now, 9), isoOffset(now, 34), now.toISOString(), now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO roster_slots
      (id, site_id, post_id, booking_id, service_date, starts_at, ends_at, arrival_due_at, check_in_due_at,
       status, absence_reason, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', NULL, 1, ?, ?)`) 
      .bind("SLOT-LIN-01", "SITE-LIN", "POST-LIN-01", "BK-2090", today,
        isoOffset(now, -94), isoOffset(now, 626), isoOffset(now, -109), isoOffset(now, -84), now.toISOString(), now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO roster_slots
      (id, site_id, post_id, booking_id, service_date, starts_at, ends_at, arrival_due_at, check_in_due_at,
       status, absence_reason, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'uncovered', 'Additional coverage requirement', 1, ?, ?)`) 
      .bind("SLOT-LIN-02", "SITE-LIN", "POST-LIN-02", "BK-2090", today,
        isoOffset(now, 150), isoOffset(now, 870), isoOffset(now, 120), isoOffset(now, 160), now.toISOString(), now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO roster_assignments
      (id, roster_slot_id, officer_id, shift_id, assignment_kind, status, active_key, assigned_by, assigned_at,
       confirmed_at, released_at, version)
      VALUES (?, ?, ?, ?, 'primary', 'on_post', ?, 'demo-seed', ?, ?, NULL, 1)`)
      .bind("RA-RSB-01", "SLOT-RSB-01", "OFF-001", "SH-2081", "SLOT-RSB-01", isoOffset(now, -180), isoOffset(now, -170)),
    db.prepare(`INSERT OR IGNORE INTO roster_assignments
      (id, roster_slot_id, officer_id, shift_id, assignment_kind, status, active_key, assigned_by, assigned_at,
       confirmed_at, released_at, version)
      VALUES (?, ?, ?, ?, 'primary', 'confirmed', ?, 'demo-seed', ?, ?, NULL, 1)`)
      .bind("RA-MID-01", "SLOT-MID-01", "OFF-002", "SH-2084", "SLOT-MID-01", isoOffset(now, -90), isoOffset(now, -76)),
    db.prepare(`INSERT OR IGNORE INTO roster_assignments
      (id, roster_slot_id, officer_id, shift_id, assignment_kind, status, active_key, assigned_by, assigned_at,
       confirmed_at, released_at, version)
      VALUES (?, ?, ?, ?, 'primary', 'on_post', ?, 'demo-seed', ?, ?, NULL, 1)`)
      .bind("RA-LIN-01", "SLOT-LIN-01", "OFF-003", "SH-2090", "SLOT-LIN-01", isoOffset(now, -130), isoOffset(now, -120)),
    db.prepare(`INSERT OR IGNORE INTO site_presence_signals
      (id, site_id, shift_id, officer_id, signal_type, latitude_e6, longitude_e6, accuracy_meters, source, source_session_id,
       sequence_number, idempotency_key, policy_version, geofence_version, environment, integrity_state, review_required,
       captured_at, received_at, retention_review_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'simulated', ?, ?, ?, 'demo-synthetic-v1', 1, 'demo', 'synthetic', 0, ?, ?, ?)`)
      .bind("SIG-RSB-001", "SITE-RSB", "SH-2081", "OFF-001", "attendance_heartbeat", -26146820, 28041730, 18,
        "SESSION-DEMO-RSB", 1, "DEMO-RSB-1", isoOffset(now, -4), isoOffset(now, -4), signalRetention),
    db.prepare(`INSERT OR IGNORE INTO site_presence_signals
      (id, site_id, shift_id, officer_id, signal_type, latitude_e6, longitude_e6, accuracy_meters, source, source_session_id,
       sequence_number, idempotency_key, policy_version, geofence_version, environment, integrity_state, review_required,
       captured_at, received_at, retention_review_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'simulated', ?, ?, ?, 'demo-synthetic-v1', 1, 'demo', 'synthetic', 0, ?, ?, ?)`)
      .bind("SIG-MID-001", "SITE-MID", "SH-2084", "OFF-002", "assignment_confirmed", -25999180, 28126280, 22,
        "SESSION-DEMO-MID", 1, "DEMO-MID-1", isoOffset(now, -9), isoOffset(now, -9), signalRetention),
    db.prepare(`INSERT OR IGNORE INTO site_presence_signals
      (id, site_id, shift_id, officer_id, signal_type, latitude_e6, longitude_e6, accuracy_meters, source, source_session_id,
       sequence_number, idempotency_key, policy_version, geofence_version, environment, integrity_state, review_required,
       captured_at, received_at, retention_review_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'simulated', ?, ?, ?, 'demo-synthetic-v1', 1, 'demo', 'synthetic', 1, ?, ?, ?)`)
      .bind("SIG-LIN-001", "SITE-LIN", "SH-2090", "OFF-003", "attendance_heartbeat", -26084650, 28122320, 34,
        "SESSION-DEMO-LIN", 1, "DEMO-LIN-1", isoOffset(now, -38), isoOffset(now, -38), signalRetention),
    db.prepare(`INSERT OR IGNORE INTO site_incidents
      (id, site_id, shift_id, severity, category, summary, detail, status, visibility, reported_by_type, reported_by_id,
       occurred_at, reported_at, owner_id, sla_due_at, acknowledged_at, acknowledged_by, resolved_at, resolved_by,
       resolution_note, client_notified_at, retention_review_at, version)
      VALUES (?, ?, ?, 'medium', 'site_condition', ?, ?, 'open', 'operations', 'officer', 'OFF-003', ?, ?, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, 1)`)
      .bind("INC-DEMO-001", "SITE-LIN", "SH-2090", "Perimeter lighting exception", "Lighting along the east vehicle lane requires supervisor review. No injury or loss reported.",
        isoOffset(now, -28), isoOffset(now, -25), isoOffset(now, 35), incidentRetention),
    db.prepare(`INSERT OR IGNORE INTO site_incidents
      (id, site_id, shift_id, severity, category, summary, detail, status, visibility, reported_by_type, reported_by_id,
       occurred_at, reported_at, owner_id, sla_due_at, acknowledged_at, acknowledged_by, resolved_at, resolved_by,
       resolution_note, client_notified_at, retention_review_at, version)
      VALUES (?, ?, ?, 'low', 'access_control', ?, ?, 'resolved', 'operations', 'officer', 'OFF-001', ?, ?, 'operations-demo', ?, ?, 'operations-demo', ?, 'operations-demo', ?, ?, ?, 2)`)
      .bind("INC-DEMO-002", "SITE-RSB", "SH-2081", "Unscheduled visitor declined", "Host confirmed that no appointment existed. Access was declined without confrontation.",
        isoOffset(now, -132), isoOffset(now, -128), isoOffset(now, -68), isoOffset(now, -120), isoOffset(now, -96), "Procedure followed; no further action.", isoOffset(now, -90), incidentRetention),
    db.prepare(`INSERT OR IGNORE INTO incident_events
      (id, incident_id, event_type, actor_type, actor_id, detail, created_at)
      VALUES (?, ?, 'case_opened', 'officer', 'OFF-003', ?, ?)`)
      .bind("IE-DEMO-001", "INC-DEMO-001", "Officer report received; Operations triage required.", isoOffset(now, -25)),
    db.prepare(`INSERT OR IGNORE INTO operational_exceptions
      (id, site_id, post_id, shift_id, exception_type, priority, status, summary, owner_id, detected_at, sla_due_at,
       acknowledged_at, resolved_at, resolution_code, resolution_note, version)
      VALUES (?, ?, ?, ?, 'signal_stale', 'P2', 'new', ?, NULL, ?, ?, NULL, NULL, NULL, NULL, 1)`)
      .bind("EXC-DEMO-001", "SITE-LIN", "POST-LIN-01", "SH-2090", "Synthetic attendance signal is older than the 15-minute monitoring threshold.", isoOffset(now, -23), isoOffset(now, 22)),
    db.prepare(`UPDATE roster_slots SET service_date = ?, starts_at = ?, ends_at = ?, arrival_due_at = ?,
      check_in_due_at = ?, updated_at = ? WHERE id = 'SLOT-RSB-01' AND version = 1 AND status = 'scheduled'`)
      .bind(today, isoOffset(now, -154), isoOffset(now, 566), isoOffset(now, -169), isoOffset(now, -144), now.toISOString()),
    db.prepare(`UPDATE roster_slots SET service_date = ?, starts_at = ?, ends_at = ?, arrival_due_at = ?,
      check_in_due_at = ?, updated_at = ? WHERE id = 'SLOT-MID-01' AND version = 1 AND status = 'scheduled'`)
      .bind(today, isoOffset(now, 24), isoOffset(now, 744), isoOffset(now, 9), isoOffset(now, 34), now.toISOString()),
    db.prepare(`UPDATE roster_slots SET service_date = ?, starts_at = ?, ends_at = ?, arrival_due_at = ?,
      check_in_due_at = ?, updated_at = ? WHERE id = 'SLOT-LIN-01' AND version = 1 AND status = 'scheduled'`)
      .bind(today, isoOffset(now, -94), isoOffset(now, 626), isoOffset(now, -109), isoOffset(now, -84), now.toISOString()),
    db.prepare(`UPDATE roster_slots SET service_date = ?, starts_at = ?, ends_at = ?, arrival_due_at = ?,
      check_in_due_at = ?, updated_at = ? WHERE id = 'SLOT-LIN-02' AND version = 1 AND status = 'uncovered'`)
      .bind(today, isoOffset(now, 150), isoOffset(now, 870), isoOffset(now, 120), isoOffset(now, 160), now.toISOString()),
    db.prepare(`UPDATE officer_availability_windows SET starts_at = ?, ends_at = ?, rest_confirmed_at = ?
      WHERE id = 'AVAIL-OFF-004-01' AND version = 1 AND status = 'available'`)
      .bind(isoOffset(now, -60), isoOffset(now, 60 * 24), now.toISOString()),
    db.prepare(`UPDATE officer_availability_windows SET starts_at = ?, ends_at = ?, rest_confirmed_at = ?
      WHERE id = 'AVAIL-OFF-005-01' AND version = 1 AND status = 'available'`)
      .bind(isoOffset(now, -60), isoOffset(now, 60 * 24), now.toISOString()),
    db.prepare(`UPDATE bookings SET purpose_code = 'secure_logistics', purpose_label = 'Secure logistics'
      WHERE id = 'BK-2090'`),
    db.prepare(`UPDATE roster_assignments SET shift_id = 'SH-2084'
      WHERE id = 'RA-MID-01' AND shift_id IS NULL AND EXISTS (SELECT 1 FROM shifts WHERE id = 'SH-2084')`),
  ]);
}

type SiteRow = {
  id: string;
  clientId: string;
  clientName: string;
  bookingId: string | null;
  name: string;
  area: string;
  addressLabel: string;
  latitudeE6: number;
  longitudeE6: number;
  riskBand: string;
  serviceType: string;
  geofenceRadiusMeters: number;
  geofenceVersion: number;
  telemetryMode: "simulated";
  siteStatus: string;
};

export async function readOperationsState(db: D1Database): Promise<OperationsCommandState> {
  const now = new Date();
  const rosterWindowStart = isoOffset(now, -60 * 12);
  const rosterWindowEnd = isoOffset(now, 60 * 24);
  const siteRows = await all<SiteRow>(db.prepare(`SELECT s.id, s.client_id AS clientId, c.organisation_name AS clientName,
    s.booking_id AS bookingId, s.name, s.area, s.address_label AS addressLabel, s.latitude_e6 AS latitudeE6,
    s.longitude_e6 AS longitudeE6, s.risk_band AS riskBand, s.service_type AS serviceType,
    s.geofence_radius_meters AS geofenceRadiusMeters, s.geofence_version AS geofenceVersion,
    s.telemetry_mode AS telemetryMode, s.status AS siteStatus
    FROM operational_sites s JOIN clients c ON c.id = s.client_id
    WHERE s.status <> 'archived' ORDER BY s.name`));
  const posts = await all<OperationsPost & { siteId: string }>(db.prepare(`SELECT id, site_id AS siteId,
    booking_id AS bookingId, name, service_type AS serviceType, purpose_code AS purposeCode,
    minimum_grade AS minimumGrade, post_orders_version AS postOrdersVersion, status
    FROM site_posts WHERE status <> 'archived' ORDER BY name`));
  const deployments = await all<{
    siteId: string; shiftId: string; bookingId: string; officerName: string; passportStatus: string | null;
    postName: string; scheduledDate: string; shiftStart: string; shiftEnd: string; status: string; checkInAt: string | null;
  }>(db.prepare(`SELECT os.id AS siteId, sh.id AS shiftId, b.id AS bookingId, o.full_name AS officerName,
    op.status AS passportStatus, b.post_name AS postName, sh.scheduled_date AS scheduledDate,
    b.shift_start AS shiftStart, b.shift_end AS shiftEnd, sh.status, sh.check_in_at AS checkInAt
    FROM operational_sites os JOIN bookings b ON b.id = os.booking_id
    LEFT JOIN shifts sh ON sh.booking_id = b.id
    LEFT JOIN officers o ON o.id = sh.officer_id
    LEFT JOIN officer_passports op ON op.officer_id = o.id
    ORDER BY sh.scheduled_date DESC, sh.rowid DESC`));
  const rosterRows = await all<{
    id: string; siteId: string; siteName: string; area: string; postId: string; postName: string; bookingId: string;
    shiftId: string | null; officerId: string | null; officerName: string | null; officerGrade: string | null;
    passportStatus: string | null; serviceType: string; serviceDate: string; startsAt: string; endsAt: string;
    arrivalDueAt: string; checkInDueAt: string; status: string; assignmentStatus: string | null;
    checkInAt: string | null; absenceReason: string | null; version: number;
  }>(db.prepare(`SELECT rs.id, rs.site_id AS siteId, os.name AS siteName, os.area, rs.post_id AS postId,
    sp.name AS postName, rs.booking_id AS bookingId, ra.shift_id AS shiftId, ra.officer_id AS officerId,
    o.full_name AS officerName, o.psira_grade AS officerGrade, op.status AS passportStatus,
    sp.service_type AS serviceType, rs.service_date AS serviceDate, rs.starts_at AS startsAt,
    rs.ends_at AS endsAt, rs.arrival_due_at AS arrivalDueAt, rs.check_in_due_at AS checkInDueAt,
    rs.status, ra.status AS assignmentStatus, sh.check_in_at AS checkInAt, rs.absence_reason AS absenceReason, rs.version
    FROM roster_slots rs
    JOIN operational_sites os ON os.id = rs.site_id
    JOIN site_posts sp ON sp.id = rs.post_id
    LEFT JOIN roster_assignments ra ON ra.roster_slot_id = rs.id AND ra.active_key = rs.id
    LEFT JOIN shifts sh ON sh.id = ra.shift_id
    LEFT JOIN officers o ON o.id = ra.officer_id
    LEFT JOIN officer_passports op ON op.officer_id = ra.officer_id
    WHERE rs.ends_at >= ? AND rs.starts_at <= ? AND rs.status <> 'cancelled'
    ORDER BY rs.starts_at, os.name, sp.name`).bind(rosterWindowStart, rosterWindowEnd));
  const reliefRows = await all<OperationsReliefDispatch & { rosterSlotId: string; siteId: string }>(db.prepare(`SELECT rd.id,
    rd.roster_slot_id AS rosterSlotId, rd.site_id AS siteId, rd.replacement_officer_id AS replacementOfficerId,
    o.full_name AS replacementOfficerName, rd.status, rd.reason_code AS reasonCode, rd.priority,
    rd.requested_by AS requestedBy, rd.requested_at AS requestedAt, rd.response_due_at AS responseDueAt,
    rd.target_arrival_at AS targetArrivalAt,
    rd.accepted_at AS acceptedAt, rd.arrived_at AS arrivedAt, rd.version
    FROM relief_dispatches rd JOIN officers o ON o.id = rd.replacement_officer_id
    ORDER BY rd.requested_at DESC`));
  const reserveRows = await all<{
    id: string; fullName: string; city: string; psiraGrade: string; passportStatus: string; serviceTypes: string;
  }>(db.prepare(`SELECT o.id, o.full_name AS fullName, o.city, o.psira_grade AS psiraGrade,
    op.status AS passportStatus, GROUP_CONCAT(os.service_type, '|') AS serviceTypes
    FROM officers o JOIN officer_passports op ON op.officer_id = o.id
    JOIN officer_services os ON os.officer_id = o.id
    WHERE o.approval_status = 'approved' AND o.flex_available = 1 AND o.external_work_acknowledged = 1
      AND o.rest_window_confirmed = 1 AND op.status IN ('active', 'expiring') AND os.qualified = 1 AND os.opted_in = 1
    GROUP BY o.id, o.full_name, o.city, o.psira_grade, op.status
    ORDER BY o.psira_grade, o.full_name`));
  const signals = await all<{
    id: string; siteId: string; type: string; latitudeE6: number; longitudeE6: number; accuracyMeters: number | null;
    source: "simulated"; integrityState: "synthetic"; capturedAt: string; receivedAt: string;
  }>(db.prepare(`SELECT id, site_id AS siteId, signal_type AS type, latitude_e6 AS latitudeE6,
    longitude_e6 AS longitudeE6, accuracy_meters AS accuracyMeters, source, integrity_state AS integrityState,
    captured_at AS capturedAt, received_at AS receivedAt
    FROM site_presence_signals WHERE environment = 'demo' ORDER BY captured_at DESC`));
  const incidentRows = await all<Omit<OperationsIncident, "siteName"> & { siteName: string }>(db.prepare(`SELECT i.id,
    i.site_id AS siteId, s.name AS siteName, i.severity, i.category, i.summary, i.detail, i.status,
    i.owner_id AS ownerId, i.occurred_at AS occurredAt, i.reported_at AS reportedAt, i.sla_due_at AS slaDueAt,
    i.acknowledged_at AS acknowledgedAt, i.resolved_at AS resolvedAt, i.version
    FROM site_incidents i JOIN operational_sites s ON s.id = i.site_id
    WHERE i.visibility = 'operations' ORDER BY i.reported_at DESC`));
  const exceptionRows = await all<OperationsException>(db.prepare(`SELECT e.id, e.site_id AS siteId,
    s.name AS siteName, e.priority, e.exception_type AS exceptionType, e.summary, e.status,
    e.owner_id AS ownerId, e.detected_at AS detectedAt, e.sla_due_at AS slaDueAt, e.version
    FROM operational_exceptions e JOIN operational_sites s ON s.id = e.site_id
    ORDER BY e.detected_at DESC`));
  const incidentEventRows = await all<{
    id: string; siteId: string; siteName: string; eventType: string; detail: string; createdAt: string;
  }>(db.prepare(`SELECT ie.id, i.site_id AS siteId, s.name AS siteName, ie.event_type AS eventType,
    ie.detail, ie.created_at AS createdAt FROM incident_events ie
    JOIN site_incidents i ON i.id = ie.incident_id JOIN operational_sites s ON s.id = i.site_id
    ORDER BY ie.created_at DESC LIMIT 20`));
  const reliefEventRows = await all<{
    id: string; siteId: string; siteName: string; eventType: string; detail: string; createdAt: string;
  }>(db.prepare(`SELECT rde.id, rd.site_id AS siteId, s.name AS siteName, rde.event_type AS eventType,
    rde.detail, rde.created_at AS createdAt FROM relief_dispatch_events rde
    JOIN relief_dispatches rd ON rd.id = rde.relief_dispatch_id
    JOIN operational_sites s ON s.id = rd.site_id
    ORDER BY rde.created_at DESC LIMIT 20`));

  const activeReliefBySlot = new Map<string, (typeof reliefRows)[number]>();
  for (const relief of reliefRows) {
    if (!["cancelled", "closed"].includes(relief.status) && !activeReliefBySlot.has(relief.rosterSlotId)) {
      activeReliefBySlot.set(relief.rosterSlotId, relief);
    }
  }
  const roster: OperationsRosterSlot[] = rosterRows.map((row) => {
    const relief = activeReliefBySlot.get(row.id) ?? null;
    const coverageState = deriveCoverageState({
      status: row.assignmentStatus === "on_post" ? "on_post" : row.status,
      startsAt: row.startsAt,
      arrivalDueAt: row.arrivalDueAt,
      checkInDueAt: row.checkInDueAt,
      checkInAt: row.checkInAt,
      officerId: row.officerId,
      activeRelief: Boolean(relief),
      now,
    });
    return {
      id: row.id,
      siteId: row.siteId,
      siteName: row.siteName,
      area: row.area,
      postId: row.postId,
      postName: row.postName,
      bookingId: row.bookingId,
      shiftId: row.shiftId,
      officerId: row.officerId,
      officerName: row.officerName,
      officerGrade: row.officerGrade,
      passportStatus: row.passportStatus,
      serviceType: row.serviceType,
      serviceDate: row.serviceDate,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      arrivalDueAt: row.arrivalDueAt,
      checkInDueAt: row.checkInDueAt,
      status: row.status,
      coverageState,
      coverageLabel: coverageStateLabel(coverageState),
      minutesToStart: minutesUntil(row.startsAt, now),
      arrivalEvidence: row.checkInAt ? "checked_in" : "not_recorded",
      absenceReason: row.absenceReason,
      version: row.version,
      relief,
    };
  });
  const actionableRoster = roster.filter((slot) => ["arrival_at_risk", "check_in_missing", "uncovered"].includes(slot.coverageState));
  const reserveCandidates = await Promise.all(reserveRows.map(async (row): Promise<OperationsReserveOfficer | null> => {
    const eligibleSlotIds: string[] = [];
    for (const slot of actionableRoster) {
      const result = await reliefCandidateEligibility(db, row.id, slot);
      if (result.eligible) eligibleSlotIds.push(slot.id);
    }
    if (!eligibleSlotIds.length) return null;
    return {
      id: row.id,
      fullName: row.fullName,
      city: row.city,
      psiraGrade: row.psiraGrade,
      passportStatus: row.passportStatus,
      serviceTypes: row.serviceTypes.split("|").filter(Boolean),
      eligibleSlotIds,
      eligibilityLabel: `Eligible for ${eligibleSlotIds.length} open coverage window${eligibleSlotIds.length === 1 ? "" : "s"} after readiness, availability, overlap and demo rest checks`,
    };
  }));
  const reserveOfficers = reserveCandidates.filter((officer): officer is OperationsReserveOfficer => Boolean(officer));

  const latestDeployment = new Map<string, (typeof deployments)[number]>();
  for (const deployment of deployments) if (!latestDeployment.has(deployment.siteId)) latestDeployment.set(deployment.siteId, deployment);
  const latestSignal = new Map<string, (typeof signals)[number]>();
  for (const signal of signals) if (!latestSignal.has(signal.siteId)) latestSignal.set(signal.siteId, signal);
  const activeIncidents = incidentRows.filter((incident) => !["resolved", "closed"].includes(incident.status));
  const activeExceptions = exceptionRows.filter((exception) => !["resolved", "closed"].includes(exception.status));
  const coverageWeight: Record<CoverageState, number> = {
    cancelled: 0,
    completed: 0,
    confirmed: 1,
    on_post: 1,
    relief_active: 2,
    arrival_at_risk: 3,
    check_in_missing: 4,
    uncovered: 4,
  };

  const sites: OperationsSite[] = siteRows.map((site) => {
    const deployment = latestDeployment.get(site.id);
    const signal = latestSignal.get(site.id);
    const signalAgeMinutes = ageInMinutes(signal?.capturedAt ?? null, now);
    const siteIncidents = activeIncidents.filter((incident) => incident.siteId === site.id);
    const siteExceptions = activeExceptions.filter((exception) => exception.siteId === site.id);
    const highestIncidentSeverity = highestSeverity(siteIncidents.map((incident) => incident.severity));
    const highestExceptionPriority = highestPriority(siteExceptions.map((exception) => exception.priority));
    const coverageState = roster
      .filter((slot) => slot.siteId === site.id && !["completed", "cancelled"].includes(slot.coverageState))
      .sort((left, right) => coverageWeight[right.coverageState] - coverageWeight[left.coverageState])[0]?.coverageState ?? null;
    const state = deriveOperationalState({
      active: site.siteStatus === "active",
      shiftStatus: deployment?.status ?? null,
      signalAgeMinutes,
      highestIncidentSeverity,
      highestExceptionPriority,
      coverageState,
    });
    return {
      id: site.id,
      clientId: site.clientId,
      clientName: site.clientName,
      name: site.name,
      area: site.area,
      addressLabel: site.addressLabel,
      latitude: site.latitudeE6 / 1_000_000,
      longitude: site.longitudeE6 / 1_000_000,
      riskBand: site.riskBand,
      serviceType: site.serviceType,
      geofenceRadiusMeters: site.geofenceRadiusMeters,
      geofenceVersion: site.geofenceVersion,
      telemetryMode: site.telemetryMode,
      state,
      stateLabel: operationalStateLabel(state),
      signalFreshness: signalFreshness(signalAgeMinutes),
      openIncidentCount: siteIncidents.length,
      highestIncidentSeverity,
      openExceptionCount: siteExceptions.length,
      highestExceptionPriority,
      nextAction: nextOperationalAction({ state, highestExceptionPriority, openIncidentCount: siteIncidents.length, shiftStatus: deployment?.status ?? null, coverageState }),
      posts: posts.filter((post) => post.siteId === site.id).map((post) => ({
        id: post.id,
        name: post.name,
        serviceType: post.serviceType,
        purposeCode: post.purposeCode,
        minimumGrade: post.minimumGrade,
        postOrdersVersion: post.postOrdersVersion,
        status: post.status,
        bookingId: post.bookingId,
      })),
      deployment: deployment ? {
        shiftId: deployment.shiftId,
        bookingId: deployment.bookingId,
        officerName: deployment.officerName,
        passportStatus: deployment.passportStatus,
        postName: deployment.postName,
        scheduledDate: deployment.scheduledDate,
        shiftStart: deployment.shiftStart,
        shiftEnd: deployment.shiftEnd,
        status: deployment.status,
        checkInAt: deployment.checkInAt,
      } : {
        shiftId: null, bookingId: site.bookingId, officerName: null, passportStatus: null, postName: null,
        scheduledDate: null, shiftStart: null, shiftEnd: null, status: null, checkInAt: null,
      },
      latestSignal: signal ? {
        id: signal.id,
        type: signal.type,
        latitude: signal.latitudeE6 / 1_000_000,
        longitude: signal.longitudeE6 / 1_000_000,
        accuracyMeters: signal.accuracyMeters,
        source: signal.source,
        integrityState: signal.integrityState,
        capturedAt: signal.capturedAt,
        receivedAt: signal.receivedAt,
        ageMinutes: signalAgeMinutes,
      } : null,
    };
  });

  const events: OperationsEvent[] = [
    ...signals.slice(0, 8).map((signal) => ({
      id: signal.id,
      siteId: signal.siteId,
      siteName: siteRows.find((site) => site.id === signal.siteId)?.name ?? "Site",
      type: "signal" as const,
      tone: signal.type === "attendance_heartbeat" ? "green" as const : "blue" as const,
      title: signal.type.replaceAll("_", " "),
      detail: `${signal.source} signal · ${signal.accuracyMeters ?? "—"}m stated accuracy`,
      occurredAt: signal.capturedAt,
    })),
    ...incidentRows.slice(0, 8).map((incident) => ({
      id: `case-${incident.id}`,
      siteId: incident.siteId,
      siteName: incident.siteName,
      type: "incident" as const,
      tone: incident.severity === "critical" || incident.severity === "high" ? "red" as const : incident.status === "resolved" ? "neutral" as const : "amber" as const,
      title: incident.summary,
      detail: `${incident.severity} · ${incident.status}`,
      occurredAt: incident.reportedAt,
    })),
    ...incidentEventRows.map((event) => ({
      id: event.id,
      siteId: event.siteId,
      siteName: event.siteName,
      type: "incident_event" as const,
      tone: "amber" as const,
      title: event.eventType.replaceAll("_", " "),
      detail: event.detail,
      occurredAt: event.createdAt,
    })),
    ...exceptionRows.slice(0, 8).map((exception) => ({
      id: exception.id,
      siteId: exception.siteId,
      siteName: exception.siteName,
      type: "exception" as const,
      tone: exception.priority === "P0" || exception.priority === "P1" ? "red" as const : "amber" as const,
      title: exception.exceptionType.replaceAll("_", " "),
      detail: `${exception.priority} · ${exception.status} · ${exception.summary}`,
      occurredAt: exception.detectedAt,
    })),
    ...reliefEventRows.map((event) => ({
      id: event.id,
      siteId: event.siteId,
      siteName: event.siteName,
      type: "relief" as const,
      tone: event.eventType === "case_cancelled" ? "neutral" as const : "amber" as const,
      title: event.eventType.replaceAll("_", " "),
      detail: event.detail,
      occurredAt: event.createdAt,
    })),
  ].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, 16);

  return {
    environment: "demo",
    telemetry: "simulated",
    generatedAt: now.toISOString(),
    timezone: "Africa/Johannesburg",
    refreshAfterMs: 30_000,
    summary: {
      sites: sites.length,
      operational: sites.filter((site) => site.state === "operational").length,
      scheduled: sites.filter((site) => site.state === "scheduled").length,
      attention: sites.filter((site) => site.state === "attention").length,
      critical: sites.filter((site) => site.state === "critical").length,
      openIncidents: activeIncidents.length,
      openExceptions: activeExceptions.length,
      rosterSlots: roster.length,
      coveredSlots: roster.filter((slot) => Boolean(slot.officerId) || Boolean(slot.relief)).length,
      arrivalWatch: roster.filter((slot) => ["arrival_at_risk", "check_in_missing", "uncovered"].includes(slot.coverageState)).length,
      reliefActive: reliefRows.filter((relief) => !["cancelled", "closed"].includes(relief.status)).length,
      coveragePercent: roster.length ? Math.round((roster.filter((slot) => Boolean(slot.officerId) || Boolean(slot.relief)).length / roster.length) * 100) : 100,
    },
    sites,
    roster,
    reserveOfficers,
    incidents: incidentRows,
    exceptions: exceptionRows,
    events,
  };
}

function requireId(value: unknown, label: string) {
  if (typeof value !== "string" || !/^[A-Za-z0-9-]{3,96}$/.test(value)) throw new OperationsError(`${label} is not valid.`);
  return value;
}

function requireVersion(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 1_000_000) throw new OperationsError("The record version is not valid.");
  return Number(value);
}

function requireResolution(value: unknown) {
  if (typeof value !== "string") throw new OperationsError("Add a resolution note.");
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length < 8 || clean.length > 500) throw new OperationsError("The resolution note must be between 8 and 500 characters.");
  return clean;
}

function requireText(value: unknown, label: string, minimum: number, maximum: number) {
  if (typeof value !== "string") throw new OperationsError(`${label} is required.`);
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length < minimum || clean.length > maximum) throw new OperationsError(`${label} must be between ${minimum} and ${maximum} characters.`);
  return clean;
}

export async function applyOperationsAction(db: D1Database, payload: OperationsAction, actor: PilotPrincipal) {
  const now = new Date().toISOString();
  if (payload.action === "create_incident") {
    const siteId = requireId(payload.siteId, "Site");
    if (!["low", "medium", "high", "critical"].includes(payload.severity)) throw new OperationsError("Choose a valid incident severity.");
    const category = requireText(payload.category, "Category", 3, 48).toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const summary = requireText(payload.summary, "Summary", 8, 120);
    const detail = requireText(payload.detail, "Incident detail", 12, 700);
    const site = await db.prepare(`SELECT id FROM operational_sites WHERE id = ? AND status = 'active'`)
      .bind(siteId).first<{ id: string }>();
    if (!site) throw new OperationsError("That active site is unavailable.", 404);
    const incidentId = eventId("INC-OPS");
    const slaMinutes = payload.severity === "critical" ? 5 : payload.severity === "high" ? 15 : payload.severity === "medium" ? 60 : 240;
    const slaDueAt = new Date(new Date(now).getTime() + slaMinutes * 60_000).toISOString();
    const retentionReviewAt = new Date(new Date(now).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    await db.batch([
      db.prepare(`INSERT INTO site_incidents
        (id, site_id, shift_id, severity, category, summary, detail, status, visibility, reported_by_type, reported_by_id,
         occurred_at, reported_at, owner_id, sla_due_at, acknowledged_at, acknowledged_by, resolved_at, resolved_by,
         resolution_note, client_notified_at, retention_review_at, version)
        VALUES (?, ?, NULL, ?, ?, ?, ?, 'open', 'operations', 'operations', ?, ?, ?, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, 1)`)
        .bind(incidentId, siteId, payload.severity, category, summary, detail, actor.email, now, now, slaDueAt, retentionReviewAt),
      db.prepare(`INSERT INTO incident_events (id, incident_id, event_type, actor_type, actor_id, detail, created_at)
        VALUES (?, ?, 'case_opened', 'operations', ?, 'Operations created the incident case.', ?)`)
        .bind(eventId("IE"), incidentId, actor.email, now),
      db.prepare(`INSERT INTO audit_events (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
        VALUES (?, 'operations', ?, 'incident_created', 'incident', ?, 'Operations incident case created.', ?)`)
        .bind(eventId("AUD"), actor.email, incidentId, now),
    ]);
    return;
  }

  if (payload.action === "acknowledge_incident") {
    const incidentId = requireId(payload.incidentId, "Incident");
    const version = requireVersion(payload.version);
    const result = await db.prepare(`UPDATE site_incidents SET status = 'acknowledged', owner_id = ?,
      acknowledged_at = ?, acknowledged_by = ?, version = version + 1
      WHERE id = ? AND version = ? AND status = 'open'`)
      .bind(actor.email, now, actor.email, incidentId, version).run();
    if (!result.meta.changes) throw new OperationsError("This incident changed before your action. Refresh and try again.", 409);
    await db.batch([
      db.prepare(`INSERT INTO incident_events (id, incident_id, event_type, actor_type, actor_id, detail, created_at)
        VALUES (?, ?, 'acknowledged', 'operations', ?, 'Operations ownership accepted; investigation remains open.', ?)`)
        .bind(eventId("IE"), incidentId, actor.email, now),
      db.prepare(`INSERT INTO audit_events (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
        VALUES (?, 'operations', ?, 'incident_acknowledged', 'incident', ?, 'Operations accepted ownership; incident remains active.', ?)`)
        .bind(eventId("AUD"), actor.email, incidentId, now),
    ]);
    return;
  }

  if (payload.action === "resolve_incident") {
    const incidentId = requireId(payload.incidentId, "Incident");
    const version = requireVersion(payload.version);
    const resolutionNote = requireResolution(payload.resolutionNote);
    const result = await db.prepare(`UPDATE site_incidents SET status = 'resolved', resolved_at = ?, resolved_by = ?,
      resolution_note = ?, version = version + 1
      WHERE id = ? AND version = ? AND status IN ('acknowledged', 'investigating')`)
      .bind(now, actor.email, resolutionNote, incidentId, version).run();
    if (!result.meta.changes) throw new OperationsError("Acknowledge the current incident version before resolving it.", 409);
    await db.batch([
      db.prepare(`INSERT INTO incident_events (id, incident_id, event_type, actor_type, actor_id, detail, created_at)
        VALUES (?, ?, 'resolved', 'operations', ?, ?, ?)`)
        .bind(eventId("IE"), incidentId, actor.email, resolutionNote, now),
      db.prepare(`INSERT INTO audit_events (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
        VALUES (?, 'operations', ?, 'incident_resolved', 'incident', ?, 'Resolution recorded in the incident case.', ?)`)
        .bind(eventId("AUD"), actor.email, incidentId, now),
    ]);
    return;
  }

  if (payload.action === "acknowledge_exception") {
    const exceptionId = requireId(payload.exceptionId, "Exception");
    const version = requireVersion(payload.version);
    const result = await db.prepare(`UPDATE operational_exceptions SET status = 'acknowledged', owner_id = ?,
      acknowledged_at = ?, version = version + 1 WHERE id = ? AND version = ? AND status = 'new'`)
      .bind(actor.email, now, exceptionId, version).run();
    if (!result.meta.changes) throw new OperationsError("This exception changed before your action. Refresh and try again.", 409);
    await db.prepare(`INSERT INTO audit_events (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
      VALUES (?, 'operations', ?, 'exception_acknowledged', 'operational_exception', ?, 'Operations accepted ownership; exception remains active.', ?)`)
      .bind(eventId("AUD"), actor.email, exceptionId, now).run();
    return;
  }

  if (payload.action === "open_relief_case") {
    const rosterSlotId = requireId(payload.rosterSlotId, "Roster slot");
    const replacementOfficerId = requireId(payload.replacementOfficerId, "Reserve officer");
    const version = requireVersion(payload.version);
    const reasons = ["arrival_not_assured", "officer_unavailable", "client_request", "operations_contingency"] as const;
    if (!reasons.includes(payload.reasonCode)) throw new OperationsError("Choose a valid relief reason.");
    const slot = await db.prepare(`SELECT rs.id, rs.site_id AS siteId, rs.post_id AS postId,
      rs.booking_id AS bookingId, rs.service_date AS serviceDate, rs.starts_at AS startsAt,
      rs.ends_at AS endsAt, rs.arrival_due_at AS arrivalDueAt, rs.check_in_due_at AS checkInDueAt,
      rs.status, rs.version, ra.shift_id AS shiftId, ra.officer_id AS officerId,
      ra.status AS assignmentStatus, sh.check_in_at AS checkInAt
      FROM roster_slots rs
      LEFT JOIN roster_assignments ra ON ra.roster_slot_id = rs.id AND ra.active_key = rs.id
      LEFT JOIN shifts sh ON sh.id = ra.shift_id WHERE rs.id = ?`)
      .bind(rosterSlotId).first<{
        id: string; siteId: string; postId: string; bookingId: string; serviceDate: string; startsAt: string;
        endsAt: string; arrivalDueAt: string; checkInDueAt: string; status: string; version: number;
        shiftId: string | null; officerId: string | null; assignmentStatus: string | null; checkInAt: string | null;
      }>();
    if (!slot) throw new OperationsError("That roster slot is unavailable.", 404);
    if (slot.version !== version) throw new OperationsError("This roster slot changed before your action. Refresh and try again.", 409);
    const activeRelief = await db.prepare(`SELECT id FROM relief_dispatches WHERE active_key = ?`).bind(slot.id).first<{ id: string }>();
    if (activeRelief) throw new OperationsError("A relief case is already active for this post.", 409);
    const coverageState = deriveCoverageState({
      status: slot.assignmentStatus === "on_post" ? "on_post" : slot.status,
      startsAt: slot.startsAt,
      arrivalDueAt: slot.arrivalDueAt,
      checkInDueAt: slot.checkInDueAt,
      checkInAt: slot.checkInAt,
      officerId: slot.officerId,
      activeRelief: false,
      now: new Date(now),
    });
    if (!["arrival_at_risk", "check_in_missing", "uncovered"].includes(coverageState)) {
      throw new OperationsError("This post is not currently inside the relief-control threshold.", 409);
    }
    const eligibility = await reliefCandidateEligibility(db, replacementOfficerId, slot);
    if (!eligibility.eligible) throw new OperationsError(`That reserve officer is not eligible: ${eligibility.reason}`, 409);
    const priority = coverageState === "arrival_at_risk" ? "P2" : "P1";
    const responseDueAt = isoOffset(new Date(now), 10);
    const exceptionId = eventId("EXC-REL");
    const reliefId = eventId("REL");
    const reasonLabel = ({
      arrival_not_assured: "Arrival not assured",
      officer_unavailable: "Officer unavailable",
      client_request: "Client requested replacement",
      operations_contingency: "Operations contingency",
    } as const)[payload.reasonCode];
    try {
      await db.batch([
        db.prepare(`INSERT INTO operational_exceptions
          (id, site_id, post_id, shift_id, exception_type, priority, status, summary, owner_id, detected_at, sla_due_at,
           acknowledged_at, resolved_at, resolution_code, resolution_note, version)
          VALUES (?, ?, ?, ?, 'relief_case', ?, 'acknowledged', ?, ?, ?, ?, ?, NULL, NULL, NULL, 1)`)
          .bind(exceptionId, slot.siteId, slot.postId, slot.shiftId, priority, `${reasonLabel}; relief control opened.`, actor.email, now, responseDueAt, now),
        db.prepare(`INSERT INTO relief_dispatches
          (id, roster_slot_id, site_id, exception_id, replacement_officer_id, active_key, status, reason_code, priority,
           requested_by, requested_at, response_due_at, target_arrival_at, accepted_at, arrived_at, closed_at, version)
          SELECT ?, rs.id, rs.site_id, ?, ?, rs.id, 'case_open', ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 1
          FROM roster_slots rs WHERE rs.id = ? AND rs.version = ? AND rs.status IN ('scheduled', 'uncovered')
            AND NOT EXISTS (SELECT 1 FROM relief_dispatches active_case WHERE active_case.active_key = rs.id)`)
          .bind(reliefId, exceptionId, replacementOfficerId, payload.reasonCode, priority, actor.email, now, responseDueAt, slot.id, version),
        db.prepare(`INSERT INTO relief_dispatch_events
          (id, relief_dispatch_id, event_type, actor_type, actor_id, detail, created_at)
          VALUES (?, ?, 'case_opened', 'operations', ?, ?, ?)`)
          .bind(eventId("RDE"), reliefId, actor.email, `Candidate reserved for Operations review: ${reasonLabel}. No officer notification was sent by this demo.`, now),
        db.prepare(`UPDATE roster_slots SET status = 'relief_active', version = version + 1, updated_at = ?
          WHERE id = ? AND version = ?`).bind(now, slot.id, version),
        db.prepare(`INSERT INTO audit_events
          (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
          VALUES (?, 'operations', ?, 'relief_case_opened', 'relief_dispatch', ?,
           'Relief candidate reserved after server-side readiness, availability, overlap and demo rest controls.', ?)`)
          .bind(eventId("AUD"), actor.email, reliefId, now),
      ]);
    } catch {
      throw new OperationsError("The relief case changed before it could be opened. Refresh and try again.", 409);
    }
    return;
  }

  if (payload.action === "cancel_relief") {
    const reliefDispatchId = requireId(payload.reliefDispatchId, "Relief case");
    const version = requireVersion(payload.version);
    const relief = await db.prepare(`SELECT id, roster_slot_id AS rosterSlotId, exception_id AS exceptionId
      FROM relief_dispatches WHERE id = ? AND version = ? AND status IN ('case_open', 'offer_pending')`)
      .bind(reliefDispatchId, version).first<{ id: string; rosterSlotId: string; exceptionId: string | null }>();
    if (!relief) throw new OperationsError("This relief case changed before your action. Refresh and try again.", 409);
    try {
      await db.batch([
        db.prepare(`UPDATE relief_dispatches SET status = 'cancelled', active_key = NULL, closed_at = ?, version = version + 1
          WHERE id = ? AND version = ? AND status IN ('case_open', 'offer_pending')`)
          .bind(now, relief.id, version),
        db.prepare(`INSERT INTO relief_dispatch_events
          (id, relief_dispatch_id, event_type, actor_type, actor_id, detail, created_at)
          VALUES (?, (SELECT id FROM relief_dispatches WHERE id = ? AND version = ? AND status = 'cancelled'),
           'case_cancelled', 'operations', ?, 'Relief case cancelled before any officer notification was sent.', ?)`)
          .bind(eventId("RDE"), relief.id, version + 1, actor.email, now),
        db.prepare(`UPDATE roster_slots SET status = CASE WHEN EXISTS (
            SELECT 1 FROM roster_assignments ra WHERE ra.roster_slot_id = roster_slots.id AND ra.active_key = roster_slots.id
          ) THEN 'scheduled' ELSE 'uncovered' END, version = version + 1, updated_at = ? WHERE id = ?`)
          .bind(now, relief.rosterSlotId),
        db.prepare(`UPDATE operational_exceptions SET status = 'resolved', resolved_at = ?, resolution_code = 'relief_cancelled',
          resolution_note = 'Operations cancelled the relief case before officer notification.', version = version + 1
          WHERE id = ? AND status NOT IN ('resolved', 'closed')`).bind(now, relief.exceptionId),
        db.prepare(`INSERT INTO audit_events
          (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
          VALUES (?, 'operations', ?, 'relief_case_cancelled', 'relief_dispatch', ?, 'Relief case cancelled; no notification was sent.', ?)`)
          .bind(eventId("AUD"), actor.email, relief.id, now),
      ]);
    } catch {
      throw new OperationsError("The relief case changed before it could be cancelled. Refresh and try again.", 409);
    }
    return;
  }

  throw new OperationsError("Choose a valid Operations action.");
}
