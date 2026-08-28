import type { PilotPrincipal } from "./pilot-runtime";
import { evaluateBookingReadiness } from "./passport-server";
import {
  AssignmentActivationError,
  evaluateAssignmentActivation,
  recordAssignmentActivationEvaluation,
} from "./assignment-activation-server";
import { splitAcrossIsoWeeks } from "./assignment-activation-core";
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
import {
  launchGateDecision,
  REQUIRED_LAUNCH_GATE_CODES,
} from "./workforce-core";
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
  OperationsWorkforceOfficer,
  OperationsAssignmentActivation,
} from "./operations-types";

const PILOT_CLIENT_ID = "CL-001";
const OPERATIONS_DEMO_OFFICER_IDS = ["OFF-001", "OFF-002", "OFF-003", "OFF-004", "OFF-005"] as const;

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

async function assertOperationsDemoSeedIsolation(db: D1Database) {
  const collision = await db.prepare(`SELECT entity, id FROM (
    SELECT 'client' AS entity, id FROM clients
      WHERE id = 'CL-001' AND (environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL SELECT 'booking', id FROM bookings
      WHERE id IN ('BK-2081','BK-2084','BK-2090') AND (environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL SELECT 'site', id FROM operational_sites
      WHERE id IN ('SITE-RSB','SITE-MID','SITE-LIN') AND (environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL SELECT 'post', id FROM site_posts
      WHERE id IN ('POST-RSB-01','POST-MID-01','POST-LIN-01','POST-LIN-02')
        AND (environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL SELECT 'slot', id FROM roster_slots
      WHERE id IN ('SLOT-RSB-01','SLOT-MID-01','SLOT-LIN-01','SLOT-LIN-02')
        AND (environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL SELECT 'assignment', id FROM roster_assignments
      WHERE id IN ('RA-RSB-01','RA-MID-01','RA-LIN-01')
        AND (environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL SELECT 'shift', id FROM shifts
      WHERE id IN ('SH-2081','SH-OPS-2084','SH-2090')
        AND (environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL SELECT 'funding', id FROM booking_funding_reconciliations
      WHERE id IN ('FR-DEMO-2081','FR-DEMO-2084','FR-DEMO-2090')
        AND (environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL SELECT 'risk', id FROM site_risk_assessments
      WHERE id IN ('SRA-DEMO-RSB','SRA-DEMO-MID','SRA-DEMO-LIN')
        AND (environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL SELECT 'post_orders', id FROM post_order_approvals
      WHERE id IN ('POA-DEMO-RSB-01','POA-DEMO-MID-01','POA-DEMO-LIN-01','POA-DEMO-LIN-02')
        AND (environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL SELECT 'induction', id FROM officer_site_inductions
      WHERE id IN ('IND-DEMO-OFF-001-RSB','IND-DEMO-OFF-002-MID','IND-DEMO-OFF-003-LIN',
        'IND-DEMO-OFF-004-LIN','IND-DEMO-OFF-005-LIN')
        AND (environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL SELECT 'travel', id FROM officer_travel_assessments
      WHERE id IN ('TRAVEL-DEMO-OFF-004-LIN','TRAVEL-DEMO-OFF-005-LIN')
        AND (environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL SELECT 'availability', id FROM officer_availability_windows
      WHERE id IN ('AVAIL-OFF-004-01','AVAIL-OFF-005-01')
        AND (environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL SELECT 'schedule', id FROM officer_schedule_declarations
      WHERE id IN ('OSD-DEMO-OFF-001-01','OSD-DEMO-OFF-002-01','OSD-DEMO-OFF-003-01',
        'OSD-DEMO-OFF-004-01','OSD-DEMO-OFF-005-01')
        AND (environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL SELECT 'passport', officer_id FROM officer_passports
      WHERE officer_id IN ('OFF-001','OFF-002','OFF-003','OFF-004','OFF-005')
        AND (environment <> 'demo' OR integrity_state <> 'synthetic'
          OR passport_number <> CASE officer_id
            WHEN 'OFF-001' THEN 'LKD-P-1842'
            WHEN 'OFF-002' THEN 'LOKD-DEMO-002'
            WHEN 'OFF-003' THEN 'LOKD-DEMO-003'
            WHEN 'OFF-004' THEN 'LOKD-DEMO-004'
            WHEN 'OFF-005' THEN 'LOKD-DEMO-005' END)
    UNION ALL SELECT 'compliance', id FROM compliance_records
      WHERE id IN ('CR-OFF-001-IDENTITY','CR-OFF-001-PSIRA','CR-OFF-002-IDENTITY','CR-OFF-002-PSIRA',
        'CR-OFF-003-IDENTITY','CR-OFF-003-PSIRA','CR-OFF-004-IDENTITY','CR-OFF-004-PSIRA',
        'CR-OFF-005-IDENTITY','CR-OFF-005-PSIRA')
        AND (environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL SELECT 'endorsement', id FROM officer_endorsements
      WHERE id IN ('END-OFF-004-CORE','END-OFF-004-UNARMED','END-OFF-004-CONSTRUCTION','END-OFF-004-LOGISTICS',
        'END-OFF-005-CORE','END-OFF-005-UNARMED','END-OFF-005-CONSTRUCTION','END-OFF-005-LOGISTICS')
        AND (environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL SELECT 'employer', id FROM workforce_employers
      WHERE id IN ('EMP-LOKD-DEMO','EMP-PARTNER-DEMO') AND environment <> 'demo'
    UNION ALL SELECT 'engagement', id FROM workforce_engagements
      WHERE id IN ('WE-OFF-001','WE-OFF-002','WE-OFF-003','WE-OFF-004') AND environment <> 'demo'
    UNION ALL SELECT 'terms', id FROM workforce_terms_acceptances
      WHERE id IN ('WTA-OFF-001','WTA-OFF-002','WTA-OFF-003','WTA-OFF-004')
        AND (environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL SELECT 'employer_evidence', id FROM employer_compliance_evidence
      WHERE id LIKE 'ECE-EMP-%-DEMO-%' AND (environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL SELECT 'workforce_snapshot', id FROM assignment_workforce_snapshots
      WHERE id IN ('AWS-RA-RSB-01','AWS-RA-MID-01','AWS-RA-LIN-01') AND environment <> 'demo'
    UNION ALL SELECT 'signal', id FROM site_presence_signals
      WHERE id IN ('SIG-RSB-001','SIG-MID-001','SIG-LIN-001')
        AND (environment <> 'demo' OR integrity_state <> 'synthetic')
    UNION ALL SELECT 'incident', i.id FROM site_incidents i JOIN operational_sites s ON s.id = i.site_id
      WHERE i.id IN ('INC-DEMO-001','INC-DEMO-002')
        AND (s.environment <> 'demo' OR s.integrity_state <> 'synthetic')
    UNION ALL SELECT 'incident_event', ie.id FROM incident_events ie
      JOIN site_incidents i ON i.id = ie.incident_id JOIN operational_sites s ON s.id = i.site_id
      WHERE ie.id = 'IE-DEMO-001' AND (s.environment <> 'demo' OR s.integrity_state <> 'synthetic')
    UNION ALL SELECT 'exception', e.id FROM operational_exceptions e JOIN operational_sites s ON s.id = e.site_id
      WHERE e.id = 'EXC-DEMO-001' AND (s.environment <> 'demo' OR s.integrity_state <> 'synthetic')
    UNION ALL SELECT 'officer', o.id FROM officers o
      WHERE o.id IN ('OFF-001','OFF-002','OFF-003','OFF-004','OFF-005') AND (
        EXISTS (SELECT 1 FROM workforce_engagements we WHERE we.officer_id = o.id AND we.environment = 'production')
        OR EXISTS (SELECT 1 FROM assignment_activation_commands c WHERE c.officer_id = o.id AND c.environment = 'production')
        OR EXISTS (SELECT 1 FROM officer_schedule_declarations sd WHERE sd.officer_id = o.id AND sd.environment = 'production')
      )
    UNION ALL SELECT 'officer_identity', o.id FROM officers o
      WHERE o.id IN ('OFF-001','OFF-002','OFF-003','OFF-004','OFF-005') AND NOT (
        (o.id = 'OFF-001' AND o.full_name = 'Lerato Khumalo' AND o.email = 'lerato@example.co.za' AND o.psira_number = 'PSIRA-1842')
        OR (o.id = 'OFF-002' AND o.full_name = 'Ayanda Ncube' AND o.email = 'ayanda@example.co.za' AND o.psira_number = 'PSIRA-DEMO-202')
        OR (o.id = 'OFF-003' AND o.full_name = 'Sibusiso Dlamini' AND o.email = 'sibusiso@example.co.za' AND o.psira_number = 'PSIRA-DEMO-303')
        OR (o.id = 'OFF-004' AND o.full_name = 'Thandi Mokoena' AND o.email = 'thandi@example.co.za' AND o.psira_number = 'PSIRA-DEMO-404')
        OR (o.id = 'OFF-005' AND o.full_name = 'Neo Molefe' AND o.email = 'neo@example.co.za' AND o.psira_number = 'PSIRA-DEMO-505')
      )
    UNION ALL SELECT 'officer_scope', o.id FROM officers o
      WHERE o.id IN ('OFF-001','OFF-002','OFF-003','OFF-004','OFF-005')
        AND NOT EXISTS (SELECT 1 FROM officer_passports passport WHERE passport.officer_id = o.id
          AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic')
        AND NOT EXISTS (SELECT 1 FROM workforce_engagements engagement WHERE engagement.officer_id = o.id
          AND engagement.id = CASE o.id WHEN 'OFF-001' THEN 'WE-OFF-001' WHEN 'OFF-002' THEN 'WE-OFF-002'
            WHEN 'OFF-003' THEN 'WE-OFF-003' WHEN 'OFF-004' THEN 'WE-OFF-004' ELSE 'WE-OFF-005' END
          AND engagement.environment = 'demo')
  ) LIMIT 1`).first<{ entity: string; id: string }>();
  if (collision) {
    throw new OperationsError("The synthetic Operations dataset could not be isolated from production records. Demo seeding was stopped.", 503);
  }
}

type ReliefEligibilitySlot = {
  id: string;
  bookingId: string;
  serviceDate: string;
  startsAt: string;
  endsAt: string;
};

