import { env } from "cloudflare:workers";
import { PilotAccessError, pilotStage, requirePilotApiRole, requireSameOriginJson, roleForPilotAction, type PilotPrincipal } from "../../lib/pilot-runtime";
import type { PilotAction, PilotScope, PilotState, ServiceType } from "../../lib/pilot-types";
import { defaultRiskInput, PRICE_BOOK_VERSION, purposePriceBook, quoteBooking, rosterPatterns, servicePriceBook } from "../../lib/pilot-pricing";
import { evaluateBookingReadiness, PILOT_PASSPORT_NUMBER, PILOT_PASSPORT_TOKEN, readEndorsements, tokenHash } from "../../lib/passport-server";

export const dynamic = "force-dynamic";

const PILOT_OFFICER_ID = "OFF-001";
const PILOT_CLIENT_ID = "CL-001";

type PilotOfficerColumn = "officers.id" | "officer.id" | "officer_services.officer_id" | "passport.officer_id";

const PILOT_OFFICER_PRODUCTION_HISTORY = (officerColumn: PilotOfficerColumn) => `
  EXISTS (SELECT 1 FROM officer_endorsements history WHERE history.officer_id = ${officerColumn} AND history.environment = 'production')
  OR EXISTS (SELECT 1 FROM compliance_records history WHERE history.officer_id = ${officerColumn} AND history.environment = 'production')
  OR EXISTS (SELECT 1 FROM workforce_engagements history WHERE history.officer_id = ${officerColumn} AND history.environment = 'production')
  OR EXISTS (SELECT 1 FROM site_presence_signals history WHERE history.officer_id = ${officerColumn} AND history.environment = 'production')
  OR EXISTS (SELECT 1 FROM roster_assignments history WHERE history.officer_id = ${officerColumn} AND history.environment = 'production')
  OR EXISTS (SELECT 1 FROM assignment_workforce_snapshots history WHERE history.officer_id = ${officerColumn} AND history.environment = 'production')
  OR EXISTS (SELECT 1 FROM officer_availability_windows history WHERE history.officer_id = ${officerColumn} AND history.environment = 'production')
  OR EXISTS (SELECT 1 FROM relief_dispatches history WHERE history.replacement_officer_id = ${officerColumn} AND history.environment = 'production')
  OR EXISTS (SELECT 1 FROM officer_site_inductions history WHERE history.officer_id = ${officerColumn} AND history.environment = 'production')
  OR EXISTS (SELECT 1 FROM workforce_terms_acceptances history WHERE history.officer_id = ${officerColumn} AND history.environment = 'production')
  OR EXISTS (SELECT 1 FROM officer_work_commitments history WHERE history.officer_id = ${officerColumn} AND history.environment = 'production')
  OR EXISTS (SELECT 1 FROM officer_schedule_declarations history WHERE history.officer_id = ${officerColumn} AND history.environment = 'production')
  OR EXISTS (SELECT 1 FROM officer_travel_assessments history WHERE history.officer_id = ${officerColumn} AND history.environment = 'production')
  OR EXISTS (SELECT 1 FROM assignment_activation_commands history WHERE history.officer_id = ${officerColumn} AND history.environment = 'production')
  OR EXISTS (SELECT 1 FROM assignment_evidence_tokens history WHERE history.officer_id = ${officerColumn} AND history.environment = 'production')
  OR EXISTS (SELECT 1 FROM assignment_activation_snapshots history WHERE history.officer_id = ${officerColumn} AND history.environment = 'production')
  OR EXISTS (SELECT 1 FROM shifts history WHERE history.officer_id = ${officerColumn} AND history.environment = 'production')
  OR EXISTS (SELECT 1 FROM offers history_offer JOIN bookings history_booking ON history_booking.id = history_offer.booking_id
    WHERE history_offer.officer_id = ${officerColumn} AND history_booking.environment = 'production')`;

const PILOT_OFFICER_UPDATE_GUARD = (officerColumn: PilotOfficerColumn) => `
  EXISTS (SELECT 1 FROM officer_passports demo_passport
    WHERE demo_passport.officer_id = ${officerColumn}
      AND demo_passport.environment = 'demo' AND demo_passport.integrity_state = 'synthetic')
  AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY(officerColumn)})`;

class PilotError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function getPilotDb(): D1Database {
  if (!env.DB) throw new PilotError("The pilot database is not available.", 503);
  return env.DB;
}

function eventId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nextThursdayAndFriday() {
  const thursday = new Date();
  const daysUntilThursday = (4 - thursday.getUTCDay() + 7) % 7;
  thursday.setUTCDate(thursday.getUTCDate() + (daysUntilThursday === 0 ? 0 : daysUntilThursday));
  thursday.setUTCHours(10, 0, 0, 0);
  const friday = new Date(thursday);
  friday.setUTCDate(friday.getUTCDate() + 1);
  return { thursday: thursday.toISOString(), friday: friday.toISOString().slice(0, 10) };
}

function nextReleaseAt(cadence: "Weekly" | "Monthly") {
  const now = new Date();
  const release = new Date(now);
  if (cadence === "Weekly") {
    const daysUntilThursday = (4 - release.getUTCDay() + 7) % 7;
    release.setUTCDate(release.getUTCDate() + daysUntilThursday);
    release.setUTCHours(4, 0, 0, 0);
    if (release.getTime() <= now.getTime()) release.setUTCDate(release.getUTCDate() + 7);
  } else {
    release.setUTCMonth(release.getUTCMonth() + 1, 1);
    release.setUTCHours(6, 0, 0, 0);
  }
  return release.toISOString();
}

async function assertPilotSeedIsolation(db: D1Database, passportHash: string) {
  const collision = await db.prepare(`SELECT entity FROM (
    SELECT 'officer' AS entity FROM officers
      WHERE id = ? AND (
        full_name <> 'Lerato Khumalo' OR mobile <> '+27 82 555 0184'
        OR email <> 'lerato@example.co.za' OR psira_number <> 'PSIRA-1842'
        OR NOT EXISTS (SELECT 1 FROM officer_passports passport
          WHERE passport.officer_id = officers.id AND passport.passport_number = ?
            AND passport.public_token_hash = ? AND passport.environment = 'demo'
            AND passport.integrity_state = 'synthetic')
        OR (${PILOT_OFFICER_PRODUCTION_HISTORY("officers.id")})
      )
    UNION ALL
    SELECT 'passport' FROM officer_passports
      WHERE (officer_id = ? OR passport_number = ? OR public_token_hash = ?)
        AND (officer_id <> ? OR passport_number <> ? OR public_token_hash <> ?
          OR environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL
    SELECT 'client' FROM clients WHERE id = ?
      AND (environment <> 'demo' OR integrity_state <> 'synthetic'
        OR organisation_name <> 'Northbridge Property Services'
        OR contact_email <> 'nadia@northbridge.example')
    UNION ALL
    SELECT 'endorsement' FROM officer_endorsements
      WHERE (id IN ('END-CORE-001', 'END-UNA-001', 'END-ARM-001', 'END-VIP-001', 'END-COM-001', 'END-CON-001', 'END-EXE-001')
        OR (officer_id = ? AND code IN ('core_ready', 'service_unarmed', 'service_armed', 'service_vip',
          'purpose_commercial_access', 'purpose_construction', 'purpose_executive_protection')))
        AND (officer_id <> ? OR environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL
    SELECT 'compliance' FROM compliance_records
      WHERE id IN ('CMP-PSIRA-001', 'CMP-FIREARM-001', 'CMP-REG21-001')
        AND (officer_id <> ? OR environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL
    SELECT 'booking' FROM bookings
      WHERE id IN ('BK-2081', 'BK-2080', 'BK-2084', 'BK-2078')
        AND (client_id <> ? OR environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL
    SELECT 'offer' FROM offers offer
      LEFT JOIN bookings booking ON booking.id = offer.booking_id
      WHERE offer.id = 'OF-2084' AND (offer.booking_id <> 'BK-2084' OR offer.officer_id <> ?
        OR booking.environment <> 'demo' OR booking.integrity_state <> 'synthetic')
    UNION ALL
    SELECT 'shift' FROM shifts
      WHERE id IN ('SH-2081', 'SH-2080', 'SH-2077', 'SH-2078')
        AND (officer_id <> ? OR environment <> 'demo' OR integrity_state <> 'synthetic'
          OR (id = 'SH-2081' AND booking_id <> 'BK-2081')
          OR (id = 'SH-2080' AND booking_id <> 'BK-2080')
          OR (id = 'SH-2077' AND booking_id <> 'BK-2081')
          OR (id = 'SH-2078' AND booking_id <> 'BK-2078'))
    UNION ALL
    SELECT 'ledger' FROM ledger_entries ledger
      LEFT JOIN shifts shift ON shift.id = ledger.shift_id
      LEFT JOIN bookings booking ON booking.id = shift.booking_id
      WHERE ledger.id IN ('LE-2077', 'LE-2080', 'LE-2078')
        AND (ledger.officer_id <> ? OR shift.environment <> 'demo' OR shift.integrity_state <> 'synthetic'
          OR booking.environment <> 'demo' OR booking.integrity_state <> 'synthetic'
          OR (ledger.id = 'LE-2077' AND ledger.shift_id <> 'SH-2077')
          OR (ledger.id = 'LE-2080' AND ledger.shift_id <> 'SH-2080')
          OR (ledger.id = 'LE-2078' AND ledger.shift_id <> 'SH-2078'))
    UNION ALL
    SELECT 'audit' FROM audit_events WHERE id = 'AUD-001'
      AND (actor_type <> 'system' OR actor_id <> 'LOKD' OR event_type <> 'pilot_seeded'
        OR entity_type <> 'officer' OR entity_id <> ?)
  ) collisions LIMIT 1`)
    .bind(
      PILOT_OFFICER_ID, PILOT_PASSPORT_NUMBER, passportHash,
      PILOT_OFFICER_ID, PILOT_PASSPORT_NUMBER, passportHash,
      PILOT_OFFICER_ID, PILOT_PASSPORT_NUMBER, passportHash,
      PILOT_CLIENT_ID,
      PILOT_OFFICER_ID, PILOT_OFFICER_ID,
      PILOT_OFFICER_ID,
      PILOT_CLIENT_ID,
      PILOT_OFFICER_ID,
      PILOT_OFFICER_ID,
      PILOT_OFFICER_ID,
      PILOT_OFFICER_ID,
    )
    .first<{ entity: string }>();
  if (collision) {
    throw new PilotError("The synthetic demo seed is unavailable because its isolated records could not be verified.", 503);
  }
}

