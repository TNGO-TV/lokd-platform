import {blockedTestSurface,rehearsalEnv as env} from '../../lib/test-surface-runtime';
import {readRequestText, RequestBodyError} from '../../lib/request-body';

import {
  PilotAccessError,
  pilotStage,
  requirePilotApiRole,
  requireSameOriginJson,
  roleForPilotAction,
  type PilotPrincipal,
} from "../../lib/pilot-runtime";
import type {
  PilotAction,
  PilotScope,
  PilotState,
  ServiceType,
} from "../../lib/pilot-types";
import {
  defaultRiskInput,
  officerShiftEconomicsForRoster,
  PRICE_BOOK_VERSION,
  purposePriceBook,
  quoteBooking,
  rosterPatterns,
  servicePriceBook,
} from "../../lib/pilot-pricing";
import {
  defaultSpecialistConfiguration,
  normalizeSpecialistConfiguration,
  type SpecialistServiceCode,
} from "../../lib/specialist-pricing";
import {
  evaluateBookingReadiness,
  PILOT_PASSPORT_NUMBER,
  PILOT_PASSPORT_TOKEN,
  readEndorsements,
  tokenHash,
} from "../../lib/passport-server";
import {
  demoPaymentOrderStatements,
  createServiceRequest,
  ensureIntegrationDemoData,
  reconcileDemoPayment,
} from "../../lib/integration-server";
import { ensureOperationsDemoData } from "../../lib/operations-server";
import {
  readOfficerPayrollStatements,
  renderPayrollCalculationPdf,
  renderShadowPayslipPdf,
} from "../../lib/payroll-statement-server";

export const dynamic = "force-dynamic";

const PILOT_OFFICER_ID = "OFF-001";
const PILOT_CLIENT_ID = "CL-001";

type PilotOfficerColumn =
  | "officers.id"
  | "officer.id"
  | "officer_services.officer_id"
  | "passport.officer_id";

const PILOT_OFFICER_PRODUCTION_HISTORY = (
  officerColumn: PilotOfficerColumn,
) => `
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
  if (!env.DB)
    throw new PilotError("The pilot database is not available.", 503);
  return env.DB;
}

function eventId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");
}

function shiftWindow(
  serviceDate: string,
  shiftStart: string,
  shiftEnd: string,
) {
  const startsAt = new Date(`${serviceDate}T${shiftStart}:00+02:00`);
  const endsAt = new Date(`${serviceDate}T${shiftEnd}:00+02:00`);
  if (endsAt.getTime() <= startsAt.getTime())
    endsAt.setUTCDate(endsAt.getUTCDate() + 1);
  return {
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    arrivalDueAt: new Date(startsAt.getTime() - 15 * 60 * 1000).toISOString(),
    checkInDueAt: new Date(startsAt.getTime() + 5 * 60 * 1000).toISOString(),
  };
}

function nextThursdayAndFriday() {
  const thursday = new Date();
  const daysUntilThursday = (4 - thursday.getUTCDay() + 7) % 7;
  thursday.setUTCDate(
    thursday.getUTCDate() + (daysUntilThursday === 0 ? 0 : daysUntilThursday),
  );
  thursday.setUTCHours(10, 0, 0, 0);
  const friday = new Date(thursday);
  friday.setUTCDate(friday.getUTCDate() + 1);
  return {
    thursday: thursday.toISOString(),
    friday: friday.toISOString().slice(0, 10),
  };
}

function nextReleaseAt(cadence: "Weekly" | "Monthly") {
  const now = new Date();
  const release = new Date(now);
  if (cadence === "Weekly") {
    const daysUntilThursday = (4 - release.getUTCDay() + 7) % 7;
    release.setUTCDate(release.getUTCDate() + daysUntilThursday);
    release.setUTCHours(4, 0, 0, 0);
    if (release.getTime() <= now.getTime())
      release.setUTCDate(release.getUTCDate() + 7);
  } else {
    release.setUTCMonth(release.getUTCMonth() + 1, 1);
    release.setUTCHours(6, 0, 0, 0);
  }
  return release.toISOString();
}

async function assertPilotSeedIsolation(db: D1Database, passportHash: string) {
  const collision = await db
    .prepare(
      `SELECT entity FROM (
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
  ) collisions LIMIT 1`,
    )
    .bind(
      PILOT_OFFICER_ID,
      PILOT_PASSPORT_NUMBER,
      passportHash,
      PILOT_OFFICER_ID,
      PILOT_PASSPORT_NUMBER,
      passportHash,
      PILOT_OFFICER_ID,
      PILOT_PASSPORT_NUMBER,
      passportHash,
      PILOT_CLIENT_ID,
      PILOT_OFFICER_ID,
      PILOT_OFFICER_ID,
      PILOT_OFFICER_ID,
      PILOT_CLIENT_ID,
      PILOT_OFFICER_ID,
      PILOT_OFFICER_ID,
      PILOT_OFFICER_ID,
      PILOT_OFFICER_ID,
    )
    .first<{ entity: string }>();
  if (collision) {
    throw new PilotError(
      "The synthetic demo seed is unavailable because its isolated records could not be verified.",
      503,
    );
  }
}

async function ensurePilotData(db: D1Database) {
  const passportHash = await tokenHash(PILOT_PASSPORT_TOKEN);
  await assertPilotSeedIsolation(db, passportHash);
  const primaryQuote = quoteBooking({
    serviceType: "Unarmed",
    engagementModel: "fixed",
    term: "1",
    purposeCode: "commercial_access",
    startDate: "2026-08-01",
    shift: "day",
    rosterPattern: "monday_saturday",
    riskInput: defaultRiskInput,
  });
  const depotQuote = quoteBooking({
    serviceType: "Unarmed",
    engagementModel: "fixed",
    term: "1",
    purposeCode: "construction",
    startDate: "2026-08-22",
    shift: "day",
    rosterPattern: "monday_saturday",
    riskInput: defaultRiskInput,
  });
  const vipQuote = quoteBooking({
    serviceType: "VIP",
    engagementModel: "fixed",
    term: "6",
    purposeCode: "executive_protection",
    startDate: "2026-03-01",
    shift: "day",
    rosterPattern: "weekdays",
    riskInput: defaultRiskInput,
  });
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO officers
      (id, full_name, mobile, email, city, psira_number, psira_grade, psira_expiry, approval_status, banking_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        PILOT_OFFICER_ID,
        "Lerato Khumalo",
        "+27 82 555 0184",
        "lerato@example.co.za",
        "Johannesburg North",
        "PSIRA-1842",
        "Grade B",
        "2027-05-31",
        "approved",
        "verified",
        "2026-08-01T08:00:00.000Z",
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO officer_passports
      (officer_id, passport_number, public_token_hash, status, readiness_label, environment, integrity_state,
       issued_at, last_reviewed_at, next_review_at, updated_at)
      SELECT officer.id, ?, ?, 'active', 'LOKD Ready', 'demo', 'synthetic', ?, ?, ?, ?
      FROM officers officer WHERE officer.id = ?
        AND officer.full_name = 'Lerato Khumalo' AND officer.email = 'lerato@example.co.za'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("officer.id")})`,
      )
      .bind(
        PILOT_PASSPORT_NUMBER,
        passportHash,
        "2026-08-05T09:00:00.000Z",
        "2026-08-15T09:00:00.000Z",
        "2026-09-15",
        "2026-08-15T09:00:00.000Z",
        PILOT_OFFICER_ID,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO officer_services
      (officer_id, service_type, qualified, opted_in, qualification_expiry)
      SELECT passport.officer_id, ?, ?, ?, ? FROM officer_passports passport
      WHERE passport.officer_id = ? AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`,
      )
      .bind("Unarmed", 1, 1, null, PILOT_OFFICER_ID),
    db
      .prepare(
        `INSERT OR IGNORE INTO officer_services
      (officer_id, service_type, qualified, opted_in, qualification_expiry)
      SELECT passport.officer_id, ?, ?, ?, ? FROM officer_passports passport
      WHERE passport.officer_id = ? AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`,
      )
      .bind("Armed", 1, 0, "2028-02-10", PILOT_OFFICER_ID),
    db
      .prepare(
        `INSERT OR IGNORE INTO officer_services
      (officer_id, service_type, qualified, opted_in, qualification_expiry)
      SELECT passport.officer_id, ?, ?, ?, ? FROM officer_passports passport
      WHERE passport.officer_id = ? AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`,
      )
      .bind("VIP", 0, 0, null, PILOT_OFFICER_ID),
    db
      .prepare(
        `INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, environment, integrity_state,
       assessed_at, expires_at, next_due_at, assessor, client_visible)
      SELECT ?, passport.officer_id, ?, ?, ?, ?, ?, 'current', 'demo', 'synthetic', ?, ?, ?, ?, 1
      FROM officer_passports passport WHERE passport.officer_id = ?
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`,
      )
      .bind(
        "END-CORE-001",
        "core_ready",
        "Core LOKD Ready",
        "core",
        null,
        null,
        "2026-08-15T09:00:00.000Z",
        "2026-09-15",
        "2026-09-15",
        "LOKD Academy",
        PILOT_OFFICER_ID,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, environment, integrity_state,
       assessed_at, expires_at, next_due_at, assessor, client_visible)
      SELECT ?, passport.officer_id, ?, ?, ?, ?, ?, 'current', 'demo', 'synthetic', ?, ?, ?, ?, 1
      FROM officer_passports passport WHERE passport.officer_id = ?
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`,
      )
      .bind(
        "END-UNA-001",
        "service_unarmed",
        "Unarmed Security Professional",
        "service",
        "Unarmed",
        null,
        "2026-08-12T09:00:00.000Z",
        "2026-11-30",
        "2026-09-12",
        "LOKD Academy",
        PILOT_OFFICER_ID,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, environment, integrity_state,
       assessed_at, expires_at, next_due_at, assessor, client_visible)
      SELECT ?, passport.officer_id, ?, ?, ?, ?, ?, 'current', 'demo', 'synthetic', ?, ?, ?, ?, 1
      FROM officer_passports passport WHERE passport.officer_id = ?
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`,
      )
      .bind(
        "END-ARM-001",
        "service_armed",
        "Armed monthly readiness",
        "service",
        "Armed",
        null,
        "2026-08-05T09:00:00.000Z",
        "2026-09-05",
        "2026-09-05",
        "LOKD Academy",
        PILOT_OFFICER_ID,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, environment, integrity_state,
       assessed_at, expires_at, next_due_at, assessor, client_visible)
      SELECT ?, passport.officer_id, ?, ?, ?, ?, ?, 'current', 'demo', 'synthetic', ?, ?, ?, ?, 1
      FROM officer_passports passport WHERE passport.officer_id = ?
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`,
      )
      .bind(
        "END-VIP-001",
        "service_vip",
        "Protective Operations specialist",
        "service",
        "VIP",
        null,
        "2026-08-08T09:00:00.000Z",
        "2026-11-30",
        "2026-09-08",
        "LOKD Academy",
        PILOT_OFFICER_ID,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, environment, integrity_state,
       assessed_at, expires_at, next_due_at, assessor, client_visible)
      SELECT ?, passport.officer_id, ?, ?, ?, ?, ?, 'current', 'demo', 'synthetic', ?, ?, ?, ?, 1
      FROM officer_passports passport WHERE passport.officer_id = ?
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`,
      )
      .bind(
        "END-COM-001",
        "purpose_commercial_access",
        "Commercial access",
        "purpose",
        null,
        "commercial_access",
        "2026-08-10T09:00:00.000Z",
        "2026-12-31",
        "2026-12-01",
        "LOKD Academy",
        PILOT_OFFICER_ID,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, environment, integrity_state,
       assessed_at, expires_at, next_due_at, assessor, client_visible)
      SELECT ?, passport.officer_id, ?, ?, ?, ?, ?, 'current', 'demo', 'synthetic', ?, ?, ?, ?, 1
      FROM officer_passports passport WHERE passport.officer_id = ?
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`,
      )
      .bind(
        "END-CON-001",
        "purpose_construction",
        "Construction sites",
        "purpose",
        null,
        "construction",
        "2026-08-10T10:00:00.000Z",
        "2026-12-31",
        "2026-12-01",
        "LOKD Academy",
        PILOT_OFFICER_ID,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, environment, integrity_state,
       assessed_at, expires_at, next_due_at, assessor, client_visible)
      SELECT ?, passport.officer_id, ?, ?, ?, ?, ?, 'current', 'demo', 'synthetic', ?, ?, ?, ?, 1
      FROM officer_passports passport WHERE passport.officer_id = ?
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`,
      )
      .bind(
        "END-EXE-001",
        "purpose_executive_protection",
        "Executive protection",
        "purpose",
        null,
        "executive_protection",
        "2026-08-08T10:00:00.000Z",
        "2026-11-30",
        "2026-09-08",
        "LOKD Academy",
        PILOT_OFFICER_ID,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO compliance_records
      (id, officer_id, record_type, status, environment, integrity_state, verified_at, expires_at, next_due_at)
      SELECT ?, passport.officer_id, ?, ?, 'demo', 'synthetic', ?, ?, ? FROM officer_passports passport
      WHERE passport.officer_id = ? AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`,
      )
      .bind(
        "CMP-PSIRA-001",
        "PSiRA registration",
        "current",
        "2026-08-02T09:00:00.000Z",
        "2027-05-31",
        null,
        PILOT_OFFICER_ID,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO compliance_records
      (id, officer_id, record_type, status, environment, integrity_state, verified_at, expires_at, next_due_at)
      SELECT ?, passport.officer_id, ?, ?, 'demo', 'synthetic', ?, ?, ? FROM officer_passports passport
      WHERE passport.officer_id = ? AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`,
      )
      .bind(
        "CMP-FIREARM-001",
        "Firearm competency",
        "current",
        "2026-08-02T09:15:00.000Z",
        "2028-02-10",
        null,
        PILOT_OFFICER_ID,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO compliance_records
      (id, officer_id, record_type, status, environment, integrity_state, verified_at, expires_at, next_due_at)
      SELECT ?, passport.officer_id, ?, ?, 'demo', 'synthetic', ?, ?, ? FROM officer_passports passport
      WHERE passport.officer_id = ? AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`,
      )
      .bind(
        "CMP-REG21-001",
        "Regulation 21 record",
        "current",
        "2025-11-14T10:00:00.000Z",
        null,
        "2026-11-14",
        PILOT_OFFICER_ID,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO clients
      (id, organisation_name, contact_name, contact_email, approval_status, environment, integrity_state)
      VALUES (?, ?, ?, ?, ?, 'demo', 'synthetic')`,
      )
      .bind(
        PILOT_CLIENT_ID,
        "Northbridge Property Services",
        "Nadia Jacobs",
        "nadia@northbridge.example",
        "approved",
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date,
       shift_start, shift_end, client_price_cents, officer_rate_cents, environment, integrity_state, funding_status, release_cadence, status)
      SELECT ?, client.id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'demo', 'synthetic', ?, ?, ?
      FROM clients client WHERE client.id = ? AND client.environment = 'demo' AND client.integrity_state = 'synthetic'`,
      )
      .bind(
        "BK-2081",
        "Northbridge Rosebank Offices",
        "Rosebank",
        "Main access",
        "Unarmed",
        "Grade C",
        1,
        "2026-08-01",
        "2026-08-31",
        "06:00",
        "18:00",
        primaryQuote.clientPriceCents,
        primaryQuote.officerRateCents,
        "paid_in_full",
        "Weekly",
        "active",
        PILOT_CLIENT_ID,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date,
       shift_start, shift_end, client_price_cents, officer_rate_cents, environment, integrity_state, funding_status, release_cadence, status)
      SELECT ?, client.id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'demo', 'synthetic', ?, ?, ?
      FROM clients client WHERE client.id = ? AND client.environment = 'demo' AND client.integrity_state = 'synthetic'`,
      )
      .bind(
        "BK-2080",
        "Northbridge Rosebank Offices",
        "Rosebank",
        "Main access",
        "Unarmed",
        "Grade C",
        1,
        "2026-08-01",
        "2026-08-31",
        "06:00",
        "18:00",
        primaryQuote.clientPriceCents,
        primaryQuote.officerRateCents,
        "paid_in_full",
        "Weekly",
        "active",
        PILOT_CLIENT_ID,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date,
       shift_start, shift_end, client_price_cents, officer_rate_cents, environment, integrity_state, funding_status, release_cadence, status)
      SELECT ?, client.id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'demo', 'synthetic', ?, ?, ?
      FROM clients client WHERE client.id = ? AND client.environment = 'demo' AND client.integrity_state = 'synthetic'`,
      )
      .bind(
        "BK-2084",
        "Metsi Midrand Depot",
        "Midrand",
        "Contractor access",
        "Unarmed",
        "Grade C",
        1,
        "2026-08-22",
        "2026-09-21",
        "06:00",
        "18:00",
        depotQuote.clientPriceCents,
        depotQuote.officerRateCents,
        "paid_in_full",
        "Weekly",
        "offered",
        PILOT_CLIENT_ID,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date,
       shift_start, shift_end, client_price_cents, officer_rate_cents, environment, integrity_state, funding_status, release_cadence, status)
      SELECT ?, client.id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'demo', 'synthetic', ?, ?, ?
      FROM clients client WHERE client.id = ? AND client.environment = 'demo' AND client.integrity_state = 'synthetic'`,
      )
      .bind(
        "BK-2078",
        "Sandton Executive Centre",
        "Sandton",
        "Executive reception",
        "VIP",
        "Grade B",
        6,
        "2026-03-01",
        "2026-08-31",
        "08:00",
        "20:00",
        vipQuote.clientPriceCents,
        vipQuote.officerRateCents,
        "paid_in_full",
        "Monthly",
        "active",
        PILOT_CLIENT_ID,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO offers
      (id, booking_id, officer_id, amount_cents, status, expires_at, responded_at)
      SELECT ?, booking.id, passport.officer_id, ?, ?, ?, ?
      FROM bookings booking JOIN officer_passports passport ON passport.officer_id = ?
      WHERE booking.id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`,
      )
      .bind(
        "OF-2084",
        depotQuote.officerRateCents,
        "open",
        "2026-08-21T18:00:00.000Z",
        null,
        PILOT_OFFICER_ID,
        "BK-2084",
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, environment, integrity_state, status, check_in_at, check_out_at,
       client_signoff_status, signed_off_at, earnings_cents)
      SELECT ?, booking.id, passport.officer_id, ?, 'demo', 'synthetic', ?, ?, ?, ?, ?, ?
      FROM bookings booking JOIN officer_passports passport ON passport.officer_id = ?
      WHERE booking.id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`,
      )
      .bind(
        "SH-2081",
        "2026-08-21",
        "on_post",
        "2026-08-21T03:54:00.000Z",
        null,
        "not_due",
        null,
        80000,
        PILOT_OFFICER_ID,
        "BK-2081",
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, environment, integrity_state, status, check_in_at, check_out_at,
       client_signoff_status, signed_off_at, earnings_cents)
      SELECT ?, booking.id, passport.officer_id, ?, 'demo', 'synthetic', ?, ?, ?, ?, ?, ?
      FROM bookings booking JOIN officer_passports passport ON passport.officer_id = ?
      WHERE booking.id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`,
      )
      .bind(
        "SH-2080",
        "2026-08-18",
        "completed",
        "2026-08-18T03:55:00.000Z",
        "2026-08-18T16:03:00.000Z",
        "pending",
        null,
        80000,
        PILOT_OFFICER_ID,
        "BK-2080",
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, environment, integrity_state, status, check_in_at, check_out_at,
       client_signoff_status, signed_off_at, earnings_cents)
      SELECT ?, booking.id, passport.officer_id, ?, 'demo', 'synthetic', ?, ?, ?, ?, ?, ?
      FROM bookings booking JOIN officer_passports passport ON passport.officer_id = ?
      WHERE booking.id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`,
      )
      .bind(
        "SH-2077",
        "2026-08-14",
        "verified",
        "2026-08-14T03:53:00.000Z",
        "2026-08-14T16:01:00.000Z",
        "approved",
        "2026-08-14T16:15:00.000Z",
        80000,
        PILOT_OFFICER_ID,
        "BK-2081",
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, environment, integrity_state, status, check_in_at, check_out_at,
       client_signoff_status, signed_off_at, earnings_cents)
      SELECT ?, booking.id, passport.officer_id, ?, 'demo', 'synthetic', ?, ?, ?, ?, ?, ?
      FROM bookings booking JOIN officer_passports passport ON passport.officer_id = ?
      WHERE booking.id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`,
      )
      .bind(
        "SH-2078",
        "2026-07-31",
        "verified",
        "2026-07-31T05:56:00.000Z",
        "2026-07-31T18:04:00.000Z",
        "approved",
        "2026-07-31T18:20:00.000Z",
        450000,
        PILOT_OFFICER_ID,
        "BK-2078",
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO ledger_entries
      (id, officer_id, shift_id, amount_cents, state, release_cadence, eligible_release_at, created_at, updated_at)
      SELECT ?, shift.officer_id, shift.id, ?, ?, ?, ?, ?, ?
      FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
      WHERE shift.id = ? AND shift.officer_id = ?
        AND shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`,
      )
      .bind(
        "LE-2077",
        80000,
        "available",
        "Weekly",
        "2026-08-15T08:00:00.000Z",
        "2026-08-14T16:15:00.000Z",
        "2026-08-15T08:00:00.000Z",
        "SH-2077",
        PILOT_OFFICER_ID,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO ledger_entries
      (id, officer_id, shift_id, amount_cents, state, release_cadence, eligible_release_at, created_at, updated_at)
      SELECT ?, shift.officer_id, shift.id, ?, ?, ?, ?, ?, ?
      FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
      WHERE shift.id = ? AND shift.officer_id = ?
        AND shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`,
      )
      .bind(
        "LE-2080",
        80000,
        "pending_signoff",
        "Weekly",
        null,
        "2026-08-18T16:03:00.000Z",
        "2026-08-18T16:03:00.000Z",
        "SH-2080",
        PILOT_OFFICER_ID,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO ledger_entries
      (id, officer_id, shift_id, amount_cents, state, release_cadence, eligible_release_at, created_at, updated_at)
      SELECT ?, shift.officer_id, shift.id, ?, ?, ?, ?, ?, ?
      FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
      WHERE shift.id = ? AND shift.officer_id = ?
        AND shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`,
      )
      .bind(
        "LE-2078",
        450000,
        "pending_release",
        "Monthly",
        "2026-08-20T08:00:00.000Z",
        "2026-07-31T18:20:00.000Z",
        "2026-07-31T18:20:00.000Z",
        "SH-2078",
        PILOT_OFFICER_ID,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO audit_events
      (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
      SELECT ?, ?, ?, ?, ?, passport.officer_id, ?, ? FROM officer_passports passport
      WHERE passport.officer_id = ? AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})`,
      )
      .bind(
        "AUD-001",
        "system",
        "LOKD",
        "pilot_seeded",
        "officer",
        "Verified pilot profile and funded contracts loaded.",
        "2026-08-21T08:00:00.000Z",
        PILOT_OFFICER_ID,
      ),
    db
      .prepare(
        `UPDATE officers SET flex_available = 1, external_work_acknowledged = 1, rest_window_confirmed = 1
      WHERE id = ?
        AND ${PILOT_OFFICER_UPDATE_GUARD("officers.id")}`,
      )
      .bind(PILOT_OFFICER_ID),
    db
      .prepare(
        `UPDATE bookings SET purpose_code = 'commercial_access', purpose_label = 'Commercial access',
      engagement_model = 'fixed', notice_window = 'standard', roster_pattern = 'monday_saturday',
      calendar_category = ?, calendar_label = ?, risk_band = ?, risk_score = ?, risk_reasons = ?, required_endorsements = ?,
      manual_review = ?, shift_count = ?, client_price_cents = ?, officer_rate_cents = ?, officer_total_cents = ?,
      gross_platform_contribution_cents = ?, pricing_breakdown = ?
      WHERE id IN ('BK-2081', 'BK-2080') AND environment = 'demo' AND integrity_state = 'synthetic'`,
      )
      .bind(
        primaryQuote.firstCalendarCategory,
        primaryQuote.firstCalendarLabel,
        primaryQuote.risk.band,
        primaryQuote.risk.score,
        JSON.stringify(primaryQuote.risk.reasons),
        JSON.stringify(primaryQuote.risk.requiredEndorsements),
        primaryQuote.manualReview ? 1 : 0,
        primaryQuote.shiftCount,
        primaryQuote.clientPriceCents,
        primaryQuote.officerRateCents,
        primaryQuote.officerTotalCents,
        primaryQuote.grossPlatformContributionCents,
        JSON.stringify({
          baseClientCents: primaryQuote.baseClientCents,
          calendarPremiumCents: primaryQuote.calendarPremiumCents,
          dispatchPremiumCents: primaryQuote.dispatchPremiumCents,
          riskPremiumCents: primaryQuote.riskPremiumCents,
        }),
      ),
    db
      .prepare(
        `UPDATE bookings SET purpose_code = 'construction', purpose_label = 'Construction site',
      engagement_model = 'fixed', notice_window = 'standard', roster_pattern = 'monday_saturday',
      calendar_category = ?, calendar_label = ?, risk_band = ?, risk_score = ?, risk_reasons = ?, required_endorsements = ?,
      manual_review = ?, shift_count = ?, client_price_cents = ?, officer_rate_cents = ?, officer_total_cents = ?,
      gross_platform_contribution_cents = ?, pricing_breakdown = ? WHERE id = 'BK-2084'
        AND environment = 'demo' AND integrity_state = 'synthetic'`,
      )
      .bind(
        depotQuote.firstCalendarCategory,
        depotQuote.firstCalendarLabel,
        depotQuote.risk.band,
        depotQuote.risk.score,
        JSON.stringify(depotQuote.risk.reasons),
        JSON.stringify(depotQuote.risk.requiredEndorsements),
        depotQuote.manualReview ? 1 : 0,
        depotQuote.shiftCount,
        depotQuote.clientPriceCents,
        depotQuote.officerRateCents,
        depotQuote.officerTotalCents,
        depotQuote.grossPlatformContributionCents,
        JSON.stringify({
          baseClientCents: depotQuote.baseClientCents,
          calendarPremiumCents: depotQuote.calendarPremiumCents,
          dispatchPremiumCents: depotQuote.dispatchPremiumCents,
          riskPremiumCents: depotQuote.riskPremiumCents,
        }),
      ),
    db
      .prepare(
        `UPDATE officer_services SET qualified = 1 WHERE officer_id = ? AND service_type = 'VIP'
      AND ${PILOT_OFFICER_UPDATE_GUARD("officer_services.officer_id")}`,
      )
      .bind(PILOT_OFFICER_ID),
    db
      .prepare(
        `UPDATE bookings SET service_type = 'VIP', purpose_code = 'executive_protection', purpose_label = 'Executive protection',
      engagement_model = 'fixed', notice_window = 'standard', roster_pattern = 'weekdays', calendar_category = ?, calendar_label = ?,
      risk_band = ?, risk_score = ?, risk_reasons = ?, required_endorsements = ?, manual_review = 1, shift_count = ?,
      client_price_cents = ?, officer_rate_cents = ?, officer_total_cents = ?, gross_platform_contribution_cents = ?,
      pricing_breakdown = ?, minimum_grade = 'Grade B' WHERE id = 'BK-2078'
        AND environment = 'demo' AND integrity_state = 'synthetic'`,
      )
      .bind(
        vipQuote.firstCalendarCategory,
        vipQuote.firstCalendarLabel,
        vipQuote.risk.band,
        vipQuote.risk.score,
        JSON.stringify(vipQuote.risk.reasons),
        JSON.stringify(vipQuote.risk.requiredEndorsements),
        vipQuote.shiftCount,
        vipQuote.clientPriceCents,
        vipQuote.officerRateCents,
        vipQuote.officerTotalCents,
        vipQuote.grossPlatformContributionCents,
        JSON.stringify({
          baseClientCents: vipQuote.baseClientCents,
          calendarPremiumCents: vipQuote.calendarPremiumCents,
          dispatchPremiumCents: vipQuote.dispatchPremiumCents,
          riskPremiumCents: vipQuote.riskPremiumCents,
        }),
      ),
    db
      .prepare(
        `UPDATE offers SET amount_cents = ? WHERE id = 'OF-2084' AND status = 'open'
      AND booking_id IN (SELECT id FROM bookings WHERE id = 'BK-2084' AND client_id = ?
        AND environment = 'demo' AND integrity_state = 'synthetic')`,
      )
      .bind(depotQuote.officerRateCents, PILOT_CLIENT_ID),
    db.prepare(`UPDATE bookings SET status = 'offered' WHERE id = 'BK-2084'
      AND environment = 'demo' AND integrity_state = 'synthetic'
      AND EXISTS (SELECT 1 FROM offers WHERE id = 'OF-2084' AND booking_id = 'BK-2084' AND status = 'open')
      AND NOT EXISTS (SELECT 1 FROM offers WHERE booking_id = 'BK-2084' AND status = 'accepted')`),
    db
      .prepare(
        `UPDATE shifts SET earnings_cents = 80000 WHERE id IN ('SH-2081', 'SH-2080', 'SH-2077')
      AND environment = 'demo' AND integrity_state = 'synthetic'
      AND booking_id IN (SELECT id FROM bookings WHERE client_id = ?
        AND environment = 'demo' AND integrity_state = 'synthetic')`,
      )
      .bind(PILOT_CLIENT_ID),
    db
      .prepare(
        `UPDATE shifts SET earnings_cents = 450000 WHERE id = 'SH-2078'
      AND environment = 'demo' AND integrity_state = 'synthetic'
      AND booking_id IN (SELECT id FROM bookings WHERE client_id = ?
        AND environment = 'demo' AND integrity_state = 'synthetic')`,
      )
      .bind(PILOT_CLIENT_ID),
    db
      .prepare(
        `UPDATE ledger_entries SET amount_cents = 80000 WHERE id IN ('LE-2077', 'LE-2080')
      AND shift_id IN (SELECT shift.id FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
        WHERE shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
          AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic')`,
      )
      .bind(PILOT_CLIENT_ID),
    db
      .prepare(
        `UPDATE ledger_entries SET amount_cents = 450000 WHERE id = 'LE-2078'
      AND shift_id IN (SELECT shift.id FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
        WHERE shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
          AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic')`,
      )
      .bind(PILOT_CLIENT_ID),
    db
      .prepare(
        `UPDATE offers SET expires_at = '2026-09-05T16:00:00.000Z'
      WHERE id = 'OF-2084' AND status = 'open' AND expires_at = '2026-08-21T18:00:00.000Z'
        AND booking_id IN (SELECT id FROM bookings WHERE id = 'BK-2084' AND client_id = ?
          AND environment = 'demo' AND integrity_state = 'synthetic')`,
      )
      .bind(PILOT_CLIENT_ID),
    db
      .prepare(
        `UPDATE shifts SET passport_verification_status = 'green', passport_verified_at = COALESCE(passport_verified_at, ?)
      WHERE id = 'SH-2081' AND passport_verification_status = 'not_checked'
        AND environment = 'demo' AND integrity_state = 'synthetic'
        AND booking_id IN (SELECT id FROM bookings WHERE client_id = ?
          AND environment = 'demo' AND integrity_state = 'synthetic')`,
      )
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
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function parsePricingBreakdown(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value ?? "{}") as Partial<
      PilotState["bookings"][number]["pricingBreakdown"]
    >;
    return {
      baseClientCents: Number(parsed.baseClientCents) || 0,
      calendarPremiumCents: Number(parsed.calendarPremiumCents) || 0,
      dispatchPremiumCents: Number(parsed.dispatchPremiumCents) || 0,
      riskPremiumCents: Number(parsed.riskPremiumCents) || 0,
      marginFloorAdjustmentCents:
        Number(parsed.marginFloorAdjustmentCents) || 0,
      subtotalCents: Number(parsed.subtotalCents) || 0,
      vatCents: Number(parsed.vatCents) || 0,
      payrollBurdenCents: Number(parsed.payrollBurdenCents) || 0,
      readinessAndEquipmentCents:
        Number(parsed.readinessAndEquipmentCents) || 0,
      commandAndSupervisionCents:
        Number(parsed.commandAndSupervisionCents) || 0,
      planningCents: Number(parsed.planningCents) || 0,
      travelCents: Number(parsed.travelCents) || 0,
      vehicleAndPartnerCents:
        Number(parsed.vehicleAndPartnerCents) || 0,
      overnightCents: Number(parsed.overnightCents) || 0,
    };
  } catch {
    return {
      baseClientCents: 0,
      calendarPremiumCents: 0,
      dispatchPremiumCents: 0,
      riskPremiumCents: 0,
      marginFloorAdjustmentCents: 0,
      subtotalCents: 0,
      vatCents: 0,
      payrollBurdenCents: 0,
      readinessAndEquipmentCents: 0,
      commandAndSupervisionCents: 0,
      planningCents: 0,
      travelCents: 0,
      vehicleAndPartnerCents: 0,
      overnightCents: 0,
    };
  }
}