export async function reliefCandidateEligibility(db: D1Database, officerId: string, slot: ReliefEligibilitySlot) {
  const base = await db.prepare(`SELECT officer.id FROM officers officer
    JOIN officer_passports passport ON passport.officer_id = officer.id
      AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
    WHERE officer.id = ? AND officer.approval_status = 'approved'
      AND officer.flex_available = 1 AND officer.external_work_acknowledged = 1 AND officer.rest_window_confirmed = 1`)
    .bind(officerId).first<{ id: string }>();
  if (!base) return { eligible: false, reason: "Officer availability declarations are incomplete." };
  const workforce = await db.prepare(`SELECT we.id, we.model, we.status, we.terms_version AS termsVersion,
    we.payroll_status AS payrollStatus, we.benefits_status AS benefitsStatus, we.weekly_hour_cap AS weeklyHourCap,
    we.review_due_at AS engagementReviewDueAt, emp.status AS employerStatus, emp.review_due_at AS employerReviewDueAt,
    emp.psira_status AS psiraStatus, emp.nbcpss_status AS nbcpssStatus, emp.psspf_status AS psspfStatus,
    emp.uif_status AS uifStatus, emp.coida_status AS coidaStatus, emp.insurance_status AS insuranceStatus,
    emp.service_agreement_status AS serviceAgreementStatus
    FROM workforce_engagements we JOIN workforce_employers emp ON emp.id = we.employer_id AND emp.environment = 'demo'
    WHERE we.officer_id = ? AND we.active_key = we.officer_id AND we.status = 'active' AND we.environment = 'demo'
      AND EXISTS (SELECT 1 FROM workforce_terms_acceptances terms
        WHERE terms.workforce_engagement_id = we.id AND terms.active_key = we.id
          AND terms.environment = 'demo' AND terms.integrity_state = 'synthetic')
    LIMIT 1`).bind(officerId).first<{
      id: string; model: "direct_flex" | "partner" | "managed"; status: string; termsVersion: string | null;
      payrollStatus: string; benefitsStatus: string; weeklyHourCap: number | null; engagementReviewDueAt: string | null;
      employerStatus: string; employerReviewDueAt: string | null; psiraStatus: string; nbcpssStatus: string;
      psspfStatus: string; uifStatus: string; coidaStatus: string; insuranceStatus: string; serviceAgreementStatus: string;
    }>();
  if (!workforce) return { eligible: false, reason: "Verified Network membership is not an active employment or partner engagement." };
  const validThrough = new Date(slot.endsAt);
  if (!Number.isFinite(validThrough.getTime())) return { eligible: false, reason: "The post window is invalid." };
  if (workforce.employerStatus !== "current") return { eligible: false, reason: "The employer of record is not current." };
  if (!workforce.termsVersion) return { eligible: false, reason: "No accepted workforce terms version is recorded." };
  if (!workforce.engagementReviewDueAt || new Date(workforce.engagementReviewDueAt) < validThrough) return { eligible: false, reason: "The workforce engagement review is missing or expires before the post ends." };
  if (!workforce.employerReviewDueAt || new Date(workforce.employerReviewDueAt) < validThrough) return { eligible: false, reason: "The employer compliance review is missing or expires before the post ends." };
  const employerControls = [workforce.psiraStatus, workforce.nbcpssStatus, workforce.psspfStatus,
    workforce.uifStatus, workforce.coidaStatus, workforce.insuranceStatus, workforce.serviceAgreementStatus];
  if (employerControls.some((status) => status !== "current")) return { eligible: false, reason: "Employer compliance is incomplete." };
  if ((workforce.model === "direct_flex" || workforce.model === "managed")
    && (workforce.payrollStatus !== "ready" || workforce.benefitsStatus !== "ready")) {
    return { eligible: false, reason: "Direct payroll or benefit activation is not ready." };
  }
  if (workforce.model === "partner" && workforce.payrollStatus !== "partner_confirmed") {
    return { eligible: false, reason: "The partner has not confirmed payroll responsibility." };
  }
  if (workforce.model === "partner" && workforce.benefitsStatus !== "partner_confirmed") {
    return { eligible: false, reason: "The partner has not confirmed statutory benefit responsibility." };
  }
  const readiness = await evaluateBookingReadiness(db, officerId, slot.bookingId, {
    assignmentDate: slot.serviceDate,
    requireServiceOptIn: true,
  });
  if (!readiness.eligible) return { eligible: false, reason: readiness.blockers[0] ?? "Readiness controls did not pass." };
  const available = await db.prepare(`SELECT id FROM officer_availability_windows
    WHERE officer_id = ? AND status = 'available' AND environment = 'demo' AND integrity_state = 'synthetic'
      AND evidence_reference IS NOT NULL AND rest_confirmed_at <= ? AND starts_at <= ? AND ends_at >= ?
    ORDER BY starts_at DESC LIMIT 1`).bind(officerId, new Date().toISOString(), slot.startsAt, slot.endsAt).first<{ id: string }>();
  if (!available) return { eligible: false, reason: "No declared availability window covers the full post." };
  if (workforce.model === "direct_flex") {
    const capMinutes = (workforce.weeklyHourCap ?? 24) * 60;
    const segments = splitAcrossIsoWeeks(slot.startsAt, slot.endsAt);
    if (!segments.length) return { eligible: false, reason: "The post window must use exact whole-minute boundaries." };
    const reservationMinutes = await all<{ isoWeekStart: string; minutes: number }>(db.prepare(`SELECT h.iso_week_start AS isoWeekStart,
      COALESCE(SUM(h.reserved_minutes), 0) AS minutes FROM workforce_hour_reservations h
      WHERE h.officer_id = ? AND h.status = 'active' AND (
        (h.source_type = 'assignment' AND EXISTS (
          SELECT 1 FROM roster_assignments source_assignment
          WHERE source_assignment.id = h.source_id AND source_assignment.id = h.roster_assignment_id
            AND source_assignment.environment = 'demo' AND source_assignment.integrity_state = 'synthetic'))
        OR (h.source_type = 'relief' AND EXISTS (
          SELECT 1 FROM relief_dispatches source_relief
          WHERE source_relief.id = h.source_id AND source_relief.id = h.relief_dispatch_id
            AND source_relief.environment = 'demo' AND source_relief.integrity_state = 'synthetic'))
      ) GROUP BY h.iso_week_start`).bind(officerId));
    const existingByWeek: Record<string, number> = Object.fromEntries(reservationMinutes.map((item) => [item.isoWeekStart, Number(item.minutes)]));
    const legacyIntervals = await all<{ startsAt: string; endsAt: string }>(db.prepare(`SELECT rs.starts_at AS startsAt, rs.ends_at AS endsAt
      FROM roster_assignments ra JOIN roster_slots rs ON rs.id = ra.roster_slot_id
      WHERE ra.officer_id = ? AND ra.environment = 'demo' AND ra.integrity_state = 'synthetic'
        AND rs.environment = 'demo' AND rs.integrity_state = 'synthetic'
        AND ra.status NOT IN ('cancelled','replaced','released')
        AND NOT EXISTS (SELECT 1 FROM workforce_hour_reservations h WHERE h.roster_assignment_id = ra.id AND h.status = 'active')
      UNION ALL SELECT rs.starts_at, rs.ends_at FROM relief_dispatches rd JOIN roster_slots rs ON rs.id = rd.roster_slot_id
      WHERE rd.replacement_officer_id = ? AND rd.environment = 'demo' AND rd.integrity_state = 'synthetic'
        AND rs.environment = 'demo' AND rs.integrity_state = 'synthetic'
        AND rd.status NOT IN ('cancelled','replaced')
        AND NOT EXISTS (SELECT 1 FROM workforce_hour_reservations h WHERE h.relief_dispatch_id = rd.id AND h.status = 'active')
      UNION ALL SELECT starts_at, ends_at FROM officer_work_commitments
      WHERE officer_id = ? AND environment = 'demo' AND integrity_state = 'synthetic'
        AND status <> 'cancelled'`).bind(officerId, officerId, officerId));
    for (const interval of legacyIntervals) {
      for (const legacySegment of splitAcrossIsoWeeks(interval.startsAt, interval.endsAt)) {
        existingByWeek[legacySegment.isoWeekStart] = (existingByWeek[legacySegment.isoWeekStart] ?? 0) + legacySegment.minutes;
      }
    }
    for (const segment of segments) {
      const projectedMinutes = (existingByWeek[segment.isoWeekStart] ?? 0) + segment.minutes;
      if (projectedMinutes > capMinutes) return {
        eligible: false,
        reason: `The direct Flex weekly cap would be exceeded (${projectedMinutes / 60}h / ${capMinutes / 60}h).`,
      };
    }
  }
  const restWindowStart = new Date(new Date(slot.startsAt).getTime() - 8 * 60 * 60 * 1000).toISOString();
  const restWindowEnd = new Date(new Date(slot.endsAt).getTime() + 8 * 60 * 60 * 1000).toISOString();
  const conflictingAssignment = await db.prepare(`SELECT ra.id FROM roster_assignments ra
    JOIN roster_slots other_slot ON other_slot.id = ra.roster_slot_id
    WHERE ra.officer_id = ? AND ra.environment = 'demo' AND ra.integrity_state = 'synthetic'
      AND other_slot.environment = 'demo' AND other_slot.integrity_state = 'synthetic'
      AND ra.active_key IS NOT NULL AND other_slot.id <> ?
      AND ra.status NOT IN ('replaced', 'cancelled', 'released')
      AND other_slot.starts_at < ? AND other_slot.ends_at > ? LIMIT 1`)
    .bind(officerId, slot.id, restWindowEnd, restWindowStart).first<{ id: string }>();
  if (conflictingAssignment) return { eligible: false, reason: "Another assignment conflicts with the demo overlap/rest policy." };
  const conflictingRelief = await db.prepare(`SELECT rd.id FROM relief_dispatches rd
    JOIN roster_slots other_slot ON other_slot.id = rd.roster_slot_id
    WHERE rd.replacement_officer_id = ? AND rd.environment = 'demo' AND rd.integrity_state = 'synthetic'
      AND other_slot.environment = 'demo' AND other_slot.integrity_state = 'synthetic'
      AND rd.status NOT IN ('cancelled','replaced') AND other_slot.id <> ?
      AND other_slot.starts_at < ? AND other_slot.ends_at > ? LIMIT 1`)
    .bind(officerId, slot.id, restWindowEnd, restWindowStart).first<{ id: string }>();
  if (conflictingRelief) return { eligible: false, reason: "Another relief case conflicts with the demo overlap/rest policy." };
  const conflictingExternalWork = await db.prepare(`SELECT id FROM officer_work_commitments
    WHERE officer_id = ? AND environment = 'demo' AND integrity_state = 'synthetic'
      AND status <> 'cancelled' AND starts_at < ? AND ends_at > ? LIMIT 1`)
    .bind(officerId, restWindowEnd, restWindowStart).first<{ id: string }>();
  if (conflictingExternalWork) return { eligible: false, reason: "Declared external work conflicts with the demo overlap/rest policy." };
  return {
    eligible: true,
    reason: "Readiness, availability, overlap and demo rest controls passed.",
    workforceEngagementId: workforce.id,
    workforceModel: workforce.model,
    weeklyHourCap: workforce.weeklyHourCap,
  };
}

