import { env } from "cloudflare:workers";
import type { PilotAction, PilotState, ServiceType } from "../../lib/pilot-types";
import { defaultRiskInput, PRICE_BOOK_VERSION, purposePriceBook, quoteBooking, rosterPatterns, servicePriceBook } from "../../lib/pilot-pricing";
import { evaluateBookingReadiness, PILOT_PASSPORT_NUMBER, PILOT_PASSPORT_TOKEN, readEndorsements, tokenHash } from "../../lib/passport-server";

export const dynamic = "force-dynamic";

const PILOT_OFFICER_ID = "OFF-001";
const PILOT_CLIENT_ID = "CL-001";

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

async function ensurePilotData(db: D1Database) {
  const passportHash = await tokenHash(PILOT_PASSPORT_TOKEN);
  const primaryQuote = quoteBooking({ serviceType: "Unarmed", engagementModel: "fixed", term: "1", purposeCode: "commercial_access", startDate: "2026-08-01", shift: "day", rosterPattern: "monday_saturday", riskInput: defaultRiskInput });
  const depotQuote = quoteBooking({ serviceType: "Unarmed", engagementModel: "fixed", term: "1", purposeCode: "construction", startDate: "2026-08-22", shift: "day", rosterPattern: "monday_saturday", riskInput: defaultRiskInput });
  const vipQuote = quoteBooking({ serviceType: "VIP", engagementModel: "fixed", term: "6", purposeCode: "executive_protection", startDate: "2026-03-01", shift: "day", rosterPattern: "weekdays", riskInput: defaultRiskInput });
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO officers
      (id, full_name, mobile, email, city, psira_number, psira_grade, psira_expiry, approval_status, banking_status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(PILOT_OFFICER_ID, "Lerato Khumalo", "+27 82 555 0184", "lerato@example.co.za", "Johannesburg North", "PSIRA-1842", "Grade B", "2027-05-31", "approved", "verified", "2026-08-01T08:00:00.000Z"),
    db.prepare(`INSERT OR IGNORE INTO officer_passports
      (officer_id, passport_number, public_token_hash, status, readiness_label, issued_at, last_reviewed_at, next_review_at, updated_at)
      VALUES (?, ?, ?, 'active', 'LOKD Ready', ?, ?, ?, ?)`)
      .bind(PILOT_OFFICER_ID, PILOT_PASSPORT_NUMBER, passportHash, "2026-08-05T09:00:00.000Z", "2026-08-15T09:00:00.000Z", "2026-09-15", "2026-08-15T09:00:00.000Z"),
    db.prepare(`INSERT OR IGNORE INTO officer_services
      (officer_id, service_type, qualified, opted_in, qualification_expiry)
      VALUES (?, ?, ?, ?, ?)`)
      .bind(PILOT_OFFICER_ID, "Unarmed", 1, 1, null),
    db.prepare(`INSERT OR IGNORE INTO officer_services
      (officer_id, service_type, qualified, opted_in, qualification_expiry)
      VALUES (?, ?, ?, ?, ?)`)
      .bind(PILOT_OFFICER_ID, "Armed", 1, 0, "2028-02-10"),
    db.prepare(`INSERT OR IGNORE INTO officer_services
      (officer_id, service_type, qualified, opted_in, qualification_expiry)
      VALUES (?, ?, ?, ?, ?)`)
      .bind(PILOT_OFFICER_ID, "VIP", 0, 0, null),
    db.prepare(`INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, assessed_at, expires_at, next_due_at, assessor, client_visible)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'current', ?, ?, ?, ?, 1)`)
      .bind("END-CORE-001", PILOT_OFFICER_ID, "core_ready", "Core LOKD Ready", "core", null, null, "2026-08-15T09:00:00.000Z", "2026-09-15", "2026-09-15", "LOKD Academy"),
    db.prepare(`INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, assessed_at, expires_at, next_due_at, assessor, client_visible)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'current', ?, ?, ?, ?, 1)`)
      .bind("END-UNA-001", PILOT_OFFICER_ID, "service_unarmed", "Unarmed Security Professional", "service", "Unarmed", null, "2026-08-12T09:00:00.000Z", "2026-11-30", "2026-09-12", "LOKD Academy"),
    db.prepare(`INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, assessed_at, expires_at, next_due_at, assessor, client_visible)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'current', ?, ?, ?, ?, 1)`)
      .bind("END-ARM-001", PILOT_OFFICER_ID, "service_armed", "Armed monthly readiness", "service", "Armed", null, "2026-08-05T09:00:00.000Z", "2026-09-05", "2026-09-05", "LOKD Academy"),
    db.prepare(`INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, assessed_at, expires_at, next_due_at, assessor, client_visible)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'current', ?, ?, ?, ?, 1)`)
      .bind("END-VIP-001", PILOT_OFFICER_ID, "service_vip", "Protective Operations specialist", "service", "VIP", null, "2026-08-08T09:00:00.000Z", "2026-11-30", "2026-09-08", "LOKD Academy"),
    db.prepare(`INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, assessed_at, expires_at, next_due_at, assessor, client_visible)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'current', ?, ?, ?, ?, 1)`)
      .bind("END-COM-001", PILOT_OFFICER_ID, "purpose_commercial_access", "Commercial access", "purpose", null, "commercial_access", "2026-08-10T09:00:00.000Z", "2026-12-31", "2026-12-01", "LOKD Academy"),
    db.prepare(`INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, assessed_at, expires_at, next_due_at, assessor, client_visible)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'current', ?, ?, ?, ?, 1)`)
      .bind("END-CON-001", PILOT_OFFICER_ID, "purpose_construction", "Construction sites", "purpose", null, "construction", "2026-08-10T10:00:00.000Z", "2026-12-31", "2026-12-01", "LOKD Academy"),
    db.prepare(`INSERT OR IGNORE INTO officer_endorsements
      (id, officer_id, code, label, category, service_type, purpose_code, status, assessed_at, expires_at, next_due_at, assessor, client_visible)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'current', ?, ?, ?, ?, 1)`)
      .bind("END-EXE-001", PILOT_OFFICER_ID, "purpose_executive_protection", "Executive protection", "purpose", null, "executive_protection", "2026-08-08T10:00:00.000Z", "2026-11-30", "2026-09-08", "LOKD Academy"),
    db.prepare(`INSERT OR IGNORE INTO compliance_records
      (id, officer_id, record_type, status, verified_at, expires_at, next_due_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind("CMP-PSIRA-001", PILOT_OFFICER_ID, "PSiRA registration", "current", "2026-08-02T09:00:00.000Z", "2027-05-31", null),
    db.prepare(`INSERT OR IGNORE INTO compliance_records
      (id, officer_id, record_type, status, verified_at, expires_at, next_due_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind("CMP-FIREARM-001", PILOT_OFFICER_ID, "Firearm competency", "current", "2026-08-02T09:15:00.000Z", "2028-02-10", null),
    db.prepare(`INSERT OR IGNORE INTO compliance_records
      (id, officer_id, record_type, status, verified_at, expires_at, next_due_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind("CMP-REG21-001", PILOT_OFFICER_ID, "Regulation 21 record", "current", "2025-11-14T10:00:00.000Z", null, "2026-11-14"),
    db.prepare(`INSERT OR IGNORE INTO clients
      (id, organisation_name, contact_name, contact_email, approval_status)
      VALUES (?, ?, ?, ?, ?)`)
      .bind(PILOT_CLIENT_ID, "Northbridge Property Services", "Nadia Jacobs", "nadia@northbridge.example", "approved"),
    db.prepare(`INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date, shift_start, shift_end, client_price_cents, officer_rate_cents, funding_status, release_cadence, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind("BK-2081", PILOT_CLIENT_ID, "Northbridge Rosebank Offices", "Rosebank", "Main access", "Unarmed", "Grade C", 1, "2026-08-01", "2026-08-31", "06:00", "18:00", primaryQuote.clientPriceCents, primaryQuote.officerRateCents, "paid_in_full", "Weekly", "active"),
    db.prepare(`INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date, shift_start, shift_end, client_price_cents, officer_rate_cents, funding_status, release_cadence, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind("BK-2080", PILOT_CLIENT_ID, "Northbridge Rosebank Offices", "Rosebank", "Main access", "Unarmed", "Grade C", 1, "2026-08-01", "2026-08-31", "06:00", "18:00", primaryQuote.clientPriceCents, primaryQuote.officerRateCents, "paid_in_full", "Weekly", "active"),
    db.prepare(`INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date, shift_start, shift_end, client_price_cents, officer_rate_cents, funding_status, release_cadence, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind("BK-2084", PILOT_CLIENT_ID, "Metsi Midrand Depot", "Midrand", "Contractor access", "Unarmed", "Grade C", 1, "2026-08-22", "2026-09-21", "06:00", "18:00", depotQuote.clientPriceCents, depotQuote.officerRateCents, "paid_in_full", "Weekly", "offered"),
    db.prepare(`INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date, shift_start, shift_end, client_price_cents, officer_rate_cents, funding_status, release_cadence, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind("BK-2078", PILOT_CLIENT_ID, "Sandton Executive Centre", "Sandton", "Executive reception", "VIP", "Grade B", 6, "2026-03-01", "2026-08-31", "08:00", "20:00", vipQuote.clientPriceCents, vipQuote.officerRateCents, "paid_in_full", "Monthly", "active"),
    db.prepare(`INSERT OR IGNORE INTO offers
      (id, booking_id, officer_id, amount_cents, status, expires_at, responded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind("OF-2084", "BK-2084", PILOT_OFFICER_ID, depotQuote.officerRateCents, "open", "2026-08-21T18:00:00.000Z", null),
    db.prepare(`INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, status, check_in_at, check_out_at, client_signoff_status, signed_off_at, earnings_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind("SH-2081", "BK-2081", PILOT_OFFICER_ID, "2026-08-21", "on_post", "2026-08-21T03:54:00.000Z", null, "not_due", null, 80000),
    db.prepare(`INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, status, check_in_at, check_out_at, client_signoff_status, signed_off_at, earnings_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind("SH-2080", "BK-2080", PILOT_OFFICER_ID, "2026-08-18", "completed", "2026-08-18T03:55:00.000Z", "2026-08-18T16:03:00.000Z", "pending", null, 80000),
    db.prepare(`INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, status, check_in_at, check_out_at, client_signoff_status, signed_off_at, earnings_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind("SH-2077", "BK-2081", PILOT_OFFICER_ID, "2026-08-14", "verified", "2026-08-14T03:53:00.000Z", "2026-08-14T16:01:00.000Z", "approved", "2026-08-14T16:15:00.000Z", 80000),
    db.prepare(`INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, status, check_in_at, check_out_at, client_signoff_status, signed_off_at, earnings_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind("SH-2078", "BK-2078", PILOT_OFFICER_ID, "2026-07-31", "verified", "2026-07-31T05:56:00.000Z", "2026-07-31T18:04:00.000Z", "approved", "2026-07-31T18:20:00.000Z", 450000),
    db.prepare(`INSERT OR IGNORE INTO ledger_entries
      (id, officer_id, shift_id, amount_cents, state, release_cadence, eligible_release_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind("LE-2077", PILOT_OFFICER_ID, "SH-2077", 80000, "available", "Weekly", "2026-08-15T08:00:00.000Z", "2026-08-14T16:15:00.000Z", "2026-08-15T08:00:00.000Z"),
    db.prepare(`INSERT OR IGNORE INTO ledger_entries
      (id, officer_id, shift_id, amount_cents, state, release_cadence, eligible_release_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind("LE-2080", PILOT_OFFICER_ID, "SH-2080", 80000, "pending_signoff", "Weekly", null, "2026-08-18T16:03:00.000Z", "2026-08-18T16:03:00.000Z"),
    db.prepare(`INSERT OR IGNORE INTO ledger_entries
      (id, officer_id, shift_id, amount_cents, state, release_cadence, eligible_release_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind("LE-2078", PILOT_OFFICER_ID, "SH-2078", 450000, "pending_release", "Monthly", "2026-08-20T08:00:00.000Z", "2026-07-31T18:20:00.000Z", "2026-07-31T18:20:00.000Z"),
    db.prepare(`INSERT OR IGNORE INTO audit_events
      (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind("AUD-001", "system", "LOKD", "pilot_seeded", "officer", PILOT_OFFICER_ID, "Verified pilot profile and funded contracts loaded.", "2026-08-21T08:00:00.000Z"),
    db.prepare(`UPDATE officers SET flex_available = 1, external_work_acknowledged = 1, rest_window_confirmed = 1 WHERE id = ?`).bind(PILOT_OFFICER_ID),
    db.prepare(`UPDATE bookings SET purpose_code = 'commercial_access', purpose_label = 'Commercial access',
      engagement_model = 'fixed', notice_window = 'standard', roster_pattern = 'monday_saturday',
      calendar_category = ?, calendar_label = ?, risk_band = ?, risk_score = ?, risk_reasons = ?, required_endorsements = ?,
      manual_review = ?, shift_count = ?, client_price_cents = ?, officer_rate_cents = ?, officer_total_cents = ?,
      gross_platform_contribution_cents = ?, pricing_version = ?, pricing_breakdown = ?
      WHERE id IN ('BK-2081', 'BK-2080')`).bind(
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
      gross_platform_contribution_cents = ?, pricing_version = ?, pricing_breakdown = ? WHERE id = 'BK-2084'`).bind(
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
    db.prepare(`UPDATE officer_services SET qualified = 1 WHERE officer_id = ? AND service_type = 'VIP'`).bind(PILOT_OFFICER_ID),
    db.prepare(`UPDATE bookings SET service_type = 'VIP', purpose_code = 'executive_protection', purpose_label = 'Executive protection',
      engagement_model = 'fixed', notice_window = 'standard', roster_pattern = 'weekdays', calendar_category = ?, calendar_label = ?,
      risk_band = ?, risk_score = ?, risk_reasons = ?, required_endorsements = ?, manual_review = 1, shift_count = ?,
      client_price_cents = ?, officer_rate_cents = ?, officer_total_cents = ?, gross_platform_contribution_cents = ?,
      pricing_version = ?, pricing_breakdown = ?, minimum_grade = 'Grade B' WHERE id = 'BK-2078'`).bind(
        vipQuote.firstCalendarCategory, vipQuote.firstCalendarLabel, vipQuote.risk.band, vipQuote.risk.score,
        JSON.stringify(vipQuote.risk.reasons), JSON.stringify(vipQuote.risk.requiredEndorsements), vipQuote.shiftCount,
        vipQuote.clientPriceCents, vipQuote.officerRateCents, vipQuote.officerTotalCents, vipQuote.grossPlatformContributionCents,
        vipQuote.version, JSON.stringify({ baseClientCents: vipQuote.baseClientCents, calendarPremiumCents: vipQuote.calendarPremiumCents,
          dispatchPremiumCents: vipQuote.dispatchPremiumCents, riskPremiumCents: vipQuote.riskPremiumCents }),
      ),
    db.prepare(`UPDATE offers SET amount_cents = ? WHERE id = 'OF-2084' AND status = 'open'`).bind(depotQuote.officerRateCents),
    db.prepare(`UPDATE shifts SET earnings_cents = 80000 WHERE id IN ('SH-2081', 'SH-2080', 'SH-2077')`),
    db.prepare(`UPDATE shifts SET earnings_cents = 450000 WHERE id = 'SH-2078'`),
    db.prepare(`UPDATE ledger_entries SET amount_cents = 80000 WHERE id IN ('LE-2077', 'LE-2080')`),
    db.prepare(`UPDATE ledger_entries SET amount_cents = 450000 WHERE id = 'LE-2078'`),
    db.prepare(`UPDATE offers SET expires_at = '2026-09-05T16:00:00.000Z'
      WHERE id = 'OF-2084' AND status = 'open' AND expires_at = '2026-08-21T18:00:00.000Z'`),
    db.prepare(`UPDATE shifts SET passport_verification_status = 'green', passport_verified_at = COALESCE(passport_verified_at, ?)
      WHERE id = 'SH-2081' AND passport_verification_status = 'not_checked'`).bind("2026-08-21T03:54:00.000Z"),
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
    FROM officers WHERE id = ?`).bind(PILOT_OFFICER_ID).first<{
      id: string; fullName: string; city: string; psiraNumber: string; psiraGrade: string;
      psiraExpiry: string; approvalStatus: string; bankingStatus: string; flexAvailable: number;
      externalWorkAcknowledged: number; restWindowConfirmed: number;
    }>();
  if (!officer) throw new PilotError("The pilot officer profile is unavailable.", 500);

  const client = await db.prepare(`SELECT id, organisation_name AS organisationName, contact_name AS contactName,
    approval_status AS approvalStatus FROM clients WHERE id = ?`).bind(PILOT_CLIENT_ID).first<{
      id: string; organisationName: string; contactName: string; approvalStatus: string;
    }>();
  if (!client) throw new PilotError("The pilot client profile is unavailable.", 500);

  const passportRow = await db.prepare(`SELECT passport_number AS passportNumber, status, readiness_label AS readinessLabel,
    issued_at AS issuedAt, last_reviewed_at AS lastReviewedAt, next_review_at AS nextReviewAt
    FROM officer_passports WHERE officer_id = ?`).bind(PILOT_OFFICER_ID).first<{
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
      ORDER BY CASE service_type WHEN 'Unarmed' THEN 1 WHEN 'Armed' THEN 2 ELSE 3 END`).bind(PILOT_OFFICER_ID),
  );
  const compliance = await all<{ id: string; recordType: string; status: string; expiresAt: string | null; nextDueAt: string | null }>(
    db.prepare(`SELECT id, record_type AS recordType, status, expires_at AS expiresAt, next_due_at AS nextDueAt
      FROM compliance_records WHERE officer_id = ? ORDER BY record_type`).bind(PILOT_OFFICER_ID),
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
    WHERE o.officer_id = ? ORDER BY o.expires_at DESC`).bind(PILOT_OFFICER_ID));
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
      WHERE s.booking_id = b.id ORDER BY s.rowid DESC LIMIT 1) AS assignedOfficer
    FROM bookings b WHERE b.client_id = ? ORDER BY b.rowid DESC LIMIT 24`).bind(PILOT_CLIENT_ID));
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
    WHERE s.officer_id = ? ORDER BY s.scheduled_date DESC, s.id DESC`).bind(PILOT_OFFICER_ID));
  const ledger = await all<{
    id: string; shiftId: string; bookingId: string; siteName: string; amountCents: number;
    state: "pending_signoff" | "pending_release" | "available" | "withdrawal_queued" | "paid" | "held";
    releaseCadence: "Weekly" | "Monthly"; eligibleReleaseAt: string | null; updatedAt: string;
  }>(db.prepare(`SELECT l.id, l.shift_id AS shiftId, s.booking_id AS bookingId, b.site_name AS siteName,
    l.amount_cents AS amountCents, l.state, l.release_cadence AS releaseCadence,
    l.eligible_release_at AS eligibleReleaseAt, l.updated_at AS updatedAt
    FROM ledger_entries l JOIN shifts s ON s.id = l.shift_id JOIN bookings b ON b.id = s.booking_id
    WHERE l.officer_id = ? ORDER BY l.updated_at DESC`).bind(PILOT_OFFICER_ID));
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

async function releaseOfferWave(db: D1Database, bookingId: string) {
  const booking = await db.prepare(`SELECT id, start_date AS startDate, funding_status AS fundingStatus,
    officer_rate_cents AS officerRateCents, engagement_model AS engagementModel, status FROM bookings WHERE id = ? AND client_id = ?`)
    .bind(bookingId, PILOT_CLIENT_ID).first<{
      id: string; startDate: string; fundingStatus: string; officerRateCents: number; engagementModel: "fixed" | "flex"; status: string;
    }>();
  if (!booking) throw new PilotError("That booking is unavailable.", 404);
  if (booking.fundingStatus !== "paid_in_full") throw new PilotError("The full contract payment must be confirmed before matching.", 409);
  if (booking.status === "staffed" || booking.status === "active") throw new PilotError("This booking is already staffed.", 409);

  const existing = await db.prepare(`SELECT id, status FROM offers WHERE booking_id = ? AND officer_id = ?
    AND status IN ('open', 'accepted') ORDER BY rowid DESC LIMIT 1`).bind(bookingId, PILOT_OFFICER_ID)
    .first<{ id: string; status: string }>();
  if (existing) {
    if (existing.status === "open") await db.prepare(`UPDATE bookings SET status = 'offered' WHERE id = ?`).bind(bookingId).run();
    return { released: existing.status === "open", blockers: [] as string[] };
  }

  const readiness = await evaluateBookingReadiness(db, PILOT_OFFICER_ID, bookingId, {
    assignmentDate: booking.startDate,
    requireServiceOptIn: true,
  });
  const availability = booking.engagementModel === "flex"
    ? await db.prepare(`SELECT flex_available AS flexAvailable, external_work_acknowledged AS externalWorkAcknowledged,
        rest_window_confirmed AS restWindowConfirmed FROM officers WHERE id = ?`).bind(PILOT_OFFICER_ID)
      .first<{ flexAvailable: number; externalWorkAcknowledged: number; restWindowConfirmed: number }>()
    : null;
  const availabilityBlockers = booking.engagementModel === "flex" ? [
    !availability?.flexAvailable ? "Officer is not currently available for Flex work." : "",
    !availability?.externalWorkAcknowledged ? "External work declaration is not current." : "",
    !availability?.restWindowConfirmed ? "Rest window has not been confirmed." : "",
  ].filter(Boolean) : [];
  const blockers = [...readiness.blockers, ...availabilityBlockers];
  if (!readiness.eligible || blockers.length) {
    await db.prepare(`UPDATE bookings SET status = 'matching' WHERE id = ?`).bind(bookingId).run();
    await recordAudit(db, "operations", "OPS-DEMO", "offer_wave_blocked", "booking", bookingId, `No pilot officer matched: ${blockers.join(" ")}`);
    return { released: false, blockers };
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const offerId = `OF-DEMO-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  await db.batch([
    db.prepare(`INSERT INTO offers (id, booking_id, officer_id, amount_cents, status, expires_at, responded_at)
      VALUES (?, ?, ?, ?, 'open', ?, NULL)`).bind(offerId, bookingId, PILOT_OFFICER_ID, booking.officerRateCents, expiresAt),
    db.prepare(`UPDATE bookings SET status = 'offered' WHERE id = ? AND funding_status = 'paid_in_full'`).bind(bookingId),
  ]);
  await recordAudit(db, "operations", "OPS-DEMO", "offer_wave_released", "booking", bookingId, "Funded booking passed Passport, grade, service, purpose and opt-in controls; fixed offer released.");
  return { released: true, blockers: [] as string[] };
}

async function resetDemo(db: D1Database) {
  const now = new Date();
  const offerExpiry = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
  await db.batch([
    db.prepare(`DELETE FROM ledger_entries WHERE shift_id IN (SELECT id FROM shifts WHERE booking_id LIKE 'BK-DEMO-%')`),
    db.prepare(`DELETE FROM shifts WHERE booking_id LIKE 'BK-DEMO-%' OR id = 'SH-2084'`),
    db.prepare(`DELETE FROM offers WHERE booking_id LIKE 'BK-DEMO-%'`),
    db.prepare(`DELETE FROM bookings WHERE id LIKE 'BK-DEMO-%'`),
    db.prepare(`UPDATE officer_services SET opted_in = CASE service_type WHEN 'Unarmed' THEN 1 ELSE 0 END
      WHERE officer_id = ?`).bind(PILOT_OFFICER_ID),
    db.prepare(`UPDATE offers SET status = 'open', responded_at = NULL, amount_cents = 80000, expires_at = ? WHERE id = 'OF-2084'`).bind(offerExpiry),
    db.prepare(`UPDATE bookings SET status = 'offered', funding_status = 'paid_in_full' WHERE id = 'BK-2084'`),
    db.prepare(`UPDATE shifts SET status = 'completed', client_signoff_status = 'pending', signed_off_at = NULL WHERE id = 'SH-2080'`),
    db.prepare(`UPDATE ledger_entries SET state = 'pending_signoff', eligible_release_at = NULL, updated_at = ? WHERE id = 'LE-2080'`).bind(now.toISOString()),
    db.prepare(`UPDATE ledger_entries SET state = 'available', updated_at = ? WHERE id = 'LE-2077'`).bind(now.toISOString()),
    db.prepare(`DELETE FROM payout_requests WHERE officer_id = ? AND status = 'queued_for_thursday'`).bind(PILOT_OFFICER_ID),
  ]);
  await recordAudit(db, "operations", "OPS-DEMO", "demo_reset", "pilot", "LOKD-PHASE-1", "Shared transactional demo returned to its opening state. Applications and team feedback were preserved.");
}

async function applyAction(db: D1Database, payload: PilotAction) {
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
    await db.prepare(`INSERT INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, purpose_code, purpose_label,
       engagement_model, notice_window, roster_pattern, calendar_category, calendar_label,
       risk_band, risk_score, risk_reasons, required_endorsements, manual_review, shift_count,
       minimum_grade, contract_months, start_date, end_date, shift_start, shift_end,
       client_price_cents, officer_rate_cents, officer_total_cents, gross_platform_contribution_cents,
       pricing_version, pricing_breakdown, funding_status, release_cadence, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(bookingId, PILOT_CLIENT_ID, "Northbridge Rosebank Offices", "Rosebank", postName,
        payload.serviceType, purpose.code, purpose.label, quote.engagementModel, quote.noticeWindow, payload.rosterPattern,
        quote.firstCalendarCategory, quote.firstCalendarLabel, quote.risk.band, quote.risk.score,
        JSON.stringify(quote.risk.reasons), JSON.stringify(quote.risk.requiredEndorsements), quote.manualReview ? 1 : 0,
        quote.shiftCount, quote.minimumGrade, quote.contractMonths, payload.startDate, quote.endDate, shiftStart, shiftEnd,
        quote.clientPriceCents, quote.officerRateCents, quote.officerTotalCents, quote.grossPlatformContributionCents,
        quote.version, JSON.stringify({ baseClientCents: quote.baseClientCents, calendarPremiumCents: quote.calendarPremiumCents,
          dispatchPremiumCents: quote.dispatchPremiumCents, riskPremiumCents: quote.riskPremiumCents }),
        quote.manualReview ? "review_required" : "awaiting_payment", quote.releaseCadence,
        quote.manualReview ? "risk_review" : "awaiting_payment").run();
    await recordAudit(db, "client", PILOT_CLIENT_ID, "booking_created", "booking", bookingId,
      `${PRICE_BOOK_VERSION}; ${quote.engagementModel}; ${quote.noticeLabel}; ${quote.risk.band} ${quote.risk.score}; ${quote.shiftCount} shift${quote.shiftCount === 1 ? "" : "s"}; ${instructions}`);
    return;
  }

  if (payload.action === "approve_risk_plan") {
    const result = await db.prepare(`UPDATE bookings SET funding_status = 'awaiting_payment', status = 'awaiting_payment'
      WHERE id = ? AND client_id = ? AND status = 'risk_review'`)
      .bind(payload.bookingId, PILOT_CLIENT_ID).run();
    if (!result.meta.changes) throw new PilotError("This booking is not awaiting an operations risk review.", 409);
    await recordAudit(db, "operations", "OPS-DEMO", "risk_plan_approved", "booking", payload.bookingId,
      "DEMO ONLY: assisted risk recommendation reviewed; quote released to the payment gate.");
    return;
  }

  if (payload.action === "confirm_booking_payment") {
    const result = await db.prepare(`UPDATE bookings SET funding_status = 'paid_in_full', status = 'matching'
      WHERE id = ? AND client_id = ? AND funding_status = 'awaiting_payment'`)
      .bind(payload.bookingId, PILOT_CLIENT_ID).run();
    if (!result.meta.changes) throw new PilotError("This demo booking is not awaiting payment confirmation.", 409);
    await recordAudit(db, "operations", "OPS-DEMO", "demo_payment_confirmed", "booking", payload.bookingId,
      "DEMO ONLY: full-term payment marked as confirmed; no payment was processed.");
    await releaseOfferWave(db, payload.bookingId);
    return;
  }

  if (payload.action === "release_offer_wave") {
    await releaseOfferWave(db, payload.bookingId);
    return;
  }

  if (payload.action === "reset_demo") {
    await resetDemo(db);
    return;
  }

  if (payload.action === "accept_offer") {
    const offer = await db.prepare(`SELECT o.id, o.booking_id AS bookingId, o.status, o.amount_cents AS amountCents,
      o.expires_at AS expiresAt, b.start_date AS startDate, b.engagement_model AS engagementModel FROM offers o JOIN bookings b ON b.id = o.booking_id
      WHERE o.id = ? AND o.officer_id = ?`).bind(payload.offerId, PILOT_OFFICER_ID).first<{
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
        FROM officers WHERE id = ?`).bind(PILOT_OFFICER_ID)
        .first<{ flexAvailable: number; externalWorkAcknowledged: number; restWindowConfirmed: number }>();
      if (!availability?.flexAvailable || !availability.externalWorkAcknowledged || !availability.restWindowConfirmed) {
        throw new PilotError("Flex availability, external-work declaration and rest confirmation must still be current.", 409);
      }
    }
    const now = new Date().toISOString();
    const claimed = await db.prepare(`UPDATE bookings SET status = 'staffed' WHERE id = ?
      AND funding_status = 'paid_in_full' AND status IN ('offered', 'matching')
      AND NOT EXISTS (SELECT 1 FROM offers WHERE booking_id = ? AND status = 'accepted')`)
      .bind(offer.bookingId, offer.bookingId).run();
    if (!claimed.meta.changes) throw new PilotError("Another officer secured this booking first.", 409);
    await db.batch([
      db.prepare(`UPDATE offers SET status = 'accepted', responded_at = ?
        WHERE id = ? AND officer_id = ? AND status = 'open'`).bind(now, payload.offerId, PILOT_OFFICER_ID),
      db.prepare(`UPDATE offers SET status = 'expired', responded_at = ? WHERE booking_id = ? AND id <> ? AND status = 'open'`)
        .bind(now, offer.bookingId, payload.offerId),
      db.prepare(`INSERT OR IGNORE INTO shifts
        (id, booking_id, officer_id, scheduled_date, status, check_in_at, check_out_at, client_signoff_status, signed_off_at, earnings_cents)
        VALUES (?, ?, ?, ?, 'confirmed', NULL, NULL, 'not_due', NULL, ?)`)
        .bind(`SH-${offer.bookingId.slice(3)}`, offer.bookingId, PILOT_OFFICER_ID, offer.startDate, offer.amountCents),
    ]);
    await recordAudit(db, "officer", PILOT_OFFICER_ID, "offer_accepted", "offer", payload.offerId, "Officer accepted the fixed offer; competing offers expired.");
    return;
  }

  if (payload.action === "decline_offer") {
    const result = await db.prepare(`UPDATE offers SET status = 'declined', responded_at = ?
      WHERE id = ? AND officer_id = ? AND status = 'open'`)
      .bind(new Date().toISOString(), payload.offerId, PILOT_OFFICER_ID).run();
    if (!result.meta.changes) throw new PilotError("This offer is no longer open.", 409);
    await recordAudit(db, "officer", PILOT_OFFICER_ID, "offer_declined", "offer", payload.offerId, "Officer declined the offer; no penalty was applied.");
    return;
  }

  if (payload.action === "update_service_preference") {
    const service = await db.prepare(`SELECT qualified FROM officer_services WHERE officer_id = ? AND service_type = ?`)
      .bind(PILOT_OFFICER_ID, payload.serviceType).first<{ qualified: number }>();
    if (!service) throw new PilotError("That service preference is unavailable.", 404);
    if (payload.optedIn && !service.qualified) throw new PilotError("Qualification must be verified before this offer type can be enabled.", 409);
    await db.prepare(`UPDATE officer_services SET opted_in = ? WHERE officer_id = ? AND service_type = ?`)
      .bind(payload.optedIn ? 1 : 0, PILOT_OFFICER_ID, payload.serviceType).run();
    await recordAudit(db, "officer", PILOT_OFFICER_ID, "offer_preference_changed", "officer", PILOT_OFFICER_ID, `${payload.serviceType} offer notifications switched ${payload.optedIn ? "on" : "off"}.`);
    return;
  }

  if (payload.action === "update_flex_availability") {
    if (payload.available && (!payload.externalWorkAcknowledged || !payload.restWindowConfirmed)) {
      throw new PilotError("Confirm both the external-work declaration and rest window before going available for Flex.", 409);
    }
    await db.prepare(`UPDATE officers SET flex_available = ?, external_work_acknowledged = ?, rest_window_confirmed = ? WHERE id = ?`)
      .bind(payload.available ? 1 : 0, payload.externalWorkAcknowledged ? 1 : 0, payload.restWindowConfirmed ? 1 : 0, PILOT_OFFICER_ID).run();
    await recordAudit(db, "officer", PILOT_OFFICER_ID, "flex_availability_changed", "officer", PILOT_OFFICER_ID,
      `Flex availability switched ${payload.available ? "on" : "off"}; external-work and rest declarations recorded.`);
    return;
  }

  if (payload.action === "check_in") {
    const shift = await db.prepare(`SELECT booking_id AS bookingId, scheduled_date AS scheduledDate,
      passport_verification_status AS passportVerificationStatus FROM shifts WHERE id = ? AND officer_id = ?`)
      .bind(payload.shiftId, PILOT_OFFICER_ID).first<{ bookingId: string; scheduledDate: string; passportVerificationStatus: string }>();
    if (!shift) throw new PilotError("This shift is not assigned to the pilot officer.", 404);
    const readiness = await evaluateBookingReadiness(db, PILOT_OFFICER_ID, shift.bookingId, {
      assignmentDate: shift.scheduledDate,
    });
    if (!readiness.eligible) throw new PilotError(`LOKD Passport gate: ${readiness.blockers.join(" ")}`, 409);
    if (shift.passportVerificationStatus !== "green") throw new PilotError("Ask the client to scan your booking QR before check-in.", 409);
    const result = await db.prepare(`UPDATE shifts SET status = 'on_post', check_in_at = ?
      WHERE id = ? AND officer_id = ? AND status = 'confirmed'`)
      .bind(new Date().toISOString(), payload.shiftId, PILOT_OFFICER_ID).run();
    if (!result.meta.changes) throw new PilotError("This shift cannot be checked in from its current state.", 409);
    await recordAudit(db, "officer", PILOT_OFFICER_ID, "shift_checked_in", "shift", payload.shiftId, "Officer check-in recorded using server time. Location verification remains a production integration.");
    return;
  }

  if (payload.action === "complete_shift") {
    const shift = await db.prepare(`SELECT s.id, s.earnings_cents AS earningsCents, b.release_cadence AS releaseCadence
      FROM shifts s JOIN bookings b ON b.id = s.booking_id
      WHERE s.id = ? AND s.officer_id = ? AND s.status = 'on_post'`)
      .bind(payload.shiftId, PILOT_OFFICER_ID).first<{ id: string; earningsCents: number; releaseCadence: "Weekly" | "Monthly" }>();
    if (!shift) throw new PilotError("This shift cannot be completed from its current state.", 409);
    const now = new Date().toISOString();
    await db.batch([
      db.prepare(`UPDATE shifts SET status = 'completed', check_out_at = ?, client_signoff_status = 'pending' WHERE id = ?`)
        .bind(now, payload.shiftId),
      db.prepare(`INSERT OR IGNORE INTO ledger_entries
        (id, officer_id, shift_id, amount_cents, state, release_cadence, eligible_release_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'pending_signoff', ?, NULL, ?, ?)`)
        .bind(`LE-${payload.shiftId.slice(3)}`, PILOT_OFFICER_ID, payload.shiftId, shift.earningsCents, shift.releaseCadence, now, now),
    ]);
    await recordAudit(db, "officer", PILOT_OFFICER_ID, "shift_completed", "shift", payload.shiftId, "Officer completed the shift; earnings are awaiting service verification.");
    return;
  }

  if (payload.action === "report_issue") {
    const shift = await db.prepare(`SELECT id FROM shifts WHERE id = ? AND officer_id = ?`)
      .bind(payload.shiftId, PILOT_OFFICER_ID).first<{ id: string }>();
    if (!shift) throw new PilotError("This issue is not linked to one of your shifts.", 404);
    const category = payload.category.trim().slice(0, 80);
    if (!category) throw new PilotError("Choose an issue category.", 400);
    await recordAudit(db, "officer", PILOT_OFFICER_ID, "shift_issue_reported", "shift", payload.shiftId, `${category} reported from the officer app. Operations follow-up required.`);
    return;
  }

  if (payload.action === "client_signoff") {
    const shift = await db.prepare(`SELECT s.id, s.client_signoff_status AS signoffStatus,
      b.release_cadence AS releaseCadence FROM shifts s JOIN bookings b ON b.id = s.booking_id
      WHERE s.id = ? AND b.client_id = ?`).bind(payload.shiftId, PILOT_CLIENT_ID).first<{
        id: string; signoffStatus: string; releaseCadence: "Weekly" | "Monthly";
      }>();
    if (!shift) throw new PilotError("This shift is not available to this client.", 404);
    if (shift.signoffStatus !== "pending") throw new PilotError("This shift has already been reviewed.", 409);
    const now = new Date().toISOString();
    const releaseAt = nextReleaseAt(shift.releaseCadence);
    await db.batch([
      db.prepare(`UPDATE shifts SET status = 'verified', client_signoff_status = 'approved', signed_off_at = ? WHERE id = ?`)
        .bind(now, payload.shiftId),
      db.prepare(`UPDATE ledger_entries SET state = 'pending_release', eligible_release_at = ?, updated_at = ?
        WHERE shift_id = ? AND state = 'pending_signoff'`).bind(releaseAt, now, payload.shiftId),
    ]);
    await recordAudit(db, "client", PILOT_CLIENT_ID, "shift_signed_off", "shift", payload.shiftId, `Client verified the completed shift; earnings scheduled for the ${shift.releaseCadence.toLowerCase()} release.`);
    return;
  }

  if (payload.action === "release_earnings") {
    const now = new Date().toISOString();
    const result = await db.prepare(`UPDATE ledger_entries SET state = 'available', updated_at = ?
      WHERE state = 'pending_release' AND eligible_release_at IS NOT NULL AND eligible_release_at <= ?`)
      .bind(now, now).run();
    if (!result.meta.changes) throw new PilotError("No verified earnings are due for release yet.", 409);
    await recordAudit(db, "operations", "OPS-001", "earnings_released", "ledger", "release-batch", `${result.meta.changes} verified earning entr${result.meta.changes === 1 ? "y" : "ies"} moved to Available.`);
    return;
  }

  if (payload.action === "request_payout") {
    const available = await db.prepare(`SELECT COALESCE(SUM(amount_cents), 0) AS amountCents
      FROM ledger_entries WHERE officer_id = ? AND state = 'available'`)
      .bind(PILOT_OFFICER_ID).first<{ amountCents: number }>();
    const amountCents = Number(available?.amountCents ?? 0);
    if (!amountCents) throw new PilotError("There are no Available earnings ready for payout.", 409);
    const schedule = nextThursdayAndFriday();
    const requestId = eventId("PAY");
    await db.batch([
      db.prepare(`UPDATE ledger_entries SET state = 'withdrawal_queued', updated_at = ?
        WHERE officer_id = ? AND state = 'available'`).bind(new Date().toISOString(), PILOT_OFFICER_ID),
      db.prepare(`INSERT INTO payout_requests
        (id, officer_id, amount_cents, status, requested_at, expected_settlement_date)
        VALUES (?, ?, ?, 'queued_for_thursday', ?, ?)`)
        .bind(requestId, PILOT_OFFICER_ID, amountCents, new Date().toISOString(), schedule.friday),
    ]);
    await recordAudit(db, "officer", PILOT_OFFICER_ID, "payout_requested", "payout_request", requestId, `Payout request queued for Thursday processing with expected Friday clearance.`);
    return;
  }

  throw new PilotError("Unknown pilot action.", 400);
}

function errorResponse(cause: unknown) {
  const error = cause instanceof PilotError ? cause : new PilotError(cause instanceof Error ? cause.message : "Unexpected pilot error.", 500);
  return Response.json({ error: error.message }, { status: error.status });
}

export async function GET() {
  try {
    const db = getPilotDb();
    await ensurePilotData(db);
    return Response.json({ state: await readPilotState(db) });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function POST(request: Request) {
  try {
    const db = getPilotDb();
    await ensurePilotData(db);
    const payload = (await request.json()) as PilotAction;
    await applyAction(db, payload);
    return Response.json({ state: await readPilotState(db) });
  } catch (cause) {
    return errorResponse(cause);
  }
}