function parseSpecialistConfiguration(
  serviceType: ServiceType,
  value: string | null | undefined,
) {
  try {
    const parsed = JSON.parse(value ?? "{}") as Record<string, unknown>;
    return normalizeSpecialistConfiguration(serviceType, {
      serviceCode:
        typeof parsed.serviceCode === "string"
          ? (parsed.serviceCode as SpecialistServiceCode)
          : undefined,
      teamSize:
        typeof parsed.teamSize === "number" ? parsed.teamSize : undefined,
      vehicleClass:
        typeof parsed.vehicleClass === "string"
          ? (parsed.vehicleClass as never)
          : undefined,
      travelKmPerServiceDay:
        typeof parsed.travelKmPerServiceDay === "number"
          ? parsed.travelKmPerServiceDay
          : undefined,
      planningHours:
        typeof parsed.planningHours === "number"
          ? parsed.planningHours
          : undefined,
      overnightDays:
        typeof parsed.overnightDays === "number"
          ? parsed.overnightDays
          : undefined,
    });
  } catch {
    return defaultSpecialistConfiguration[serviceType];
  }
}

async function readPilotState(db: D1Database): Promise<PilotState> {
  const officer = await db
    .prepare(
      `SELECT id, full_name AS fullName, city, psira_number AS psiraNumber,
    psira_grade AS psiraGrade, psira_expiry AS psiraExpiry, approval_status AS approvalStatus,
    banking_status AS bankingStatus, flex_available AS flexAvailable,
    external_work_acknowledged AS externalWorkAcknowledged, rest_window_confirmed AS restWindowConfirmed
    FROM officers WHERE id = ? AND ${PILOT_OFFICER_UPDATE_GUARD("officers.id")}`,
    )
    .bind(PILOT_OFFICER_ID)
    .first<{
      id: string;
      fullName: string;
      city: string;
      psiraNumber: string;
      psiraGrade: string;
      psiraExpiry: string;
      approvalStatus: string;
      bankingStatus: string;
      flexAvailable: number;
      externalWorkAcknowledged: number;
      restWindowConfirmed: number;
    }>();
  if (!officer)
    throw new PilotError("The pilot officer profile is unavailable.", 500);

  const client = await db
    .prepare(
      `SELECT id, organisation_name AS organisationName, contact_name AS contactName,
    approval_status AS approvalStatus FROM clients WHERE id = ?
      AND environment = 'demo' AND integrity_state = 'synthetic'`,
    )
    .bind(PILOT_CLIENT_ID)
    .first<{
      id: string;
      organisationName: string;
      contactName: string;
      approvalStatus: string;
    }>();
  if (!client)
    throw new PilotError("The pilot client profile is unavailable.", 500);

  const passportRow = await db
    .prepare(
      `SELECT passport_number AS passportNumber, status, readiness_label AS readinessLabel,
    issued_at AS issuedAt, last_reviewed_at AS lastReviewedAt, next_review_at AS nextReviewAt
    FROM officer_passports WHERE officer_id = ? AND environment = 'demo' AND integrity_state = 'synthetic'`,
    )
    .bind(PILOT_OFFICER_ID)
    .first<{
      passportNumber: string;
      status: PilotState["officer"]["passport"]["status"];
      readinessLabel: string;
      issuedAt: string | null;
      lastReviewedAt: string | null;
      nextReviewAt: string | null;
    }>();
  if (!passportRow)
    throw new PilotError("The pilot LOKD Passport is unavailable.", 500);
  const endorsements = await readEndorsements(db, PILOT_OFFICER_ID);
  const today = new Date().toISOString().slice(0, 10);
  const coreReady = endorsements.find((item) => item.code === "core_ready");
  const passportOffersEnabled =
    (passportRow.status === "active" || passportRow.status === "expiring") &&
    officer.psiraExpiry.slice(0, 10) >= today &&
    (!passportRow.nextReviewAt ||
      passportRow.nextReviewAt.slice(0, 10) >= today) &&
    Boolean(
      coreReady &&
      coreReady.status === "current" &&
      (!coreReady.expiresAt || coreReady.expiresAt.slice(0, 10) >= today) &&
      (!coreReady.nextDueAt || coreReady.nextDueAt.slice(0, 10) >= today),
    );

  const services = await all<{
    serviceType: ServiceType;
    qualified: number;
    optedIn: number;
    qualificationExpiry: string | null;
  }>(
    db
      .prepare(
        `SELECT service_type AS serviceType, qualified, opted_in AS optedIn,
      qualification_expiry AS qualificationExpiry FROM officer_services WHERE officer_id = ?
        AND ${PILOT_OFFICER_UPDATE_GUARD("officer_services.officer_id")}
      ORDER BY CASE service_type WHEN 'Unarmed' THEN 1 WHEN 'Armed' THEN 2 ELSE 3 END`,
      )
      .bind(PILOT_OFFICER_ID),
  );
  const compliance = await all<{
    id: string;
    recordType: string;
    status: string;
    expiresAt: string | null;
    nextDueAt: string | null;
  }>(
    db
      .prepare(
        `SELECT id, record_type AS recordType, status, expires_at AS expiresAt, next_due_at AS nextDueAt
      FROM compliance_records WHERE officer_id = ? AND environment = 'demo' AND integrity_state = 'synthetic'
      ORDER BY record_type`,
      )
      .bind(PILOT_OFFICER_ID),
  );
  const offers = await all<{
    id: string;
    bookingId: string;
    siteName: string;
    siteArea: string;
    postName: string;
    serviceType: ServiceType;
    purposeCode: string;
    purposeLabel: string;
    engagementModel: "fixed" | "flex";
    rosterPattern: "weekdays" | "monday_saturday" | "daily";
    calendarCategory:
      "ordinary" | "sunday" | "public_holiday" | "easter" | "christmas";
    calendarLabel: string;
    riskBand: "Standard" | "Enhanced" | "Elevated" | "High" | "Critical";
    riskScore: number;
    requiredEndorsementsJson: string;
    shiftCount: number;
    plannedEarningsCents: number;
    positionIndex: number;
    minimumGrade: string;
    contractMonths: number;
    startDate: string;
    shiftStart: string;
    shiftEnd: string;
    amountCents: number;
    releaseCadence: "Weekly" | "Monthly";
    fundingStatus: string;
    status: "open" | "accepted" | "declined" | "expired";
    expiresAt: string;
  }>(
    db
      .prepare(
        `SELECT o.id, o.booking_id AS bookingId, b.site_name AS siteName, b.site_area AS siteArea,
    b.post_name AS postName, b.service_type AS serviceType, b.purpose_code AS purposeCode,
    b.purpose_label AS purposeLabel, b.engagement_model AS engagementModel, b.roster_pattern AS rosterPattern,
    b.calendar_category AS calendarCategory, b.calendar_label AS calendarLabel, b.risk_band AS riskBand,
    b.risk_score AS riskScore, b.required_endorsements AS requiredEndorsementsJson,
    CASE WHEN b.id = 'BK-2084' THEN b.shift_count ELSE b.service_day_count END AS shiftCount,
    CASE WHEN b.id = 'BK-2084' THEN o.amount_cents * b.shift_count ELSE
      (SELECT COALESCE(SUM(slot.officer_offer_cents), 0) FROM roster_slots slot
       WHERE slot.booking_id = b.id AND slot.position_index = o.position_index
         AND slot.environment = 'demo' AND slot.integrity_state = 'synthetic') END AS plannedEarningsCents,
    o.position_index AS positionIndex, b.minimum_grade AS minimumGrade,
    b.contract_months AS contractMonths, b.start_date AS startDate, b.shift_start AS shiftStart, b.shift_end AS shiftEnd,
    o.amount_cents AS amountCents, b.release_cadence AS releaseCadence, b.funding_status AS fundingStatus,
    o.status, o.expires_at AS expiresAt FROM offers o JOIN bookings b ON b.id = o.booking_id
    WHERE o.officer_id = ? AND b.client_id = ? AND b.environment = 'demo' AND b.integrity_state = 'synthetic'
    ORDER BY o.expires_at DESC`,
      )
      .bind(PILOT_OFFICER_ID, PILOT_CLIENT_ID),
  );
  const parsedOffers = offers.map(({ requiredEndorsementsJson, ...offer }) => ({
    ...offer,
    status:
      offer.status === "open" && new Date(offer.expiresAt).getTime() <= Date.now()
        ? ("expired" as const)
        : offer.status,
    requiredEndorsements: parseStringArray(requiredEndorsementsJson),
  }));
  const bookingRows = await all<{
    id: string;
    siteName: string;
    siteArea: string;
    postName: string;
    serviceType: ServiceType;
    purposeCode: string;
    purposeLabel: string;
    engagementModel: "fixed" | "flex";
    noticeWindow: "standard" | "priority" | "urgent" | "immediate";
    rosterPattern: "weekdays" | "monday_saturday" | "daily";
    calendarCategory:
      "ordinary" | "sunday" | "public_holiday" | "easter" | "christmas";
    calendarLabel: string;
    riskBand: "Standard" | "Enhanced" | "Elevated" | "High" | "Critical";
    riskScore: number;
    riskReasonsJson: string;
    requiredEndorsementsJson: string;
    manualReview: number;
    headcount: number;
    serviceDayCount: number;
    shiftCount: number;
    officerTotalCents: number;
    grossPlatformContributionCents: number;
    pricingVersion: string;
    pricingBreakdownJson: string;
    specialistServiceCode: SpecialistServiceCode;
    specialistConfigurationJson: string;
    subtotalCents: number;
    vatCents: number;
    vatRateBasisPoints: number;
    costFloorCents: number;
    marginCents: number;
    marginBasisPoints: number;
    minimumMarginBasisPoints: number;
    pricingStatus: "authoritative" | "partner_review_required" | "legacy";
    minimumGrade: string;
    contractMonths: number;
    startDate: string;
    endDate: string;
    shiftStart: string;
    shiftEnd: string;
    clientPriceCents: number;
    officerRateCents: number;
    fundingStatus: string;
    releaseCadence: "Weekly" | "Monthly";
    status: string;
    offerStatus: "open" | "accepted" | "declined" | "expired" | null;
    assignedOfficer: string | null;
  }>(
    db
      .prepare(
        `SELECT b.id, b.site_name AS siteName, b.site_area AS siteArea, b.post_name AS postName,
    b.service_type AS serviceType, b.purpose_code AS purposeCode, b.purpose_label AS purposeLabel,
    b.engagement_model AS engagementModel, b.notice_window AS noticeWindow, b.roster_pattern AS rosterPattern,
    b.calendar_category AS calendarCategory, b.calendar_label AS calendarLabel, b.risk_band AS riskBand,
    b.risk_score AS riskScore, b.risk_reasons AS riskReasonsJson, b.required_endorsements AS requiredEndorsementsJson,
    b.manual_review AS manualReview, b.headcount AS headcount, b.service_day_count AS serviceDayCount,
    b.shift_count AS shiftCount, b.officer_total_cents AS officerTotalCents,
    b.gross_platform_contribution_cents AS grossPlatformContributionCents, b.pricing_version AS pricingVersion,
    b.pricing_breakdown AS pricingBreakdownJson,
    b.specialist_service_code AS specialistServiceCode,
    b.specialist_configuration AS specialistConfigurationJson,
    b.quote_subtotal_cents AS subtotalCents, b.vat_cents AS vatCents,
    b.vat_rate_basis_points AS vatRateBasisPoints, b.cost_floor_cents AS costFloorCents,
    b.margin_cents AS marginCents, b.margin_basis_points AS marginBasisPoints,
    b.minimum_margin_basis_points AS minimumMarginBasisPoints, b.pricing_status AS pricingStatus,
    b.minimum_grade AS minimumGrade, b.contract_months AS contractMonths, b.start_date AS startDate,
    b.end_date AS endDate, b.shift_start AS shiftStart, b.shift_end AS shiftEnd,
    b.client_price_cents AS clientPriceCents, b.officer_rate_cents AS officerRateCents,
    b.funding_status AS fundingStatus, b.release_cadence AS releaseCadence, b.status,
    (SELECT status FROM offers WHERE booking_id = b.id ORDER BY rowid DESC LIMIT 1) AS offerStatus,
    (SELECT o.full_name FROM shifts s JOIN officers o ON o.id = s.officer_id
      WHERE s.booking_id = b.id AND s.environment = 'demo' AND s.integrity_state = 'synthetic'
      ORDER BY s.rowid DESC LIMIT 1) AS assignedOfficer
    FROM bookings b WHERE b.client_id = ? AND b.environment = 'demo' AND b.integrity_state = 'synthetic'
    ORDER BY b.rowid DESC LIMIT 24`,
      )
      .bind(PILOT_CLIENT_ID),
  );
  const bookings = await Promise.all(
    bookingRows.map(async (booking) => {
      const readiness = await evaluateBookingReadiness(
        db,
        PILOT_OFFICER_ID,
        booking.id,
        {
          requireServiceOptIn: true,
        },
      );
      const availabilityBlockers =
        booking.engagementModel === "flex"
          ? [
              !officer.flexAvailable
                ? "Officer is not currently available for Flex work."
                : "",
              !officer.externalWorkAcknowledged
                ? "External work declaration is not current."
                : "",
              !officer.restWindowConfirmed
                ? "Rest window has not been confirmed."
                : "",
            ].filter(Boolean)
          : [];
      const {
        riskReasonsJson,
        requiredEndorsementsJson,
        pricingBreakdownJson,
        specialistConfigurationJson,
        manualReview,
        ...bookingFields
      } = booking;
      const blockers = [...readiness.blockers, ...availabilityBlockers];
      const pricingBreakdown = parsePricingBreakdown(pricingBreakdownJson);
      return {
        ...bookingFields,
        riskReasons: parseStringArray(riskReasonsJson),
        requiredEndorsements: parseStringArray(requiredEndorsementsJson),
        pricingBreakdown,
        specialistConfiguration: parseSpecialistConfiguration(
          booking.serviceType,
          specialistConfigurationJson,
        ),
        pricingStatus:
          bookingFields.pricingStatus === "partner_review_required"
            ? ("partner_review_required" as const)
            : ("authoritative" as const),
        pricingInternal: {
          costFloorCents: bookingFields.costFloorCents,
          marginCents: bookingFields.marginCents,
          marginBasisPoints: bookingFields.marginBasisPoints,
          minimumMarginBasisPoints:
            bookingFields.minimumMarginBasisPoints,
          payrollBurdenCents: pricingBreakdown.payrollBurdenCents,
          readinessAndEquipmentCents:
            pricingBreakdown.readinessAndEquipmentCents,
          commandAndSupervisionCents:
            pricingBreakdown.commandAndSupervisionCents,
          planningCents: pricingBreakdown.planningCents,
          travelCents: pricingBreakdown.travelCents,
          vehicleAndPartnerCents:
            pricingBreakdown.vehicleAndPartnerCents,
          overnightCents: pricingBreakdown.overnightCents,
        },
        manualReview: Boolean(manualReview),
        matchEligible: blockers.length === 0,
        matchBlockers: blockers,
      };
    }),
  );
  const shifts = await all<{
    id: string;
    bookingId: string;
    siteName: string;
    postName: string;
    serviceType: ServiceType;
    purposeCode: string;
    purposeLabel: string;
    scheduledDate: string;
    shiftStart: string;
    shiftEnd: string;
    status: string;
    checkInAt: string | null;
    checkOutAt: string | null;
    clientSignoffStatus: string;
    passportVerificationStatus: string;
    passportVerifiedAt: string | null;
    earningsCents: number;
    releaseCadence: "Weekly" | "Monthly";
  }>(
    db
      .prepare(
        `SELECT s.id, s.booking_id AS bookingId, b.site_name AS siteName, b.post_name AS postName,
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
    ORDER BY s.scheduled_date DESC, s.id DESC`,
      )
      .bind(PILOT_OFFICER_ID, PILOT_CLIENT_ID),
  );
  const ledger = await all<{
    id: string;
    shiftId: string;
    bookingId: string;
    siteName: string;
    amountCents: number;
    state:
      | "pending_signoff"
      | "pending_release"
      | "available"
      | "withdrawal_queued"
      | "paid"
      | "held";
    releaseCadence: "Weekly" | "Monthly";
    eligibleReleaseAt: string | null;
    updatedAt: string;
  }>(
    db
      .prepare(
        `SELECT l.id, l.shift_id AS shiftId, s.booking_id AS bookingId, b.site_name AS siteName,
    l.amount_cents AS amountCents, l.state, l.release_cadence AS releaseCadence,
    l.eligible_release_at AS eligibleReleaseAt, l.updated_at AS updatedAt
    FROM ledger_entries l JOIN shifts s ON s.id = l.shift_id JOIN bookings b ON b.id = s.booking_id
    WHERE l.officer_id = ? AND b.client_id = ?
      AND s.environment = 'demo' AND s.integrity_state = 'synthetic'
      AND b.environment = 'demo' AND b.integrity_state = 'synthetic'
    ORDER BY l.updated_at DESC`,
      )
      .bind(PILOT_OFFICER_ID, PILOT_CLIENT_ID),
  );
  const payrollStatements = await readOfficerPayrollStatements(
    db,
    PILOT_OFFICER_ID,
  );
  const audit = await all<{
    id: string;
    actorType: string;
    eventType: string;
    entityType: string;
    entityId: string;
    detail: string;
    createdAt: string;
  }>(
    db.prepare(`SELECT id, actor_type AS actorType, event_type AS eventType, entity_type AS entityType,
    entity_id AS entityId, detail, created_at AS createdAt FROM audit_events
    ORDER BY created_at DESC LIMIT 20`),
  );

  const pendingCents = ledger
    .filter(
      (entry) =>
        entry.state === "pending_signoff" || entry.state === "pending_release",
    )
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const availableCents = ledger
    .filter((entry) => entry.state === "available")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const withdrawalQueuedCents = ledger
    .filter((entry) => entry.state === "withdrawal_queued")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const calculatedNetCents = payrollStatements
    .filter((statement) => !["paid", "settled", "void", "reversed"].includes(statement.status))
    .reduce((sum, statement) => sum + statement.netPayCents, 0);
  const paidCents = payrollStatements
    .filter((statement) => ["paid", "settled"].includes(statement.status))
    .reduce((sum, statement) => sum + statement.netPayCents, 0);
  const initials = officer.fullName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return {
    officer: {
      ...officer,
      initials,
      flexAvailable: Boolean(officer.flexAvailable),
      externalWorkAcknowledged: Boolean(officer.externalWorkAcknowledged),
      restWindowConfirmed: Boolean(officer.restWindowConfirmed),
      services: services.map((service) => ({
        ...service,
        qualified: Boolean(service.qualified),
        optedIn: Boolean(service.optedIn),
      })),
      compliance,
      passport: {
        ...passportRow,
        verificationPath: `/verify?token=${PILOT_PASSPORT_TOKEN}`,
        offersEnabled: passportOffersEnabled,
        gateMessage: passportOffersEnabled
          ? "Synthetic readiness checks pass for demo matching only; this Passport cannot authorise paid deployment."
          : "Synthetic Passport action is required before demo offers can be rehearsed.",
        endorsements,
      },
    },
    client,
    offers: parsedOffers,
    bookings,
    shifts,
    ledger,
    payrollStatements,
    wallet: {
      pendingCents,
      availableCents,
      withdrawalQueuedCents,
      calculatedNetCents,
      paidCents,
      totalTrackedCents: pendingCents + availableCents + withdrawalQueuedCents,
    },
    audit,
  };
}