async function ensurePilotData(db: D1Database) {
  const passportHash = await tokenHash(PILOT_PASSPORT_TOKEN);
  await assertPilotSeedIsolation(db, passportHash);
  const primaryQuote = quoteBooking({ serviceType: "Unarmed", engagementModel: "fixed", term: "1", purposeCode: "commercial_access", startDate: "2026-08-01", shift: "day", rosterPattern: "monday_saturday", riskInput: defaultRiskInput });
  const depotQuote = quoteBooking({ serviceType: "Unarmed", engagementModel: "fixed", term: "1", purposeCode: "construction", startDate: "2026-08-22", shift: "day", rosterPattern: "monday_saturday", riskInput: defaultRiskInput });
  const vipQuote = quoteBooking({ serviceType: "VIP", engagementModel: "fixed", term: "6", purposeCode: "executive_protection", startDate: "2026-03-01", shift: "day", rosterPattern: "weekdays", riskInput: defaultRiskInput });
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO officers
      (id, full_name, mobile, email, city, psira_number, psira_grade, psira_expiry, approval_status, banking_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(PILOT_OFFICER_ID, "Lerato Khumalo", "+27 82 555 0184", "lerato@example.co.za", "Johannesburg North", "PSIRA-1842", "Grade B", "2027-05-31", "approved", "verified", "2026-08-01T08:00:00.000Z"),
    db.prepare(`INSERT OR IGNORE INTO officer_passports
      (officer_id, passport_number, public_token_hash, status, readiness_label, environment, integrity_state,
       issued_at, last_reviewed_at, next_review_at, updated_at)
      SELECT officer.id, ?, ?, 'active', 'LOKD Ready', 'demo', 'synthetic', ?, ?, ?, ?
      FROM officers officer WHERE officer.id = ?
        AND officer.full_name = 'Lerato Khumalo' AND officer.email = 'lerato@example.co.za'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("officer.id")})`)
      .bind(PILOT_PASSPORT_NUMBER, passportHash, "2026-08-05T09:00:00.000Z", "2026-08-15T09:00:00.000Z", "2026-09-15", "2026-08-15T09:00:00.000Z", PILOT_OFFICER_ID),
    db.prepare(`INSERT OR IGNORE INTO officer_services
      (officer_id, service_type, qualified, opted_in, qualification_expiry)
      SELECT passport.officer_id, ?, ?, ?, ? FROM officer_passports passport
      WHERE passport.officer_id = ? AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`)
      .bind("Unarmed", 1, 1, null, PILOT_OFFICER_ID),
    db.prepare(`INSERT OR IGNORE INTO officer_services
      (officer_id, service_type, qualified, opted_in, qualification_expiry)
      SELECT passport.officer_id, ?, ?, ?, ? FROM officer_passports passport
      WHERE passport.officer_id = ? AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`)
      .bind("Armed", 1, 0, "2028-02-10", PILOT_OFFICER_ID),
    db.prepare(`INSERT OR IGNORE INTO officer_services
      (officer_id, service_type, qualified, opted_in, qualification_expiry)
      SELECT passport.officer_id, ?, ?, ?, ? FROM officer_passports passport
      WHERE passport.officer_id = ? AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`)
      .bind("VIP", 0, 0, null, PILOT_OFFICER_ID),
    db.prepare(`INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, environment, integrity_state,
       assessed_at, expires_at, next_due_at, assessor, client_visible)
      SELECT ?, passport.officer_id, ?, ?, ?, ?, ?, 'current', 'demo', 'synthetic', ?, ?, ?, ?, 1
      FROM officer_passports passport WHERE passport.officer_id = ?
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`)
      .bind("END-CORE-001", "core_ready", "Core LOKD Ready", "core", null, null, "2026-08-15T09:00:00.000Z", "2026-09-15", "2026-09-15", "LOKD Academy", PILOT_OFFICER_ID),
    db.prepare(`INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, environment, integrity_state,
       assessed_at, expires_at, next_due_at, assessor, client_visible)
      SELECT ?, passport.officer_id, ?, ?, ?, ?, ?, 'current', 'demo', 'synthetic', ?, ?, ?, ?, 1
      FROM officer_passports passport WHERE passport.officer_id = ?
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`)
      .bind("END-UNA-001", "service_unarmed", "Unarmed Security Professional", "service", "Unarmed", null, "2026-08-12T09:00:00.000Z", "2026-11-30", "2026-09-12", "LOKD Academy", PILOT_OFFICER_ID),
    db.prepare(`INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, environment, integrity_state,
       assessed_at, expires_at, next_due_at, assessor, client_visible)
      SELECT ?, passport.officer_id, ?, ?, ?, ?, ?, 'current', 'demo', 'synthetic', ?, ?, ?, ?, 1
      FROM officer_passports passport WHERE passport.officer_id = ?
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`)
      .bind("END-ARM-001", "service_armed", "Armed monthly readiness", "service", "Armed", null, "2026-08-05T09:00:00.000Z", "2026-09-05", "2026-09-05", "LOKD Academy", PILOT_OFFICER_ID),
    db.prepare(`INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, environment, integrity_state,
       assessed_at, expires_at, next_due_at, assessor, client_visible)
      SELECT ?, passport.officer_id, ?, ?, ?, ?, ?, 'current', 'demo', 'synthetic', ?, ?, ?, ?, 1
      FROM officer_passports passport WHERE passport.officer_id = ?
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`)
      .bind("END-VIP-001", "service_vip", "Protective Operations specialist", "service", "VIP", null, "2026-08-08T09:00:00.000Z", "2026-11-30", "2026-09-08", "LOKD Academy", PILOT_OFFICER_ID),
    db.prepare(`INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, environment, integrity_state,
       assessed_at, expires_at, next_due_at, assessor, client_visible)
      SELECT ?, passport.officer_id, ?, ?, ?, ?, ?, 'current', 'demo', 'synthetic', ?, ?, ?, ?, 1
      FROM officer_passports passport WHERE passport.officer_id = ?
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`)
      .bind("END-COM-001", "purpose_commercial_access", "Commercial access", "purpose", null, "commercial_access", "2026-08-10T09:00:00.000Z", "2026-12-31", "2026-12-01", "LOKD Academy", PILOT_OFFICER_ID),
    db.prepare(`INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, environment, integrity_state,
       assessed_at, expires_at, next_due_at, assessor, client_visible)
      SELECT ?, passport.officer_id, ?, ?, ?, ?, ?, 'current', 'demo', 'synthetic', ?, ?, ?, ?, 1
      FROM officer_passports passport WHERE passport.officer_id = ?
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`)
      .bind("END-CON-001", "purpose_construction", "Construction sites", "purpose", null, "construction", "2026-08-10T10:00:00.000Z", "2026-12-31", "2026-12-01", "LOKD Academy", PILOT_OFFICER_ID),
    db.prepare(`INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, environment, integrity_state,
       assessed_at, expires_at, next_due_at, assessor, client_visible)
      SELECT ?, passport.officer_id, ?, ?, ?, ?, ?, 'current', 'demo', 'synthetic', ?, ?, ?, ?, 1
      FROM officer_passports passport WHERE passport.officer_id = ?
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`)
      .bind("END-EXE-001", "purpose_executive_protection", "Executive protection", "purpose", null, "executive_protection", "2026-08-08T10:00:00.000Z", "2026-11-30", "2026-09-08", "LOKD Academy", PILOT_OFFICER_ID),
    db.prepare(`INSERT OR IGNORE INTO compliance_records
      (id, officer_id, record_type, status, environment, integrity_state, verified_at, expires_at, next_due_at)
      SELECT ?, passport.officer_id, ?, ?, 'demo', 'synthetic', ?, ?, ? FROM officer_passports passport
      WHERE passport.officer_id = ? AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`)
      .bind("CMP-PSIRA-001", "PSiRA registration", "current", "2026-08-02T09:00:00.000Z", "2027-05-31", null, PILOT_OFFICER_ID),
    db.prepare(`INSERT OR IGNORE INTO compliance_records
      (id, officer_id, record_type, status, environment, integrity_state, verified_at, expires_at, next_due_at)
      SELECT ?, passport.officer_id, ?, ?, 'demo', 'synthetic', ?, ?, ? FROM officer_passports passport
      WHERE passport.officer_id = ? AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`)
      .bind("CMP-FIREARM-001", "Firearm competency", "current", "2026-08-02T09:15:00.000Z", "2028-02-10", null, PILOT_OFFICER_ID),
    db.prepare(`INSERT OR IGNORE INTO compliance_records
      (id, officer_id, record_type, status, environment, integrity_state, verified_at, expires_at, next_due_at)
      SELECT ?, passport.officer_id, ?, ?, 'demo', 'synthetic', ?, ?, ? FROM officer_passports passport
      WHERE passport.officer_id = ? AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`)
      .bind("CMP-REG21-001", "Regulation 21 record", "current", "2025-11-14T10:00:00.000Z", null, "2026-11-14", PILOT_OFFICER_ID),
    db.prepare(`INSERT OR IGNORE INTO clients
      (id, organisation_name, contact_name, contact_email, approval_status, environment, integrity_state)
      VALUES (?, ?, ?, ?, ?, 'demo', 'synthetic')`)
      .bind(PILOT_CLIENT_ID, "Northbridge Property Services", "Nadia Jacobs", "nadia@northbridge.example", "approved"),
    db.prepare(`INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date,
       shift_start, shift_end, client_price_cents, officer_rate_cents, environment, integrity_state, funding_status, release_cadence, status)
      SELECT ?, client.id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'demo', 'synthetic', ?, ?, ?
      FROM clients client WHERE client.id = ? AND client.environment = 'demo' AND client.integrity_state = 'synthetic'`)
      .bind("BK-2081", "Northbridge Rosebank Offices", "Rosebank", "Main access", "Unarmed", "Grade C", 1,
        "2026-08-01", "2026-08-31", "06:00", "18:00", primaryQuote.clientPriceCents, primaryQuote.officerRateCents,
        "paid_in_full", "Weekly", "active", PILOT_CLIENT_ID),
    db.prepare(`INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date,
       shift_start, shift_end, client_price_cents, officer_rate_cents, environment, integrity_state, funding_status, release_cadence, status)
      SELECT ?, client.id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'demo', 'synthetic', ?, ?, ?
      FROM clients client WHERE client.id = ? AND client.environment = 'demo' AND client.integrity_state = 'synthetic'`)
      .bind("BK-2080", "Northbridge Rosebank Offices", "Rosebank", "Main access", "Unarmed", "Grade C", 1,
        "2026-08-01", "2026-08-31", "06:00", "18:00", primaryQuote.clientPriceCents, primaryQuote.officerRateCents,
        "paid_in_full", "Weekly", "active", PILOT_CLIENT_ID),
    db.prepare(`INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date,
       shift_start, shift_end, client_price_cents, officer_rate_cents, environment, integrity_state, funding_status, release_cadence, status)
      SELECT ?, client.id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'demo', 'synthetic', ?, ?, ?
      FROM clients client WHERE client.id = ? AND client.environment = 'demo' AND client.integrity_state = 'synthetic'`)
      .bind("BK-2084", "Metsi Midrand Depot", "Midrand", "Contractor access", "Unarmed", "Grade C", 1,
        "2026-08-22", "2026-09-21", "06:00", "18:00", depotQuote.clientPriceCents, depotQuote.officerRateCents,
        "paid_in_full", "Weekly", "offered", PILOT_CLIENT_ID),
    db.prepare(`INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date,
       shift_start, shift_end, client_price_cents, officer_rate_cents, environment, integrity_state, funding_status, release_cadence, status)
      SELECT ?, client.id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'demo', 'synthetic', ?, ?, ?
      FROM clients client WHERE client.id = ? AND client.environment = 'demo' AND client.integrity_state = 'synthetic'`)
      .bind("BK-2078", "Sandton Executive Centre", "Sandton", "Executive reception", "VIP", "Grade B", 6,
        "2026-03-01", "2026-08-31", "08:00", "20:00", vipQuote.clientPriceCents, vipQuote.officerRateCents,
        "paid_in_full", "Monthly", "active", PILOT_CLIENT_ID),
    db.prepare(`INSERT OR IGNORE INTO offers
      (id, booking_id, officer_id, amount_cents, status, expires_at, responded_at)
      SELECT ?, booking.id, passport.officer_id, ?, ?, ?, ?
      FROM bookings booking JOIN officer_passports passport ON passport.officer_id = ?
      WHERE booking.id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`)
      .bind("OF-2084", depotQuote.officerRateCents, "open", "2026-08-21T18:00:00.000Z", null,
        PILOT_OFFICER_ID, "BK-2084"),
    db.prepare(`INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, environment, integrity_state, status, check_in_at, check_out_at,
       client_signoff_status, signed_off_at, earnings_cents)
      SELECT ?, booking.id, passport.officer_id, ?, 'demo', 'synthetic', ?, ?, ?, ?, ?, ?
      FROM bookings booking JOIN officer_passports passport ON passport.officer_id = ?
      WHERE booking.id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`)
      .bind("SH-2081", "2026-08-21", "on_post", "2026-08-21T03:54:00.000Z", null, "not_due", null, 80000,
        PILOT_OFFICER_ID, "BK-2081"),
    db.prepare(`INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, environment, integrity_state, status, check_in_at, check_out_at,
       client_signoff_status, signed_off_at, earnings_cents)
      SELECT ?, booking.id, passport.officer_id, ?, 'demo', 'synthetic', ?, ?, ?, ?, ?, ?
      FROM bookings booking JOIN officer_passports passport ON passport.officer_id = ?
      WHERE booking.id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`)
      .bind("SH-2080", "2026-08-18", "completed", "2026-08-18T03:55:00.000Z", "2026-08-18T16:03:00.000Z", "pending", null, 80000,
        PILOT_OFFICER_ID, "BK-2080"),
    db.prepare(`INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, environment, integrity_state, status, check_in_at, check_out_at,
       client_signoff_status, signed_off_at, earnings_cents)
      SELECT ?, booking.id, passport.officer_id, ?, 'demo', 'synthetic', ?, ?, ?, ?, ?, ?
      FROM bookings booking JOIN officer_passports passport ON passport.officer_id = ?
      WHERE booking.id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`)
      .bind("SH-2077", "2026-08-14", "verified", "2026-08-14T03:53:00.000Z", "2026-08-14T16:01:00.000Z", "approved",
        "2026-08-14T16:15:00.000Z", 80000, PILOT_OFFICER_ID, "BK-2081"),
    db.prepare(`INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, environment, integrity_state, status, check_in_at, check_out_at,
       client_signoff_status, signed_off_at, earnings_cents)
      SELECT ?, booking.id, passport.officer_id, ?, 'demo', 'synthetic', ?, ?, ?, ?, ?, ?
      FROM bookings booking JOIN officer_passports passport ON passport.officer_id = ?
      WHERE booking.id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`)
      .bind("SH-2078", "2026-07-31", "verified", "2026-07-31T05:56:00.000Z", "2026-07-31T18:04:00.000Z", "approved",
        "2026-07-31T18:20:00.000Z", 450000, PILOT_OFFICER_ID, "BK-2078"),
    db.prepare(`INSERT OR IGNORE INTO ledger_entries
      (id, officer_id, shift_id, amount_cents, state, release_cadence, eligible_release_at, created_at, updated_at)
      SELECT ?, shift.officer_id, shift.id, ?, ?, ?, ?, ?, ?
      FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
      WHERE shift.id = ? AND shift.officer_id = ?
        AND shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`)
      .bind("LE-2077", 80000, "available", "Weekly", "2026-08-15T08:00:00.000Z", "2026-08-14T16:15:00.000Z",
        "2026-08-15T08:00:00.000Z", "SH-2077", PILOT_OFFICER_ID),
    db.prepare(`INSERT OR IGNORE INTO ledger_entries
      (id, officer_id, shift_id, amount_cents, state, release_cadence, eligible_release_at, created_at, updated_at)
      SELECT ?, shift.officer_id, shift.id, ?, ?, ?, ?, ?, ?
      FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
      WHERE shift.id = ? AND shift.officer_id = ?
        AND shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`)
      .bind("LE-2080", 80000, "pending_signoff", "Weekly", null, "2026-08-18T16:03:00.000Z",
        "2026-08-18T16:03:00.000Z", "SH-2080", PILOT_OFFICER_ID),
    db.prepare(`INSERT OR IGNORE INTO ledger_entries
      (id, officer_id, shift_id, amount_cents, state, release_cadence, eligible_release_at, created_at, updated_at)
      SELECT ?, shift.officer_id, shift.id, ?, ?, ?, ?, ?, ?
      FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
      WHERE shift.id = ? AND shift.officer_id = ?
        AND shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`)
      .bind("LE-2078", 450000, "pending_release", "Monthly", "2026-08-20T08:00:00.000Z", "2026-07-31T18:20:00.000Z",
        "2026-07-31T18:20:00.000Z", "SH-2078", PILOT_OFFICER_ID),
    db.prepare(`INSERT OR IGNORE INTO audit_events
      (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
      SELECT ?, ?, ?, ?, ?, passport.officer_id, ?, ? FROM officer_passports passport
      WHERE passport.officer_id = ? AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`)
      .bind("AUD-001", "system", "LOKD", "pilot_seeded", "officer", "Verified pilot profile and funded contracts loaded.",
        "2026-08-21T08:00:00.000Z", PILOT_OFFICER_ID),
    db.prepare(`UPDATE officers SET flex_available = 1, external_work_acknowledged = 1, rest_window_confirmed = 1
      WHERE id = ?
        AND ${PILOT_OFFICER_UPDATE_GUARD("officers.id")}`).bind(PILOT_OFFICER_ID),
    db.prepare(`UPDATE bookings SET purpose_code = 'commercial_access', purpose_label = 'Commercial access',
      engagement_model = 'fixed', notice_window = 'standard', roster_pattern = 'monday_saturday',
      calendar_category = ?, calendar_label = ?, risk_band = ?, risk_score = ?, risk_reasons = ?, required_endorsements = ?,
      manual_review = ?, shift_count = ?, client_price_cents = ?, officer_rate_cents = ?, officer_total_cents = ?,
      gross_platform_contribution_cents = ?, pricing_version = ?, pricing_breakdown = ?
      WHERE id IN ('BK-2081', 'BK-2080') AND environment = 'demo' AND integrity_state = 'synthetic'`).bind(
        primaryQuote.firstCalendarCategory, primaryQuote.firstCalendarLabel, primaryQuote.risk.band, primaryQuote.risk.score,
        JSON.stringify(primaryQuote.risk.reasons), JSON.stringify(primaryQuote.risk.requiredEndorsements), primaryQuote.manualReview ? 1 : 0,
        primaryQuote.shiftCount, primaryQuote.clientPriceCents, primaryQuote.officerRateCents, primaryQuote.officerTotalCents,
        primaryQuote.grossPlatformContributionCents, primaryQuote.version, JSON.stringify({
          baseClientCents: primaryQuote.baseClientCents,
          calendarPremiumCents: primaryQuote.calendarPremiumCents,
          dispatchPremiumCents: primaryQuote.dispatchPremiumCents,
          riskPremiumCents: primaryQuote.riskPremiumCents,
        }),
      ),
    db.prepare(`UPDATE bookings SET purpose_code = 'construction', purpose_label = 'Construction site',
      engagement_model = 'fixed', notice_window = 'standard', roster_pattern = 'monday_saturday',
      calendar_category = ?, calendar_label = ?, risk_band = ?, risk_score = ?, risk_reasons = ?, required_endorsements = ?,
      manual_review = ?, shift_count = ?, client_price_cents = ?, officer_rate_cents = ?, officer_total_cents = ?,
      gross_platform_contribution_cents = ?, pricing_version = ?, pricing_breakdown = ? WHERE id = 'BK-2084'
        AND environment = 'demo' AND integrity_state = 'synthetic'`).bind(
        depotQuote.firstCalendarCategory, depotQuote.firstCalendarLabel, depotQuote.risk.band, depotQuote.risk.score,
        JSON.stringify(depotQuote.risk.reasons), JSON.stringify(depotQuote.risk.requiredEndorsements), depotQuote.manualReview ? 1 : 0,
        depotQuote.shiftCount, depotQuote.clientPriceCents, depotQuote.officerRateCents, depotQuote.officerTotalCents,
        depotQuote.grossPlatformContributionCents, depotQuote.version, JSON.stringify({
          baseClientCents: depotQuote.baseClientCents,
          calendarPremiumCents: depotQuote.calendarPremiumCents,
          dispatchPremiumCents: depotQuote.dispatchPremiumCents,
          riskPremiumCents: depotQuote.riskPremiumCents,
        }),
      ),
    db.prepare(`UPDATE officer_services SET qualified = 1 WHERE officer_id = ? AND service_type = 'VIP'
      AND ${PILOT_OFFICER_UPDATE_GUARD("officer_services.officer_id")}`)
      .bind(PILOT_OFFICER_ID),
    db.prepare(`UPDATE bookings SET service_type = 'VIP', purpose_code = 'executive_protection', purpose_label = 'Executive protection',
      engagement_model = 'fixed', notice_window = 'standard', roster_pattern = 'weekdays', calendar_category = ?, calendar_label = ?,
      risk_band = ?, risk_score = ?, risk_reasons = ?, required_endorsements = ?, manual_review = 1, shift_count = ?,
      client_price_cents = ?, officer_rate_cents = ?, officer_total_cents = ?, gross_platform_contribution_cents = ?,
      pricing_version = ?, pricing_breakdown = ?, minimum_grade = 'Grade B' WHERE id = 'BK-2078'
        AND environment = 'demo' AND integrity_state = 'synthetic'`).bind(
        vipQuote.firstCalendarCategory, vipQuote.firstCalendarLabel, vipQuote.risk.band, vipQuote.risk.score,
        JSON.stringify(vipQuote.risk.reasons), JSON.stringify(vipQuote.risk.requiredEndorsements), vipQuote.shiftCount,
        vipQuote.clientPriceCents, vipQuote.officerRateCents, vipQuote.officerTotalCents, vipQuote.grossPlatformContributionCents,
        vipQuote.version, JSON.stringify({ baseClientCents: vipQuote.baseClientCents, calendarPremiumCents: vipQuote.calendarPremiumCents,
          dispatchPremiumCents: vipQuote.dispatchPremiumCents, riskPremiumCents: vipQuote.riskPremiumCents }),
      ),
    db.prepare(`UPDATE offers SET amount_cents = ? WHERE id = 'OF-2084' AND status = 'open'
      AND booking_id IN (SELECT id FROM bookings WHERE id = 'BK-2084' AND client_id = ?
        AND environment = 'demo' AND integrity_state = 'synthetic')`)
      .bind(depotQuote.officerRateCents, PILOT_CLIENT_ID),
    db.prepare(`UPDATE bookings SET status = 'offered' WHERE id = 'BK-2084'
      AND environment = 'demo' AND integrity_state = 'synthetic'
      AND EXISTS (SELECT 1 FROM offers WHERE id = 'OF-2084' AND booking_id = 'BK-2084' AND status = 'open')
      AND NOT EXISTS (SELECT 1 FROM offers WHERE booking_id = 'BK-2084' AND status = 'accepted')`),
    db.prepare(`UPDATE shifts SET earnings_cents = 80000 WHERE id IN ('SH-2081', 'SH-2080', 'SH-2077')
      AND environment = 'demo' AND integrity_state = 'synthetic'
      AND booking_id IN (SELECT id FROM bookings WHERE client_id = ?
        AND environment = 'demo' AND integrity_state = 'synthetic')`).bind(PILOT_CLIENT_ID),
    db.prepare(`UPDATE shifts SET earnings_cents = 450000 WHERE id = 'SH-2078'
      AND environment = 'demo' AND integrity_state = 'synthetic'
      AND booking_id IN (SELECT id FROM bookings WHERE client_id = ?
        AND environment = 'demo' AND integrity_state = 'synthetic')`).bind(PILOT_CLIENT_ID),
    db.prepare(`UPDATE ledger_entries SET amount_cents = 80000 WHERE id IN ('LE-2077', 'LE-2080')
      AND shift_id IN (SELECT shift.id FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
        WHERE shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
          AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic')`).bind(PILOT_CLIENT_ID),
    db.prepare(`UPDATE ledger_entries SET amount_cents = 450000 WHERE id = 'LE-2078'
      AND shift_id IN (SELECT shift.id FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
        WHERE shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
          AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic')`).bind(PILOT_CLIENT_ID),
    db.prepare(`UPDATE offers SET expires_at = '2026-09-05T16:00:00.000Z'
      WHERE id = 'OF-2084' AND status = 'open' AND expires_at = '2026-08-21T18:00:00.000Z'
        AND booking_id IN (SELECT id FROM bookings WHERE id = 'BK-2084' AND client_id = ?
          AND environment = 'demo' AND integrity_state = 'synthetic')`).bind(PILOT_CLIENT_ID),
    db.prepare(`UPDATE shifts SET passport_verification_status = 'green', passport_verified_at = COALESCE(passport_verified_at, ?)
      WHERE id = 'SH-2081' AND passport_verification_status = 'not_checked'
        AND environment = 'demo' AND integrity_state = 'synthetic'
        AND booking_id IN (SELECT id FROM bookings WHERE client_id = ?
          AND environment = 'demo' AND integrity_state = 'synthetic')`)
      .bind("2026-08-21T03:54:00.000Z", PILOT_CLIENT_ID),
  ]);
}