export async function ensureOperationsDemoData(db: D1Database) {
  const now = new Date(Math.floor(Date.now() / 60_000) * 60_000);
  const today = dateInJohannesburg(now);
  const endDate = isoOffset(now, 60 * 24 * 30).slice(0, 10);
  const signalRetention = isoOffset(now, 60 * 24 * 30);
  const incidentRetention = isoOffset(now, 60 * 24 * 90);

  await assertOperationsDemoSeedIsolation(db);

  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO clients
      (id, organisation_name, contact_name, contact_email, approval_status, environment, integrity_state)
      VALUES (?, ?, ?, ?, 'approved', 'demo', 'synthetic')`)
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
    db.prepare(`INSERT OR IGNORE INTO workforce_employers
      (id, legal_name, employer_type, environment, psira_status, nbcpss_status, psspf_status, uif_status, coida_status,
       insurance_status, service_agreement_status, status, last_reviewed_at, review_due_at, version, created_at, updated_at)
      VALUES ('EMP-LOKD-DEMO', 'LOKD Workforce · synthetic', 'lokd_employer', 'demo', 'current', 'current', 'current',
       'current', 'current', 'current', 'current', 'current', ?, ?, 1, ?, ?)`)
      .bind(now.toISOString(), isoOffset(now, 60 * 24 * 90), now.toISOString(), now.toISOString()),
    db.prepare(`INSERT OR IGNORE INTO workforce_employers
      (id, legal_name, employer_type, environment, psira_status, nbcpss_status, psspf_status, uif_status, coida_status,
       insurance_status, service_agreement_status, status, last_reviewed_at, review_due_at, version, created_at, updated_at)
      VALUES ('EMP-PARTNER-DEMO', 'Approved Partner Security · synthetic', 'partner_company', 'demo', 'current', 'current',
       'current', 'current', 'current', 'current', 'current', 'current', ?, ?, 1, ?, ?)`)
      .bind(now.toISOString(), isoOffset(now, 60 * 24 * 60), now.toISOString(), now.toISOString()),
    ...[
      ["WE-OFF-001", "OFF-001", "EMP-LOKD-DEMO", "direct_flex", "OFF-001", "DF-DEMO-001", "LOKD-DIRECT-FLEX-DEMO-v1", "ready", "ready", 24],
      ["WE-OFF-002", "OFF-002", "EMP-PARTNER-DEMO", "partner", "OFF-002", "PARTNER-DEMO-002", "LOKD-PARTNER-DEMO-v1", "partner_confirmed", "partner_confirmed", null],
      ["WE-OFF-003", "OFF-003", "EMP-LOKD-DEMO", "managed", "OFF-003", "MANAGED-DEMO-003", "LOKD-MANAGED-DEMO-v1", "ready", "ready", null],
      ["WE-OFF-004", "OFF-004", "EMP-LOKD-DEMO", "direct_flex", "OFF-004", "DF-DEMO-004", "LOKD-DIRECT-FLEX-DEMO-v1", "ready", "ready", 24],
    ].map(([id, officerId, employerId, model, activeKey, engagementReference, termsVersion, payrollStatus, benefitsStatus, weeklyHourCap]) => db.prepare(`INSERT OR IGNORE INTO workforce_engagements
      (id, officer_id, employer_id, model, environment, status, active_key, engagement_reference, terms_version,
       payroll_status, benefits_status, weekly_hour_cap, activated_at, ended_at, review_due_at, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'demo', 'active', ?, ?, ?, ?, ?, ?, ?, NULL, ?, 1, ?, ?)`)
      .bind(id, officerId, employerId, model, activeKey, engagementReference, termsVersion, payrollStatus, benefitsStatus,
        weeklyHourCap, now.toISOString(), isoOffset(now, 60 * 24 * 90), now.toISOString(), now.toISOString())),
    ...[
      ["WTA-OFF-001", "WE-OFF-001", "OFF-001", "LOKD-DIRECT-FLEX-DEMO-v1"],
      ["WTA-OFF-002", "WE-OFF-002", "OFF-002", "LOKD-PARTNER-DEMO-v1"],
      ["WTA-OFF-003", "WE-OFF-003", "OFF-003", "LOKD-MANAGED-DEMO-v1"],
      ["WTA-OFF-004", "WE-OFF-004", "OFF-004", "LOKD-DIRECT-FLEX-DEMO-v1"],
    ].map(([id, engagementId, officerId, termsVersion]) => db.prepare(`INSERT OR IGNORE INTO workforce_terms_acceptances
      (id, workforce_engagement_id, officer_id, terms_version, acceptance_mode, evidence_reference,
       accepted_at, expires_at, version, active_key, created_at)
      VALUES (?, ?, ?, ?, 'synthetic_demo_acceptance', ?, ?, ?, 1, ?, ?)`)
      .bind(id, engagementId, officerId, termsVersion, `demo:terms:${id}`, now.toISOString(),
        isoOffset(now, 60 * 24 * 90), engagementId, now.toISOString())),
    ...["EMP-LOKD-DEMO", "EMP-PARTNER-DEMO"].flatMap((employerId) =>
      ["psira", "nbcpss", "psspf", "uif", "coida", "insurance", "service_agreement"].map((controlCode) =>
        db.prepare(`INSERT OR IGNORE INTO employer_compliance_evidence
          (id, employer_id, control_code, status, evidence_reference, verified_at, expires_at,
           version, active_key, created_at)
          VALUES (?, ?, ?, 'current', ?, ?, ?, 1, ?, ?)`)
          .bind(`ECE-${employerId}-${controlCode}`, employerId, controlCode,
            `demo:evidence:${employerId}:${controlCode}`, now.toISOString(), isoOffset(now, 60 * 24 * 90),
            `${employerId}:${controlCode}`, now.toISOString()))),
    ...OPERATIONS_DEMO_OFFICER_IDS.flatMap((officerId) => [
      db.prepare(`INSERT OR IGNORE INTO compliance_records
        (id, officer_id, record_type, status, verified_at, expires_at, next_due_at)
        VALUES (?, ?, 'identity', 'current', ?, ?, ?)`)
        .bind(`CR-${officerId}-IDENTITY`, officerId, now.toISOString(), isoOffset(now, 60 * 24 * 365), isoOffset(now, 60 * 24 * 300)),
      db.prepare(`INSERT OR IGNORE INTO compliance_records
        (id, officer_id, record_type, status, verified_at, expires_at, next_due_at)
        VALUES (?, ?, 'psira', 'current', ?, ?, ?)`)
        .bind(`CR-${officerId}-PSIRA`, officerId, now.toISOString(), isoOffset(now, 60 * 24 * 270), isoOffset(now, 60 * 24 * 240)),
    ]),
    ...[
      ["OFF-002", "LOKD-DEMO-002", "demo-operations-token-002"],
      ["OFF-003", "LOKD-DEMO-003", "demo-operations-token-003"],
      ["OFF-004", "LOKD-DEMO-004", "demo-reserve-token-004"],
      ["OFF-005", "LOKD-DEMO-005", "demo-reserve-token-005"],
    ].map(([officerId, passportNumber, tokenHash]) => db.prepare(`INSERT OR IGNORE INTO officer_passports
      (officer_id, passport_number, public_token_hash, status, readiness_label, environment, integrity_state,
       issued_at, last_reviewed_at, next_review_at, updated_at)
      SELECT id, ?, ?, 'active', 'LOKD Ready', 'demo', 'synthetic', ?, ?, ?, ? FROM officers
      WHERE id = ?`)
      .bind(passportNumber, tokenHash, now.toISOString(), now.toISOString(), isoOffset(now, 60 * 24 * 90),
        now.toISOString(), officerId)),
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
    ...OPERATIONS_DEMO_OFFICER_IDS.map((officerId) =>
      db.prepare(`INSERT OR IGNORE INTO officer_schedule_declarations
        (id, officer_id, version, status, environment, integrity_state, evidence_reference,
         declared_at, expires_at, supersedes_id, created_at)
        VALUES (?, ?, 1, 'current', 'demo', 'synthetic', ?, ?, ?, NULL, ?)`)
        .bind(`OSD-DEMO-${officerId}-01`, officerId, `demo:schedule-declaration:${officerId}:1`,
          now.toISOString(), isoOffset(now, 60 * 24 * 90), now.toISOString())),
    db.prepare(`INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date,
       shift_start, shift_end, client_price_cents, officer_rate_cents, funding_status, release_cadence,
       environment, integrity_state, status)
      SELECT ?, client.id, ?, ?, ?, 'Unarmed', 'Grade C', 1, ?, ?, '06:00', '18:00', 140000, 80000,
       'paid_in_full', 'Weekly', 'demo', 'synthetic', 'active'
      FROM clients client WHERE client.id = ? AND client.environment = 'demo' AND client.integrity_state = 'synthetic'`)
      .bind("BK-2081", "Northbridge Rosebank Offices", "Rosebank", "Main access", today, endDate, PILOT_CLIENT_ID),
    db.prepare(`INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date,
       shift_start, shift_end, client_price_cents, officer_rate_cents, funding_status, release_cadence,
       environment, integrity_state, status)
      SELECT ?, client.id, ?, ?, ?, 'Unarmed', 'Grade C', 1, ?, ?, '06:00', '18:00', 140000, 80000,
       'paid_in_full', 'Weekly', 'demo', 'synthetic', 'staffed'
      FROM clients client WHERE client.id = ? AND client.environment = 'demo' AND client.integrity_state = 'synthetic'`)
      .bind("BK-2084", "Metsi Midrand Depot", "Midrand", "Contractor access", today, endDate, PILOT_CLIENT_ID),
    db.prepare(`INSERT OR IGNORE INTO bookings
      (id, client_id, site_name, site_area, post_name, service_type, minimum_grade, contract_months, start_date, end_date,
       shift_start, shift_end, client_price_cents, officer_rate_cents, funding_status, release_cadence,
       environment, integrity_state, status)
      SELECT ?, client.id, ?, ?, ?, 'Unarmed', 'Grade C', 1, ?, ?, '18:00', '06:00', 140000, 80000,
       'paid_in_full', 'Weekly', 'demo', 'synthetic', 'active'
      FROM clients client WHERE client.id = ? AND client.environment = 'demo' AND client.integrity_state = 'synthetic'`)
      .bind("BK-2090", "Eastline Linbro Yard", "Linbro Park", "Vehicle gate", today, endDate, PILOT_CLIENT_ID),
    ...[
      ["FR-DEMO-2081", "BK-2081", 140000],
      ["FR-DEMO-2084", "BK-2084", 140000],
      ["FR-DEMO-2090", "BK-2090", 140000],
    ].map(([id, bookingId, amountCents]) => db.prepare(`INSERT OR IGNORE INTO booking_funding_reconciliations
      (id, booking_id, environment, provider, provider_reference, currency, expected_amount_cents,
       cleared_amount_cents, status, cleared_at, reconciled_at, evidence_reference,
       evidence_verified_at, evidence_expires_at, version, active_key, created_at)
      VALUES (?, ?, 'demo', 'demo_manual', ?, 'ZAR', ?, ?, 'synthetic_confirmed', ?, ?, ?, ?, ?, 1, ?, ?)`)
      .bind(id, bookingId, `demo:${bookingId}`, amountCents, amountCents, now.toISOString(), now.toISOString(),
        `demo:evidence:${bookingId}`, now.toISOString(), isoOffset(now, 60 * 24 * 30), bookingId, now.toISOString())),
    db.prepare(`INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, status, check_in_at, check_out_at, client_signoff_status, signed_off_at, earnings_cents)
      VALUES (?, ?, ?, ?, 'on_post', ?, NULL, 'not_due', NULL, 80000)`)
      .bind("SH-2081", "BK-2081", "OFF-001", today, isoOffset(now, -154)),
    db.prepare(`INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, status, check_in_at, check_out_at, client_signoff_status, signed_off_at, earnings_cents)
      VALUES (?, ?, ?, ?, 'confirmed', NULL, NULL, 'not_due', NULL, 80000)`)
      .bind("SH-OPS-2084", "BK-2084", "OFF-002", today),
    db.prepare(`INSERT OR IGNORE INTO shifts
      (id, booking_id, officer_id, scheduled_date, status, check_in_at, check_out_at, client_signoff_status, signed_off_at, earnings_cents)
      VALUES (?, ?, ?, ?, 'on_post', ?, NULL, 'not_due', NULL, 80000)`)
      .bind("SH-2090", "BK-2090", "OFF-003", today, isoOffset(now, -94)),
    db.prepare(`INSERT OR IGNORE INTO operational_sites
      (id, client_id, booking_id, name, area, address_label, latitude_e6, longitude_e6, timezone, risk_band,
       service_type, geofence_radius_meters, geofence_version, telemetry_mode, sensitivity_classification,
       environment, integrity_state, status, version, updated_by, created_at, updated_at)
      SELECT ?, client.id, booking.id, ?, ?, ?, ?, ?, 'Africa/Johannesburg', ?, 'Unarmed', ?, 1, 'simulated',
       'operational', 'demo', 'synthetic', 'active', 1, 'demo-seed', ?, ?
      FROM clients client JOIN bookings booking ON booking.client_id = client.id
      WHERE client.id = ? AND booking.id = ? AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`)
      .bind("SITE-RSB", "Northbridge Rosebank Offices", "Rosebank", "Pilot address withheld · Rosebank", -26146800, 28041700,
        "Standard", 120, now.toISOString(), now.toISOString(), PILOT_CLIENT_ID, "BK-2081"),
    db.prepare(`INSERT OR IGNORE INTO operational_sites
      (id, client_id, booking_id, name, area, address_label, latitude_e6, longitude_e6, timezone, risk_band,
       service_type, geofence_radius_meters, geofence_version, telemetry_mode, sensitivity_classification,
       environment, integrity_state, status, version, updated_by, created_at, updated_at)
      SELECT ?, client.id, booking.id, ?, ?, ?, ?, ?, 'Africa/Johannesburg', ?, 'Unarmed', ?, 1, 'simulated',
       'operational', 'demo', 'synthetic', 'active', 1, 'demo-seed', ?, ?
      FROM clients client JOIN bookings booking ON booking.client_id = client.id
      WHERE client.id = ? AND booking.id = ? AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`)
      .bind("SITE-MID", "Metsi Midrand Depot", "Midrand", "Pilot address withheld · Midrand", -25999200, 28126300,
        "Enhanced", 140, now.toISOString(), now.toISOString(), PILOT_CLIENT_ID, "BK-2084"),
    db.prepare(`INSERT OR IGNORE INTO operational_sites
      (id, client_id, booking_id, name, area, address_label, latitude_e6, longitude_e6, timezone, risk_band,
       service_type, geofence_radius_meters, geofence_version, telemetry_mode, sensitivity_classification,
       environment, integrity_state, status, version, updated_by, created_at, updated_at)
      SELECT ?, client.id, booking.id, ?, ?, ?, ?, ?, 'Africa/Johannesburg', ?, 'Unarmed', ?, 1, 'simulated',
       'operational', 'demo', 'synthetic', 'active', 1, 'demo-seed', ?, ?
      FROM clients client JOIN bookings booking ON booking.client_id = client.id
      WHERE client.id = ? AND booking.id = ? AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`)
      .bind("SITE-LIN", "Eastline Linbro Yard", "Linbro Park", "Pilot address withheld · Linbro Park", -26084700, 28122400,
        "Enhanced", 160, now.toISOString(), now.toISOString(), PILOT_CLIENT_ID, "BK-2090"),
    ...[
      ["SRA-DEMO-RSB", "SITE-RSB", "Standard"],
      ["SRA-DEMO-MID", "SITE-MID", "Enhanced"],
      ["SRA-DEMO-LIN", "SITE-LIN", "Enhanced"],
    ].map(([id, siteId, riskBand]) => db.prepare(`INSERT OR IGNORE INTO site_risk_assessments
      (id, site_id, risk_rules_version, risk_band, status, evidence_reference, approved_by,
       approved_at, valid_from, expires_at, version, active_key, created_at)
      VALUES (?, ?, 'LOKD-RISK-RULES-2026.09', ?, 'approved', ?, 'Synthetic Operations demo', ?, ?, ?, 1, ?, ?)`)
      .bind(id, siteId, riskBand, `demo:risk:${siteId}`, now.toISOString(), now.toISOString(),
        isoOffset(now, 60 * 24 * 90), siteId, now.toISOString())),
    db.prepare(`INSERT OR IGNORE INTO site_posts
      (id, site_id, booking_id, name, service_type, purpose_code, minimum_grade, post_orders_version,
       environment, integrity_state, status, created_at, updated_at)
      SELECT ?, site.id, booking.id, ?, 'Unarmed', ?, 'Grade C', ?, 'demo', 'synthetic', 'active', ?, ?
      FROM operational_sites site JOIN bookings booking ON booking.id = site.booking_id
      WHERE site.id = ? AND booking.id = ? AND site.environment = 'demo' AND site.integrity_state = 'synthetic'
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`)
      .bind("POST-RSB-01", "Main access", "commercial_access", "PO-RSB-01.3", now.toISOString(), now.toISOString(), "SITE-RSB", "BK-2081"),
    db.prepare(`INSERT OR IGNORE INTO site_posts
      (id, site_id, booking_id, name, service_type, purpose_code, minimum_grade, post_orders_version,
       environment, integrity_state, status, created_at, updated_at)
      SELECT ?, site.id, booking.id, ?, 'Unarmed', ?, 'Grade C', ?, 'demo', 'synthetic', 'active', ?, ?
      FROM operational_sites site JOIN bookings booking ON booking.id = site.booking_id
      WHERE site.id = ? AND booking.id = ? AND site.environment = 'demo' AND site.integrity_state = 'synthetic'
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`)
      .bind("POST-MID-01", "Contractor access", "construction", "PO-MID-02.1", now.toISOString(), now.toISOString(), "SITE-MID", "BK-2084"),
    db.prepare(`INSERT OR IGNORE INTO site_posts
      (id, site_id, booking_id, name, service_type, purpose_code, minimum_grade, post_orders_version,
       environment, integrity_state, status, created_at, updated_at)
      SELECT ?, site.id, booking.id, ?, 'Unarmed', ?, 'Grade C', ?, 'demo', 'synthetic', 'active', ?, ?
      FROM operational_sites site JOIN bookings booking ON booking.id = site.booking_id
      WHERE site.id = ? AND booking.id = ? AND site.environment = 'demo' AND site.integrity_state = 'synthetic'
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`)
      .bind("POST-LIN-01", "Vehicle gate", "secure_logistics", "PO-LIN-01.6", now.toISOString(), now.toISOString(), "SITE-LIN", "BK-2090"),
    db.prepare(`INSERT OR IGNORE INTO site_posts
      (id, site_id, booking_id, name, service_type, purpose_code, minimum_grade, post_orders_version,
       environment, integrity_state, status, created_at, updated_at)
      SELECT ?, site.id, booking.id, ?, 'Unarmed', ?, 'Grade C', ?, 'demo', 'synthetic', 'active', ?, ?
      FROM operational_sites site JOIN bookings booking ON booking.id = site.booking_id
      WHERE site.id = ? AND booking.id = ? AND site.environment = 'demo' AND site.integrity_state = 'synthetic'
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`)
      .bind("POST-LIN-02", "Perimeter rover", "secure_logistics", "PO-LIN-02.2", now.toISOString(), now.toISOString(), "SITE-LIN", "BK-2090"),
    ...[
      ["POA-DEMO-RSB-01", "POST-RSB-01", "PO-RSB-01.3"],
      ["POA-DEMO-MID-01", "POST-MID-01", "PO-MID-02.1"],
      ["POA-DEMO-LIN-01", "POST-LIN-01", "PO-LIN-01.6"],
      ["POA-DEMO-LIN-02", "POST-LIN-02", "PO-LIN-02.2"],
    ].map(([id, postId, ordersVersion]) => db.prepare(`INSERT OR IGNORE INTO post_order_approvals
      (id, post_id, post_orders_version, status, evidence_reference, approved_by, approved_at,
       valid_from, expires_at, version, active_key, created_at)
      VALUES (?, ?, ?, 'approved', ?, 'Synthetic Operations demo', ?, ?, ?, 1, ?, ?)`)
      .bind(id, postId, ordersVersion, `demo:post-orders:${postId}`, now.toISOString(), now.toISOString(),
        isoOffset(now, 60 * 24 * 90), postId, now.toISOString())),
    ...[
      ["IND-DEMO-OFF-001-RSB", "OFF-001", "SITE-RSB", "IND-RSB-v1"],
      ["IND-DEMO-OFF-002-MID", "OFF-002", "SITE-MID", "IND-MID-v1"],
      ["IND-DEMO-OFF-003-LIN", "OFF-003", "SITE-LIN", "IND-LIN-v1"],
      ["IND-DEMO-OFF-004-LIN", "OFF-004", "SITE-LIN", "IND-LIN-v1"],
      ["IND-DEMO-OFF-005-LIN", "OFF-005", "SITE-LIN", "IND-LIN-v1"],
    ].map(([id, officerId, siteId, inductionVersion]) => db.prepare(`INSERT OR IGNORE INTO officer_site_inductions
      (id, officer_id, site_id, induction_version, status, evidence_reference, completed_at,
       expires_at, version, active_key, created_at)
      VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, 1, ?, ?)`)
      .bind(id, officerId, siteId, inductionVersion, `demo:induction:${id}`, now.toISOString(),
        isoOffset(now, 60 * 24 * 90), `${officerId}:${siteId}`, now.toISOString())),
    ...[
      ["TRAVEL-DEMO-OFF-004-LIN", "OFF-004", "SITE-LIN", 42],
      ["TRAVEL-DEMO-OFF-005-LIN", "OFF-005", "SITE-LIN", 36],
    ].map(([id, officerId, siteId, estimatedMinutes]) => db.prepare(`INSERT OR IGNORE INTO officer_travel_assessments
      (id, officer_id, site_id, status, estimated_minutes, source, evidence_reference, assessed_at,
       valid_until, version, active_key, created_at)
      VALUES (?, ?, ?, 'feasible', ?, 'synthetic_route_matrix', ?, ?, ?, 1, ?, ?)`)
      .bind(id, officerId, siteId, estimatedMinutes, `demo:travel:${id}`, now.toISOString(),
        isoOffset(now, 60 * 24 * 30), `${officerId}:${siteId}`, now.toISOString())),
    db.prepare(`INSERT OR IGNORE INTO roster_slots
      (id, site_id, post_id, booking_id, service_date, starts_at, ends_at, arrival_due_at, check_in_due_at,
       environment, integrity_state, status, absence_reason, version, created_at, updated_at)
      SELECT ?, site.id, post.id, booking.id, ?, ?, ?, ?, ?, 'demo', 'synthetic', 'scheduled', NULL, 1, ?, ?
      FROM operational_sites site JOIN clients client ON client.id = site.client_id
      JOIN bookings booking ON booking.id = site.booking_id AND booking.client_id = client.id
      JOIN site_posts post ON post.site_id = site.id AND post.booking_id = booking.id
      WHERE site.id = ? AND post.id = ? AND booking.id = ?
        AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
        AND site.environment = 'demo' AND site.integrity_state = 'synthetic'
        AND post.environment = 'demo' AND post.integrity_state = 'synthetic'`)
      .bind("SLOT-RSB-01", today, isoOffset(now, -154), isoOffset(now, 566), isoOffset(now, -169), isoOffset(now, -144),
        now.toISOString(), now.toISOString(), "SITE-RSB", "POST-RSB-01", "BK-2081"),
    db.prepare(`INSERT OR IGNORE INTO roster_slots
      (id, site_id, post_id, booking_id, service_date, starts_at, ends_at, arrival_due_at, check_in_due_at,
       environment, integrity_state, status, absence_reason, version, created_at, updated_at)
      SELECT ?, site.id, post.id, booking.id, ?, ?, ?, ?, ?, 'demo', 'synthetic', 'scheduled', NULL, 1, ?, ?
      FROM operational_sites site JOIN clients client ON client.id = site.client_id
      JOIN bookings booking ON booking.id = site.booking_id AND booking.client_id = client.id
      JOIN site_posts post ON post.site_id = site.id AND post.booking_id = booking.id
      WHERE site.id = ? AND post.id = ? AND booking.id = ?
        AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
        AND site.environment = 'demo' AND site.integrity_state = 'synthetic'
        AND post.environment = 'demo' AND post.integrity_state = 'synthetic'`)
      .bind("SLOT-MID-01", today, isoOffset(now, 24), isoOffset(now, 744), isoOffset(now, 9), isoOffset(now, 34),
        now.toISOString(), now.toISOString(), "SITE-MID", "POST-MID-01", "BK-2084"),
    db.prepare(`INSERT OR IGNORE INTO roster_slots
      (id, site_id, post_id, booking_id, service_date, starts_at, ends_at, arrival_due_at, check_in_due_at,
       environment, integrity_state, status, absence_reason, version, created_at, updated_at)
      SELECT ?, site.id, post.id, booking.id, ?, ?, ?, ?, ?, 'demo', 'synthetic', 'scheduled', NULL, 1, ?, ?
      FROM operational_sites site JOIN clients client ON client.id = site.client_id
      JOIN bookings booking ON booking.id = site.booking_id AND booking.client_id = client.id
      JOIN site_posts post ON post.site_id = site.id AND post.booking_id = booking.id
      WHERE site.id = ? AND post.id = ? AND booking.id = ?
        AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
        AND site.environment = 'demo' AND site.integrity_state = 'synthetic'
        AND post.environment = 'demo' AND post.integrity_state = 'synthetic'`)
      .bind("SLOT-LIN-01", today, isoOffset(now, -94), isoOffset(now, 626), isoOffset(now, -109), isoOffset(now, -84),
        now.toISOString(), now.toISOString(), "SITE-LIN", "POST-LIN-01", "BK-2090"),
    db.prepare(`INSERT OR IGNORE INTO roster_slots
      (id, site_id, post_id, booking_id, service_date, starts_at, ends_at, arrival_due_at, check_in_due_at,
       environment, integrity_state, status, absence_reason, version, created_at, updated_at)
      SELECT ?, site.id, post.id, booking.id, ?, ?, ?, ?, ?, 'demo', 'synthetic', 'uncovered',
       'Additional coverage requirement', 1, ?, ?
      FROM operational_sites site JOIN clients client ON client.id = site.client_id
      JOIN bookings booking ON booking.id = site.booking_id AND booking.client_id = client.id
      JOIN site_posts post ON post.site_id = site.id AND post.booking_id = booking.id
      WHERE site.id = ? AND post.id = ? AND booking.id = ?
        AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
        AND site.environment = 'demo' AND site.integrity_state = 'synthetic'
        AND post.environment = 'demo' AND post.integrity_state = 'synthetic'`)
      .bind("SLOT-LIN-02", today, isoOffset(now, 150), isoOffset(now, 870), isoOffset(now, 120), isoOffset(now, 160),
        now.toISOString(), now.toISOString(), "SITE-LIN", "POST-LIN-02", "BK-2090"),
    db.prepare(`INSERT OR IGNORE INTO roster_assignments
      (id, roster_slot_id, officer_id, shift_id, assignment_kind, status, active_key, assigned_by, assigned_at,
       confirmed_at, released_at, version)
      VALUES (?, ?, ?, ?, 'primary', 'on_post', ?, 'demo-seed', ?, ?, NULL, 1)`)
      .bind("RA-RSB-01", "SLOT-RSB-01", "OFF-001", "SH-2081", "SLOT-RSB-01", isoOffset(now, -180), isoOffset(now, -170)),
    db.prepare(`INSERT OR IGNORE INTO roster_assignments
      (id, roster_slot_id, officer_id, shift_id, assignment_kind, status, active_key, assigned_by, assigned_at,
       confirmed_at, released_at, version)
      VALUES (?, ?, ?, ?, 'primary', 'confirmed', ?, 'demo-seed', ?, ?, NULL, 1)`)
      .bind("RA-MID-01", "SLOT-MID-01", "OFF-002", "SH-OPS-2084", "SLOT-MID-01", isoOffset(now, -90), isoOffset(now, -76)),
    db.prepare(`INSERT OR IGNORE INTO roster_assignments
      (id, roster_slot_id, officer_id, shift_id, assignment_kind, status, active_key, assigned_by, assigned_at,
       confirmed_at, released_at, version)
      VALUES (?, ?, ?, ?, 'primary', 'on_post', ?, 'demo-seed', ?, ?, NULL, 1)`)
      .bind("RA-LIN-01", "SLOT-LIN-01", "OFF-003", "SH-2090", "SLOT-LIN-01", isoOffset(now, -130), isoOffset(now, -120)),
    ...[
      ["AWS-RA-RSB-01", "RA-RSB-01", "WE-OFF-001", "OFF-001", "EMP-LOKD-DEMO", "direct_flex", "LOKD Workforce · synthetic", "LOKD-DIRECT-FLEX-DEMO-v1"],
      ["AWS-RA-MID-01", "RA-MID-01", "WE-OFF-002", "OFF-002", "EMP-PARTNER-DEMO", "partner", "Approved Partner Security · synthetic", "LOKD-PARTNER-DEMO-v1"],
      ["AWS-RA-LIN-01", "RA-LIN-01", "WE-OFF-003", "OFF-003", "EMP-LOKD-DEMO", "managed", "LOKD Workforce · synthetic", "LOKD-MANAGED-DEMO-v1"],
    ].map(([id, rosterAssignmentId, workforceEngagementId, officerId, employerId, workforceModel, employerLegalName, termsVersion]) => db.prepare(`INSERT OR IGNORE INTO assignment_workforce_snapshots
      (id, roster_assignment_id, workforce_engagement_id, officer_id, employer_id, workforce_model, employer_legal_name,
       terms_version, decision, blockers, environment, captured_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synthetic_demo_only', '["Production activation remains locked."]', 'demo', ?)`)
      .bind(id, rosterAssignmentId, workforceEngagementId, officerId, employerId, workforceModel, employerLegalName, termsVersion, now.toISOString())),
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
      .bind("SIG-MID-001", "SITE-MID", "SH-OPS-2084", "OFF-002", "assignment_confirmed", -25999180, 28126280, 22,
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
      check_in_due_at = ?, updated_at = ? WHERE id = 'SLOT-RSB-01' AND version = 1 AND status = 'scheduled'
        AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(today, isoOffset(now, -154), isoOffset(now, 566), isoOffset(now, -169), isoOffset(now, -144), now.toISOString()),
    db.prepare(`UPDATE roster_slots SET service_date = ?, starts_at = ?, ends_at = ?, arrival_due_at = ?,
      check_in_due_at = ?, updated_at = ? WHERE id = 'SLOT-MID-01' AND version = 1 AND status = 'scheduled'
        AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(today, isoOffset(now, 24), isoOffset(now, 744), isoOffset(now, 9), isoOffset(now, 34), now.toISOString()),
    db.prepare(`UPDATE roster_slots SET service_date = ?, starts_at = ?, ends_at = ?, arrival_due_at = ?,
      check_in_due_at = ?, updated_at = ? WHERE id = 'SLOT-LIN-01' AND version = 1 AND status = 'scheduled'
        AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(today, isoOffset(now, -94), isoOffset(now, 626), isoOffset(now, -109), isoOffset(now, -84), now.toISOString()),
    db.prepare(`UPDATE roster_slots SET service_date = ?, starts_at = ?, ends_at = ?, arrival_due_at = ?,
      check_in_due_at = ?, updated_at = ? WHERE id = 'SLOT-LIN-02' AND version = 1 AND status = 'uncovered'
        AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(today, isoOffset(now, 150), isoOffset(now, 870), isoOffset(now, 120), isoOffset(now, 160), now.toISOString()),
    db.prepare(`UPDATE officer_availability_windows SET starts_at = ?, ends_at = ?, rest_confirmed_at = ?
      WHERE id = 'AVAIL-OFF-004-01' AND version = 1 AND status = 'available'
        AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(isoOffset(now, -60), isoOffset(now, 60 * 24), now.toISOString()),
    db.prepare(`UPDATE officer_availability_windows SET starts_at = ?, ends_at = ?, rest_confirmed_at = ?
      WHERE id = 'AVAIL-OFF-005-01' AND version = 1 AND status = 'available'
        AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(isoOffset(now, -60), isoOffset(now, 60 * 24), now.toISOString()),
    db.prepare(`UPDATE bookings SET purpose_code = 'secure_logistics', purpose_label = 'Secure logistics'
      WHERE id = 'BK-2090' AND environment = 'demo' AND integrity_state = 'synthetic'`),
    db.prepare(`UPDATE roster_assignments SET shift_id = 'SH-OPS-2084'
      WHERE id = 'RA-MID-01' AND shift_id IS NULL AND environment = 'demo' AND integrity_state = 'synthetic'
        AND EXISTS (SELECT 1 FROM shifts WHERE id = 'SH-OPS-2084'
          AND environment = 'demo' AND integrity_state = 'synthetic')`),
    db.prepare(`UPDATE compliance_records SET evidence_reference = COALESCE(evidence_reference, 'demo:compliance:' || id)
      WHERE id IN ('CR-OFF-001-IDENTITY','CR-OFF-001-PSIRA','CR-OFF-002-IDENTITY','CR-OFF-002-PSIRA',
        'CR-OFF-003-IDENTITY','CR-OFF-003-PSIRA','CR-OFF-004-IDENTITY','CR-OFF-004-PSIRA',
        'CR-OFF-005-IDENTITY','CR-OFF-005-PSIRA')
        AND environment = 'demo' AND integrity_state = 'synthetic'`),
    db.prepare(`UPDATE officer_passports
      SET evidence_reference = COALESCE(evidence_reference, 'demo:passport:' || passport_number)
      WHERE officer_id IN ('OFF-001','OFF-002','OFF-003','OFF-004','OFF-005')
        AND environment = 'demo' AND integrity_state = 'synthetic'`),
    db.prepare(`UPDATE officer_endorsements
      SET evidence_reference = COALESCE(evidence_reference, 'demo:endorsement:' || id)
      WHERE officer_id IN ('OFF-004','OFF-005') AND environment = 'demo' AND integrity_state = 'synthetic'`),
    db.prepare(`UPDATE officer_availability_windows
      SET evidence_reference = COALESCE(evidence_reference, 'demo:availability:' || id)
      WHERE officer_id IN ('OFF-004','OFF-005') AND environment = 'demo' AND integrity_state = 'synthetic'`),
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
    FROM operational_sites s
    JOIN clients c ON c.id = s.client_id
      AND c.environment = 'demo' AND c.integrity_state = 'synthetic'
    JOIN bookings b ON b.id = s.booking_id AND b.client_id = c.id
      AND b.environment = 'demo' AND b.integrity_state = 'synthetic'
    WHERE s.status <> 'archived' AND s.environment = 'demo' AND s.integrity_state = 'synthetic'
    ORDER BY s.name`));
  const posts = await all<OperationsPost & { siteId: string }>(db.prepare(`SELECT sp.id, sp.site_id AS siteId,
    sp.booking_id AS bookingId, sp.name, sp.service_type AS serviceType, sp.purpose_code AS purposeCode,
    sp.minimum_grade AS minimumGrade, sp.post_orders_version AS postOrdersVersion, sp.status
    FROM site_posts sp
    JOIN operational_sites site ON site.id = sp.site_id
      AND site.environment = 'demo' AND site.integrity_state = 'synthetic'
    JOIN clients client ON client.id = site.client_id
      AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
    JOIN bookings booking ON booking.id = sp.booking_id AND booking.id = site.booking_id
      AND booking.client_id = client.id AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
    WHERE sp.status <> 'archived' AND sp.environment = 'demo' AND sp.integrity_state = 'synthetic'
    ORDER BY sp.name`));
  const deployments = await all<{
    siteId: string; shiftId: string | null; bookingId: string; officerId: string | null; officerName: string | null; passportStatus: string | null;
    postName: string; scheduledDate: string | null; shiftStart: string; shiftEnd: string; status: string | null; checkInAt: string | null;
  }>(db.prepare(`SELECT os.id AS siteId, sh.id AS shiftId, b.id AS bookingId, ra.officer_id AS officerId, o.full_name AS officerName,
    op.status AS passportStatus, sp.name AS postName, sh.scheduled_date AS scheduledDate,
    b.shift_start AS shiftStart, b.shift_end AS shiftEnd, sh.status, sh.check_in_at AS checkInAt
    FROM operational_sites os
    JOIN clients client ON client.id = os.client_id
      AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
    JOIN roster_slots rs ON rs.site_id = os.id
      AND rs.environment = 'demo' AND rs.integrity_state = 'synthetic'
    JOIN bookings b ON b.id = rs.booking_id AND b.id = os.booking_id AND b.client_id = client.id
      AND b.environment = 'demo' AND b.integrity_state = 'synthetic'
    JOIN site_posts sp ON sp.id = rs.post_id AND sp.site_id = os.id AND sp.booking_id = b.id
      AND sp.environment = 'demo' AND sp.integrity_state = 'synthetic'
    LEFT JOIN roster_assignments ra ON ra.roster_slot_id = rs.id AND ra.active_key = rs.id
      AND ra.environment = 'demo' AND ra.integrity_state = 'synthetic'
    LEFT JOIN shifts sh ON sh.id = ra.shift_id AND sh.booking_id = b.id
      AND sh.environment = 'demo' AND sh.integrity_state = 'synthetic'
    LEFT JOIN officers o ON o.id = ra.officer_id
    LEFT JOIN officer_passports op ON op.officer_id = o.id AND op.environment = 'demo' AND op.integrity_state = 'synthetic'
    WHERE rs.status <> 'cancelled' AND rs.environment = 'demo' AND rs.integrity_state = 'synthetic'
      AND os.environment = 'demo' AND os.integrity_state = 'synthetic'
      AND sp.environment = 'demo' AND sp.integrity_state = 'synthetic'
      AND b.environment = 'demo' AND b.integrity_state = 'synthetic'
      AND (ra.id IS NULL OR ra.shift_id IS NULL OR sh.id IS NOT NULL)
      AND (ra.id IS NULL OR op.officer_id IS NOT NULL)
    ORDER BY os.id,
      CASE WHEN rs.starts_at <= ? AND rs.ends_at > ? THEN 0 WHEN rs.starts_at > ? THEN 1 ELSE 2 END,
      CASE WHEN rs.ends_at <= ? THEN rs.ends_at END DESC,
      CASE WHEN rs.starts_at > ? THEN rs.starts_at END ASC,
      CASE WHEN ra.id IS NULL THEN 1 ELSE 0 END`).bind(now.toISOString(), now.toISOString(), now.toISOString(), now.toISOString(), now.toISOString()));
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
      AND os.environment = 'demo' AND os.integrity_state = 'synthetic'
    JOIN clients client ON client.id = os.client_id
      AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
    JOIN bookings b ON b.id = rs.booking_id AND b.id = os.booking_id AND b.client_id = client.id
      AND b.environment = 'demo' AND b.integrity_state = 'synthetic'
    JOIN site_posts sp ON sp.id = rs.post_id AND sp.site_id = os.id AND sp.booking_id = b.id
      AND sp.environment = 'demo' AND sp.integrity_state = 'synthetic'
    LEFT JOIN roster_assignments ra ON ra.roster_slot_id = rs.id AND ra.active_key = rs.id
      AND ra.environment = 'demo' AND ra.integrity_state = 'synthetic'
    LEFT JOIN shifts sh ON sh.id = ra.shift_id AND sh.booking_id = b.id
      AND sh.environment = 'demo' AND sh.integrity_state = 'synthetic'
    LEFT JOIN officers o ON o.id = ra.officer_id
    LEFT JOIN officer_passports op ON op.officer_id = ra.officer_id
      AND op.environment = 'demo' AND op.integrity_state = 'synthetic'
    WHERE rs.ends_at >= ? AND rs.starts_at <= ? AND rs.status <> 'cancelled'
      AND rs.environment = 'demo' AND rs.integrity_state = 'synthetic'
      AND os.environment = 'demo' AND os.integrity_state = 'synthetic'
      AND sp.environment = 'demo' AND sp.integrity_state = 'synthetic'
      AND (ra.id IS NULL OR ra.shift_id IS NULL OR sh.id IS NOT NULL)
      AND (ra.id IS NULL OR op.officer_id IS NOT NULL)
    ORDER BY rs.starts_at, os.name, sp.name`).bind(rosterWindowStart, rosterWindowEnd));
  const reliefRows = await all<OperationsReliefDispatch & { rosterSlotId: string; siteId: string }>(db.prepare(`SELECT rd.id,
    rd.roster_slot_id AS rosterSlotId, rd.site_id AS siteId, rd.replacement_officer_id AS replacementOfficerId,
    o.full_name AS replacementOfficerName, rd.status, rd.reason_code AS reasonCode, rd.priority,
    rd.requested_by AS requestedBy, rd.requested_at AS requestedAt, rd.response_due_at AS responseDueAt,
    rd.target_arrival_at AS targetArrivalAt,
    rd.accepted_at AS acceptedAt, rd.arrived_at AS arrivedAt, rd.version
    FROM relief_dispatches rd
    JOIN roster_slots rs ON rs.id = rd.roster_slot_id
      AND rs.environment = 'demo' AND rs.integrity_state = 'synthetic'
    JOIN operational_sites site ON site.id = rd.site_id AND site.id = rs.site_id
      AND site.environment = 'demo' AND site.integrity_state = 'synthetic'
    JOIN clients client ON client.id = site.client_id
      AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
    JOIN bookings booking ON booking.id = rs.booking_id AND booking.id = site.booking_id
      AND booking.client_id = client.id AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
    JOIN site_posts post ON post.id = rs.post_id AND post.site_id = site.id AND post.booking_id = booking.id
      AND post.environment = 'demo' AND post.integrity_state = 'synthetic'
    JOIN officers o ON o.id = rd.replacement_officer_id
    JOIN officer_passports op ON op.officer_id = o.id
      AND op.environment = 'demo' AND op.integrity_state = 'synthetic'
    WHERE rd.environment = 'demo' AND rd.integrity_state = 'synthetic'
    ORDER BY rd.requested_at DESC`));
  const reserveRows = await all<{
    id: string; fullName: string; city: string; psiraGrade: string; passportStatus: string; serviceTypes: string;
  }>(db.prepare(`SELECT o.id, o.full_name AS fullName, o.city, o.psira_grade AS psiraGrade,
    op.status AS passportStatus, GROUP_CONCAT(os.service_type, '|') AS serviceTypes
    FROM officers o JOIN officer_passports op ON op.officer_id = o.id
      AND op.environment = 'demo' AND op.integrity_state = 'synthetic'
    JOIN officer_services os ON os.officer_id = o.id
    JOIN workforce_engagements we ON we.officer_id = o.id AND we.status = 'active'
      AND we.active_key = o.id AND we.environment = 'demo'
    JOIN workforce_employers emp ON emp.id = we.employer_id AND emp.environment = 'demo'
    JOIN workforce_terms_acceptances terms ON terms.workforce_engagement_id = we.id
      AND terms.active_key = we.id AND terms.environment = 'demo' AND terms.integrity_state = 'synthetic'
    WHERE o.approval_status = 'approved' AND o.flex_available = 1 AND o.external_work_acknowledged = 1
      AND o.rest_window_confirmed = 1 AND op.status IN ('active', 'expiring') AND os.qualified = 1 AND os.opted_in = 1
    GROUP BY o.id, o.full_name, o.city, o.psira_grade, op.status
    ORDER BY o.psira_grade, o.full_name LIMIT 30`));
  const signals = await all<{
    id: string; siteId: string; shiftId: string | null; officerId: string | null; type: string; latitudeE6: number; longitudeE6: number; accuracyMeters: number | null;
    source: "simulated"; integrityState: "synthetic"; capturedAt: string; receivedAt: string;
  }>(db.prepare(`SELECT signal.id, signal.site_id AS siteId, signal.shift_id AS shiftId,
    signal.officer_id AS officerId, signal.signal_type AS type, signal.latitude_e6 AS latitudeE6,
    signal.longitude_e6 AS longitudeE6, signal.accuracy_meters AS accuracyMeters, signal.source,
    signal.integrity_state AS integrityState, signal.captured_at AS capturedAt, signal.received_at AS receivedAt
    FROM site_presence_signals signal
    JOIN operational_sites site ON site.id = signal.site_id
      AND site.environment = 'demo' AND site.integrity_state = 'synthetic'
    JOIN clients client ON client.id = site.client_id
      AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
    JOIN bookings booking ON booking.id = site.booking_id AND booking.client_id = client.id
      AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
    LEFT JOIN shifts shift ON shift.id = signal.shift_id AND shift.booking_id = booking.id
      AND shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
    LEFT JOIN officer_passports passport ON passport.officer_id = signal.officer_id
      AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
    WHERE signal.environment = 'demo' AND signal.integrity_state = 'synthetic'
      AND (signal.shift_id IS NULL OR shift.id IS NOT NULL)
      AND (signal.officer_id IS NULL OR passport.officer_id IS NOT NULL)
    ORDER BY signal.captured_at DESC`));
  const incidentRows = await all<Omit<OperationsIncident, "siteName"> & { siteName: string }>(db.prepare(`SELECT i.id,
    i.site_id AS siteId, s.name AS siteName, i.severity, i.category, i.summary, i.detail, i.status,
    i.owner_id AS ownerId, i.occurred_at AS occurredAt, i.reported_at AS reportedAt, i.sla_due_at AS slaDueAt,
    i.acknowledged_at AS acknowledgedAt, i.resolved_at AS resolvedAt, i.version
    FROM site_incidents i
    JOIN operational_sites s ON s.id = i.site_id
      AND s.environment = 'demo' AND s.integrity_state = 'synthetic'
    JOIN clients client ON client.id = s.client_id
      AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
    JOIN bookings booking ON booking.id = s.booking_id AND booking.client_id = client.id
      AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
    LEFT JOIN shifts shift ON shift.id = i.shift_id AND shift.booking_id = booking.id
      AND shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
    WHERE i.visibility = 'operations' AND (i.shift_id IS NULL OR shift.id IS NOT NULL)
    ORDER BY i.reported_at DESC`));
  const exceptionRows = await all<OperationsException>(db.prepare(`SELECT e.id, e.site_id AS siteId,
    s.name AS siteName, e.priority, e.exception_type AS exceptionType, e.summary, e.status,
    e.owner_id AS ownerId, e.detected_at AS detectedAt, e.sla_due_at AS slaDueAt, e.version
    FROM operational_exceptions e
    JOIN operational_sites s ON s.id = e.site_id
      AND s.environment = 'demo' AND s.integrity_state = 'synthetic'
    JOIN clients client ON client.id = s.client_id
      AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
    JOIN bookings booking ON booking.id = s.booking_id AND booking.client_id = client.id
      AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
    LEFT JOIN site_posts post ON post.id = e.post_id AND post.site_id = s.id AND post.booking_id = booking.id
      AND post.environment = 'demo' AND post.integrity_state = 'synthetic'
    LEFT JOIN shifts shift ON shift.id = e.shift_id AND shift.booking_id = booking.id
      AND shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
    WHERE (e.post_id IS NULL OR post.id IS NOT NULL) AND (e.shift_id IS NULL OR shift.id IS NOT NULL)
    ORDER BY e.detected_at DESC`));
  const incidentEventRows = await all<{
    id: string; siteId: string; siteName: string; eventType: string; detail: string; createdAt: string;
  }>(db.prepare(`SELECT ie.id, i.site_id AS siteId, s.name AS siteName, ie.event_type AS eventType,
    ie.detail, ie.created_at AS createdAt FROM incident_events ie
    JOIN site_incidents i ON i.id = ie.incident_id
    JOIN operational_sites s ON s.id = i.site_id
      AND s.environment = 'demo' AND s.integrity_state = 'synthetic'
    JOIN clients client ON client.id = s.client_id
      AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
    JOIN bookings booking ON booking.id = s.booking_id AND booking.client_id = client.id
      AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
    LEFT JOIN shifts shift ON shift.id = i.shift_id AND shift.booking_id = booking.id
      AND shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
    WHERE i.visibility = 'operations' AND (i.shift_id IS NULL OR shift.id IS NOT NULL)
    ORDER BY ie.created_at DESC LIMIT 20`));
  const reliefEventRows = await all<{
    id: string; siteId: string; siteName: string; eventType: string; detail: string; createdAt: string;
  }>(db.prepare(`SELECT rde.id, rd.site_id AS siteId, s.name AS siteName, rde.event_type AS eventType,
    rde.detail, rde.created_at AS createdAt FROM relief_dispatch_events rde
    JOIN relief_dispatches rd ON rd.id = rde.relief_dispatch_id
    JOIN roster_slots rs ON rs.id = rd.roster_slot_id
      AND rs.environment = 'demo' AND rs.integrity_state = 'synthetic'
    JOIN operational_sites s ON s.id = rd.site_id AND s.id = rs.site_id
      AND s.environment = 'demo' AND s.integrity_state = 'synthetic'
    JOIN clients client ON client.id = s.client_id
      AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
    JOIN bookings booking ON booking.id = rs.booking_id AND booking.id = s.booking_id
      AND booking.client_id = client.id AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
    JOIN site_posts post ON post.id = rs.post_id AND post.site_id = s.id AND post.booking_id = booking.id
      AND post.environment = 'demo' AND post.integrity_state = 'synthetic'
    WHERE rd.environment = 'demo' AND rd.integrity_state = 'synthetic'
    ORDER BY rde.created_at DESC LIMIT 20`));
  const launchGates = await all<OperationsCommandState["launch"]["gates"][number]>(db.prepare(`SELECT code, label,
    category, status, evidence_level AS evidenceLevel, evidence_reference AS evidenceReference, detail,
    hard_gate AS hardGate, verified_at AS verifiedAt, expires_at AS expiresAt
    FROM launch_controls ORDER BY sort_order, code`));
  const workforceRows = await all<{
    officerId: string; officerName: string; passportStatus: string | null; networkStatus: string;
    engagementStatus: OperationsWorkforceOfficer["employmentStatus"] | null;
    workforceModel: OperationsWorkforceOfficer["workforceModel"]; employerName: string | null;
    employerStatus: string | null; payrollStatus: string | null; benefitsStatus: string | null;
    weeklyHourCap: number | null; termsVersion: string | null;
  }>(db.prepare(`SELECT o.id AS officerId, o.full_name AS officerName, op.status AS passportStatus,
    o.approval_status AS networkStatus, we.status AS engagementStatus, we.model AS workforceModel,
    emp.legal_name AS employerName, emp.status AS employerStatus, we.payroll_status AS payrollStatus,
    we.benefits_status AS benefitsStatus, we.weekly_hour_cap AS weeklyHourCap, we.terms_version AS termsVersion
    FROM officers o JOIN officer_passports op ON op.officer_id = o.id
      AND op.environment = 'demo' AND op.integrity_state = 'synthetic'
    LEFT JOIN workforce_engagements we ON we.officer_id = o.id AND we.active_key = o.id AND we.environment = 'demo'
      AND EXISTS (SELECT 1 FROM workforce_employers employer_scope
        WHERE employer_scope.id = we.employer_id AND employer_scope.environment = 'demo')
    LEFT JOIN workforce_employers emp ON emp.id = we.employer_id AND emp.environment = 'demo'
    WHERE o.approval_status IN ('approved', 'pending') ORDER BY o.full_name LIMIT 25`));
  const workforceCounts = await db.prepare(`SELECT
    COALESCE(SUM(CASE WHEN o.approval_status = 'approved' THEN 1 ELSE 0 END), 0) AS verifiedNetwork,
    COALESCE(SUM(CASE WHEN we.id IS NULL THEN 1 ELSE 0 END), 0) AS profilesWithoutEmployment,
    COALESCE(SUM(CASE WHEN we.status = 'active' AND we.model = 'direct_flex' THEN 1 ELSE 0 END), 0) AS activeDirectFlex,
    COALESCE(SUM(CASE WHEN we.status = 'active' AND we.model = 'partner' THEN 1 ELSE 0 END), 0) AS activePartner,
    COALESCE(SUM(CASE WHEN we.status = 'active' AND we.model = 'managed' THEN 1 ELSE 0 END), 0) AS activeManaged
    FROM officers o JOIN officer_passports op ON op.officer_id = o.id
      AND op.environment = 'demo' AND op.integrity_state = 'synthetic'
    LEFT JOIN workforce_engagements we ON we.officer_id = o.id
      AND we.active_key = o.id AND we.environment = 'demo'
      AND EXISTS (SELECT 1 FROM workforce_employers employer_scope
        WHERE employer_scope.id = we.employer_id AND employer_scope.environment = 'demo')
    WHERE o.approval_status IN ('approved', 'pending')`).first<{
      verifiedNetwork: number; profilesWithoutEmployment: number; activeDirectFlex: number;
      activePartner: number; activeManaged: number;
    }>();
  const assignmentSnapshotCounts = await db.prepare(`SELECT COUNT(*) AS total,
    COALESCE(SUM(CASE WHEN aws.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS withSnapshots
    FROM roster_assignments ra
    JOIN roster_slots rs ON rs.id = ra.roster_slot_id
      AND rs.environment = 'demo' AND rs.integrity_state = 'synthetic'
    JOIN operational_sites site ON site.id = rs.site_id
      AND site.environment = 'demo' AND site.integrity_state = 'synthetic'
    JOIN clients client ON client.id = site.client_id
      AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
    JOIN bookings booking ON booking.id = rs.booking_id AND booking.id = site.booking_id
      AND booking.client_id = client.id AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
    JOIN site_posts post ON post.id = rs.post_id AND post.site_id = site.id AND post.booking_id = booking.id
      AND post.environment = 'demo' AND post.integrity_state = 'synthetic'
    JOIN officer_passports passport ON passport.officer_id = ra.officer_id
      AND passport.environment = 'demo' AND passport.integrity_state = 'synthetic'
    LEFT JOIN shifts shift ON shift.id = ra.shift_id AND shift.booking_id = booking.id
      AND shift.environment = 'demo' AND shift.integrity_state = 'synthetic'
    LEFT JOIN assignment_workforce_snapshots aws ON aws.roster_assignment_id = ra.id AND aws.environment = 'demo'
      AND EXISTS (SELECT 1 FROM workforce_engagements we
        JOIN workforce_employers employer ON employer.id = we.employer_id AND employer.environment = 'demo'
        WHERE we.id = aws.workforce_engagement_id AND we.officer_id = aws.officer_id AND we.environment = 'demo')
    WHERE ra.active_key IS NOT NULL AND ra.environment = 'demo' AND ra.integrity_state = 'synthetic'
      AND (ra.shift_id IS NULL OR shift.id IS NOT NULL)`)
    .first<{ total: number; withSnapshots: number }>();
  const activationCommandRows = await all<{
    commandId: string; activationKey: string | null; rosterSlotId: string; slotVersion: number; bookingId: string;
    clientName: string; siteName: string; postName: string; officerId: string; officerName: string;
    startsAt: string; endsAt: string; environment: "production" | "demo_synthetic";
    integrityState: "production_candidate" | "production_verified" | "synthetic_demo_only";
    state: "ready" | "blocked" | "reserved" | "activated"; lastDecisionAt: string;
    workforceModel: OperationsWorkforceOfficer["workforceModel"]; employerName: string | null;
    termsVersion: string | null; fundedWageCents: number; snapshotStatutoryCostCents: number | null;
    pricingVersion: string; fundingStatus: string | null; fundingReference: string | null;
    evidenceValidThrough: string | null; snapshotId: string | null; snapshotFinal: number | null;
    snapshotIntegrityState: string | null;
  }>(db.prepare(`SELECT c.id AS commandId,
    CASE WHEN c.environment = 'demo_synthetic' THEN c.activation_key ELSE NULL END AS activationKey,
    c.roster_slot_id AS rosterSlotId,
    c.expected_slot_version AS slotVersion, rs.booking_id AS bookingId, client.organisation_name AS clientName,
    os.name AS siteName, sp.name AS postName, c.officer_id AS officerId, o.full_name AS officerName,
    rs.starts_at AS startsAt, rs.ends_at AS endsAt, c.environment, c.integrity_state AS integrityState,
    c.state, COALESCE(d.evaluated_at, c.requested_at) AS lastDecisionAt,
    COALESCE(snap.workforce_model, we.model) AS workforceModel,
    COALESCE(snap.employer_legal_name, emp.legal_name) AS employerName,
    COALESCE(snap.terms_version, we.terms_version) AS termsVersion,
    COALESCE(snap.funded_offer_cents, b.officer_rate_cents) AS fundedWageCents,
    snap.statutory_cost_cents AS snapshotStatutoryCostCents,
    COALESCE(snap.pricing_version, b.pricing_version) AS pricingVersion,
    COALESCE(frozen_funding.status, current_funding.status) AS fundingStatus,
    CASE WHEN c.environment = 'production'
      AND COALESCE(frozen_funding.evidence_reference, current_funding.evidence_reference) IS NOT NULL
      THEN 'verified:' || substr(COALESCE(frozen_funding.evidence_reference, current_funding.evidence_reference), -6)
      ELSE COALESCE(frozen_funding.evidence_reference, current_funding.evidence_reference)
    END AS fundingReference,
    snap.evidence_valid_through AS evidenceValidThrough, snap.id AS snapshotId,
    snap.final AS snapshotFinal, snap.integrity_state AS snapshotIntegrityState
    FROM assignment_activation_commands c
    JOIN roster_slots rs ON rs.id = c.roster_slot_id
    JOIN bookings b ON b.id = rs.booking_id
    JOIN clients client ON client.id = b.client_id
    JOIN operational_sites os ON os.id = rs.site_id AND os.booking_id = b.id AND os.client_id = client.id
    JOIN site_posts sp ON sp.id = rs.post_id AND sp.site_id = os.id AND sp.booking_id = b.id
    JOIN officers o ON o.id = c.officer_id
    LEFT JOIN workforce_engagements we ON we.officer_id = c.officer_id AND we.active_key = we.officer_id
      AND we.environment = CASE WHEN c.environment = 'production' THEN 'production' ELSE 'demo' END
      AND EXISTS (SELECT 1 FROM workforce_employers employer_scope WHERE employer_scope.id = we.employer_id
        AND employer_scope.environment = CASE WHEN c.environment = 'production' THEN 'production' ELSE 'demo' END)
    LEFT JOIN workforce_employers emp ON emp.id = we.employer_id
      AND emp.environment = CASE WHEN c.environment = 'production' THEN 'production' ELSE 'demo' END
    LEFT JOIN assignment_activation_snapshots snap ON snap.command_id = c.id
      AND snap.environment = CASE WHEN c.environment = 'production' THEN 'production' ELSE 'demo' END
    LEFT JOIN booking_funding_reconciliations frozen_funding ON frozen_funding.id = snap.funding_reconciliation_id
      AND ((c.environment = 'production' AND frozen_funding.environment = 'production' AND frozen_funding.integrity_state = 'verified')
        OR (c.environment = 'demo_synthetic' AND frozen_funding.environment = 'demo' AND frozen_funding.integrity_state = 'synthetic'))
    LEFT JOIN booking_funding_reconciliations current_funding ON current_funding.active_key = b.id
      AND ((c.environment = 'production' AND current_funding.environment = 'production'
        AND current_funding.integrity_state = 'verified')
        OR (c.environment = 'demo_synthetic' AND current_funding.environment = 'demo'
          AND current_funding.integrity_state = 'synthetic'))
    LEFT JOIN assignment_activation_decisions d ON d.command_id = c.id
      AND d.sequence = (SELECT MAX(latest.sequence) FROM assignment_activation_decisions latest WHERE latest.command_id = c.id)
    WHERE c.environment IN ('production', 'demo_synthetic') AND (
      (c.environment = 'production'
        AND c.integrity_state IN ('production_candidate','production_verified')
        AND rs.environment = 'production' AND rs.integrity_state = 'production_verified'
        AND b.environment = 'production' AND b.integrity_state = 'production_verified'
        AND client.environment = 'production' AND client.integrity_state = 'production_verified'
        AND os.environment = 'production' AND os.integrity_state = 'production_verified'
        AND sp.environment = 'production' AND sp.integrity_state = 'production_verified')
      OR (c.environment = 'demo_synthetic' AND c.integrity_state = 'synthetic_demo_only'
        AND rs.environment = 'demo' AND rs.integrity_state = 'synthetic'
        AND b.environment = 'demo' AND b.integrity_state = 'synthetic'
        AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
        AND os.environment = 'demo' AND os.integrity_state = 'synthetic'
        AND sp.environment = 'demo' AND sp.integrity_state = 'synthetic')
    )
    ORDER BY COALESCE(d.evaluated_at, c.requested_at) DESC LIMIT 30`));
  const activationBlockerRows = await all<{ commandId: string; code: string; category: string; detail: string }>(db.prepare(`SELECT d.command_id AS commandId,
    b.code, b.category, b.detail FROM assignment_activation_blockers b
    JOIN assignment_activation_decisions d ON d.id = b.decision_id
    WHERE d.sequence = (SELECT MAX(latest.sequence) FROM assignment_activation_decisions latest WHERE latest.command_id = d.command_id)
    ORDER BY b.created_at, b.code`));
  const activationHourRows = await all<{ commandId: string; isoWeekStart: string; isoWeekEnd: string; minutes: number }>(db.prepare(`SELECT command_id AS commandId,
    iso_week_start AS isoWeekStart, iso_week_end AS isoWeekEnd, SUM(reserved_minutes) AS minutes
    FROM workforce_hour_reservations WHERE command_id IS NOT NULL AND status = 'active'
    GROUP BY command_id, iso_week_start, iso_week_end ORDER BY iso_week_start`));
  const activationRevalidationRows = await all<{ commandId: string; checkpoint: "t_minus_24" | "t_minus_2" | "check_in"; scheduledAt: string; status: string }>(db.prepare(`SELECT snap.command_id AS commandId,
    rv.checkpoint, rv.scheduled_at AS scheduledAt, rv.status FROM assignment_revalidations rv
    JOIN assignment_activation_snapshots snap ON snap.id = rv.snapshot_id
    ORDER BY rv.scheduled_at`));

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
  const workforceOfficers: OperationsWorkforceOfficer[] = workforceRows.map((row) => {
    const employmentStatus = row.engagementStatus ?? "not_employed";
    let nextControl = "Network member only · no employment or payroll activation";
    if (row.workforceModel === "direct_flex") nextControl = `LOKD payroll · ${row.weeklyHourCap ?? 24}h weekly Flex cap`;
    if (row.workforceModel === "partner") nextControl = "Partner remains employer · B2B compliance monitored";
    if (row.workforceModel === "managed") nextControl = "LOKD managed employment · recurring roster controls";
    if (employmentStatus !== "not_employed" && employmentStatus !== "active") nextControl = `Engagement ${employmentStatus.replaceAll("_", " ")} · deployment blocked`;
    return { ...row, employmentStatus, nextControl };
  });
  const currentTime = Date.now();
  const gateEvidenceIsCurrent = (gate: (typeof launchGates)[number]) => {
    const verifiedAt = gate.verifiedAt ? new Date(gate.verifiedAt).getTime() : Number.NaN;
    const expiresAt = gate.expiresAt ? new Date(gate.expiresAt).getTime() : Number.NaN;
    return Boolean(gate.hardGate)
      && (gate.evidenceLevel === "system_verified" || gate.evidenceLevel === "independently_verified")
      && Boolean(gate.evidenceReference)
      && Number.isFinite(verifiedAt) && verifiedAt <= currentTime
      && Number.isFinite(expiresAt) && expiresAt >= currentTime;
  };
  const launchGateState = launchGates.map((gate) => ({
    ...gate,
    hardGate: Boolean(gate.hardGate),
    status: gate.status === "passed" && !gateEvidenceIsCurrent(gate) ? "blocked" : gate.status,
  }));
  const requiredLaunchGates = launchGateState.filter((gate) => REQUIRED_LAUNCH_GATE_CODES.includes(gate.code as (typeof REQUIRED_LAUNCH_GATE_CODES)[number]));
  const launchDecision = launchGateDecision(launchGates.map((gate) => ({
    code: gate.code,
    status: gate.status,
    hardGate: Boolean(gate.hardGate),
    evidenceLevel: gate.evidenceLevel,
    evidenceReference: gate.evidenceReference,
    verifiedAt: gate.verifiedAt,
    expiresAt: gate.expiresAt,
  })));
  const launchBlockerLabels = launchDecision.blockers.map((code) => {
    const gateCode = code.includes(":") ? code.slice(code.indexOf(":") + 1) : code;
    const label = launchGates.find((gate) => gate.code === gateCode)?.label ?? gateCode;
    return code.startsWith("MISSING:") ? `Missing required gate: ${label}` : code.startsWith("DUPLICATE:") ? `Duplicate required gate: ${label}` : label;
  });
  const assignmentTotal = Number(assignmentSnapshotCounts?.total ?? 0);
  const assignmentWithSnapshot = Number(assignmentSnapshotCounts?.withSnapshots ?? 0);

  const activationQueue: OperationsAssignmentActivation[] = activationCommandRows.map((row) => {
    const { snapshotId, snapshotFinal, snapshotIntegrityState, snapshotStatutoryCostCents, ...publicRow } = row;
    const hourSegments = activationHourRows.filter((segment) => segment.commandId === row.commandId)
      .map(({ isoWeekStart, isoWeekEnd, minutes }) => ({ isoWeekStart, isoWeekEnd, minutes: Number(minutes) }));
    const revalidations = activationRevalidationRows.filter((item) => item.commandId === row.commandId && item.status === "pending");
    const nextRevalidation = revalidations.sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime())[0] ?? null;
    return {
      ...publicRow,
      recordKind: row.environment === "production" ? "production" : "synthetic_rehearsal",
      statutoryCostCents: snapshotStatutoryCostCents ?? (row.workforceModel === "partner" ? 0 : Math.round(row.fundedWageCents * 0.15)),
      fundingStatus: row.fundingStatus ?? "missing",
      reservedMinutes: hourSegments.reduce((sum, segment) => sum + segment.minutes, 0),
      hourSegments,
      evidenceValidThrough: row.evidenceValidThrough,
      revalidation: {
        nextCheckpoint: nextRevalidation?.checkpoint ?? null,
        nextDueAt: nextRevalidation?.scheduledAt ?? null,
        status: nextRevalidation ? "pending" : row.state === "activated" ? "complete" : "not_scheduled",
      },
      blockers: activationBlockerRows.filter((blocker) => blocker.commandId === row.commandId)
        .map(({ code, category, detail }) => ({ code, category, detail })),
      databaseProtected: Boolean(row.environment === "production"
        && row.integrityState === "production_verified"
        && row.state === "activated"
        && snapshotId
        && snapshotFinal === 1
        && snapshotIntegrityState === "production_verified"),
      productionAuthorised: false,
    };
  });
  const previewSlot = roster.find((slot) => slot.id === "SLOT-LIN-02") ?? roster.find((slot) => slot.coverageState === "uncovered");
  const previewOfficer = reserveOfficers.find((officer) => officer.id === "OFF-004") ?? reserveOfficers[0];
  if (previewSlot && previewOfficer && !activationQueue.some((item) => item.environment === "demo_synthetic"
    && item.rosterSlotId === previewSlot.id
    && item.officerId === previewOfficer.id && item.slotVersion === previewSlot.version)) {
    const preview = await evaluateAssignmentActivation(db, {
      rosterSlotId: previewSlot.id,
      officerId: previewOfficer.id,
      expectedSlotVersion: previewSlot.version,
      activationKey: `preview:${previewSlot.id}:${previewOfficer.id}:v${previewSlot.version}`,
      environment: "demo_synthetic",
      checkpoint: "activation",
    });
    activationQueue.unshift({
      commandId: null,
      activationKey: null,
      rosterSlotId: previewSlot.id,
      slotVersion: previewSlot.version,
      bookingId: previewSlot.bookingId,
      clientName: siteRows.find((site) => site.id === previewSlot.siteId)?.clientName ?? "Client",
      siteName: previewSlot.siteName,
      postName: previewSlot.postName,
      officerId: previewOfficer.id,
      officerName: previewOfficer.fullName,
      startsAt: previewSlot.startsAt,
      endsAt: previewSlot.endsAt,
      environment: "demo_synthetic",
      integrityState: "synthetic_demo_only",
      recordKind: "synthetic_rehearsal",
      state: preview.result.ready ? "ready" : "blocked",
      lastDecisionAt: preview.facts.evaluatedAt,
      workforceModel: preview.facts.workforce.model,
      employerName: preview.facts.workforce.employer.legalName,
      termsVersion: typeof preview.facts.workforce.terms.version === "string" ? preview.facts.workforce.terms.version : null,
      fundedWageCents: preview.facts.compensation.fundedOfferCents,
      statutoryCostCents: preview.facts.compensation.statutoryCostCents,
      pricingVersion: preview.facts.compensation.pricingVersion ?? "not frozen",
      fundingStatus: preview.facts.funding.status ?? "missing",
      fundingReference: preview.facts.funding.evidenceReference,
      reservedMinutes: 0,
      hourSegments: preview.result.weekSegments.map((segment) => ({
        isoWeekStart: segment.isoWeekStart,
        isoWeekEnd: segment.isoWeekEnd,
        minutes: segment.minutes,
      })),
      evidenceValidThrough: null,
      revalidation: { nextCheckpoint: null, nextDueAt: null, status: "not_scheduled" },
      blockers: preview.result.blockers,
      databaseProtected: false,
      productionAuthorised: false,
    });
  }

  const latestDeployment = new Map<string, (typeof deployments)[number]>();
  for (const deployment of deployments) if (!latestDeployment.has(deployment.siteId)) latestDeployment.set(deployment.siteId, deployment);
  const latestSignal = new Map<string, (typeof signals)[number]>();
  for (const signal of signals) {
    const deployment = latestDeployment.get(signal.siteId);
    if (!deployment?.shiftId || !deployment.officerId || signal.shiftId !== deployment.shiftId || signal.officerId !== deployment.officerId) continue;
    if (!latestSignal.has(signal.siteId)) latestSignal.set(signal.siteId, signal);
  }
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
      coveredSlots: roster.filter((slot) => Boolean(slot.officerId)).length,
      arrivalWatch: roster.filter((slot) => ["arrival_at_risk", "check_in_missing", "uncovered"].includes(slot.coverageState)).length,
      reliefActive: reliefRows.filter((relief) => !["cancelled", "closed"].includes(relief.status)).length,
      coveragePercent: roster.length ? Math.round((roster.filter((slot) => Boolean(slot.officerId)).length / roster.length) * 100) : 100,
    },
    launch: {
      activationLocked: !launchDecision.ready,
      passedHardGates: requiredLaunchGates.filter((gate) => gate.status === "passed" && gateEvidenceIsCurrent(gate)).length,
      totalHardGates: REQUIRED_LAUNCH_GATE_CODES.length,
      reportedGates: launchGates.filter((gate) => gate.status === "reported").length,
      blockers: launchBlockerLabels,
      gates: launchGateState,
    },
    workforce: {
      verifiedNetwork: Number(workforceCounts?.verifiedNetwork ?? 0),
      profilesWithoutEmployment: Number(workforceCounts?.profilesWithoutEmployment ?? 0),
      activeDirectFlex: Number(workforceCounts?.activeDirectFlex ?? 0),
      activePartner: Number(workforceCounts?.activePartner ?? 0),
      activeManaged: Number(workforceCounts?.activeManaged ?? 0),
      assignmentsWithEmployerSnapshot: assignmentWithSnapshot,
      assignmentsMissingEmployerSnapshot: Math.max(0, assignmentTotal - assignmentWithSnapshot),
      officers: workforceOfficers,
    },
    activation: {
      ready: activationQueue.filter((item) => item.state === "ready").length,
      blocked: activationQueue.filter((item) => item.state === "blocked").length,
      reserved: activationQueue.filter((item) => item.state === "reserved").length,
      activated: activationQueue.filter((item) => item.state === "activated").length,
      queue: activationQueue,
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
  if (payload.action === "evaluate_assignment_activation") {
    const rosterSlotId = requireId(payload.rosterSlotId, "Roster slot");
    const officerId = requireId(payload.officerId, "Officer");
    const expectedSlotVersion = requireVersion(payload.expectedSlotVersion);
    try {
      const evaluation = await evaluateAssignmentActivation(db, {
        rosterSlotId,
        officerId,
        expectedSlotVersion,
        activationKey: "demo-evaluation-preview",
        environment: "demo_synthetic",
        checkpoint: "activation",
      });
      await recordAssignmentActivationEvaluation(db, {
        rosterSlotId,
        officerId,
        expectedSlotVersion,
        activationKey: `demo-eval:${evaluation.evaluationHash}`,
        environment: "demo_synthetic",
        checkpoint: "activation",
      }, actor.email);
    } catch (cause) {
      if (cause instanceof AssignmentActivationError) throw new OperationsError(cause.message, cause.status);
      throw cause;
    }
    return;
  }
  if (payload.action === "create_incident") {
    const siteId = requireId(payload.siteId, "Site");
    if (!["low", "medium", "high", "critical"].includes(payload.severity)) throw new OperationsError("Choose a valid incident severity.");
    const category = requireText(payload.category, "Category", 3, 48).toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const summary = requireText(payload.summary, "Summary", 8, 120);
    const detail = requireText(payload.detail, "Incident detail", 12, 700);
    const site = await db.prepare(`SELECT site.id FROM operational_sites site
      JOIN clients client ON client.id = site.client_id
        AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
      JOIN bookings booking ON booking.id = site.booking_id AND booking.client_id = client.id
        AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
      WHERE site.id = ? AND site.status = 'active'
        AND site.environment = 'demo' AND site.integrity_state = 'synthetic'`)
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
      WHERE id = ? AND version = ? AND status = 'open'
        AND EXISTS (SELECT 1 FROM operational_sites site
          JOIN clients client ON client.id = site.client_id
            AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
          JOIN bookings booking ON booking.id = site.booking_id AND booking.client_id = client.id
            AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
          WHERE site.id = site_incidents.site_id
            AND site.environment = 'demo' AND site.integrity_state = 'synthetic')`)
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
      WHERE id = ? AND version = ? AND status IN ('acknowledged', 'investigating')
        AND EXISTS (SELECT 1 FROM operational_sites site
          JOIN clients client ON client.id = site.client_id
            AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
          JOIN bookings booking ON booking.id = site.booking_id AND booking.client_id = client.id
            AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
          WHERE site.id = site_incidents.site_id
            AND site.environment = 'demo' AND site.integrity_state = 'synthetic')`)
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
      acknowledged_at = ?, version = version + 1 WHERE id = ? AND version = ? AND status = 'new'
        AND EXISTS (SELECT 1 FROM operational_sites site
          JOIN clients client ON client.id = site.client_id
            AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
          JOIN bookings booking ON booking.id = site.booking_id AND booking.client_id = client.id
            AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
          WHERE site.id = operational_exceptions.site_id
            AND site.environment = 'demo' AND site.integrity_state = 'synthetic')`)
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
      JOIN operational_sites site ON site.id = rs.site_id
        AND site.environment = 'demo' AND site.integrity_state = 'synthetic'
      JOIN clients client ON client.id = site.client_id
        AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
      JOIN bookings booking ON booking.id = rs.booking_id AND booking.id = site.booking_id
        AND booking.client_id = client.id AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
      JOIN site_posts post ON post.id = rs.post_id AND post.site_id = site.id AND post.booking_id = booking.id
        AND post.environment = 'demo' AND post.integrity_state = 'synthetic'
      LEFT JOIN roster_assignments ra ON ra.roster_slot_id = rs.id AND ra.active_key = rs.id
        AND ra.environment = 'demo' AND ra.integrity_state = 'synthetic'
      LEFT JOIN shifts sh ON sh.id = ra.shift_id AND sh.booking_id = booking.id
        AND sh.environment = 'demo' AND sh.integrity_state = 'synthetic'
      LEFT JOIN officer_passports assigned_passport ON assigned_passport.officer_id = ra.officer_id
        AND assigned_passport.environment = 'demo' AND assigned_passport.integrity_state = 'synthetic'
      WHERE rs.id = ? AND rs.environment = 'demo' AND rs.integrity_state = 'synthetic'
        AND (ra.id IS NULL OR ra.shift_id IS NULL OR sh.id IS NOT NULL)
        AND (ra.id IS NULL OR assigned_passport.officer_id IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM roster_assignments opposite_assignment
          WHERE opposite_assignment.roster_slot_id = rs.id AND opposite_assignment.active_key = rs.id
            AND (opposite_assignment.environment <> 'demo' OR opposite_assignment.integrity_state <> 'synthetic'))`)
      .bind(rosterSlotId).first<{
        id: string; siteId: string; postId: string; bookingId: string; serviceDate: string; startsAt: string;
        endsAt: string; arrivalDueAt: string; checkInDueAt: string; status: string; version: number;
        shiftId: string | null; officerId: string | null; assignmentStatus: string | null; checkInAt: string | null;
      }>();
    if (!slot) throw new OperationsError("That roster slot is unavailable.", 404);
    if (slot.version !== version) throw new OperationsError("This roster slot changed before your action. Refresh and try again.", 409);
    const activeRelief = await db.prepare(`SELECT id FROM relief_dispatches WHERE active_key = ?
      AND roster_slot_id = ? AND site_id = ? AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(slot.id, slot.id, slot.siteId).first<{ id: string }>();
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
          FROM roster_slots rs
          JOIN operational_sites site ON site.id = rs.site_id
            AND site.environment = 'demo' AND site.integrity_state = 'synthetic'
          JOIN clients client ON client.id = site.client_id
            AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
          JOIN bookings booking ON booking.id = rs.booking_id AND booking.id = site.booking_id
            AND booking.client_id = client.id AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
          JOIN site_posts post ON post.id = rs.post_id AND post.site_id = site.id AND post.booking_id = booking.id
            AND post.environment = 'demo' AND post.integrity_state = 'synthetic'
          WHERE rs.id = ? AND rs.version = ? AND rs.status IN ('scheduled', 'uncovered')
            AND rs.environment = 'demo' AND rs.integrity_state = 'synthetic'
            AND NOT EXISTS (SELECT 1 FROM relief_dispatches active_case WHERE active_case.active_key = rs.id
              AND active_case.environment = 'demo' AND active_case.integrity_state = 'synthetic')
            AND NOT EXISTS (SELECT 1 FROM roster_assignments opposite_assignment
              WHERE opposite_assignment.roster_slot_id = rs.id AND opposite_assignment.active_key = rs.id
                AND (opposite_assignment.environment <> 'demo' OR opposite_assignment.integrity_state <> 'synthetic'))`)
          .bind(reliefId, exceptionId, replacementOfficerId, payload.reasonCode, priority, actor.email, now, responseDueAt, slot.id, version),
        ...(eligibility.workforceModel === "direct_flex" ? splitAcrossIsoWeeks(slot.startsAt, slot.endsAt).map((segment, index) =>
          db.prepare(`INSERT INTO workforce_hour_reservations
            (id, command_id, roster_assignment_id, relief_dispatch_id, officer_id, workforce_engagement_id,
             source_type, source_id, iso_week_start, iso_week_end, segment_starts_at, segment_ends_at,
             reserved_minutes, weekly_cap_minutes, status, active_key, created_at, released_at, release_reason)
            VALUES (?, NULL, NULL, ?, ?, ?, 'relief', ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, NULL, NULL)`)
            .bind(`${reliefId}-H${index + 1}`, reliefId, replacementOfficerId, eligibility.workforceEngagementId,
              reliefId, segment.isoWeekStart, segment.isoWeekEnd, segment.startsAt, segment.endsAt,
              segment.minutes, (eligibility.weeklyHourCap ?? 0) * 60,
              `${replacementOfficerId}:${segment.isoWeekStart}:${reliefId}`, now)) : []),
        db.prepare(`INSERT INTO relief_dispatch_events
          (id, relief_dispatch_id, event_type, actor_type, actor_id, detail, created_at)
          VALUES (?, ?, 'case_opened', 'operations', ?, ?, ?)`)
          .bind(eventId("RDE"), reliefId, actor.email, `Candidate reserved for Operations review: ${reasonLabel}. No officer notification was sent by this demo.`, now),
        db.prepare(`UPDATE roster_slots SET status = 'relief_active', version = version + 1, updated_at = ?
          WHERE id = ? AND version = ? AND environment = 'demo' AND integrity_state = 'synthetic'`)
          .bind(now, slot.id, version),
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
      FROM relief_dispatches WHERE id = ? AND version = ? AND status IN ('case_open', 'offer_pending')
        AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(reliefDispatchId, version).first<{ id: string; rosterSlotId: string; exceptionId: string | null }>();
    if (!relief) throw new OperationsError("This relief case changed before your action. Refresh and try again.", 409);
    try {
      await db.batch([
        db.prepare(`UPDATE relief_dispatches SET status = 'cancelled', active_key = NULL, closed_at = ?, version = version + 1
          WHERE id = ? AND version = ? AND status IN ('case_open', 'offer_pending')
            AND environment = 'demo' AND integrity_state = 'synthetic'`)
          .bind(now, relief.id, version),
        db.prepare(`INSERT INTO relief_dispatch_events
          (id, relief_dispatch_id, event_type, actor_type, actor_id, detail, created_at)
          VALUES (?, (SELECT id FROM relief_dispatches WHERE id = ? AND version = ? AND status = 'cancelled'),
           'case_cancelled', 'operations', ?, 'Relief case cancelled before any officer notification was sent.', ?)`)
          .bind(eventId("RDE"), relief.id, version + 1, actor.email, now),
        db.prepare(`UPDATE roster_slots SET status = CASE WHEN EXISTS (
            SELECT 1 FROM roster_assignments ra WHERE ra.roster_slot_id = roster_slots.id AND ra.active_key = roster_slots.id
              AND ra.environment = 'demo' AND ra.integrity_state = 'synthetic'
          ) THEN 'scheduled' ELSE 'uncovered' END, version = version + 1, updated_at = ?
          WHERE id = ? AND environment = 'demo' AND integrity_state = 'synthetic'`)
          .bind(now, relief.rosterSlotId),
        db.prepare(`UPDATE operational_exceptions SET status = 'resolved', resolved_at = ?, resolution_code = 'relief_cancelled',
          resolution_note = 'Operations cancelled the relief case before officer notification.', version = version + 1
          WHERE id = ? AND status NOT IN ('resolved', 'closed')
            AND EXISTS (SELECT 1 FROM operational_sites site
              JOIN clients client ON client.id = site.client_id
                AND client.environment = 'demo' AND client.integrity_state = 'synthetic'
              JOIN bookings booking ON booking.id = site.booking_id AND booking.client_id = client.id
                AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
              WHERE site.id = operational_exceptions.site_id
                AND site.environment = 'demo' AND site.integrity_state = 'synthetic')`)
          .bind(now, relief.exceptionId),
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