async function recordAudit(
  db: D1Database,
  actorType: string,
  actorId: string,
  eventType: string,
  entityType: string,
  entityId: string,
  detail: string,
) {
  await db
    .prepare(
      `INSERT INTO audit_events
    (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      eventId("AUD"),
      actorType,
      actorId,
      eventType,
      entityType,
      entityId,
      detail,
      new Date().toISOString(),
    )
    .run();
}

function requireShortText(value: unknown, label: string, maximum: number) {
  if (typeof value !== "string") throw new PilotError(`${label} is required.`);
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned || cleaned.length > maximum)
    throw new PilotError(`${label} is not valid.`);
  return cleaned;
}

async function releaseOfferWave(
  db: D1Database,
  bookingId: string,
  actorId: string,
) {
  const releaseStartedAt = new Date().toISOString();
  await db
    .prepare(
      `UPDATE offers SET status = 'expired', responded_at = ?
      WHERE booking_id = ? AND status = 'open' AND expires_at <= ?
        AND booking_id IN (SELECT id FROM bookings WHERE client_id = ?
          AND environment = 'demo' AND integrity_state = 'synthetic')`,
    )
    .bind(releaseStartedAt, bookingId, releaseStartedAt, PILOT_CLIENT_ID)
    .run();
  const booking = await db
    .prepare(
      `SELECT id, start_date AS startDate, funding_status AS fundingStatus,
    officer_rate_cents AS officerRateCents, engagement_model AS engagementModel, status FROM bookings
    WHERE id = ? AND client_id = ? AND environment = 'demo' AND integrity_state = 'synthetic'`,
    )
    .bind(bookingId, PILOT_CLIENT_ID)
    .first<{
      id: string;
      startDate: string;
      fundingStatus: string;
      officerRateCents: number;
      engagementModel: "fixed" | "flex";
      status: string;
    }>();
  if (!booking) throw new PilotError("That booking is unavailable.", 404);
  if (booking.fundingStatus !== "paid_in_full")
    throw new PilotError(
      "The full contract payment must be confirmed before matching.",
      409,
    );
  if (booking.status === "staffed" || booking.status === "active")
    throw new PilotError("This booking is already staffed.", 409);

  const targetPosition = await db
    .prepare(
      `SELECT slot.position_index AS positionIndex,
      MIN(slot.service_date) AS firstServiceDate,
      (SELECT first_slot.officer_offer_cents FROM roster_slots first_slot
       WHERE first_slot.booking_id = slot.booking_id AND first_slot.position_index = slot.position_index
         AND first_slot.status = 'uncovered' AND first_slot.environment = 'demo'
         AND first_slot.integrity_state = 'synthetic'
       ORDER BY first_slot.starts_at, first_slot.id LIMIT 1) AS firstOfferCents
    FROM roster_slots slot
    WHERE slot.booking_id = ? AND slot.status = 'uncovered'
      AND slot.environment = 'demo' AND slot.integrity_state = 'synthetic'
      AND NOT EXISTS (SELECT 1 FROM offers accepted WHERE accepted.booking_id = slot.booking_id
        AND accepted.position_index = slot.position_index AND accepted.status = 'accepted')
    GROUP BY slot.position_index ORDER BY slot.position_index LIMIT 1`,
    )
    .bind(bookingId)
    .first<{
      positionIndex: number;
      firstServiceDate: string;
      firstOfferCents: number;
    }>();
  if (!targetPosition)
    throw new PilotError(
      "This booking has no uncovered officer position available for matching.",
      409,
    );

  const existing = await db
    .prepare(
      `SELECT offer.id, offer.status FROM offers offer
    JOIN bookings booking ON booking.id = offer.booking_id
    WHERE offer.booking_id = ? AND offer.officer_id = ? AND offer.position_index = ?
      AND offer.status IN ('open', 'accepted')
      AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
    ORDER BY offer.rowid DESC LIMIT 1`,
    )
    .bind(
      bookingId,
      PILOT_OFFICER_ID,
      targetPosition.positionIndex,
      PILOT_CLIENT_ID,
    )
    .first<{ id: string; status: string }>();
  if (existing) {
    if (existing.status === "open") {
      await db
        .prepare(
          `UPDATE bookings SET status = 'offered' WHERE id = ? AND client_id = ?
        AND environment = 'demo' AND integrity_state = 'synthetic'
        AND EXISTS (SELECT 1 FROM offers WHERE id = ? AND booking_id = bookings.id AND status = 'open')`,
        )
        .bind(bookingId, PILOT_CLIENT_ID, existing.id)
        .run();
    }
    return { released: existing.status === "open", blockers: [] as string[] };
  }

  const alreadyAssigned = await db
    .prepare(
      `SELECT 1 AS present FROM offers offer
    WHERE offer.booking_id = ? AND offer.officer_id = ? AND offer.status = 'accepted' LIMIT 1`,
    )
    .bind(bookingId, PILOT_OFFICER_ID)
    .first<{ present: number }>();
  if (alreadyAssigned) {
    const blockers = [
      "The pilot officer already holds another position on this overlapping roster; a different eligible officer is required.",
    ];
    await db
      .prepare(
        `UPDATE bookings SET status = 'partially_staffed' WHERE id = ? AND client_id = ?
      AND environment = 'demo' AND integrity_state = 'synthetic'`,
      )
      .bind(bookingId, PILOT_CLIENT_ID)
      .run();
    await recordAudit(
      db,
      "operations",
      actorId,
      "offer_wave_blocked",
      "booking",
      bookingId,
      blockers[0],
    );
    return { released: false, blockers };
  }

  const readiness = await evaluateBookingReadiness(
    db,
    PILOT_OFFICER_ID,
    bookingId,
    {
      requireServiceOptIn: true,
    },
  );
  const availability =
    booking.engagementModel === "flex"
      ? await db
          .prepare(
            `SELECT flex_available AS flexAvailable, external_work_acknowledged AS externalWorkAcknowledged,
        rest_window_confirmed AS restWindowConfirmed FROM officers WHERE id = ?
        AND ${PILOT_OFFICER_UPDATE_GUARD("officers.id")}`,
          )
          .bind(PILOT_OFFICER_ID)
          .first<{
            flexAvailable: number;
            externalWorkAcknowledged: number;
            restWindowConfirmed: number;
          }>()
      : null;
  const availabilityBlockers =
    booking.engagementModel === "flex"
      ? [
          !availability?.flexAvailable
            ? "Officer is not currently available for Flex work."
            : "",
          !availability?.externalWorkAcknowledged
            ? "External work declaration is not current."
            : "",
          !availability?.restWindowConfirmed
            ? "Rest window has not been confirmed."
            : "",
        ].filter(Boolean)
      : [];
  const blockers = [...readiness.blockers, ...availabilityBlockers];
  if (!readiness.eligible || blockers.length) {
    await db
      .prepare(
        `UPDATE bookings SET status = 'matching' WHERE id = ? AND client_id = ?
      AND environment = 'demo' AND integrity_state = 'synthetic'`,
      )
      .bind(bookingId, PILOT_CLIENT_ID)
      .run();
    await recordAudit(
      db,
      "operations",
      actorId,
      "offer_wave_blocked",
      "booking",
      bookingId,
      `No pilot officer matched: ${blockers.join(" ")}`,
    );
    return { released: false, blockers };
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const offerId = `OF-DEMO-${crypto.randomUUID().slice(0, 6).toUpperCase()}-P${targetPosition.positionIndex}`;
  await db.batch([
    db
      .prepare(
        `INSERT INTO offers (id, booking_id, officer_id, position_index, amount_cents, status, expires_at, responded_at)
      SELECT ?, booking.id, passport.officer_id, ?, ?, 'open', ?, NULL
      FROM bookings booking JOIN officer_passports passport ON passport.officer_id = ?
      WHERE booking.id = ? AND booking.client_id = ?
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
        AND booking.funding_status = 'paid_in_full' AND booking.status NOT IN ('staffed', 'active')
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
        AND NOT (${PILOT_OFFICER_PRODUCTION_HISTORY("passport.officer_id")})
        AND NOT EXISTS (SELECT 1 FROM offers current_offer WHERE current_offer.booking_id = booking.id
          AND current_offer.position_index = ? AND current_offer.status IN ('open', 'accepted'))`,
      )
      .bind(
        offerId,
        targetPosition.positionIndex,
        targetPosition.firstOfferCents,
        expiresAt,
        PILOT_OFFICER_ID,
        bookingId,
        PILOT_CLIENT_ID,
        targetPosition.positionIndex,
      ),
    db
      .prepare(
        `UPDATE bookings SET status = 'offered' WHERE id = ? AND client_id = ?
      AND environment = 'demo' AND integrity_state = 'synthetic' AND funding_status = 'paid_in_full'
      AND EXISTS (SELECT 1 FROM offers WHERE id = ? AND booking_id = bookings.id AND status = 'open')`,
      )
      .bind(bookingId, PILOT_CLIENT_ID, offerId),
  ]);
  const released = await db
    .prepare(
      `SELECT 1 AS present FROM offers offer JOIN bookings booking ON booking.id = offer.booking_id
    WHERE offer.id = ? AND offer.booking_id = ? AND offer.officer_id = ? AND offer.status = 'open'
      AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`,
    )
    .bind(offerId, bookingId, PILOT_OFFICER_ID, PILOT_CLIENT_ID)
    .first<{ present: number }>();
  if (!released)
    throw new PilotError(
      "The synthetic offer could not be released from the verified demo booking.",
      409,
    );
  await recordAudit(
    db,
    "operations",
    actorId,
    "offer_wave_released",
    "booking",
    bookingId,
    `Funded booking passed Passport, grade, service, purpose and opt-in controls; synthetic position ${targetPosition.positionIndex} contract offer released.`,
  );
  return { released: true, blockers: [] as string[] };
}

async function resetDemo(db: D1Database, actorId: string) {
  const now = new Date();
  const offerExpiry = new Date(
    now.getTime() + 48 * 60 * 60 * 1000,
  ).toISOString();
  await db.batch([
    db
      .prepare(
        `UPDATE relief_dispatches SET status = 'cancelled', active_key = NULL, closed_at = ?,
      version = version + 1 WHERE environment = 'demo' AND integrity_state = 'synthetic'
      AND status NOT IN ('cancelled', 'closed', 'replaced')`,
      )
      .bind(now.toISOString()),
    db.prepare(`DELETE FROM operational_exceptions WHERE id LIKE 'EXC-REL-%'
      AND site_id IN (SELECT id FROM operational_sites WHERE environment = 'demo' AND integrity_state = 'synthetic')`),
    db
      .prepare(
        `UPDATE roster_slots SET status = CASE WHEN EXISTS (
        SELECT 1 FROM roster_assignments ra WHERE ra.roster_slot_id = roster_slots.id AND ra.active_key = roster_slots.id
      ) THEN 'scheduled' ELSE 'uncovered' END, absence_reason = CASE WHEN id = 'SLOT-LIN-02'
      THEN 'Additional coverage requirement' ELSE NULL END, version = 1, updated_at = ?
      WHERE environment = 'demo' AND integrity_state = 'synthetic'`,
      )
      .bind(now.toISOString()),
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
    db
      .prepare(
        `DELETE FROM shifts WHERE environment = 'demo' AND integrity_state = 'synthetic'
      AND booking_id IN (SELECT id FROM bookings WHERE client_id = ?
        AND environment = 'demo' AND integrity_state = 'synthetic'
        AND id = 'BK-2084')`,
      )
      .bind(PILOT_CLIENT_ID),
    db
      .prepare(
        `UPDATE officer_services SET opted_in = CASE service_type WHEN 'Unarmed' THEN 1 ELSE 0 END
      WHERE officer_id = ?
        AND ${PILOT_OFFICER_UPDATE_GUARD("officer_services.officer_id")}`,
      )
      .bind(PILOT_OFFICER_ID),
    db
      .prepare(
        `UPDATE offers SET status = 'open', responded_at = NULL, amount_cents = 80000, expires_at = ?
      WHERE id = 'OF-2084' AND booking_id IN (SELECT id FROM bookings WHERE id = 'BK-2084' AND client_id = ?
        AND environment = 'demo' AND integrity_state = 'synthetic')`,
      )
      .bind(offerExpiry, PILOT_CLIENT_ID),
    db
      .prepare(
        `UPDATE bookings SET status = 'offered', funding_status = 'paid_in_full'
      WHERE id = 'BK-2084' AND client_id = ? AND environment = 'demo' AND integrity_state = 'synthetic'`,
      )
      .bind(PILOT_CLIENT_ID),
    db
      .prepare(
        `UPDATE shifts SET status = 'completed', client_signoff_status = 'pending', signed_off_at = NULL
      WHERE id = 'SH-2080' AND environment = 'demo' AND integrity_state = 'synthetic'
        AND booking_id IN (SELECT id FROM bookings WHERE id = 'BK-2080' AND client_id = ?
          AND environment = 'demo' AND integrity_state = 'synthetic')`,
      )
      .bind(PILOT_CLIENT_ID),
    db
      .prepare(
        `UPDATE ledger_entries SET state = 'pending_signoff', eligible_release_at = NULL, updated_at = ?
      WHERE id = 'LE-2080' AND shift_id IN (SELECT shift.id FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
        WHERE shift.id = 'SH-2080' AND shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
          AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic')`,
      )
      .bind(now.toISOString(), PILOT_CLIENT_ID),
    db
      .prepare(
        `UPDATE ledger_entries SET state = 'available', updated_at = ?
      WHERE id = 'LE-2077' AND shift_id IN (SELECT shift.id FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
        WHERE shift.id = 'SH-2077' AND shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
          AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic')`,
      )
      .bind(now.toISOString(), PILOT_CLIENT_ID),
    db
      .prepare(
        `DELETE FROM payout_requests WHERE id LIKE 'PAY-DEMO-%' AND officer_id = ?
      AND status = 'queued_for_thursday'`,
      )
      .bind(PILOT_OFFICER_ID),
  ]);
  await recordAudit(
    db,
    "operations",
    actorId,
    "demo_reset",
    "pilot",
    "LOKD-PHASE-1",
    "Seeded demo controls returned to their opening state. Version 21 connected workflow records were preserved as synthetic audit history.",
  );
}