async function all<T>(statement: D1PreparedStatement) {
  const result = await statement.all<T>();
  return result.results ?? [];
}

function parseStringArray(value: string | null | undefined) {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parsePricingBreakdown(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value ?? "{}") as Partial<PilotState["bookings"][number]["pricingBreakdown"]>;
    return {
      baseClientCents: Number(parsed.baseClientCents) || 0,
      calendarPremiumCents: Number(parsed.calendarPremiumCents) || 0,
      dispatchPremiumCents: Number(parsed.dispatchPremiumCents) || 0,
      riskPremiumCents: Number(parsed.riskPremiumCents) || 0,
    };
  } catch {
    return { baseClientCents: 0, calendarPremiumCents: 0, dispatchPremiumCents: 0, riskPremiumCents: 0 };
  }
}

async function readPilotState(db: D1Database): Promise<PilotState> {
  const officer = await db.prepare(`SELECT id, full_name AS fullName, city, psira_number AS psiraNumber,
    psira_grade AS psiraGrade, psira_expiry AS psiraExpiry, approval_status AS approvalStatus,
    banking_status AS bankingStatus, flex_available AS flexAvailable,
    external_work_acknowledged AS externalWorkAcknowledged, rest_window_confirmed AS restWindowConfirmed
    FROM officers WHERE id = ? AND ${PILOT_OFFICER_UPDATE_GUARD("officers.id")}`).bind(PILOT_OFFICER_ID).first<{
      id: string; fullName: string; city: string; psiraNumber: string; psiraGrade: string;
      psiraExpiry: string; approvalStatus: string; bankingStatus: string; flexAvailable: number;
      externalWorkAcknowledged: number; restWindowConfirmed: number;
    }>();
  if (!officer) throw new PilotError("The pilot officer profile is unavailable.", 500);

  const client = await db.prepare(`SELECT id, organisation_name AS organisationName, contact_name AS contactName,
    approval_status AS approvalStatus FROM clients WHERE id = ?
      AND environment = 'demo' AND integrity_state = 'synthetic'`).bind(PILOT_CLIENT_ID).first<{
      id: string; organisationName: string; contactName: string; approvalStatus: string;
    }>();
  if (!client) throw new PilotError("The pilot client profile is unavailable.", 500);

  const passportRow = await db.prepare(`SELECT passport_number AS passportNumber, status, readiness_label AS readinessLabel,
    issued_at AS issuedAt, last_reviewed_at AS lastReviewedAt, next_review_at AS nextReviewAt
    FROM officer_passports WHERE officer_id = ? AND environment = 'demo' AND integrity_state = 'synthetic'`)
    .bind(PILOT_OFFICER_ID).first<{
      passportNumber: string; status: PilotState["officer"]["passport"]["status"]; readinessLabel: string;
      issuedAt: string | null; lastReviewedAt: string | null; nextReviewAt: string | null;
    }>();
  if (!passportRow) throw new PilotError("The pilot LOKD Passport is unavailable.", 500);
  const endorsements = await readEndorsements(db, PILOT_OFFICER_ID);
  const today = new Date().toISOString().slice(0, 10);
  const coreReady = endorsements.find((item) => item.code === "core_ready");
  const passportOffersEnabled = (passportRow.status === "active" || passportRow.status === "expiring")
    && officer.psiraExpiry.slice(0, 10) >= today
    && (!passportRow.nextReviewAt || passportRow.nextReviewAt.slice(0, 10) >= today)
    && Boolean(
      coreReady
      && coreReady.status === "current"
      && (!coreReady.expiresAt || coreReady.expiresAt.slice(0, 10) >= today)
      && (!coreReady.nextDueAt || coreReady.nextDueAt.slice(0, 10) >= today),
    );

  const services = await all<{ serviceType: ServiceType; qualified: number; optedIn: number; qualificationExpiry: string | null }>(
    db.prepare(`SELECT service_type AS serviceType, qualified, opted_in AS optedIn,
      qualification_expiry AS qualificationExpiry FROM officer_services WHERE officer_id = ?
        AND ${PILOT_OFFICER_UPDATE_GUARD("officer_services.officer_id")}
      ORDER BY CASE service_type WHEN 'Unarmed' THEN 1 WHEN 'Armed' THEN 2 ELSE 3 END`).bind(PILOT_OFFICER_ID),
  );
  const compliance = await all<{ id: string; recordType: string; status: string; expiresAt: string | null; nextDueAt: string | null }>(
    db.prepare(`SELECT id, record_type AS recordType, status, expires_at AS expiresAt, next_due_at AS nextDueAt
      FROM compliance_records WHERE officer_id = ? AND environment = 'demo' AND integrity_state = 'synthetic'
      ORDER BY record_type`).bind(PILOT_OFFICER_ID),
  );
  const offers = await all<{
    id: string; bookingId: string; siteName: string; siteArea: string; postName: string; serviceType: ServiceType;
    purposeCode: string; purposeLabel: string; engagementModel: "fixed" | "flex"; rosterPattern: "weekdays" | "monday_saturday" | "daily";
    calendarCategory: "ordinary" | "sunday" | "public_holiday" | "easter" | "christmas"; calendarLabel: string;
    riskBand: "Standard" | "Enhanced" | "Elevated" | "High" | "Critical"; riskScore: number; requiredEndorsementsJson: string; shiftCount: number;
    minimumGrade: string; contractMonths: number; startDate: string; shiftStart: string; shiftEnd: string; amountCents: number;
    releaseCadence: "Weekly" | "Monthly"; fundingStatus: string; status: "open" | "accepted" | "declined" | "expired"; expiresAt: string;
  }>(db.prepare(`SELECT o.id, o.booking_id AS bookingId, b.site_name AS siteName, b.site_area AS siteArea,
    b.post_name AS postName, b.service_type AS serviceType, b.purpose_code AS purposeCode,
    b.purpose_label AS purposeLabel, b.engagement_model AS engagementModel, b.roster_pattern AS rosterPattern,
    b.calendar_category AS calendarCategory, b.calendar_label AS calendarLabel, b.risk_band AS riskBand,
    b.risk_score AS riskScore, b.required_endorsements AS requiredEndorsementsJson, b.shift_count AS shiftCount, b.minimum_grade AS minimumGrade,
    b.contract_months AS contractMonths, b.start_date AS startDate, b.shift_start AS shiftStart, b.shift_end AS shiftEnd,
    o.amount_cents AS amountCents, b.release_cadence AS releaseCadence, b.funding_status AS fundingStatus,
    o.status, o.expires_at AS expiresAt FROM offers o JOIN bookings b ON b.id = o.booking_id
    WHERE o.officer_id = ? AND b.client_id = ? AND b.environment = 'demo' AND b.integrity_state = 'synthetic'
    ORDER BY o.expires_at DESC`).bind(PILOT_OFFICER_ID, PILOT_CLIENT_ID));
  const parsedOffers = offers.map(({ requiredEndorsementsJson, ...offer }) => ({
    ...offer,
    requiredEndorsements: parseStringArray(requiredEndorsementsJson),
  }));
  const bookingRows = await all<{
    id: string; siteName: string; siteArea: string; postName: string; serviceType: ServiceType;
    purposeCode: string; purposeLabel: string; engagementModel: "fixed" | "flex";
    noticeWindow: "standard" | "priority" | "urgent" | "immediate"; rosterPattern: "weekdays" | "monday_saturday" | "daily";
    calendarCategory: "ordinary" | "sunday" | "public_holiday" | "easter" | "christmas"; calendarLabel: string;
    riskBand: "Standard" | "Enhanced" | "Elevated" | "High" | "Critical"; riskScore: number;
    riskReasonsJson: string; requiredEndorsementsJson: string; manualReview: number; shiftCount: number;
    officerTotalCents: number; grossPlatformContributionCents: number; pricingVersion: string; pricingBreakdownJson: string;
    minimumGrade: string; contractMonths: number;
    startDate: string; endDate: string; shiftStart: string; shiftEnd: string; clientPriceCents: number;
    officerRateCents: number; fundingStatus: string; releaseCadence: "Weekly" | "Monthly"; status: string;
    offerStatus: "open" | "accepted" | "declined" | "expired" | null; assignedOfficer: string | null;
  }>(db.prepare(`SELECT b.id, b.site_name AS siteName, b.site_area AS siteArea, b.post_name AS postName,
    b.service_type AS serviceType, b.purpose_code AS purposeCode, b.purpose_label AS purposeLabel,
    b.engagement_model AS engagementModel, b.notice_window AS noticeWindow, b.roster_pattern AS rosterPattern,
    b.calendar_category AS calendarCategory, b.calendar_label AS calendarLabel, b.risk_band AS riskBand,
    b.risk_score AS riskScore, b.risk_reasons AS riskReasonsJson, b.required_endorsements AS requiredEndorsementsJson,
    b.manual_review AS manualReview, b.shift_count AS shiftCount, b.officer_total_cents AS officerTotalCents,
    b.gross_platform_contribution_cents AS grossPlatformContributionCents, b.pricing_version AS pricingVersion,
    b.pricing_breakdown AS pricingBreakdownJson,
    b.minimum_grade AS minimumGrade, b.contract_months AS contractMonths, b.start_date AS startDate,
    b.end_date AS endDate, b.shift_start AS shiftStart, b.shift_end AS shiftEnd,
    b.client_price_cents AS clientPriceCents, b.officer_rate_cents AS officerRateCents,
    b.funding_status AS fundingStatus, b.release_cadence AS releaseCadence, b.status,
    (SELECT status FROM offers WHERE booking_id = b.id ORDER BY rowid DESC LIMIT 1) AS offerStatus,
    (SELECT o.full_name FROM shifts s JOIN officers o ON o.id = s.officer_id
      WHERE s.booking_id = b.id AND s.environment = 'demo' AND s.integrity_state = 'synthetic'
      ORDER BY s.rowid DESC LIMIT 1) AS assignedOfficer
    FROM bookings b WHERE b.client_id = ? AND b.environment = 'demo' AND b.integrity_state = 'synthetic'
    ORDER BY b.rowid DESC LIMIT 24`).bind(PILOT_CLIENT_ID));
  const bookings = await Promise.all(bookingRows.map(async (booking) => {
    const readiness = await evaluateBookingReadiness(db, PILOT_OFFICER_ID, booking.id, {
      assignmentDate: booking.startDate,
      requireServiceOptIn: true,
    });
    const availabilityBlockers = booking.engagementModel === "flex"
      ? [
        !officer.flexAvailable ? "Officer is not currently available for Flex work." : "",
        !officer.externalWorkAcknowledged ? "External work declaration is not current." : "",
        !officer.restWindowConfirmed ? "Rest window has not been confirmed." : "",
      ].filter(Boolean)
      : [];
    const { riskReasonsJson, requiredEndorsementsJson, pricingBreakdownJson, manualReview, ...bookingFields } = booking;
    const blockers = [...readiness.blockers, ...availabilityBlockers];
    return {
      ...bookingFields,
      riskReasons: parseStringArray(riskReasonsJson),
      requiredEndorsements: parseStringArray(requiredEndorsementsJson),
      pricingBreakdown: parsePricingBreakdown(pricingBreakdownJson),
      manualReview: Boolean(manualReview),
      matchEligible: blockers.length === 0,
      matchBlockers: blockers,
    };
  }));
  const shifts = await all<{
    id: string; bookingId: string; siteName: string; postName: string; serviceType: ServiceType;
    purposeCode: string; purposeLabel: string; scheduledDate: string;
    shiftStart: string; shiftEnd: string; status: string; checkInAt: string | null; checkOutAt: string | null;
    clientSignoffStatus: string; passportVerificationStatus: string; passportVerifiedAt: string | null;
    earningsCents: number; releaseCadence: "Weekly" | "Monthly";
  }>(db.prepare(`SELECT s.id, s.booking_id AS bookingId, b.site_name AS siteName, b.post_name AS postName,
    b.service_type AS serviceType, b.purpose_code AS purposeCode, b.purpose_label AS purposeLabel,
    s.scheduled_date AS scheduledDate, b.shift_start AS shiftStart,
    b.shift_end AS shiftEnd, s.status, s.check_in_at AS checkInAt, s.check_out_at AS checkOutAt,
    s.client_signoff_status AS clientSignoffStatus,
    s.passport_verification_status AS passportVerificationStatus, s.passport_verified_at AS passportVerifiedAt,
    s.earnings_cents AS earningsCents,
    b.release_cadence AS releaseCadence FROM shifts s JOIN bookings b ON b.id = s.booking_id
    WHERE s.officer_id = ? AND b.client_id = ?
      AND s.environment = 'demo' AND s.integrity_state = 'synthetic'
      AND b.environment = 'demo' AND b.integrity_state = 'synthetic'
    ORDER BY s.scheduled_date DESC, s.id DESC`).bind(PILOT_OFFICER_ID, PILOT_CLIENT_ID));
  const ledger = await all<{
    id: string; shiftId: string; bookingId: string; siteName: string; amountCents: number;
    state: "pending_signoff" | "pending_release" | "available" | "withdrawal_queued" | "paid" | "held";
    releaseCadence: "Weekly" | "Monthly"; eligibleReleaseAt: string | null; updatedAt: string;
  }>(db.prepare(`SELECT l.id, l.shift_id AS shiftId, s.booking_id AS bookingId, b.site_name AS siteName,
    l.amount_cents AS amountCents, l.state, l.release_cadence AS releaseCadence,
    l.eligible_release_at AS eligibleReleaseAt, l.updated_at AS updatedAt
    FROM ledger_entries l JOIN shifts s ON s.id = l.shift_id JOIN bookings b ON b.id = s.booking_id
    WHERE l.officer_id = ? AND b.client_id = ?
      AND s.environment = 'demo' AND s.integrity_state = 'synthetic'
      AND b.environment = 'demo' AND b.integrity_state = 'synthetic'
    ORDER BY l.updated_at DESC`).bind(PILOT_OFFICER_ID, PILOT_CLIENT_ID));
  const audit = await all<{
    id: string; actorType: string; eventType: string; entityType: string; entityId: string; detail: string; createdAt: string;
  }>(db.prepare(`SELECT id, actor_type AS actorType, event_type AS eventType, entity_type AS entityType,
    entity_id AS entityId, detail, created_at AS createdAt FROM audit_events
    ORDER BY created_at DESC LIMIT 20`));

  const pendingCents = ledger.filter((entry) => entry.state === "pending_signoff" || entry.state === "pending_release").reduce((sum, entry) => sum + entry.amountCents, 0);
  const availableCents = ledger.filter((entry) => entry.state === "available").reduce((sum, entry) => sum + entry.amountCents, 0);
  const withdrawalQueuedCents = ledger.filter((entry) => entry.state === "withdrawal_queued").reduce((sum, entry) => sum + entry.amountCents, 0);
  const initials = officer.fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return {
    officer: {
      ...officer,
      initials,
      flexAvailable: Boolean(officer.flexAvailable),
      externalWorkAcknowledged: Boolean(officer.externalWorkAcknowledged),
      restWindowConfirmed: Boolean(officer.restWindowConfirmed),
      services: services.map((service) => ({ ...service, qualified: Boolean(service.qualified), optedIn: Boolean(service.optedIn) })),
      compliance,
      passport: {
        ...passportRow,
        verificationPath: `/verify?token=${PILOT_PASSPORT_TOKEN}`,
        offersEnabled: passportOffersEnabled,
        gateMessage: passportOffersEnabled ? "Passport current. Eligible matching offers can be received." : "Passport action required before offers can be received.",
        endorsements,
      },
    },
    client,
    offers: parsedOffers,
    bookings,
    shifts,
    ledger,
    wallet: {
      pendingCents,
      availableCents,
      withdrawalQueuedCents,
      totalTrackedCents: pendingCents + availableCents + withdrawalQueuedCents,
    },
    audit,
  };
}