async function applyAction(
  db: D1Database,
  payload: PilotAction,
  actor: PilotPrincipal,
) {
  if (payload.action === "create_client_service_request") {
    const category = requireShortText(payload.category, "Request category", 48)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_");
    const summary = requireShortText(payload.summary, "Request summary", 120);
    const detail = requireShortText(payload.detail, "Request detail", 1200);
    if (payload.bookingId) {
      const booking = await db
        .prepare(
          `SELECT id FROM bookings WHERE id = ? AND client_id = ?
        AND environment = 'demo' AND integrity_state = 'synthetic'`,
        )
        .bind(payload.bookingId, PILOT_CLIENT_ID)
        .first();
      if (!booking)
        throw new PilotError(
          "That booking does not belong to the pilot client.",
          404,
        );
    }
    if (payload.shiftId) {
      const shift = await db
        .prepare(
          `SELECT shift.id FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
        WHERE shift.id = ? AND booking.client_id = ? AND shift.environment = 'demo'
         AND shift.integrity_state = 'synthetic' AND booking.environment = 'demo'
         AND booking.integrity_state = 'synthetic'`,
        )
        .bind(payload.shiftId, PILOT_CLIENT_ID)
        .first();
      if (!shift)
        throw new PilotError(
          "That shift does not belong to the pilot client.",
          404,
        );
    }
    await createServiceRequest(db, {
      requestedByRole: "client",
      requestedById: actor.email,
      clientId: PILOT_CLIENT_ID,
      bookingId: payload.bookingId ?? null,
      shiftId: payload.shiftId ?? null,
      category,
      summary,
      detail,
    });
    return;
  }

  if (payload.action === "create_officer_service_request") {
    const category = requireShortText(payload.category, "Request category", 48)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_");
    const summary = requireShortText(payload.summary, "Request summary", 120);
    const detail = requireShortText(payload.detail, "Request detail", 1200);
    if (payload.shiftId) {
      const shift = await db
        .prepare(
          `SELECT id FROM shifts WHERE id = ? AND officer_id = ?
        AND environment = 'demo' AND integrity_state = 'synthetic'`,
        )
        .bind(payload.shiftId, PILOT_OFFICER_ID)
        .first();
      if (!shift)
        throw new PilotError(
          "That shift does not belong to the pilot officer.",
          404,
        );
    }
    await createServiceRequest(db, {
      requestedByRole: "officer",
      requestedById: actor.email,
      officerId: PILOT_OFFICER_ID,
      shiftId: payload.shiftId ?? null,
      category,
      summary,
      detail,
    });
    return;
  }

  if (payload.action === "create_booking") {
    const commandId =
      typeof payload.commandId === "string"
        ? payload.commandId.trim().toLowerCase()
        : "";
    if (!/^[a-z0-9][a-z0-9-]{15,79}$/.test(commandId))
      throw new PilotError("The booking command reference is invalid.");
    if (!Object.hasOwn(servicePriceBook, payload.serviceType))
      throw new PilotError("Choose a valid security service.");
    if (!(["fixed", "flex"] as const).includes(payload.engagementModel))
      throw new PilotError("Choose Fixed or Flex cover.");
    if (!["single", "1", "3", "6", "12"].includes(payload.term))
      throw new PilotError("Choose a valid contract term.");
    if (!Object.hasOwn(rosterPatterns, payload.rosterPattern))
      throw new PilotError("Choose a valid coverage roster.");
    if (payload.engagementModel === "fixed" && payload.term === "single")
      throw new PilotError("Fixed cover requires a contract term.");
    const purpose = purposePriceBook.find(
      (item) => item.code === payload.purposeCode,
    );
    if (!purpose) throw new PilotError("Choose a valid work purpose.");
    const parsedStartDate = new Date(`${payload.startDate}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(payload.startDate) ||
      Number.isNaN(parsedStartDate.getTime()) ||
      parsedStartDate.toISOString().slice(0, 10) !== payload.startDate
    ) {
      throw new PilotError("Choose a valid start date.");
    }
    if (!(["day", "night"] as const).includes(payload.shift))
      throw new PilotError("Choose a valid day or night shift.");
    const johannesburgToday = new Date(Date.now() + 2 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    if (payload.startDate < johannesburgToday)
      throw new PilotError("Choose a start date that has not passed.");
    const postName = requireShortText(payload.postName, "Post", 80);
    const instructions = requireShortText(
      payload.instructions,
      "Instructions",
      600,
    );
    const siteName = requireShortText(payload.siteName, "Site name", 100);
    const siteArea = requireShortText(payload.siteArea, "Site area", 80);
    const addressLabel = requireShortText(
      payload.addressLabel,
      "Site address",
      180,
    );
    const shiftStart = payload.shift === "night" ? "18:00" : "06:00";
    const shiftEnd = payload.shift === "night" ? "06:00" : "18:00";
    const riskInput = payload.riskInput;
    if (
      !riskInput ||
      !["standard", "valuable", "high_value"].includes(
        riskInput.assetExposure,
      ) ||
      !["controlled", "moderate", "open"].includes(riskInput.publicAccess) ||
      !["none", "isolated", "repeated"].includes(riskInput.incidentHistory) ||
      !["strong", "partial", "limited"].includes(riskInput.existingControls) ||
      typeof riskInput.nightOperation !== "boolean" ||
      typeof riskInput.vulnerablePeople !== "boolean"
    ) {
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
        specialistConfiguration: payload.specialistConfiguration,
      });
    } catch (cause) {
      throw new PilotError(
        cause instanceof Error
          ? cause.message
          : "The booking could not be priced.",
      );
    }
    const requestHash = await sha256(
      JSON.stringify({
        commandId,
        serviceType: payload.serviceType,
        engagementModel: payload.engagementModel,
        term: payload.term,
        rosterPattern: payload.rosterPattern,
        purposeCode: payload.purposeCode,
        riskInput,
        specialistConfiguration: quote.specialistConfiguration,
        startDate: payload.startDate,
        shift: payload.shift,
        postName,
        instructions,
        siteName,
        siteArea,
        addressLabel,
      }),
    );
    const existingCommand = await db
      .prepare(
        `SELECT request_hash AS requestHash, aggregate_id AS aggregateId,
      completed_at AS completedAt FROM api_idempotency_keys
      WHERE principal_type = 'client' AND principal_id = ? AND operation = 'create_booking'
       AND environment = 'demo' AND idempotency_key = ? LIMIT 1`,
      )
      .bind(PILOT_CLIENT_ID, commandId)
      .first<{
        requestHash: string;
        aggregateId: string;
        completedAt: string | null;
      }>();
    if (existingCommand) {
      if (existingCommand.requestHash !== requestHash)
        throw new PilotError(
          "That booking command was already used with different terms.",
          409,
        );
      if (!existingCommand.completedAt)
        throw new PilotError(
          "That booking command is still being processed.",
          409,
        );
      return;
    }
    const bookingId = `BK-DEMO-${requestHash.slice(0, 12).toUpperCase()}`;
    const suffix = bookingId.slice("BK-DEMO-".length);
    const siteId = `SITE-DEMO-${suffix}`;
    const postId = `POST-DEMO-${suffix}`;
    const riskId = `RISK-DEMO-${suffix}`;
    const postApprovalId = `POA-DEMO-${suffix}`;
    const invoiceId = `INV-DEMO-${suffix}`;
    const invoiceLineId = `INVL-DEMO-${suffix}`;
    const postOrdersVersion = `PO-${suffix}-v1`;
    const now = new Date().toISOString();
    const commandExpiry = new Date(
      new Date(now).getTime() + 24 * 60 * 60 * 1000,
    ).toISOString();
    const rosterRows = quote.serviceDates.flatMap((serviceDate, dateIndex) => {
      const window = shiftWindow(serviceDate, shiftStart, shiftEnd);
      const economics = officerShiftEconomicsForRoster({
        serviceType: payload.serviceType,
        specialistServiceCode: quote.specialistServiceCode,
        riskBand: quote.risk.band,
        engagementModel: quote.engagementModel,
        serviceDate,
        startsAt: window.startsAt,
      });
      if (!economics)
        throw new PilotError("The roster economics could not be frozen.", 409);
      return Array.from({ length: quote.headcount }, (_, positionOffset) => ({
        id: `SLOT-DEMO-${suffix}-${String(dateIndex + 1).padStart(3, "0")}-${positionOffset + 1}`,
        serviceDate,
        positionIndex: positionOffset + 1,
        calendarCategory: economics.calendarCategory,
        officerOfferCents: economics.officerOfferCents,
        ...window,
      }));
    });
    const rosterSlotId = rosterRows[0]?.id;
    if (!rosterSlotId || rosterRows.length !== quote.shiftCount)
      throw new PilotError("The full roster could not be materialised.", 409);
    const evidenceExpiresAt = rosterRows.reduce(
      (latest, row) => (row.endsAt > latest ? row.endsAt : latest),
      rosterRows[0].endsAt,
    );
    const pricingBreakdown = JSON.stringify({
      baseClientCents: quote.baseClientCents,
      calendarPremiumCents: quote.calendarPremiumCents,
      dispatchPremiumCents: quote.dispatchPremiumCents,
      riskPremiumCents: quote.riskPremiumCents,
      marginFloorAdjustmentCents: quote.marginFloorAdjustmentCents,
      subtotalCents: quote.subtotalCents,
      vatCents: quote.vatCents,
      payrollBurdenCents: quote.pricingDecision.payrollBurdenCents,
      readinessAndEquipmentCents:
        quote.pricingDecision.readinessAndEquipmentCents,
      commandAndSupervisionCents:
        quote.pricingDecision.commandAndSupervisionCents,
      planningCents: quote.pricingDecision.planningCents,
      travelCents: quote.pricingDecision.travelCents,
      vehicleAndPartnerCents: quote.pricingDecision.vehicleAndPartnerCents,
      overnightCents: quote.pricingDecision.overnightCents,
    });
    await ensureIntegrationDemoData(db);
    const paymentStatements = await demoPaymentOrderStatements(db, {
      bookingId,
      clientId: PILOT_CLIENT_ID,
      amountCents: quote.clientPriceCents,
      createdAt: now,
    });
    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO bookings
          (id, client_id, site_name, site_area, post_name, service_type, purpose_code, purpose_label,
           engagement_model, notice_window, roster_pattern, calendar_category, calendar_label,
           risk_band, risk_score, risk_reasons, required_endorsements, manual_review, headcount,
           service_day_count, shift_count,
           minimum_grade, contract_months, start_date, end_date, shift_start, shift_end,
           client_price_cents, officer_rate_cents, officer_total_cents, gross_platform_contribution_cents,
           pricing_version, pricing_breakdown, specialist_service_code, specialist_configuration,
           quote_subtotal_cents, vat_rate_basis_points, vat_cents, cost_floor_cents, margin_cents,
           margin_basis_points, minimum_margin_basis_points, pricing_status,
           environment, integrity_state, funding_status, release_cadence, status)
          SELECT ?, client.id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            'demo', 'synthetic', ?, ?, ?
          FROM clients client
          WHERE client.id = ? AND client.environment = 'demo' AND client.integrity_state = 'synthetic'`,
          )
          .bind(
            bookingId,
            siteName,
            siteArea,
            postName,
            payload.serviceType,
            purpose.code,
            purpose.label,
            quote.engagementModel,
            quote.noticeWindow,
            payload.rosterPattern,
            quote.firstCalendarCategory,
            quote.firstCalendarLabel,
            quote.risk.band,
            quote.risk.score,
            JSON.stringify(quote.risk.reasons),
            JSON.stringify(quote.risk.requiredEndorsements),
            quote.manualReview ? 1 : 0,
            quote.headcount,
            quote.serviceDayCount,
            quote.shiftCount,
            quote.minimumGrade,
            quote.contractMonths,
            quote.startDate,
            quote.endDate,
            shiftStart,
            shiftEnd,
            quote.clientPriceCents,
            quote.officerRateCents,
            quote.officerTotalCents,
            quote.grossPlatformContributionCents,
            quote.version,
            pricingBreakdown,
            quote.specialistServiceCode,
            JSON.stringify(quote.specialistConfiguration),
            quote.subtotalCents,
            quote.vatRateBasisPoints,
            quote.vatCents,
            quote.costFloorCents,
            quote.marginCents,
            quote.marginBasisPoints,
            quote.minimumMarginBasisPoints,
            quote.pricingStatus,
            "site_review",
            quote.releaseCadence,
            "site_review",
            PILOT_CLIENT_ID,
          ),
        db
          .prepare(
            `INSERT INTO operational_sites
          (id, client_id, booking_id, name, area, address_label, latitude_e6, longitude_e6, timezone,
           risk_band, service_type, geofence_radius_meters, geofence_version, telemetry_mode,
           sensitivity_classification, environment, integrity_state, status, version, updated_by, created_at, updated_at)
          SELECT ?, booking.client_id, booking.id, booking.site_name, booking.site_area,
           ?, -26145900, 28041400, 'Africa/Johannesburg',
           booking.risk_band, booking.service_type, 120, 1, 'simulated', 'operational',
           'demo', 'synthetic', 'onboarding', 1, ?, ?, ?
          FROM bookings booking WHERE booking.id = ? AND booking.client_id = ?
           AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`,
          )
          .bind(
            siteId,
            `${addressLabel} · synthetic map pin pending geocoding`,
            actor.email,
            now,
            now,
            bookingId,
            PILOT_CLIENT_ID,
          ),
        db
          .prepare(
            `INSERT INTO site_posts
          (id, site_id, booking_id, name, service_type, purpose_code, minimum_grade, post_orders_version, post_orders_content,
           environment, integrity_state, status, created_at, updated_at)
          SELECT ?, site.id, booking.id, booking.post_name, booking.service_type, booking.purpose_code,
           booking.minimum_grade, ?, ?, 'demo', 'synthetic', 'draft', ?, ?
          FROM operational_sites site JOIN bookings booking ON booking.id = site.booking_id
          WHERE site.id = ? AND booking.id = ? AND site.environment = 'demo' AND site.integrity_state = 'synthetic'
           AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`,
          )
          .bind(
            postId,
            postOrdersVersion,
            instructions,
            now,
            now,
            siteId,
            bookingId,
          ),
        db
          .prepare(
            `INSERT INTO site_risk_assessments
          (id, site_id, risk_rules_version, risk_band, status, environment, integrity_state,
           evidence_reference, approved_by, approved_at, valid_from, expires_at, version, active_key, created_at)
          SELECT ?, site.id, ?, site.risk_band, 'review_required', 'demo', 'synthetic', NULL, NULL, NULL,
           NULL, ?, 1, NULL, ?
          FROM operational_sites site WHERE site.id = ? AND site.environment = 'demo' AND site.integrity_state = 'synthetic'`,
          )
          .bind(riskId, quote.risk.version, evidenceExpiresAt, now, siteId),
        db
          .prepare(
            `INSERT INTO post_order_approvals
          (id, post_id, post_orders_version, status, environment, integrity_state, evidence_reference,
           approved_by, approved_at, valid_from, expires_at, version, active_key, created_at)
          SELECT ?, post.id, post.post_orders_version, 'review_required', 'demo', 'synthetic', NULL, NULL,
           NULL, NULL, ?, 1, NULL, ?
          FROM site_posts post WHERE post.id = ? AND post.environment = 'demo' AND post.integrity_state = 'synthetic'`,
          )
          .bind(postApprovalId, evidenceExpiresAt, now, postId),
        db
          .prepare(
            `INSERT INTO roster_slots
          (id, site_id, post_id, booking_id, service_date, starts_at, ends_at, arrival_due_at, check_in_due_at,
           position_index, calendar_category, officer_offer_cents, environment, integrity_state, status,
           absence_reason, version, created_at, updated_at)
          SELECT json_extract(input.value, '$.id'), site.id, post.id, booking.id,
           json_extract(input.value, '$.serviceDate'), json_extract(input.value, '$.startsAt'),
           json_extract(input.value, '$.endsAt'), json_extract(input.value, '$.arrivalDueAt'),
           json_extract(input.value, '$.checkInDueAt'), json_extract(input.value, '$.positionIndex'),
           json_extract(input.value, '$.calendarCategory'), json_extract(input.value, '$.officerOfferCents'),
           'demo', 'synthetic', 'uncovered', 'Awaiting funded officer match', 1, ?, ?
          FROM json_each(?) input
          JOIN operational_sites site ON site.id = ?
          JOIN bookings booking ON booking.id = site.booking_id
          JOIN site_posts post ON post.site_id = site.id AND post.booking_id = booking.id
          WHERE site.id = ? AND post.id = ? AND booking.id = ?
           AND site.environment = 'demo' AND site.integrity_state = 'synthetic'
           AND post.environment = 'demo' AND post.integrity_state = 'synthetic'
           AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`,
          )
          .bind(
            now,
            now,
            JSON.stringify(rosterRows),
            siteId,
            siteId,
            postId,
            bookingId,
          ),
        db
          .prepare(
            `INSERT INTO client_invoices
          (id, booking_id, client_id, issuer_billing_profile_id, client_billing_profile_id, artifact_id,
           original_invoice_id, document_type, invoice_number, currency, service_period_start,
           service_period_end, subtotal_cents, tax_cents, total_cents, balance_cents, tax_treatment,
           status, funding_status, pricing_version, issuer_snapshot, client_snapshot, issue_reference,
           payment_reference, due_at, issued_at, settled_at, environment, integrity_state,
           created_at, updated_at, version)
          SELECT ?, booking.id, booking.client_id, NULL, NULL, NULL, NULL, 'invoice', NULL, 'ZAR',
           booking.start_date, booking.end_date, booking.quote_subtotal_cents, booking.vat_cents,
           booking.client_price_cents, booking.client_price_cents,
           'standard_vat_15', 'draft', 'not_started', booking.pricing_version, NULL, NULL,
           NULL, NULL, NULL, NULL, NULL, 'demo', 'synthetic', ?, ?, 1
          FROM bookings booking WHERE booking.id = ? AND booking.client_id = ?
           AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`,
          )
          .bind(invoiceId, now, now, bookingId, PILOT_CLIENT_ID),
        db
          .prepare(
            `INSERT INTO client_invoice_lines
          (id, invoice_id, booking_id, roster_slot_id, timesheet_id, description, quantity,
           unit_price_cents, net_cents, tax_cents, gross_cents, tax_code, tax_rate_basis_points,
           pricing_version, environment, integrity_state, created_at)
          SELECT ?, invoice.id, booking.id, NULL, NULL,
           booking.service_type || ' security service · ' || booking.service_day_count || ' service day(s) × ' || booking.headcount || ' position(s)',
           1, booking.quote_subtotal_cents, booking.quote_subtotal_cents, booking.vat_cents,
           booking.client_price_cents, 'standard', booking.vat_rate_basis_points,
           booking.pricing_version, 'demo', 'synthetic', ?
          FROM client_invoices invoice JOIN bookings booking ON booking.id = invoice.booking_id
          WHERE invoice.id = ? AND booking.id = ? AND invoice.environment = 'demo'
           AND invoice.integrity_state = 'synthetic' AND booking.environment = 'demo'
           AND booking.integrity_state = 'synthetic'`,
          )
          .bind(invoiceLineId, now, invoiceId, bookingId),
        ...paymentStatements,
        db
          .prepare(
            `INSERT INTO api_idempotency_keys
          (id, principal_type, principal_id, operation, idempotency_key, request_hash,
           aggregate_type, aggregate_id, response_status, response_reference, environment,
           expires_at, created_at, completed_at)
          VALUES (?, 'client', ?, 'create_booking', ?, ?, 'booking', ?, 200, ?, 'demo', ?, ?, ?)`,
          )
          .bind(
            `IDEMP-BOOK-${commandId}`,
            PILOT_CLIENT_ID,
            commandId,
            requestHash,
            bookingId,
            bookingId,
            commandExpiry,
            now,
            now,
          ),
        db
          .prepare(
            `INSERT INTO audit_events
          (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
          VALUES (?, 'client', ?, 'booking_created', 'booking', ?,
            CASE WHEN EXISTS (SELECT 1 FROM bookings booking WHERE booking.id = ? AND booking.client_id = ?
              AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic')
            AND EXISTS (SELECT 1 FROM operational_sites site WHERE site.id = ? AND site.booking_id = ?
              AND site.client_id = ? AND site.environment = 'demo' AND site.integrity_state = 'synthetic')
            AND EXISTS (SELECT 1 FROM site_posts post WHERE post.id = ? AND post.site_id = ?
              AND post.booking_id = ? AND post.environment = 'demo' AND post.integrity_state = 'synthetic')
            AND EXISTS (SELECT 1 FROM site_risk_assessments risk WHERE risk.id = ? AND risk.site_id = ?
              AND risk.status = 'review_required' AND risk.environment = 'demo' AND risk.integrity_state = 'synthetic')
            AND EXISTS (SELECT 1 FROM post_order_approvals approval WHERE approval.id = ? AND approval.post_id = ?
              AND approval.status = 'review_required' AND approval.environment = 'demo'
              AND approval.integrity_state = 'synthetic')
            AND (SELECT COUNT(*) FROM roster_slots slot WHERE slot.booking_id = ? AND slot.site_id = ?
              AND slot.post_id = ? AND slot.environment = 'demo' AND slot.integrity_state = 'synthetic') = ?
            AND EXISTS (SELECT 1 FROM client_invoices invoice WHERE invoice.id = ? AND invoice.booking_id = ?
              AND invoice.client_id = ? AND invoice.subtotal_cents = ? AND invoice.tax_cents = ?
              AND invoice.total_cents = ? AND invoice.status = 'draft'
              AND invoice.environment = 'demo' AND invoice.integrity_state = 'synthetic')
            AND EXISTS (SELECT 1 FROM client_invoice_lines line WHERE line.id = ? AND line.invoice_id = ?
              AND line.booking_id = ? AND line.net_cents = ? AND line.tax_cents = ?
              AND line.gross_cents = ? AND line.environment = 'demo'
              AND line.integrity_state = 'synthetic')
            AND EXISTS (SELECT 1 FROM payment_orders payment WHERE payment.id = ? AND payment.booking_id = ?
              AND payment.client_id = ? AND payment.amount_cents = ? AND payment.status = 'requires_action'
              AND payment.environment = 'demo' AND payment.integrity_state = 'synthetic')
            AND EXISTS (SELECT 1 FROM integration_operations operation WHERE operation.provider_key = 'INT-DEMO-PAYMENTS'
              AND operation.entity_type = 'booking' AND operation.entity_id = ?
              AND operation.environment = 'demo' AND operation.integrity_state = 'synthetic')
            AND EXISTS (SELECT 1 FROM domain_outbox_events event WHERE event.aggregate_type = 'booking'
              AND event.aggregate_id = ? AND event.event_type = 'payment.order.created'
              AND event.environment = 'demo' AND event.integrity_state = 'synthetic')
            AND EXISTS (SELECT 1 FROM api_idempotency_keys command WHERE command.principal_type = 'client'
              AND command.principal_id = ? AND command.operation = 'create_booking'
              AND command.idempotency_key = ? AND command.request_hash = ? AND command.aggregate_id = ?
              AND command.environment = 'demo' AND command.completed_at IS NOT NULL)
            THEN ? ELSE NULL END, ?)`,
          )
          .bind(
            eventId("AUD"),
            actor.email,
            bookingId,
            bookingId,
            PILOT_CLIENT_ID,
            siteId,
            bookingId,
            PILOT_CLIENT_ID,
            postId,
            siteId,
            bookingId,
            riskId,
            siteId,
            postApprovalId,
            postId,
            bookingId,
            siteId,
            postId,
            quote.shiftCount,
            invoiceId,
            bookingId,
            PILOT_CLIENT_ID,
            quote.subtotalCents,
            quote.vatCents,
            quote.clientPriceCents,
            invoiceLineId,
            invoiceId,
            bookingId,
            quote.subtotalCents,
            quote.vatCents,
            quote.clientPriceCents,
            `PAYORD-${bookingId}`,
            bookingId,
            PILOT_CLIENT_ID,
            quote.clientPriceCents,
            bookingId,
            bookingId,
            PILOT_CLIENT_ID,
            commandId,
            requestHash,
            bookingId,
            `${PRICE_BOOK_VERSION}; connected site ${siteId}, post ${postId}, ${quote.serviceDayCount} service days, ${quote.headcount} required officer position${quote.headcount === 1 ? "" : "s"}, ${quote.shiftCount} roster slots and canonical payment order; independent Operations site/risk/post approval required.`,
            now,
          ),
      ]);
    } catch {
      const concurrent = await db
        .prepare(
          `SELECT request_hash AS requestHash FROM api_idempotency_keys
        WHERE principal_type = 'client' AND principal_id = ? AND operation = 'create_booking'
         AND environment = 'demo' AND idempotency_key = ? AND completed_at IS NOT NULL`,
        )
        .bind(PILOT_CLIENT_ID, commandId)
        .first<{ requestHash: string }>();
      if (concurrent?.requestHash === requestHash) return;
      throw new PilotError(
        "The connected booking, roster and payment command could not be created together.",
        409,
      );
    }
    return;
  }

  if (payload.action === "approve_risk_plan") {
    // SQLite CURRENT_TIMESTAMP has second precision. Floor approval evidence to
    // that same precision so a legitimate approval is not misread as being a
    // fraction of a second in the future by the database guard.
    const now = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
    try {
      await db.batch([
      db
        .prepare(
          `UPDATE site_risk_assessments SET status = 'approved', evidence_reference = ?, approved_by = ?,
        approved_at = ?, valid_from = ?, active_key = site_id, version = version + 1
        WHERE site_id IN (SELECT id FROM operational_sites WHERE booking_id = ? AND client_id = ?
          AND environment = 'demo' AND integrity_state = 'synthetic')
        AND status = 'review_required' AND environment = 'demo' AND integrity_state = 'synthetic'`,
        )
        .bind(
          `demo:risk-review:${payload.bookingId}`,
          actor.email,
          now,
          now,
          payload.bookingId,
          PILOT_CLIENT_ID,
        ),
      db
        .prepare(
          `UPDATE post_order_approvals SET status = 'approved', evidence_reference = ?, approved_by = ?,
        approved_at = ?, valid_from = ?, active_key = post_id, version = version + 1
        WHERE post_id IN (SELECT post.id FROM site_posts post JOIN operational_sites site ON site.id = post.site_id
          WHERE site.booking_id = ? AND site.client_id = ? AND post.environment = 'demo'
           AND post.integrity_state = 'synthetic' AND site.environment = 'demo' AND site.integrity_state = 'synthetic')
        AND status = 'review_required' AND environment = 'demo' AND integrity_state = 'synthetic'
        AND post_orders_version = (SELECT post.post_orders_version FROM site_posts post
          WHERE post.id = post_order_approvals.post_id AND post.environment = 'demo'
            AND post.integrity_state = 'synthetic')`,
        )
        .bind(
          `demo:post-order-review:${payload.bookingId}`,
          actor.email,
          now,
          now,
          payload.bookingId,
          PILOT_CLIENT_ID,
        ),
      db
        .prepare(
          `UPDATE site_posts SET status = 'active', updated_at = ? WHERE booking_id = ?
        AND environment = 'demo' AND integrity_state = 'synthetic' AND status = 'draft'`,
        )
        .bind(now, payload.bookingId),
      db
        .prepare(
          `UPDATE operational_sites SET status = 'active', updated_by = ?, updated_at = ?, version = version + 1
        WHERE booking_id = ? AND client_id = ? AND environment = 'demo' AND integrity_state = 'synthetic'
         AND status = 'onboarding'`,
        )
        .bind(actor.email, now, payload.bookingId, PILOT_CLIENT_ID),
      db
        .prepare(
          `UPDATE bookings SET funding_status = 'awaiting_payment', status = 'awaiting_payment'
        WHERE id = ? AND client_id = ? AND status = 'site_review'
          AND environment = 'demo' AND integrity_state = 'synthetic'
          AND EXISTS (SELECT 1 FROM operational_sites site JOIN site_risk_assessments risk ON risk.site_id = site.id
            JOIN site_posts post ON post.site_id = site.id
            JOIN post_order_approvals approval ON approval.post_id = post.id
            WHERE site.booking_id = bookings.id AND site.status = 'active'
             AND risk.status = 'approved' AND risk.active_key = site.id
             AND post.status = 'active' AND approval.status = 'approved' AND approval.active_key = post.id
             AND approval.post_orders_version = post.post_orders_version)`,
        )
        .bind(payload.bookingId, PILOT_CLIENT_ID),
      db
        .prepare(
          `INSERT INTO audit_events
          (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
          VALUES (?, 'operations', ?, 'site_plan_approved', 'booking', ?,
            CASE WHEN EXISTS (SELECT 1 FROM bookings booking WHERE booking.id = ?
              AND booking.client_id = ? AND booking.status = 'awaiting_payment'
              AND booking.funding_status = 'awaiting_payment'
              AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic')
            AND (SELECT COUNT(*) FROM operational_sites site WHERE site.booking_id = ? AND site.client_id = ?
              AND site.status = 'active' AND site.environment = 'demo' AND site.integrity_state = 'synthetic') = 1
            AND (SELECT COUNT(*) FROM site_risk_assessments risk JOIN operational_sites site ON site.id = risk.site_id
              WHERE site.booking_id = ? AND risk.status = 'approved' AND risk.active_key = site.id
                AND risk.environment = 'demo' AND risk.integrity_state = 'synthetic') = 1
            AND (SELECT COUNT(*) FROM site_posts post JOIN post_order_approvals approval ON approval.post_id = post.id
              WHERE post.booking_id = ? AND post.status = 'active' AND approval.status = 'approved'
                AND approval.active_key = post.id AND approval.post_orders_version = post.post_orders_version
                AND post.environment = 'demo' AND post.integrity_state = 'synthetic'
                AND approval.environment = 'demo' AND approval.integrity_state = 'synthetic') = 1
            THEN 'DEMO ONLY: risk assessment, site onboarding and versioned post orders were independently reviewed; quote released to the payment gate.'
            ELSE NULL END, ?)`,
        )
        .bind(
          eventId("AUD"),
          actor.email,
          payload.bookingId,
          payload.bookingId,
          PILOT_CLIENT_ID,
          payload.bookingId,
          PILOT_CLIENT_ID,
          payload.bookingId,
          payload.bookingId,
          now,
        ),
      ]);
    } catch {
      throw new PilotError(
        "This booking is not awaiting an Operations site-plan review.",
        409,
      );
    }
    return;
  }

  if (payload.action === "confirm_booking_payment") {
    try {
      await reconcileDemoPayment(
        db,
        payload.bookingId,
        PILOT_CLIENT_ID,
        actor.email,
      );
    } catch (cause) {
      if (cause instanceof Error) throw new PilotError(cause.message, 409);
      throw cause;
    }
    await releaseOfferWave(db, payload.bookingId, actor.email);
    return;
  }

  if (payload.action === "release_offer_wave") {
    await releaseOfferWave(db, payload.bookingId, actor.email);
    return;
  }

  if (payload.action === "reset_demo") {
    if (pilotStage() !== "demo")
      throw new PilotError(
        "Demo reset is disabled outside the isolated demo environment.",
        403,
      );
    await resetDemo(db, actor.email);
    return;
  }

  if (payload.action === "accept_offer") {
    const offer = await db
      .prepare(
        `SELECT o.id, o.booking_id AS bookingId, o.status, o.amount_cents AS amountCents,
      o.position_index AS positionIndex, o.expires_at AS expiresAt, b.start_date AS startDate,
      b.engagement_model AS engagementModel,
      site.id AS siteId,
      (SELECT COUNT(*) FROM roster_slots slot WHERE slot.booking_id = b.id
        AND slot.position_index = o.position_index AND slot.environment = 'demo'
        AND slot.integrity_state = 'synthetic') AS slotCount,
      (SELECT COUNT(*) FROM roster_slots slot WHERE slot.booking_id = b.id
        AND slot.position_index = o.position_index AND slot.status = 'uncovered'
        AND slot.environment = 'demo' AND slot.integrity_state = 'synthetic') AS uncoveredSlotCount,
      (SELECT MAX(slot.ends_at) FROM roster_slots slot WHERE slot.booking_id = b.id
        AND slot.position_index = o.position_index AND slot.environment = 'demo'
        AND slot.integrity_state = 'synthetic') AS positionEndsAt,
      engagement.id AS engagementId, engagement.employer_id AS employerId,
      engagement.model AS workforceModel, engagement.terms_version AS termsVersion,
      employer.legal_name AS employerLegalName
      FROM offers o JOIN bookings b ON b.id = o.booking_id
      LEFT JOIN operational_sites site ON site.booking_id = b.id AND site.environment = b.environment
        AND site.integrity_state = b.integrity_state
      LEFT JOIN workforce_engagements engagement ON engagement.officer_id = o.officer_id
        AND engagement.environment = 'demo' AND engagement.status = 'active' AND engagement.active_key = o.officer_id
      LEFT JOIN workforce_employers employer ON employer.id = engagement.employer_id AND employer.environment = 'demo'
      WHERE o.id = ? AND o.officer_id = ? AND b.client_id = ?
        AND b.environment = 'demo' AND b.integrity_state = 'synthetic'
      ORDER BY site.id LIMIT 1`,
      )
      .bind(payload.offerId, PILOT_OFFICER_ID, PILOT_CLIENT_ID)
      .first<{
        id: string;
        bookingId: string;
        status: string;
        amountCents: number;
        positionIndex: number;
        startDate: string;
        expiresAt: string;
        engagementModel: "fixed" | "flex";
        siteId: string | null;
        slotCount: number;
        uncoveredSlotCount: number;
        positionEndsAt: string | null;
        engagementId: string | null;
        employerId: string | null;
        workforceModel: string | null;
        termsVersion: string | null;
        employerLegalName: string | null;
      }>();
    if (!offer)
      throw new PilotError(
        "This offer is not available to the pilot officer.",
        404,
      );
    if (offer.status !== "open")
      throw new PilotError("This offer has already been decided.", 409);
    if (new Date(offer.expiresAt).getTime() <= Date.now())
      throw new PilotError("This offer has expired.", 409);
    const readiness = await evaluateBookingReadiness(
      db,
      PILOT_OFFICER_ID,
      offer.bookingId,
      {
        requireServiceOptIn: true,
      },
    );
    if (!readiness.eligible)
      throw new PilotError(
        `LOKD Passport gate: ${readiness.blockers.join(" ")}`,
        409,
      );
    if (offer.engagementModel === "flex") {
      const availability = await db
        .prepare(
          `SELECT flex_available AS flexAvailable,
        external_work_acknowledged AS externalWorkAcknowledged, rest_window_confirmed AS restWindowConfirmed
        FROM officers WHERE id = ? AND ${PILOT_OFFICER_UPDATE_GUARD("officers.id")}`,
        )
        .bind(PILOT_OFFICER_ID)
        .first<{
          flexAvailable: number;
          externalWorkAcknowledged: number;
          restWindowConfirmed: number;
        }>();
      if (
        !availability?.flexAvailable ||
        !availability.externalWorkAcknowledged ||
        !availability.restWindowConfirmed
      ) {
        throw new PilotError(
          "Flex availability, external-work declaration and rest confirmation must still be current.",
          409,
        );
      }
    }
    const now = new Date().toISOString();
    const isRetainedLegacyOffer =
      offer.id === "OF-2084" && offer.bookingId === "BK-2084";
    if (isRetainedLegacyOffer) {
      try {
        await db.batch([
          db
            .prepare(
              `UPDATE bookings SET status = 'staffed' WHERE id = ?
            AND environment = 'demo' AND integrity_state = 'synthetic'
            AND funding_status = 'paid_in_full' AND status IN ('offered', 'matching')
            AND NOT EXISTS (SELECT 1 FROM offers WHERE booking_id = ? AND status = 'accepted')`,
            )
            .bind(offer.bookingId, offer.bookingId),
          db
            .prepare(
              `UPDATE offers SET status = 'accepted', responded_at = ?
            WHERE id = ? AND officer_id = ? AND status = 'open'
            AND EXISTS (SELECT 1 FROM bookings WHERE id = ? AND status = 'staffed'
              AND client_id = ? AND environment = 'demo' AND integrity_state = 'synthetic')`,
            )
            .bind(
              now,
              payload.offerId,
              PILOT_OFFICER_ID,
              offer.bookingId,
              PILOT_CLIENT_ID,
            ),
          db
            .prepare(
              `INSERT INTO shifts
            (id, booking_id, officer_id, scheduled_date, environment, integrity_state, status,
             check_in_at, check_out_at, client_signoff_status, signed_off_at, earnings_cents)
            SELECT ?, booking.id, ?, booking.start_date, 'demo', 'synthetic', 'confirmed',
             NULL, NULL, 'not_due', NULL, ? FROM bookings booking
            WHERE booking.id = ? AND booking.client_id = ? AND booking.environment = 'demo'
             AND booking.integrity_state = 'synthetic'
             AND EXISTS (SELECT 1 FROM offers accepted WHERE accepted.id = ? AND accepted.status = 'accepted')`,
            )
            .bind(
              `SH-${offer.bookingId.slice(3)}`,
              PILOT_OFFICER_ID,
              offer.amountCents,
              offer.bookingId,
              PILOT_CLIENT_ID,
              payload.offerId,
            ),
        ]);
      } catch {
        throw new PilotError(
          "Another officer secured this synthetic demo booking first.",
          409,
        );
      }
      await recordAudit(
        db,
        "officer",
        actor.email,
        "legacy_synthetic_offer_accepted",
        "offer",
        payload.offerId,
        "DEMO ONLY: the retained Version 20 seed offer was accepted through its legacy synthetic path. New Version 21 bookings use the connected site, roster and employer chain.",
      );
      return;
    }
    if (
      !offer.siteId ||
      !offer.positionEndsAt ||
      !offer.engagementId ||
      !offer.employerId ||
      !offer.workforceModel ||
      !offer.termsVersion ||
      !offer.employerLegalName ||
      offer.slotCount < 1 ||
      offer.uncoveredSlotCount !== offer.slotCount
    ) {
      throw new PilotError(
        "This connected contract is missing a complete site, roster, employer or terms chain. Nothing was accepted.",
        409,
      );
    }
    const inductionId = `IND-${offer.bookingId.slice(3)}-${PILOT_OFFICER_ID}`;
    const auditId = eventId("AUD");
    const detail = `DEMO ONLY: position ${offer.positionIndex} was accepted across ${offer.slotCount} dated roster slots and its site induction, employer route and synthetic workforce snapshots were recorded together. ${offer.employerLegalName} / ${offer.workforceModel} / ${offer.termsVersion}. No production activation or payroll liability was created.`;
    try {
      await db.batch([
        db
          .prepare(
            `UPDATE offers SET status = 'accepted', responded_at = ?
          WHERE id = ? AND officer_id = ? AND status = 'open'
          AND EXISTS (SELECT 1 FROM bookings WHERE id = ? AND funding_status = 'paid_in_full'
            AND status IN ('offered', 'matching', 'partially_staffed')
            AND client_id = ? AND environment = 'demo' AND integrity_state = 'synthetic')
          AND ? = (SELECT COUNT(*) FROM roster_slots slot WHERE slot.booking_id = ?
            AND slot.position_index = ? AND slot.status = 'uncovered'
            AND slot.environment = 'demo' AND slot.integrity_state = 'synthetic')`,
          )
          .bind(
            now,
            payload.offerId,
            PILOT_OFFICER_ID,
            offer.bookingId,
            PILOT_CLIENT_ID,
            offer.slotCount,
            offer.bookingId,
            offer.positionIndex,
          ),
        db
          .prepare(
            `INSERT OR IGNORE INTO officer_site_inductions
          (id, officer_id, site_id, induction_version, status, environment, integrity_state,
           evidence_reference, completed_at, expires_at, version, active_key, created_at)
          SELECT ?, passport.officer_id, site.id, ?, 'completed', 'demo', 'synthetic', ?, ?, ?, 1,
           passport.officer_id || ':' || site.id, ?
          FROM officer_passports passport JOIN operational_sites site ON site.id = ?
          WHERE passport.officer_id = ? AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
           AND site.environment = 'demo' AND site.integrity_state = 'synthetic'`,
          )
          .bind(
            inductionId,
            `IND-${offer.siteId}-v1`,
            `demo:induction:${inductionId}`,
            now,
            new Date(
              new Date(offer.positionEndsAt).getTime() +
                90 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            now,
            offer.siteId,
            PILOT_OFFICER_ID,
          ),
        db
          .prepare(
            `INSERT INTO shifts
          (id, booking_id, officer_id, scheduled_date, environment, integrity_state, status, check_in_at, check_out_at,
           client_signoff_status, signed_off_at, earnings_cents)
          SELECT 'SH-' || slot.id, slot.booking_id, accepted.officer_id, slot.service_date,
            'demo', 'synthetic', 'confirmed', NULL, NULL, 'not_due', NULL, slot.officer_offer_cents
          FROM roster_slots slot JOIN offers accepted ON accepted.id = ?
            AND accepted.booking_id = slot.booking_id AND accepted.position_index = slot.position_index
          WHERE slot.booking_id = ? AND slot.position_index = ? AND slot.status = 'uncovered'
            AND slot.environment = 'demo' AND slot.integrity_state = 'synthetic'
            AND accepted.officer_id = ? AND accepted.status = 'accepted'`,
          )
          .bind(
            payload.offerId,
            offer.bookingId,
            offer.positionIndex,
            PILOT_OFFICER_ID,
          ),
        db
          .prepare(
            `INSERT INTO roster_assignments
          (id, roster_slot_id, officer_id, shift_id, assignment_kind, environment, integrity_state,
           status, active_key, assigned_by, assigned_at, confirmed_at, released_at, version)
          SELECT 'RA-' || slot.id, slot.id, shift.officer_id, shift.id, 'primary', 'demo', 'synthetic',
            'confirmed', slot.id, ?, ?, ?, NULL, 1
          FROM roster_slots slot JOIN shifts shift ON shift.id = 'SH-' || slot.id
          WHERE slot.booking_id = ? AND slot.position_index = ? AND slot.status = 'uncovered'
            AND slot.environment = 'demo' AND slot.integrity_state = 'synthetic'
            AND shift.booking_id = slot.booking_id AND shift.officer_id = ?
            AND shift.environment = 'demo' AND shift.integrity_state = 'synthetic'`,
          )
          .bind(
            actor.email,
            now,
            now,
            offer.bookingId,
            offer.positionIndex,
            PILOT_OFFICER_ID,
          ),
        db
          .prepare(
            `INSERT INTO assignment_workforce_snapshots
          (id, roster_assignment_id, workforce_engagement_id, officer_id, employer_id, workforce_model,
           employer_legal_name, terms_version, decision, blockers, environment, captured_at)
          SELECT 'AWS-' || slot.id, assignment.id, engagement.id, assignment.officer_id, employer.id, engagement.model,
           employer.legal_name, engagement.terms_version, 'synthetic_rehearsal',
           '["Production activation remains locked"]', 'demo', ?
          FROM roster_slots slot JOIN roster_assignments assignment ON assignment.id = 'RA-' || slot.id
          JOIN workforce_engagements engagement ON engagement.id = ? AND engagement.officer_id = assignment.officer_id
          JOIN workforce_employers employer ON employer.id = engagement.employer_id
          WHERE slot.booking_id = ? AND slot.position_index = ? AND slot.status = 'uncovered'
           AND slot.environment = 'demo' AND slot.integrity_state = 'synthetic'
           AND assignment.environment = 'demo' AND assignment.integrity_state = 'synthetic'
           AND engagement.environment = 'demo' AND employer.environment = 'demo'`,
          )
          .bind(now, offer.engagementId, offer.bookingId, offer.positionIndex),
        db
          .prepare(
            `UPDATE roster_slots SET status = 'scheduled', absence_reason = NULL,
          version = version + 1, updated_at = ? WHERE booking_id = ? AND position_index = ? AND status = 'uncovered'
          AND EXISTS (SELECT 1 FROM roster_assignments assignment WHERE assignment.id = 'RA-' || roster_slots.id
            AND assignment.roster_slot_id = roster_slots.id AND assignment.active_key = roster_slots.id
            AND assignment.status = 'confirmed' AND assignment.environment = 'demo'
            AND assignment.integrity_state = 'synthetic')
          AND environment = 'demo' AND integrity_state = 'synthetic'`,
          )
          .bind(now, offer.bookingId, offer.positionIndex),
        db
          .prepare(
            `UPDATE offers SET status = 'expired', responded_at = ? WHERE booking_id = ? AND id <> ?
          AND position_index = ? AND status = 'open'
          AND booking_id IN (SELECT id FROM bookings WHERE client_id = ?
            AND environment = 'demo' AND integrity_state = 'synthetic')
          AND EXISTS (SELECT 1 FROM offers winner WHERE winner.id = ? AND winner.booking_id = offers.booking_id
            AND winner.position_index = offers.position_index AND winner.status = 'accepted')`,
          )
          .bind(
            now,
            offer.bookingId,
            payload.offerId,
            offer.positionIndex,
            PILOT_CLIENT_ID,
            payload.offerId,
          ),
        db
          .prepare(
            `UPDATE bookings SET status = CASE
            WHEN EXISTS (SELECT 1 FROM roster_slots slot WHERE slot.booking_id = bookings.id
              AND slot.status = 'uncovered' AND slot.environment = 'demo' AND slot.integrity_state = 'synthetic')
            THEN 'partially_staffed' ELSE 'staffed' END
          WHERE id = ? AND client_id = ? AND funding_status = 'paid_in_full'
            AND environment = 'demo' AND integrity_state = 'synthetic'
            AND EXISTS (SELECT 1 FROM offers accepted WHERE accepted.id = ?
              AND accepted.booking_id = bookings.id AND accepted.status = 'accepted')`,
          )
          .bind(offer.bookingId, PILOT_CLIENT_ID, payload.offerId),
        db
          .prepare(
            `INSERT INTO audit_events
          (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
          VALUES (?, 'officer', ?, 'synthetic_offer_accepted', 'offer', ?,
            CASE WHEN
              (SELECT COUNT(*) FROM roster_slots slot WHERE slot.booking_id = ? AND slot.position_index = ?
                AND slot.status = 'scheduled' AND slot.environment = 'demo' AND slot.integrity_state = 'synthetic') = ?
              AND (SELECT COUNT(*) FROM roster_assignments assignment JOIN roster_slots slot
                ON slot.id = assignment.roster_slot_id WHERE slot.booking_id = ? AND slot.position_index = ?
                AND assignment.officer_id = ? AND assignment.status = 'confirmed'
                AND assignment.environment = 'demo' AND assignment.integrity_state = 'synthetic') = ?
              AND (SELECT COUNT(*) FROM assignment_workforce_snapshots snapshot JOIN roster_assignments assignment
                ON assignment.id = snapshot.roster_assignment_id JOIN roster_slots slot ON slot.id = assignment.roster_slot_id
                WHERE slot.booking_id = ? AND slot.position_index = ? AND snapshot.environment = 'demo') = ?
              AND NOT EXISTS (SELECT 1 FROM shifts shift JOIN roster_assignments assignment ON assignment.shift_id = shift.id
                JOIN roster_slots slot ON slot.id = assignment.roster_slot_id
                WHERE slot.booking_id = ? AND slot.position_index = ? AND shift.earnings_cents <> slot.officer_offer_cents)
              AND EXISTS (SELECT 1 FROM offers accepted WHERE accepted.id = ? AND accepted.status = 'accepted')
              THEN ? ELSE NULL END, ?)`,
          )
          .bind(
            auditId,
            actor.email,
            payload.offerId,
            offer.bookingId,
            offer.positionIndex,
            offer.slotCount,
            offer.bookingId,
            offer.positionIndex,
            PILOT_OFFICER_ID,
            offer.slotCount,
            offer.bookingId,
            offer.positionIndex,
            offer.slotCount,
            offer.bookingId,
            offer.positionIndex,
            payload.offerId,
            detail,
            now,
          ),
      ]);
    } catch {
      throw new PilotError(
        "This synthetic contract changed while it was being accepted. Nothing was created; refresh and try again.",
        409,
      );
    }
    return;
  }

  if (payload.action === "decline_offer") {
    const offer = await db
      .prepare(
        `SELECT offer.id, offer.booking_id AS bookingId, offer.position_index AS positionIndex
        FROM offers offer JOIN bookings booking ON booking.id = offer.booking_id
        WHERE offer.id = ? AND offer.officer_id = ? AND offer.status = 'open'
          AND offer.expires_at > ? AND booking.client_id = ?
          AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`,
      )
      .bind(payload.offerId, PILOT_OFFICER_ID, new Date().toISOString(), PILOT_CLIENT_ID)
      .first<{ id: string; bookingId: string; positionIndex: number }>();
    if (!offer)
      throw new PilotError("This offer is no longer open.", 409);
    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare(
          `UPDATE offers SET status = 'declined', responded_at = ?
          WHERE id = ? AND officer_id = ? AND status = 'open' AND expires_at > ?
            AND booking_id = ?`,
        )
        .bind(now, offer.id, PILOT_OFFICER_ID, now, offer.bookingId),
      db
        .prepare(
          `UPDATE bookings SET status = CASE
            WHEN EXISTS (SELECT 1 FROM offers accepted WHERE accepted.booking_id = bookings.id
              AND accepted.status = 'accepted') THEN 'partially_staffed' ELSE 'matching' END
          WHERE id = ? AND client_id = ? AND funding_status = 'paid_in_full'
            AND environment = 'demo' AND integrity_state = 'synthetic'
            AND EXISTS (SELECT 1 FROM offers declined WHERE declined.id = ?
              AND declined.booking_id = bookings.id AND declined.status = 'declined')`,
        )
        .bind(offer.bookingId, PILOT_CLIENT_ID, offer.id),
      db
        .prepare(
          `INSERT INTO audit_events
          (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
          VALUES (?, 'officer', ?, 'offer_declined', 'offer', ?,
            CASE WHEN EXISTS (SELECT 1 FROM offers WHERE id = ? AND status = 'declined')
              AND EXISTS (SELECT 1 FROM bookings WHERE id = ? AND status IN ('matching','partially_staffed'))
            THEN 'Officer declined the synthetic offer; no penalty was applied and the uncovered position returned to matching.'
            ELSE NULL END, ?)`,
        )
        .bind(eventId("AUD"), actor.email, offer.id, offer.id, offer.bookingId, now),
    ]);
    return;
  }

  if (payload.action === "update_service_preference") {
    const service = await db
      .prepare(
        `SELECT qualified FROM officer_services WHERE officer_id = ? AND service_type = ?`,
      )
      .bind(PILOT_OFFICER_ID, payload.serviceType)
      .first<{ qualified: number }>();
    if (!service)
      throw new PilotError("That service preference is unavailable.", 404);
    if (payload.optedIn && !service.qualified)
      throw new PilotError(
        "Qualification must be verified before this offer type can be enabled.",
        409,
      );
    const result = await db
      .prepare(
        `UPDATE officer_services SET opted_in = ?
      WHERE officer_id = ? AND service_type = ?
        AND ${PILOT_OFFICER_UPDATE_GUARD("officer_services.officer_id")}`,
      )
      .bind(payload.optedIn ? 1 : 0, PILOT_OFFICER_ID, payload.serviceType)
      .run();
    if (!result.meta.changes)
      throw new PilotError(
        "Demo preferences are locked once an officer has production workforce history.",
        423,
      );
    await recordAudit(
      db,
      "officer",
      actor.email,
      "offer_preference_changed",
      "officer",
      PILOT_OFFICER_ID,
      `${payload.serviceType} offer notifications switched ${payload.optedIn ? "on" : "off"}.`,
    );
    return;
  }

  if (payload.action === "update_flex_availability") {
    if (
      payload.available &&
      (!payload.externalWorkAcknowledged || !payload.restWindowConfirmed)
    ) {
      throw new PilotError(
        "Confirm both the external-work declaration and rest window before going available for Flex.",
        409,
      );
    }
    const result = await db
      .prepare(
        `UPDATE officers SET flex_available = ?, external_work_acknowledged = ?, rest_window_confirmed = ?
      WHERE id = ?
        AND ${PILOT_OFFICER_UPDATE_GUARD("officers.id")}`,
      )
      .bind(
        payload.available ? 1 : 0,
        payload.externalWorkAcknowledged ? 1 : 0,
        payload.restWindowConfirmed ? 1 : 0,
        PILOT_OFFICER_ID,
      )
      .run();
    if (!result.meta.changes)
      throw new PilotError(
        "Demo availability is locked once an officer has production workforce history.",
        423,
      );
    await recordAudit(
      db,
      "officer",
      actor.email,
      "flex_availability_changed",
      "officer",
      PILOT_OFFICER_ID,
      `Flex availability switched ${payload.available ? "on" : "off"}; external-work and rest declarations recorded.`,
    );
    return;
  }

  if (payload.action === "record_demo_arrival_check") {
    const shift = await db
      .prepare(
        `SELECT shift.id, shift.booking_id AS bookingId,
      shift.officer_id AS officerId, shift.scheduled_date AS scheduledDate,
      shift.status, shift.passport_verification_status AS passportVerificationStatus,
      passport.passport_number AS passportNumber
      FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
      JOIN officer_passports passport ON passport.officer_id = shift.officer_id
        AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
      WHERE shift.id = ? AND booking.client_id = ?
        AND shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`,
      )
      .bind(payload.shiftId, PILOT_CLIENT_ID)
      .first<{
        id: string;
        bookingId: string;
        officerId: string;
        scheduledDate: string;
        status: string;
        passportVerificationStatus: string;
        passportNumber: string;
      }>();
    if (!shift)
      throw new PilotError("This shift is not available to this client.", 404);
    if (shift.status !== "confirmed")
      throw new PilotError(
        "Arrival can only be rehearsed for a confirmed shift.",
        409,
      );
    if (shift.passportVerificationStatus === "green") return;
    const readiness = await evaluateBookingReadiness(
      db,
      shift.officerId,
      shift.bookingId,
      {
        assignmentDate: shift.scheduledDate,
      },
    );
    if (!readiness.eligible)
      throw new PilotError(
        `LOKD Passport gate: ${readiness.blockers.join(" ")}`,
        409,
      );
    const now = new Date().toISOString();
    const scanId = `SCAN-DEMO-${shift.id}`;
    await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO passport_scans
        (id, officer_id, passport_number, booking_id, shift_id, verification_mode, result, reason, created_at)
        SELECT ?, demo_shift.officer_id, ?, demo_shift.booking_id, demo_shift.id,
          'synthetic_client_arrival', 'green', 'DEMO ONLY: synthetic readiness and assignment match', ?
        FROM shifts demo_shift JOIN bookings booking ON booking.id = demo_shift.booking_id
        WHERE demo_shift.id = ? AND demo_shift.status = 'confirmed'
          AND demo_shift.environment = 'demo' AND demo_shift.integrity_state = 'synthetic'
          AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`,
        )
        .bind(scanId, shift.passportNumber, now, shift.id, PILOT_CLIENT_ID),
      db
        .prepare(
          `UPDATE shifts SET passport_verification_status = 'green', passport_verified_at = ?, passport_scan_id = ?
        WHERE id = ? AND status = 'confirmed' AND passport_verification_status = 'not_checked'
          AND environment = 'demo' AND integrity_state = 'synthetic'
          AND EXISTS (SELECT 1 FROM passport_scans scan WHERE scan.id = ? AND scan.shift_id = shifts.id
            AND scan.result = 'green' AND scan.verification_mode = 'synthetic_client_arrival')`,
        )
        .bind(now, scanId, shift.id, scanId),
      db
        .prepare(
          `INSERT INTO audit_events
        (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
        VALUES (?, 'client', ?, 'synthetic_arrival_verified', 'shift', ?,
          CASE WHEN EXISTS (SELECT 1 FROM shifts WHERE id = ? AND passport_verification_status = 'green'
            AND passport_scan_id = ? AND environment = 'demo' AND integrity_state = 'synthetic')
          THEN 'DEMO ONLY: the client rehearsed a booking-specific Passport arrival check. This is not identity proof, geolocation evidence or production authorisation.'
          ELSE NULL END, ?)`,
        )
        .bind(eventId("AUD"), actor.email, shift.id, shift.id, scanId, now),
    ]);
    return;
  }

  if (payload.action === "check_in") {
    const shift = await db
      .prepare(
        `SELECT shift.booking_id AS bookingId, shift.scheduled_date AS scheduledDate,
      shift.passport_verification_status AS passportVerificationStatus FROM shifts shift
      JOIN bookings booking ON booking.id = shift.booking_id
      WHERE shift.id = ? AND shift.officer_id = ?
        AND shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
        AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`,
      )
      .bind(payload.shiftId, PILOT_OFFICER_ID, PILOT_CLIENT_ID)
      .first<{
        bookingId: string;
        scheduledDate: string;
        passportVerificationStatus: string;
      }>();
    if (!shift)
      throw new PilotError(
        "This shift is not assigned to the pilot officer.",
        404,
      );
    const readiness = await evaluateBookingReadiness(
      db,
      PILOT_OFFICER_ID,
      shift.bookingId,
      {
        assignmentDate: shift.scheduledDate,
      },
    );
    if (!readiness.eligible)
      throw new PilotError(
        `LOKD Passport gate: ${readiness.blockers.join(" ")}`,
        409,
      );
    if (shift.passportVerificationStatus !== "green")
      throw new PilotError(
        "Ask the client to scan your booking QR before check-in.",
        409,
      );
    const result = await db
      .prepare(
        `UPDATE shifts SET status = 'on_post', check_in_at = ?
      WHERE id = ? AND officer_id = ? AND status = 'confirmed'
        AND environment = 'demo' AND integrity_state = 'synthetic'
        AND booking_id IN (SELECT id FROM bookings WHERE client_id = ?
          AND environment = 'demo' AND integrity_state = 'synthetic')`,
      )
      .bind(
        new Date().toISOString(),
        payload.shiftId,
        PILOT_OFFICER_ID,
        PILOT_CLIENT_ID,
      )
      .run();
    if (!result.meta.changes)
      throw new PilotError(
        "This shift cannot be checked in from its current state.",
        409,
      );
    await recordAudit(
      db,
      "officer",
      actor.email,
      "shift_checked_in",
      "shift",
      payload.shiftId,
      "Officer check-in recorded using server time. Location verification remains a production integration.",
    );
    return;
  }

  if (payload.action === "complete_shift") {
    const shift = await db
      .prepare(
        `SELECT s.id, s.earnings_cents AS earningsCents, b.release_cadence AS releaseCadence
      FROM shifts s JOIN bookings b ON b.id = s.booking_id
      WHERE s.id = ? AND s.officer_id = ? AND s.status = 'on_post'
        AND s.environment = 'demo' AND s.integrity_state = 'synthetic'
        AND b.client_id = ? AND b.environment = 'demo' AND b.integrity_state = 'synthetic'`,
      )
      .bind(payload.shiftId, PILOT_OFFICER_ID, PILOT_CLIENT_ID)
      .first<{
        id: string;
        earningsCents: number;
        releaseCadence: "Weekly" | "Monthly";
      }>();
    if (!shift)
      throw new PilotError(
        "This shift cannot be completed from its current state.",
        409,
      );
    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare(
          `UPDATE shifts SET status = 'completed', check_out_at = ?, client_signoff_status = 'pending'
        WHERE id = ? AND environment = 'demo' AND integrity_state = 'synthetic'
          AND booking_id IN (SELECT id FROM bookings WHERE client_id = ?
            AND environment = 'demo' AND integrity_state = 'synthetic')`,
        )
        .bind(now, payload.shiftId, PILOT_CLIENT_ID),
      db
        .prepare(
          `INSERT OR IGNORE INTO shift_timesheets
        (id, shift_id, booking_id, roster_assignment_id, activation_snapshot_id, officer_id,
         workforce_engagement_id, employer_id, workforce_model, service_date,
         scheduled_starts_at, scheduled_ends_at, check_in_at, check_out_at,
         scheduled_minutes, recorded_minutes, payable_minutes, gross_wage_cents,
         calendar_category, policy_version, client_evidence_status, operations_status,
         evidence_reference, evidence_hash, exception_reason, supersedes_id, active_key,
         approved_by, approved_at, submitted_at, locked_at, environment, integrity_state,
         version, created_at, updated_at)
        SELECT 'TS-' || demo_shift.id, demo_shift.id, demo_shift.booking_id, assignment.id,
         activation.id, demo_shift.officer_id, workforce.workforce_engagement_id,
         workforce.employer_id, workforce.workforce_model, slot.service_date,
         slot.starts_at, slot.ends_at, demo_shift.check_in_at, demo_shift.check_out_at,
         CAST((unixepoch(slot.ends_at) - unixepoch(slot.starts_at)) / 60 AS INTEGER),
         CAST((unixepoch(slot.ends_at) - unixepoch(slot.starts_at)) / 60 AS INTEGER),
         NULL, demo_shift.earnings_cents, slot.calendar_category, 'LOKD-DEMO-TIMESHEET-v1',
         'pending', 'awaiting_review', 'demo:scheduled-service:' || demo_shift.id,
         NULL, 'synthetic_rehearsal_uses_scheduled_minutes', NULL, demo_shift.id,
         NULL, NULL, ?, NULL, 'demo', 'synthetic', 1, ?, ?
        FROM shifts demo_shift
        JOIN roster_assignments assignment ON assignment.shift_id = demo_shift.id
          AND assignment.officer_id = demo_shift.officer_id AND assignment.status = 'confirmed'
          AND assignment.environment = 'demo' AND assignment.integrity_state = 'synthetic'
        JOIN roster_slots slot ON slot.id = assignment.roster_slot_id
          AND slot.booking_id = demo_shift.booking_id AND slot.environment = 'demo'
          AND slot.integrity_state = 'synthetic'
        JOIN assignment_workforce_snapshots workforce ON workforce.roster_assignment_id = assignment.id
          AND workforce.officer_id = demo_shift.officer_id AND workforce.environment = 'demo'
        LEFT JOIN assignment_activation_snapshots activation
          ON activation.roster_assignment_id = assignment.id AND activation.environment = 'demo'
          AND activation.integrity_state = 'synthetic'
        JOIN bookings booking ON booking.id = demo_shift.booking_id AND booking.client_id = ?
          AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
        WHERE demo_shift.id = ? AND demo_shift.status = 'completed'
          AND demo_shift.environment = 'demo' AND demo_shift.integrity_state = 'synthetic'`,
        )
        .bind(now, now, now, PILOT_CLIENT_ID, payload.shiftId),
      db
        .prepare(
          `INSERT OR IGNORE INTO ledger_entries
        (id, officer_id, shift_id, amount_cents, state, release_cadence, eligible_release_at, created_at, updated_at)
        SELECT ?, demo_shift.officer_id, demo_shift.id, demo_shift.earnings_cents, 'pending_signoff', booking.release_cadence,
          NULL, ?, ? FROM shifts demo_shift JOIN bookings booking ON booking.id = demo_shift.booking_id
        WHERE demo_shift.id = ? AND demo_shift.officer_id = ? AND demo_shift.status = 'completed'
          AND demo_shift.environment = 'demo' AND demo_shift.integrity_state = 'synthetic'
          AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`,
        )
        .bind(
          `LE-${payload.shiftId.slice(3)}`,
          now,
          now,
          payload.shiftId,
          PILOT_OFFICER_ID,
          PILOT_CLIENT_ID,
        ),
    ]);
    await recordAudit(
      db,
      "officer",
      actor.email,
      "shift_completed",
      "shift",
      payload.shiftId,
      "Officer completed the shift; a canonical synthetic timesheet is awaiting client evidence and Operations review.",
    );
    return;
  }

  if (payload.action === "report_issue") {
    const shift = await db
      .prepare(
        `SELECT s.id, os.id AS siteId FROM shifts s
      JOIN bookings booking ON booking.id = s.booking_id
      LEFT JOIN operational_sites os ON os.booking_id = s.booking_id
        AND os.environment = 'demo' AND os.integrity_state = 'synthetic'
      WHERE s.id = ? AND s.officer_id = ? AND s.environment = 'demo' AND s.integrity_state = 'synthetic'
        AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`,
      )
      .bind(payload.shiftId, PILOT_OFFICER_ID, PILOT_CLIENT_ID)
      .first<{ id: string; siteId: string | null }>();
    if (!shift)
      throw new PilotError(
        "This issue is not linked to one of your shifts.",
        404,
      );
    const category = payload.category.trim().slice(0, 80);
    if (!category) throw new PilotError("Choose an issue category.", 400);
    if (!shift.siteId) {
      await recordAudit(
        db,
        "officer",
        actor.email,
        "shift_issue_reported",
        "shift",
        payload.shiftId,
        `${category} reported from the officer app. Operations follow-up required.`,
      );
      return;
    }
    const now = new Date();
    const incidentId = eventId("INC-RPT");
    const incidentDetail =
      "Officer raised an operational issue from the assigned shift. Operations must triage the case before any further conclusion.";
    await db.batch([
      db
        .prepare(
          `INSERT INTO site_incidents
        (id, site_id, shift_id, severity, category, summary, detail, status, visibility, reported_by_type, reported_by_id,
         occurred_at, reported_at, owner_id, sla_due_at, acknowledged_at, acknowledged_by, resolved_at, resolved_by,
         resolution_note, client_notified_at, retention_review_at, version)
        VALUES (?, ?, ?, 'medium', ?, ?, ?, 'open', 'operations', 'officer', ?, ?, ?, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, 1)`,
        )
        .bind(
          incidentId,
          shift.siteId,
          payload.shiftId,
          category
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .slice(0, 48),
          category,
          incidentDetail,
          actor.email,
          now.toISOString(),
          now.toISOString(),
          new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
          new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        ),
      db
        .prepare(
          `INSERT INTO incident_events (id, incident_id, event_type, actor_type, actor_id, detail, created_at)
        VALUES (?, ?, 'case_opened', 'officer', ?, ?, ?)`,
        )
        .bind(
          eventId("IE"),
          incidentId,
          actor.email,
          `${category} reported from the officer app.`,
          now.toISOString(),
        ),
      db
        .prepare(
          `INSERT INTO audit_events
        (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
        VALUES (?, 'officer', ?, 'incident_reported', 'incident', ?, 'Officer report created an Operations incident case.', ?)`,
        )
        .bind(eventId("AUD"), actor.email, incidentId, now.toISOString()),
    ]);
    return;
  }

  if (payload.action === "client_signoff") {
    const shift = await db
      .prepare(
        `SELECT s.id, s.client_signoff_status AS signoffStatus,
      b.release_cadence AS releaseCadence FROM shifts s JOIN bookings b ON b.id = s.booking_id
      WHERE s.id = ? AND b.client_id = ?
        AND s.environment = 'demo' AND s.integrity_state = 'synthetic'
        AND b.environment = 'demo' AND b.integrity_state = 'synthetic'`,
      )
      .bind(payload.shiftId, PILOT_CLIENT_ID)
      .first<{
        id: string;
        signoffStatus: string;
        releaseCadence: "Weekly" | "Monthly";
      }>();
    if (!shift)
      throw new PilotError("This shift is not available to this client.", 404);
    if (shift.signoffStatus !== "pending")
      throw new PilotError("This shift has already been reviewed.", 409);
    const now = new Date().toISOString();
    const releaseAt = nextReleaseAt(shift.releaseCadence);
    await db.batch([
      db
        .prepare(
          `UPDATE shifts SET status = 'verified', client_signoff_status = 'approved', signed_off_at = ?
        WHERE id = ? AND environment = 'demo' AND integrity_state = 'synthetic'
          AND booking_id IN (SELECT id FROM bookings WHERE client_id = ?
            AND environment = 'demo' AND integrity_state = 'synthetic')`,
        )
        .bind(now, payload.shiftId, PILOT_CLIENT_ID),
      db
        .prepare(
          `UPDATE shift_timesheets SET client_evidence_status = 'confirmed',
        evidence_reference = 'demo:client-signoff:' || shift_id, updated_at = ?, version = version + 1
        WHERE shift_id = ? AND active_key = shift_id AND client_evidence_status = 'pending'
          AND operations_status = 'awaiting_review' AND environment = 'demo'
          AND integrity_state = 'synthetic'
          AND EXISTS (SELECT 1 FROM shifts demo_shift JOIN bookings booking
            ON booking.id = demo_shift.booking_id WHERE demo_shift.id = shift_timesheets.shift_id
              AND demo_shift.status = 'verified' AND demo_shift.client_signoff_status = 'approved'
              AND demo_shift.environment = 'demo' AND demo_shift.integrity_state = 'synthetic'
              AND booking.client_id = ? AND booking.environment = 'demo'
              AND booking.integrity_state = 'synthetic')`,
        )
        .bind(now, payload.shiftId, PILOT_CLIENT_ID),
      db
        .prepare(
          `UPDATE ledger_entries SET state = 'pending_release', eligible_release_at = ?, updated_at = ?
        WHERE shift_id = ? AND state = 'pending_signoff'
          AND shift_id IN (SELECT demo_shift.id FROM shifts demo_shift JOIN bookings booking ON booking.id = demo_shift.booking_id
            WHERE demo_shift.environment = 'demo' AND demo_shift.integrity_state = 'synthetic'
              AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic')`,
        )
        .bind(releaseAt, now, payload.shiftId, PILOT_CLIENT_ID),
    ]);
    await recordAudit(
      db,
      "client",
      actor.email,
      "shift_signed_off",
      "shift",
      payload.shiftId,
      `Client verified the completed shift; its timesheet is ready for Operations approval before the ${shift.releaseCadence.toLowerCase()} backend handoff.`,
    );
    return;
  }

  if (payload.action === "release_earnings") {
    const now = new Date().toISOString();
    const result = await db
      .prepare(
        `UPDATE ledger_entries SET state = 'available', updated_at = ?
      WHERE state = 'pending_release' AND eligible_release_at IS NOT NULL AND eligible_release_at <= ?
        AND shift_id IN (SELECT shift.id FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
          WHERE shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
            AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic')`,
      )
      .bind(now, now, PILOT_CLIENT_ID)
      .run();
    if (!result.meta.changes)
      throw new PilotError(
        "No verified earnings are due for release yet.",
        409,
      );
    await recordAudit(
      db,
      "operations",
      actor.email,
      "earnings_released",
      "ledger",
      "release-batch",
      `${result.meta.changes} verified earning entr${result.meta.changes === 1 ? "y" : "ies"} moved to Available.`,
    );
    return;
  }

  if (payload.action === "request_payout") {
    const available = await db
      .prepare(
        `SELECT COALESCE(SUM(amount_cents), 0) AS amountCents
      FROM ledger_entries WHERE officer_id = ? AND state = 'available'
        AND shift_id IN (SELECT shift.id FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
          WHERE shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
            AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic')`,
      )
      .bind(PILOT_OFFICER_ID, PILOT_CLIENT_ID)
      .first<{ amountCents: number }>();
    const amountCents = Number(available?.amountCents ?? 0);
    if (!amountCents)
      throw new PilotError(
        "There are no Available earnings ready for payout.",
        409,
      );
    const schedule = nextThursdayAndFriday();
    const requestId = eventId("PAY-DEMO");
    await db.batch([
      db
        .prepare(
          `UPDATE ledger_entries SET state = 'withdrawal_queued', updated_at = ?
        WHERE officer_id = ? AND state = 'available'
          AND shift_id IN (SELECT shift.id FROM shifts shift JOIN bookings booking ON booking.id = shift.booking_id
            WHERE shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
              AND booking.client_id = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic')`,
        )
        .bind(new Date().toISOString(), PILOT_OFFICER_ID, PILOT_CLIENT_ID),
      db
        .prepare(
          `INSERT INTO payout_requests
        (id, officer_id, amount_cents, status, requested_at, expected_settlement_date)
        VALUES (?, ?, ?, 'queued_for_thursday', ?, ?)`,
        )
        .bind(
          requestId,
          PILOT_OFFICER_ID,
          amountCents,
          new Date().toISOString(),
          schedule.friday,
        ),
    ]);
    await recordAudit(
      db,
      "officer",
      actor.email,
      "payout_requested",
      "payout_request",
      requestId,
      `Payout request queued for Thursday processing with expected Friday clearance.`,
    );
    return;
  }

  throw new PilotError("Unknown pilot action.", 400);
}

function stateForScope(state: PilotState, scope: PilotScope): PilotState {
  if (scope === "operations") return state;
  const emptyMoney = {
    pendingCents: 0,
    availableCents: 0,
    withdrawalQueuedCents: 0,
    calculatedNetCents: 0,
    paidCents: 0,
    totalTrackedCents: 0,
  };
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
        pricingInternal: undefined,
        pricingBreakdown: {
          ...booking.pricingBreakdown,
          baseClientCents: booking.clientPriceCents,
          calendarPremiumCents: 0,
          dispatchPremiumCents: 0,
          riskPremiumCents: 0,
          marginFloorAdjustmentCents:
            booking.pricingBreakdown.marginFloorAdjustmentCents,
          subtotalCents: booking.subtotalCents,
          vatCents: booking.vatCents,
          payrollBurdenCents: 0,
          readinessAndEquipmentCents: 0,
          commandAndSupervisionCents: 0,
          planningCents: 0,
          travelCents: 0,
          vehicleAndPartnerCents: 0,
          overnightCents: 0,
        },
      })),
      shifts: state.shifts
        .filter((shift) => bookingIds.has(shift.bookingId))
        .map((shift) => ({ ...shift, earningsCents: 0 })),
      ledger: [],
      payrollStatements: [],
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
    bookings: state.bookings
      .filter((booking) => relatedBookings.has(booking.id))
      .map((booking) => ({
        ...booking,
        clientPriceCents: 0,
        officerTotalCents: 0,
        grossPlatformContributionCents: 0,
        pricingInternal: undefined,
        pricingBreakdown: {
          baseClientCents: 0,
          calendarPremiumCents: 0,
          dispatchPremiumCents: 0,
          riskPremiumCents: 0,
          marginFloorAdjustmentCents: 0,
          subtotalCents: 0,
          vatCents: 0,
          payrollBurdenCents: 0,
          readinessAndEquipmentCents: 0,
          commandAndSupervisionCents: 0,
          planningCents: 0,
          travelCents: 0,
          vehicleAndPartnerCents: 0,
          overnightCents: 0,
        },
      })),
    audit: [],
  };
}