async function recordAudit(db: D1Database, actorType: string, actorId: string, eventType: string, entityType: string, entityId: string, detail: string) {
  await db.prepare(`INSERT INTO audit_events
    (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(eventId("AUD"), actorType, actorId, eventType, entityType, entityId, detail, new Date().toISOString())
    .run();
}

function requireShortText(value: unknown, label: string, maximum: number) {
  if (typeof value !== "string") throw new PilotError(`${label} is required.`);
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned || cleaned.length > maximum) throw new PilotError(`${label} is not valid.`);
  return cleaned;
}

async function releaseOfferWave(db: D1Database, bookingId: string, actorId: string) {
  const booking = await db.prepare(`SELECT id, start_date AS startDate, funding_status AS fundingStatus,
    officer_rate_cents AS officerRateCents, engagement_model AS engagementModel, status FROM bookings
    WHERE id = ? AND client_id = ? AND environment = 'demo' AND integrity_state = 'synthetic'`)
    .bind(bookingId, PILOT_CLIENT_ID).first<{
      id: string; startDate: string; fundingStatus: string; officerRateCents: number; engagementModel: "fixed" | "flex"; status: string;
    }>();
  if (!booking) throw new PilotError("That booking is unavailable.", 404);
  if (booking.fundingStatus !== "paid_in_full") throw new PilotError("The full contract payment must be confirmed before matching.", 409);
  if (booking.status === "staffed" || booking.status === "active") throw new PilotError("This booking is already staffed.", 409);

  const existing = await db.prepare(`SELECT offer.id, offer.status FROM offers offer
    JOIN bookings booking ON booking.id = offer.booking_id
    WHERE offer.booking_id = ? AND offer.officer_id = ? AND offer.status IN ('open', 'accepted')
      AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
    ORDER BY offer.rowid DESC LIMIT 1`).bind(bookingId, PILOT_OFFICER_ID, PILOT_CLIENT_ID)
    .first<{ id: string; status: string }>();
  if (existing) {
    if (existing.status === "open") {
      await db.prepare(`UPDATE bookings SET status = 'offered' WHERE id = ? AND client_id = ?
        AND environment = 'demo' AND integrity_state = 'synthetic'
        AND EXISTS (SELECT 1 FROM offers WHERE id = ? AND booking_id = bookings.id AND status = 'open')`)
        .bind(bookingId, PILOT_CLIENT_ID, existing.id).run();
    }
    return { released: existing.status === "open", blockers: [] as string[] };
  }

  const readiness = await evaluateBookingReadiness(db, PILOT_OFFICER_ID, bookingId, {
    assignmentDate: booking.startDate,
    requireServiceOptIn: true,
  });
  const availability = booking.engagementModel === "flex"
    ? await db.prepare(`SELECT flex_available AS flexAvailable, external_work_acknowledged AS externalWorkAcknowledged,
        rest_window_confirmed AS restWindowConfirmed FROM officers WHERE id = ?
        AND ${PILOT_OFFICER_UPDATE_GUARD("officers.id")}`).bind(PILOT_OFFICER_ID)
      .first<{ flexAvailable: number; externalWorkAcknowledged: number; restWindowConfirmed: number }>()
    : null;
  const availabilityBlockers = booking.engagementModel === "flex" ? [
    !availability?.flexAvailable ? "Officer is not currently available for Flex work." : "",
    !availability?.externalWorkAcknowledged ? "External work declaration is not current." : "",
    !availability?.restWindowConfirmed ? "Rest window has not been confirmed." : "",
  ].filter(Boolean) : [];
  const blockers = [...readiness.blockers, ...availabilityBlockers];
  if (!readiness.eligible || blockers.length) {
    await db.prepare(`UPDATE bookings SET status = 'matching' WHERE id = ? AND client_id = ?
      AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(bookingId, PILOT_CLIENT_ID).run();
    await recordAudit(db, "operations", actorId, "offer_wave_blocked", "booking", bookingId, `No pilot officer matched: ${blockers.join(" ")}`);
    return { released: false, blockers };
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const offerId = `OF-DEMO-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  await db.batch([
    db.prepare(`INSERT INTO offers (id, booking_id, officer_id, amount_cents, status, expires_at, responded_at)
      SELECT ?, booking.id, passport.officer_id, booking.officer_rate_cents, 'open', ?, NULL
      FROM bookings booking JOIN officer_passports passport ON passport.officer_id = ?
      WHERE booking.id = ? AND booking.client_id = ?
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
        AND booking.funding_status = 'paid_in_full' AND booking.status NOT IN ('staffed', 'active')
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})
        AND NOT EXISTS (SELECT 1 FROM offers current_offer WHERE current_offer.booking_id = booking.id
          AND current_offer.officer_id = passport.officer_id AND current_offer.status IN ('open', 'accepted'))`)
      .bind(offerId, expiresAt, PILOT_OFFICER_ID, bookingId, PILOT_CLIENT_ID),
    db.prepare(`UPDATE bookings SET status = 'offered' WHERE id = ? AND client_id = ?
      AND environment = 'demo' AND integrity_state = 'synthetic' AND funding_status = 'paid_in_full'
      AND EXISTS (SELECT 1 FROM offers WHERE id = ? AND booking_id = bookings.id AND status = 'open')`)
      .bind(bookingId, PILOT_CLIENT_ID, offerId),
  ]);
  const released = await db.prepare(`SELECT 1 AS present FROM offers offer JOIN bookings booking ON booking.id = offer.booking_id
    WHERE offer.id = ? AND offer.booking_id = ? AND offer.officer_id = ? AND offer.status = 'open'
      AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`)
    .bind(offerId, bookingId, PILOT_OFFICER_ID, PILOT_CLIENT_ID).first<{ present: number }>();
  if (!released) throw new PilotError("The synthetic offer could not be released from the verified demo booking.", 409);
  await recordAudit(db, "operations", actorId, "offer_wave_released", "booking", bookingId, "Funded booking passed Passport, grade, service, purpose and opt-in controls; fixed offer released.");
  return { released: true, blockers: [] as string[] };
}

async function resetDemo(db: D1Database, actorId: string) {
  const now = new Date();
  const offerExpiry = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
  await db.batch([
    db.prepare(`UPDATE relief_dispatches SET status = 'cancelled', active_key = NULL, closed_at = ?,
      version = version + 1 WHERE environment = 'demo' AND integrity_state = 'synthetic'
      AND status NOT IN ('cancelled', 'closed', 'replaced')`).bind(now.toISOString()),
    db.prepare(`DELETE FROM operational_exceptions WHERE id LIKE 'EXC-REL-%'
      AND site_id IN (SELECT id FROM operational_sites WHERE environment = 'demo' AND integrity_state = 'synthetic')`),
    db.prepare(`UPDATE roster_slots SET status = CASE WHEN EXISTS (
        SELECT 1 FROM roster_assignments ra WHERE ra.roster_slot_id = roster_slots.id AND ra.active_key = roster_slots.id
      ) THEN 'scheduled' ELSE 'uncovered' END, absence_reason = CASE WHEN id = 'SLOT-LIN-02'
      THEN 'Additional coverage requirement' ELSE NULL END, version = 1, updated_at = ?
      WHERE environment = 'demo' AND integrity_state = 'synthetic'`).bind(now.toISOString()),
    db.prepare(`DELETE FROM audit_events WHERE entity_type = 'relief_dispatch'
      AND entity_id IN (SELECT id FROM relief_dispatches WHERE environment = 'demo' AND integrity_state = 'synthetic')`),
    db.prepare(`DELETE FROM incident_events WHERE incident_id IN (SELECT incident.id FROM site_incidents incident
      JOIN operational_sites site ON site.id = incident.site_id
      WHERE (incident.id LIKE 'INC-RPT-%' OR incident.id LIKE 'INC-OPS-%')
        AND site.environment = 'demo' AND site.integrity_state = 'synthetic')`),
    db.prepare(`DELETE FROM site_incidents WHERE (id LIKE 'INC-RPT-%' OR id LIKE 'INC-OPS-%')
      AND site_id IN (SELECT id FROM operational_sites WHERE environment = 'demo' AND integrity_state = 'synthetic')`),
    db.prepare(`DELETE FROM incident_events WHERE incident_id = 'INC-DEMO-001' AND id <> 'IE-DEMO-001'
      AND EXISTS (SELECT 1 FROM site_incidents incident JOIN operational_sites site ON site.id = incident.site_id
        WHERE incident.id = incident_events.incident_id AND site.environment = 'demo' AND site.integrity_state = 'synthetic')`),
    db.prepare(`UPDATE site_incidents SET status = 'open', owner_id = NULL, acknowledged_at = NULL,
      acknowledged_by = NULL, resolved_at = NULL, resolved_by = NULL, resolution_note = NULL, version = 1
      WHERE id = 'INC-DEMO-001' AND site_id IN (
        SELECT id FROM operational_sites WHERE environment = 'demo' AND integrity_state = 'synthetic')`),
    db.prepare(`UPDATE operational_exceptions SET status = 'new', owner_id = NULL, acknowledged_at = NULL,
      resolved_at = NULL, resolution_code = NULL, resolution_note = NULL, version = 1
      WHERE id = 'EXC-DEMO-001' AND site_id IN (
        SELECT id FROM operational_sites WHERE environment = 'demo' AND integrity_state = 'synthetic')`),
    db.prepare(`DELETE FROM ledger_entries WHERE shift_id IN (SELECT shift.id FROM shifts shift
      JOIN bookings booking ON booking.id = shift.booking_id
      WHERE booking.id LIKE 'BK-DEMO-%' AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
        AND shift.environment = 'demo' AND shift.integrity_state = 'synthetic')`),
    db.prepare(`DELETE FROM shifts WHERE environment = 'demo' AND integrity_state = 'synthetic'
      AND booking_id IN (SELECT id FROM bookings WHERE client_id = ?
        AND environment = 'demo' AND integrity_state = 'synthetic'
        AND (id LIKE 'BK-DEMO-%' OR id = 'BK-2084'))`).bind(PILOT_CLIENT_ID),
    db.prepare(`DELETE FROM offers WHERE booking_id IN (SELECT id FROM bookings WHERE id LIKE 'BK-DEMO-%'
      AND environment = 'demo' AND integrity_state = 'synthetic')`),
    db.prepare(`DELETE FROM bookings WHERE id LIKE 'BK-DEMO-%' AND client_id = ?
      AND environment = 'demo' AND integrity_state = 'synthetic'`).bind(PILOT_CLIENT_ID),
    db.prepare(`UPDATE officer_services SET opted_in = CASE service_type WHEN 'Unarmed' THEN 1 ELSE 0 END
      WHERE officer_id = ?
        AND ${PILOT_OFFICER_UPDATE_GUARD("officer_services.officer_id")}`)
      .bind(PILOT_OFFICER_ID),
    db.prepare(`UPDATE offers SET status = 'open', responded_at = NULL, amount_cents = 80000, expires_at = ?
      WHERE id = 'OF-2084' AND booking_id IN (SELECT id FROM bookings WHERE id = 'BK-2084' AND client_id = ?
        AND environment = 'demo' AND integrity_state = 'synthetic')`).bind(offerExpiry, PILOT_CLIENT_ID),
    db.prepare(`UPDATE bookings SET status = 'offered', funding_status = 'paid_in_full'
      WHERE id = 'BK-2084' AND client_id = ? AND environment = 'demo' AND integrity_state = 'synthetic'`).bind(PILOT_CLIENT_ID),
    db.prepare(`UPDATE shifts SET status = 'completed', client_signoff_status = 'pending', signed_off_at = NULL
      WHERE id = 'SH-2080' AND environment = 'demo' AND integrity_state = 'synthetic'
        AND booking_id IN (SELECT id FROM bookings WHERE id = 'BK-2080' AND client_id = ?
          AND environment = 'demo' AND integrity_state = 'synthetic')`).bind(PILOT_CLIENT_ID),
    db.prepare(`UPDATE ledger_entries SET state = 'pending_signoff', eligible_release_at = NULL, updated_at = ?
      WHERE id = 'LE-2080' AND shift_id IN (SELECT shift.id FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
        WHERE shift.id = 'SH-2080' AND shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
          AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic')`)
      .bind(now.toISOString(), PILOT_CLIENT_ID),
    db.prepare(`UPDATE ledger_entries SET state = 'available', updated_at = ?
      WHERE id = 'LE-2077' AND shift_id IN (SELECT shift.id FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
        WHERE shift.id = 'SH-2077' AND shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
          AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic')`)
      .bind(now.toISOString(), PILOT_CLIENT_ID),
    db.prepare(`DELETE FROM payout_requests WHERE id LIKE 'PAY-DEMO-%' AND officer_id = ?
      AND status = 'queued_for_thursday'`).bind(PILOT_OFFICER_ID),
  ]);
  await recordAudit(db, "operations", actorId, "demo_reset", "pilot", "LOKD-PHASE-1", "Shared transactional demo returned to its opening state. Applications and team feedback were preserved.");
}