function requireScopedPilotEntity(
  principal: PilotPrincipal,
  scope: PilotScope,
) {
  if (principal.owner || scope === "operations") return;
  if (scope === "client" && principal.clientId === PILOT_CLIENT_ID) return;
  if (scope === "officer" && principal.officerId === PILOT_OFFICER_ID) return;
  throw new PilotAccessError(
    "This account is not assigned to the requested pilot record.",
    403,
  );
}

function scopeFromRequest(request: Request): PilotScope {
  const scope = new URL(request.url).searchParams.get("scope");
  if (scope === "operations" || scope === "client" || scope === "officer")
    return scope;
  throw new PilotAccessError("Choose a valid LOKD workspace.", 400);
}

function response(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      vary: "x-lokd-verified-email",
    },
  });
}

function errorResponse(cause: unknown) {
  const error =
    cause instanceof PilotError || cause instanceof RequestBodyError || cause instanceof PilotAccessError
      ? cause
      : new PilotError(
          "The LOKD workspace could not complete that request.",
          500,
        );
  return response({ error: error.message }, error.status);
}

function requireDemoTransactionModel() {
  if (pilotStage() !== "demo") {
    throw new PilotAccessError(
      "The transaction simulator is disabled outside the isolated demo environment.",
      423,
    );
  }
}