async function applyAction(db: D1Database, payload: PilotAction, actor: PilotPrincipal) {
  if (payload.action === "create_booking") {
    if (!Object.hasOwn(servicePriceBook, payload.serviceType)) throw new PilotError("Choose a valid security service.");
    if (!(["fixed", "flex"] as const).includes(payload.engagementModel)) throw new PilotError("Choose Fixed or Flex cover.");
    if (!["single", "1", "3", "6", "12"].includes(payload.term)) throw new PilotError("Choose a valid contract term.");
    if (!Object.hasOwn(rosterPatterns, payload.rosterPattern)) throw new PilotError("Choose a valid coverage roster.");
    if (payload.engagementModel === "fixed" && payload.term === "single") throw new PilotError("Fixed cover requires a contract term.");
    const purpose = purposePriceBook.find((item) => item.code === payload.purposeCode);
    if (!purpose) throw new PilotError("Choose a valid work purpose.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.startDate) || Number.isNaN(new Date(`${payload.startDate}T00:00:00Z`).getTime())) {
      throw new PilotError("Choose a valid start date.");
    }
    const postName = requireShortText(payload.postName, "Post", 80);
    const instructions = requireShortText(payload.instructions, "Instructions", 600);
    const shiftStart = payload.shift === "night" ? "18:00" : "06:00";
    const shiftEnd = payload.shift === "night" ? "06:00" : "18:00";
    const riskInput = payload.riskInput;
    if (!riskInput || !["standard", "valuable", "high_value"].includes(riskInput.assetExposure)
      || !["controlled", "moderate", "open"].includes(riskInput.publicAccess)
      || !["none", "isolated", "repeated"].includes(riskInput.incidentHistory)
      || !["strong", "partial", "limited"].includes(riskInput.existingControls)
      || typeof riskInput.nightOperation !== "boolean" || typeof riskInput.vulnerablePeople !== "boolean") {
      throw new PilotError("Complete the LOKD risk assessment.");
    }
    let quote: ReturnType<typeof quoteBooking>;
    try {
      quote = quoteBooking({
        serviceType: payload.serviceType,
        engagementModel: payload.engagementModel,
        term: payload.term,
        purposeCode: payload.purposeCode,
        startDate: payload.startDate,
        shift: payload.shift,
        rosterPattern: payload.rosterPattern,
        riskInput,
      });
    } catch (cause) {
      throw new PilotError(cause instanceof Error ? cause.message : "The booking could not be priced.");
    }
    const bookingId = `BK-DEMO-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const created = await db.prepare(`INSERT INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, purpose_code, purpose_label,
       engagement_model, notice_window, roster_pattern, calendar_category, calendar_label,
       risk_band, risk_score, risk_reasons, required_endorsements, manual_review, shift_count,
       minimum_grade, contract_months, start_date, end_date, shift_start, shift_end,
       client_price_cents, officer_rate_cents, officer_total_cents, gross_platform_contribution_cents,
       pricing_version, pricing_breakdown, environment, integrity_state, funding_status, release_cadence, status)
      SELECT ?, client.id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        'demo', 'synthetic', ?, ?, ?
      FROM clients client
      WHERE client.id = ? AND client.environment = 'demo' AND client.integrity_state = 'synthetic'`)
      .bind(bookingId, "Northbridge Rosebank Offices", "Rosebank", postName,
        payload.serviceType, purpose.code, purpose.label, quote.engagementModel, quote.noticeWindow, payload.rosterPattern,
        quote.firstCalendarCategory, quote.firstCalendarLabel, quote.risk.band, quote.risk.score,
        JSON.stringify(quote.risk.reasons), JSON.stringify(quote.risk.requiredEndorsements), quote.manualReview ? 1 : 0,
        quote.shiftCount, quote.minimumGrade, quote.contractMonths, payload.startDate, quote.endDate, shiftStart, shiftEnd,
        quote.clientPriceCents, quote.officerRateCents, quote.officerTotalCents, quote.grossPlatformContributionCents,
        quote.version, JSON.stringify({ baseClientCents: quote.baseClientCents, calendarPremiumCents: quote.calendarPremiumCents,
          dispatchPremiumCents: quote.dispatchPremiumCents, riskPremiumCents: quote.riskPremiumCents }),
        quote.manualReview ? "review_required" : "awaiting_payment", quote.releaseCadence,
        quote.manualReview ? "risk_review" : "awaiting_payment", PILOT_CLIENT_ID).run();
    if (!created.meta.changes) throw new PilotError("The verified synthetic demo client is unavailable.", 503);
    await recordAudit(db, "client", actor.email, "booking_created", "booking", bookingId,
      `${PRICE_BOOK_VERSION}; ${quote.engagementModel}; ${quote.noticeLabel}; ${quote.risk.band} ${quote.risk.score}; ${quote.shiftCount} shift${quote.shiftCount === 1 ? "" : "s"}; ${instructions}`);
    return;
  }

  if (payload.action === "approve_risk_plan") {
    const result = await db.prepare(`UPDATE bookings SET funding_status = 'awaiting_payment', status = 'awaiting_payment'
      WHERE id = ? AND client_id = ? AND status = 'risk_review'
        AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(payload.bookingId, PILOT_CLIENT_ID).run();
    if (!result.meta.changes) throw new PilotError("This booking is not awaiting an operations risk review.", 409);
    await recordAudit(db, "operations", actor.email, "risk_plan_approved", "booking", payload.bookingId,
      "DEMO ONLY: assisted risk recommendation reviewed; quote released to the payment gate.");
    return;
  }

  if (payload.action === "confirm_booking_payment") {
    const result = await db.prepare(`UPDATE bookings SET funding_status = 'paid_in_full', status = 'matching'
      WHERE id = ? AND client_id = ? AND funding_status = 'awaiting_payment'
        AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(payload.bookingId, PILOT_CLIENT_ID).run();
    if (!result.meta.changes) throw new PilotError("This demo booking is not awaiting payment confirmation.", 409);
    await recordAudit(db, "operations", actor.email, "demo_payment_confirmed", "booking", payload.bookingId,
      "DEMO ONLY: full-term payment marked as confirmed; no payment was processed.");
    await releaseOfferWave(db, payload.bookingId, actor.email);
    return;
  }

  if (payload.action === "release_offer_wave") {
    await releaseOfferWave(db, payload.bookingId, actor.email);
    return;
  }

  if (payload.action === "reset_demo") {
    if (pilotStage() !== "demo") throw new PilotError("Demo reset is disabled outside the isolated demo environment.", 403);
    await resetDemo(db, actor.email);
    return;
  }

  if (payload.action === "accept_offer") {
    const offer = await db.prepare(`SELECT o.id, o.booking_id AS bookingId, o.status, o.amount_cents AS amountCents,
      o.expires_at AS expiresAt, b.start_date AS startDate, b.engagement_model AS engagementModel FROM offers o JOIN bookings b ON b.id = o.booking_id
      WHERE o.id = ? AND o.officer_id = ? AND b.client_id = ?
        AND b.environment = 'demo' AND b.integrity_state = 'synthetic'`)
      .bind(payload.offerId, PILOT_OFFICER_ID, PILOT_CLIENT_ID).first<{
        id: string; bookingId: string; status: string; amountCents: number; startDate: string; expiresAt: string; engagementModel: "fixed" | "flex";
      }>();
    if (!offer) throw new PilotError("This offer is not available to the pilot officer.", 404);
    if (offer.status !== "open") throw new PilotError("This offer has already been decided.", 409);
    if (new Date(offer.expiresAt).getTime() <= Date.now()) throw new PilotError("This offer has expired.", 409);
    const readiness = await evaluateBookingReadiness(db, PILOT_OFFICER_ID, offer.bookingId, {
      assignmentDate: offer.startDate,
      requireServiceOptIn: true,
    });
    if (!readiness.eligible) throw new PilotError(`LOKD Passport gate: ${readiness.blockers.join(" ")}`, 409);
    if (offer.engagementModel === "flex") {
      const availability = await db.prepare(`SELECT flex_available AS flexAvailable,
        external_work_acknowledged AS externalWorkAcknowledged, rest_window_confirmed AS restWindowConfirmed
        FROM officers WHERE id = ? AND ${PILOT_OFFICER_UPDATE_GUARD("officers.id")}`).bind(PILOT_OFFICER_ID)
        .first<{ flexAvailable: number; externalWorkAcknowledged: number; restWindowConfirmed: number }>();
      if (!availability?.flexAvailable || !availability.externalWorkAcknowledged || !availability.restWindowConfirmed) {
        throw new PilotError("Flex availability, external-work declaration and rest confirmation must still be current.", 409);
      }
    }
    const now = new Date().toISOString();
    try {
      await db.batch([
        db.prepare(`UPDATE bookings SET status = 'staffed' WHERE id = ?
          AND environment = 'demo' AND integrity_state = 'synthetic'
          AND funding_status = 'paid_in_full' AND status IN ('offered', 'matching')
          AND NOT EXISTS (SELECT 1 FROM offers WHERE booking_id = ? AND status = 'accepted')`)
          .bind(offer.bookingId, offer.bookingId),
        db.prepare(`UPDATE offers SET status = 'accepted', responded_at = ?
          WHERE id = ? AND officer_id = ? AND status = 'open'
          AND EXISTS (SELECT 1 FROM bookings WHERE id = ? AND status = 'staffed'
            AND client_id = ? AND environment = 'demo' AND integrity_state = 'synthetic')`)
          .bind(now, payload.offerId, PILOT_OFFICER_ID, offer.bookingId, PILOT_CLIENT_ID),
        db.prepare(`UPDATE offers SET status = 'expired', responded_at = ? WHERE booking_id = ? AND id <> ?
          AND status = 'open'
          AND booking_id IN (SELECT id FROM bookings WHERE client_id = ?
            AND environment = 'demo' AND integrity_state = 'synthetic')
          AND EXISTS (SELECT 1 FROM offers winner WHERE winner.id = ? AND winner.booking_id = offers.booking_id
            AND winner.status = 'accepted')`)
          .bind(now, offer.bookingId, payload.offerId, PILOT_CLIENT_ID, payload.offerId),
        db.prepare(`INSERT INTO shifts
          (id, booking_id, officer_id, scheduled_date, environment, integrity_state, status, check_in_at, check_out_at,
           client_signoff_status, signed_off_at, earnings_cents)
          VALUES (?,
            (SELECT booking.id FROM bookings booking JOIN offers accepted_offer ON accepted_offer.booking_id = booking.id
              WHERE booking.id = ? AND booking.client_id = ? AND booking.environment = 'demo'
                AND booking.integrity_state = 'synthetic' AND accepted_offer.id = ?
                AND accepted_offer.officer_id = ? AND accepted_offer.status = 'accepted'),
            (SELECT passport.officer_id FROM officer_passports passport WHERE passport.officer_id = ?
              AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
              AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})),
            ?, 'demo', 'synthetic', 'confirmed', NULL, NULL, 'not_due', NULL, ?)`)
          .bind(`SH-${offer.bookingId.slice(3)}`, offer.bookingId, PILOT_CLIENT_ID, payload.offerId, PILOT_OFFICER_ID,
            PILOT_OFFICER_ID, offer.startDate, offer.amountCents),
      ]);
    } catch {
      throw new PilotError("Another officer secured this synthetic demo booking first.", 409);
    }
    await recordAudit(db, "officer", actor.email, "synthetic_offer_accepted", "offer", payload.offerId,
      "DEMO ONLY: officer accepted the synthetic offer. No production assignment activation or payroll liability was created.");
    return;
  }

  if (payload.action === "decline_offer") {
    const result = await db.prepare(`UPDATE offers SET status = 'declined', responded_at = ?
      WHERE id = ? AND officer_id = ? AND status = 'open'
        AND booking_id IN (SELECT id FROM bookings WHERE client_id = ?
          AND environment = 'demo' AND integrity_state = 'synthetic')`)
      .bind(new Date().toISOString(), payload.offerId, PILOT_OFFICER_ID, PILOT_CLIENT_ID).run();
    if (!result.meta.changes) throw new PilotError("This offer is no longer open.", 409);
    await recordAudit(db, "officer", actor.email, "offer_declined", "offer", payload.offerId, "Officer declined the offer; no penalty was applied.");
    return;
  }

  if (payload.action === "update_service_preference") {
    const service = await db.prepare(`SELECT qualified FROM officer_services WHERE officer_id = ? AND service_type = ?`)
      .bind(PILOT_OFFICER_ID, payload.serviceType).first<{ qualified: number }>();
    if (!service) throw new PilotError("That service preference is unavailable.", 404);
    if (payload.optedIn && !service.qualified) throw new PilotError("Qualification must be verified before this offer type can be enabled.", 409);
    const result = await db.prepare(`UPDATE officer_services SET opted_in = ?
      WHERE officer_id = ? AND service_type = ?
        AND ${PILOT_OFFICER_UPDATE_GUARD("officer_services.officer_id")}`)
      .bind(payload.optedIn ? 1 : 0, PILOT_OFFICER_ID, payload.serviceType).run();
    if (!result.meta.changes) throw new PilotError("Demo preferences are locked once an officer has production workforce history.", 423);
    await recordAudit(db, "officer", actor.email, "offer_preference_changed", "officer", PILOT_OFFICER_ID, `${payload.serviceType} offer notifications switched ${payload.optedIn ? "on" : "off"}.`);
    return;
  }

  if (payload.action === "update_flex_availability") {
    if (payload.available && (!payload.externalWorkAcknowledged || !payload.restWindowConfirmed)) {
      throw new PilotError("Confirm both the external-work declaration and rest window before going available for Flex.", 409);
    }
    const result = await db.prepare(`UPDATE officers SET flex_available = ?, external_work_acknowledged = ?, rest_window_confirmed = ?
      WHERE id = ?
        AND ${PILOT_OFFICER_UPDATE_GUARD("officers.id")}`)
      .bind(payload.available ? 1 : 0, payload.externalWorkAcknowledged ? 1 : 0,
        payload.restWindowConfirmed ? 1 : 0, PILOT_OFFICER_ID).run();
    if (!result.meta.changes) throw new PilotError("Demo availability is locked once an officer has production workforce history.", 423);
    await recordAudit(db, "officer", actor.email, "flex_availability_changed", "officer", PILOT_OFFICER_ID,
      `Flex availability switched ${payload.available ? "on" : "off"}; external-work and rest declarations recorded.`);
    return;
  }

  if (payload.action === "check_in") {
    const shift = await db.prepare(`SELECT shift.booking_id AS bookingId, shift.scheduled_date AS scheduledDate,
      shift.passport_verification_status AS passportVerificationStatus FROM shifts shift
      JOIN bookings booking ON booking.id = shift.booking_id
      WHERE shift.id = ? AND shift.officer_id = ?
        AND shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
        AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`)
      .bind(payload.shiftId, PILOT_OFFICER_ID, PILOT_CLIENT_ID)
      .first<{ bookingId: string; scheduledDate: string; passportVerificationStatus: string }>();
    if (!shift) throw new PilotError("This shift is not assigned to the pilot officer.", 404);
    const readiness = await evaluateBookingReadiness(db, PILOT_OFFICER_ID, shift.bookingId, {
      assignmentDate: shift.scheduledDate,
    });
    if (!readiness.eligible) throw new PilotError(`LOKD Passport gate: ${readiness.blockers.join(" ")}`, 409);
    if (shift.passportVerificationStatus !== "green") throw new PilotError("Ask the client to scan your booking QR before check-in.", 409);
    const result = await db.prepare(`UPDATE shifts SET status = 'on_post', check_in_at = ?
      WHERE id = ? AND officer_id = ? AND status = 'confirmed'
        AND environment = 'demo' AND integrity_state = 'synthetic'
        AND booking_id IN (SELECT id FROM bookings WHERE client_id = ?
          AND environment = 'demo' AND integrity_state = 'synthetic')`)
      .bind(new Date().toISOString(), payload.shiftId, PILOT_OFFICER_ID, PILOT_CLIENT_ID).run();
    if (!result.meta.changes) throw new PilotError("This shift cannot be checked in from its current state.", 409);
    await recordAudit(db, "officer", actor.email, "shift_checked_in", "shift", payload.shiftId, "Officer check-in recorded using server time. Location verification remains a production integration.");
    return;
  }

  if (payload.action === "complete_shift") {
    const shift = await db.prepare(`SELECT s.id, s.earnings_cents AS earningsCents, b.release_cadence AS releaseCadence
      FROM shifts s JOIN bookings b ON b.id = s.booking_id
      WHERE s.id = ? AND s.officer_id = ? AND s.status = 'on_post'
        AND s.environment = 'demo' AND s.integrity_state = 'synthetic'
        AND b.client_id = ? AND b.environment = 'demo' AND b.integrity_state = 'synthetic'`)
      .bind(payload.shiftId, PILOT_OFFICER_ID, PILOT_CLIENT_ID)
      .first<{ id: string; earningsCents: number; releaseCadence: "Weekly" | "Monthly" }>();
    if (!shift) throw new PilotError("This shift cannot be completed from its current state.", 409);
    const now = new Date().toISOString();
    await db.batch([
      db.prepare(`UPDATE shifts SET status = 'completed', check_out_at = ?, client_signoff_status = 'pending'
        WHERE id = ? AND environment = 'demo' AND integrity_state = 'synthetic'
          AND booking_id IN (SELECT id FROM bookings WHERE client_id = ?
            AND environment = 'demo' AND integrity_state = 'synthetic')`)
        .bind(now, payload.shiftId, PILOT_CLIENT_ID),
      db.prepare(`INSERT OR IGNORE INTO ledger_entries
        (id, officer_id, shift_id, amount_cents, state, release_cadence, eligible_release_at, created_at, updated_at)
        SELECT ?, demo_shift.officer_id, demo_shift.id, demo_shift.earnings_cents, 'pending_signoff', booking.release_cadence,
          NULL, ?, ? FROM shifts demo_shift JOIN bookings booking ON booking.id = demo_shift.booking_id
        WHERE demo_shift.id = ? AND demo_shift.officer_id = ? AND demo_shift.status = 'completed'
          AND demo_shift.environment = 'demo' AND demo_shift.integrity_state = 'synthetic'
          AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`)
        .bind(`LE-${payload.shiftId.slice(3)}`, now, now, payload.shiftId, PILOT_OFFICER_ID, PILOT_CLIENT_ID),
    ]);
    await recordAudit(db, "officer", actor.email, "shift_completed", "shift", payload.shiftId, "Officer completed the shift; earnings are awaiting service verification.");
    return;
  }

  if (payload.action === "report_issue") {
    const shift = await db.prepare(`SELECT s.id, os.id AS siteId FROM shifts s
      JOIN bookings booking ON booking.id = s.booking_id
      LEFT JOIN operational_sites os ON os.booking_id = s.booking_id
        AND os.environment = 'demo' AND os.integrity_state = 'synthetic'
      WHERE s.id = ? AND s.officer_id = ? AND s.environment = 'demo' AND s.integrity_state = 'synthetic'
        AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`)
      .bind(payload.shiftId, PILOT_OFFICER_ID, PILOT_CLIENT_ID).first<{ id: string; siteId: string | null }>();
    if (!shift) throw new PilotError("This issue is not linked to one of your shifts.", 404);
    const category = payload.category.trim().slice(0, 80);
    if (!category) throw new PilotError("Choose an issue category.", 400);
    if (!shift.siteId) {
      await recordAudit(db, "officer", actor.email, "shift_issue_reported", "shift", payload.shiftId, `${category} reported from the officer app. Operations follow-up required.`);
      return;
    }
    const now = new Date();
    const incidentId = eventId("INC-RPT");
    const incidentDetail = "Officer raised an operational issue from the assigned shift. Operations must triage the case before any further conclusion.";
    await db.batch([
      db.prepare(`INSERT INTO site_incidents
        (id, site_id, shift_id, severity, category, summary, detail, status, visibility, reported_by_type, reported_by_id,
         occurred_at, reported_at, owner_id, sla_due_at, acknowledged_at, acknowledged_by, resolved_at, resolved_by,
         resolution_note, client_notified_at, retention_review_at, version)
        VALUES (?, ?, ?, 'medium', ?, ?, ?, 'open', 'operations', 'officer', ?, ?, ?, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, 1)`)
        .bind(incidentId, shift.siteId, payload.shiftId, category.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 48), category, incidentDetail,
          actor.email, now.toISOString(), now.toISOString(), new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
          new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()),
      db.prepare(`INSERT INTO incident_events (id, incident_id, event_type, actor_type, actor_id, detail, created_at)
        VALUES (?, ?, 'case_opened', 'officer', ?, ?, ?)`)
        .bind(eventId("IE"), incidentId, actor.email, `${category} reported from the officer app.`, now.toISOString()),
      db.prepare(`INSERT INTO audit_events
        (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
        VALUES (?, 'officer', ?, 'incident_reported', 'incident', ?, 'Officer report created an Operations incident case.', ?)`)
        .bind(eventId("AUD"), actor.email, incidentId, now.toISOString()),
    ]);
    return;
  }

  if (payload.action === "client_signoff") {
    const shift = await db.prepare(`SELECT s.id, s.client_signoff_status AS signoffStatus,
      b.release_cadence AS releaseCadence FROM shifts s JOIN bookings b ON b.id = s.booking_id
      WHERE s.id = ? AND b.client_id = ?
        AND s.environment = 'demo' AND s.integrity_state = 'synthetic'
        AND b.environment = 'demo' AND b.integrity_state = 'synthetic'`)
      .bind(payload.shiftId, PILOT_CLIENT_ID).first<{
        id: string; signoffStatus: string; releaseCadence: "Weekly" | "Monthly";
      }>();
    if (!shift) throw new PilotError("This shift is not available to this client.", 404);
    if (shift.signoffStatus !== "pending") throw new PilotError("This shift has already been reviewed.", 409);
    const now = new Date().toISOString();
    const releaseAt = nextReleaseAt(shift.releaseCadence);
    await db.batch([
      db.prepare(`UPDATE shifts SET status = 'verified', client_signoff_status = 'approved', signed_off_at = ?
        WHERE id = ? AND environment = 'demo' AND integrity_state = 'synthetic'
          AND booking_id IN (SELECT id FROM bookings WHERE client_id = ?
            AND environment = 'demo' AND integrity_state = 'synthetic')`)
        .bind(now, payload.shiftId, PILOT_CLIENT_ID),
      db.prepare(`UPDATE ledger_entries SET state = 'pending_release', eligible_release_at = ?, updated_at = ?
        WHERE shift_id = ? AND state = 'pending_signoff'
          AND shift_id IN (SELECT demo_shift.id FROM shifts demo_shift JOIN bookings booking ON booking.id = demo_shift.booking_id
            WHERE demo_shift.environment = 'demo' AND demo_shift.integrity_state = 'synthetic'
              AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic')`)
        .bind(releaseAt, now, payload.shiftId, PILOT_CLIENT_ID),
    ]);
    await recordAudit(db, "client", actor.email, "shift_signed_off", "shift", payload.shiftId, `Client verified the completed shift; earnings scheduled for the ${shift.releaseCadence.toLowerCase()} release.`);
    return;
  }

  if (payload.action === "release_earnings") {
    const now = new Date().toISOString();
    const result = await db.prepare(`UPDATE ledger_entries SET state = 'available', updated_at = ?
      WHERE state = 'pending_release' AND eligible_release_at IS NOT NULL AND eligible_release_at <= ?
        AND shift_id IN (SELECT shift.id FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
          WHERE shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
            AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic')`)
      .bind(now, now, PILOT_CLIENT_ID).run();
    if (!result.meta.changes) throw new PilotError("No verified earnings are due for release yet.", 409);
    await recordAudit(db, "operations", actor.email, "earnings_released", "ledger", "release-batch", `${result.meta.changes} verified earning entr${result.meta.changes === 1 ? "y" : "ies"} moved to Available.`);
    return;
  }

  if (payload.action === "request_payout") {
    const available = await db.prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS amountCents
      FROM ledger_entries WHERE officer_id = ? AND state = 'available'
        AND shift_id IN (SELECT shift.id FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
          WHERE shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
            AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic')`)
      .bind(PILOT_OFFICER_ID, PILOT_CLIENT_ID).first<{ amountCents: number }>();
    const amountCents = Number(available?.amountCents ?? 0);
    if (!amountCents) throw new PilotError("There are no Available earnings ready for payout.", 409);
    const schedule = nextThursdayAndFriday();
    const requestId = eventId("PAY-DEMO");
    await db.batch([
      db.prepare(`UPDATE ledger_entries SET state = 'withdrawal_queued', updated_at = ?
        WHERE officer_id = ? AND state = 'available'
          AND shift_id IN (SELECT shift.id FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
            WHERE shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
              AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic')`)
        .bind(new Date().toISOString(), PILOT_OFFICER_ID, PILOT_CLIENT_ID),
      db.prepare(`INSERT INTO payout_requests
        (id, officer_id, amount_cents, status, requested_at, expected_settlement_date)
        VALUES (?, ?, ?, 'queued_for_thursday', ?, ?)`)
        .bind(requestId, PILOT_OFFICER_ID, amountCents, new Date().toISOString(), schedule.friday),
    ]);
    await recordAudit(db, "officer", actor.email, "payout_requested", "payout_request", requestId, `Payout request queued for Thursday processing with expected Friday clearance.`);
    return;
  }

  throw new PilotError("Unknown pilot action.", 400);
}

function stateForScope(state: PilotState, scope: PilotScope): PilotState {
  if (scope === "operations") return state;
  const emptyMoney = { pendingCents: 0, availableCents: 0, withdrawalQueuedCents: 0, totalTrackedCents: 0 };
  if (scope === "client") {
    const bookingIds = new Set(state.bookings.map((booking) => booking.id));
    return {
      ...state,
      officer: {
        ...state.officer,
        psiraNumber: "Verified by LOKD",
        psiraExpiry: "",
        bankingStatus: "not disclosed",
        flexAvailable: false,
        externalWorkAcknowledged: false,
        restWindowConfirmed: false,
        services: [],
        compliance: [],
        passport: { ...state.officer.passport, endorsements: [] },
      },
      offers: [],
      bookings: state.bookings.map((booking) => ({
        ...booking,
        officerTotalCents: 0,
        grossPlatformContributionCents: 0,
        officerRateCents: 0,
        pricingBreakdown: {
          ...booking.pricingBreakdown,
          baseClientCents: booking.clientPriceCents,
          calendarPremiumCents: 0,
          dispatchPremiumCents: 0,
          riskPremiumCents: 0,
        },
      })),
      shifts: state.shifts.filter((shift) => bookingIds.has(shift.bookingId)).map((shift) => ({ ...shift, earningsCents: 0 })),
      ledger: [],
      wallet: emptyMoney,
      audit: [],
    };
  }
  const relatedBookings = new Set([
    ...state.offers.map((offer) => offer.bookingId),
    ...state.shifts.map((shift) => shift.bookingId),
    ...state.ledger.map((entry) => entry.bookingId),
  ]);
  return {
    ...state,
    client: { ...state.client, contactName: "Authorised client contact" },
    bookings: state.bookings.filter((booking) => relatedBookings.has(booking.id)).map((booking) => ({
      ...booking,
      clientPriceCents: 0,
      officerTotalCents: 0,
      grossPlatformContributionCents: 0,
      pricingBreakdown: { baseClientCents: 0, calendarPremiumCents: 0, dispatchPremiumCents: 0, riskPremiumCents: 0 },
    })),
    audit: [],
  };
}