export async function GET(request: Request) {
 const blockedTest = await blockedTestSurface(request); if (blockedTest) return blockedTest;

  try {
    const scope = scopeFromRequest(request);
    const viewer = requirePilotApiRole(request, scope);
    requireScopedPilotEntity(viewer, scope);
    requireDemoTransactionModel();
    const db = getPilotDb();
    await ensurePilotData(db);
    await ensureOperationsDemoData(db);
    const url = new URL(request.url);
    if (url.searchParams.get("download") === "payroll-calculation" || url.searchParams.get("download") === "shadow-payslip") {
      if (scope !== "officer")
        throw new PilotAccessError("Payroll calculations are available only in the officer workspace.", 403);
      const statementId = url.searchParams.get("id")?.trim() ?? "";
      if (!/^PI-[A-Z0-9-]{1,100}$/.test(statementId))
        throw new PilotAccessError("Choose a valid payroll calculation.", 400);
      const officerId = viewer.officerId ?? PILOT_OFFICER_ID;
      if (!viewer.owner && officerId !== PILOT_OFFICER_ID)
        throw new PilotAccessError("This payroll calculation is not assigned to your account.", 403);
      const statement = (await readOfficerPayrollStatements(db, officerId))
        .find((item) => item.id === statementId);
      if (!statement)
        throw new PilotAccessError("That payroll calculation is not available.", 404);
      const shadowPayslip = url.searchParams.get("download") === "shadow-payslip";
      let bytes: Uint8Array;
      try {
        bytes = shadowPayslip ? renderShadowPayslipPdf(statement) : renderPayrollCalculationPdf(statement);
      } catch (cause) {
        throw new PilotAccessError(cause instanceof Error ? cause.message : "That payroll preview is unavailable.", 409);
      }
      return new Response(new Uint8Array(bytes), {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="LOKD-${shadowPayslip ? "shadow-payslip" : "pay-calculation"}-${statement.id}.pdf"`,
          "cache-control": "no-store, private",
          "x-content-type-options": "nosniff",
          "referrer-policy": "no-referrer",
          vary: "x-lokd-verified-email",
        },
      });
    }
    return response({ state: stateForScope(await readPilotState(db), scope) });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function POST(request: Request) {
 const blockedTest = await blockedTestSurface(request); if (blockedTest) return blockedTest;

  try {
    requireSameOriginJson(request);
    const scope = scopeFromRequest(request);
    const viewer = requirePilotApiRole(request, scope);
    requireScopedPilotEntity(viewer, scope);
    const raw = await readRequestText(request, 32_768);
    let payload: PilotAction;
    try {
      payload = JSON.parse(raw) as PilotAction;
    } catch {
      throw new PilotError("The request body is not valid JSON.", 400);
    }
    if (
      !payload ||
      typeof payload !== "object" ||
      typeof payload.action !== "string"
    )
      throw new PilotError("Choose a valid pilot action.", 400);
    const actionRole = roleForPilotAction(payload.action);
    const actor = requirePilotApiRole(request, actionRole);
    if (actionRole === "client" || actionRole === "officer")
      requireScopedPilotEntity(actor, actionRole);
    requireDemoTransactionModel();
    const db = getPilotDb();
    await ensurePilotData(db);
    await ensureOperationsDemoData(db);
    await applyAction(db, payload, actor);
    return response({ state: stateForScope(await readPilotState(db), scope) });
  } catch (cause) {
    return errorResponse(cause);
  }
}