function requireScopedPilotEntity(principal: PilotPrincipal, scope: PilotScope) {
  if (principal.owner || scope === "operations") return;
  if (scope === "client" && principal.clientId === PILOT_CLIENT_ID) return;
  if (scope === "officer" && principal.officerId === PILOT_OFFICER_ID) return;
  throw new PilotAccessError("This account is not assigned to the requested pilot record.", 403);
}

function scopeFromRequest(request: Request): PilotScope {
  const scope = new URL(request.url).searchParams.get("scope");
  if (scope === "operations" || scope === "client" || scope === "officer") return scope;
  throw new PilotAccessError("Choose a valid LOKD workspace.", 400);
}

function response(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      vary: "oai-authenticated-user-email",
    },
  });
}

function errorResponse(cause: unknown) {
  const error = cause instanceof PilotError || cause instanceof PilotAccessError
    ? cause
    : new PilotError("The LOKD workspace could not complete that request.", 500);
  return response({ error: error.message }, error.status);
}

function requireDemoTransactionModel() {
  if (pilotStage() !== "demo") {
    throw new PilotAccessError("The transaction simulator is disabled outside the isolated demo environment.", 423);
  }
}

export async function GET(request: Request) {
  try {
    const scope = scopeFromRequest(request);
    const viewer = requirePilotApiRole(request, scope);
    requireScopedPilotEntity(viewer, scope);
    requireDemoTransactionModel();
    const db = getPilotDb();
    await ensurePilotData(db);
    return response({ state: stateForScope(await readPilotState(db), scope) });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function POST(request: Request) {
  try {
    requireSameOriginJson(request);
    const scope = scopeFromRequest(request);
    const viewer = requirePilotApiRole(request, scope);
    requireScopedPilotEntity(viewer, scope);
    const raw = await request.text();
    if (raw.length > 32_768) throw new PilotError("The request is too large.", 413);
    let payload: PilotAction;
    try {
      payload = JSON.parse(raw) as PilotAction;
    } catch {
      throw new PilotError("The request body is not valid JSON.", 400);
    }
    if (!payload || typeof payload !== "object" || typeof payload.action !== "string") throw new PilotError("Choose a valid pilot action.", 400);
    const actionRole = roleForPilotAction(payload.action);
    const actor = requirePilotApiRole(request, actionRole);
    if (actionRole === "client" || actionRole === "officer") requireScopedPilotEntity(actor, actionRole);
    requireDemoTransactionModel();
    const db = getPilotDb();
    await ensurePilotData(db);
    await applyAction(db, payload, actor);
    return response({ state: stateForScope(await readPilotState(db), scope) });
  } catch (cause) {
    return errorResponse(cause);
  }
}
