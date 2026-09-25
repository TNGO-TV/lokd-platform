import {isSpecialistPricingVersion} from "./specialist-pricing";
import {currentClientReview} from './production-client-review';
import { readActivationAgreements } from './agreement-activation';
import { officerHasCurrentPsiraVerification } from './psira-server';
import {
  ACTIVATION_POLICY_VERSION,
  evaluateAssignmentActivation as evaluateActivationFacts,
  splitAcrossIsoWeeks,
  type ActivationBlocker,
  type ActivationCheckpoint,
  type ActivationEnvironment,
  type AssignmentActivationFacts,
  type DatedEvidence,
} from "./assignment-activation-core";
import {
  LEGACY_UNARMED_PRICE_BOOK_VERSION,
  officerShiftEconomicsForRoster,
  type CalendarCategory,
  type EngagementModel,
} from "./pilot-pricing";
import type { LaunchGateInput, WorkforceModel } from "./workforce-core";

export class AssignmentActivationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type AssignmentActivationRequest = {
  rosterSlotId: string;
  officerId: string;
  expectedSlotVersion: number;
  activationKey: string;
  environment?: ActivationEnvironment;
  checkpoint?: ActivationCheckpoint;
};

type CandidateRow = {
  rosterSlotId: string;
  slotVersion: number;
  slotStatus: string;
  bookingId: string;
  clientId: string;
  clientApprovalStatus: string;
  contractingEntityId: string | null;
  orderVersion: number;
  orderDetails: string;
  clientPriceCents: number;
  officerRateCents: number;
  pricingVersion: string;
  specialistServiceCode: string;
  calendarCategory: CalendarCategory;
  riskBand: string;
  engagementModel: EngagementModel;
  startsAt: string;
  endsAt: string;
  checkInDueAt: string;
  serviceDate: string;
  siteId: string;
  siteStatus: string;
  siteVersion: number;
  postId: string;
  postStatus: string;
  postOrdersVersion: string;
  serviceType: string;
  purposeCode: string;
  minimumGrade: string;
};

type WorkforceRow = {
  engagementId: string;
  engagementVersion: number;
  environment: string;
  model: WorkforceModel;
  status: string;
  termsVersion: string | null;
  reviewDueAt: string | null;
  weeklyHourCap: number | null;
  payrollStatus: string;
  benefitsStatus: string;
  employerId: string;
  employerLegalName: string;
  employerType: string;
  employerEnvironment: string;
  employerStatus: string;
  employerVersion: number;
  employerReviewDueAt: string | null;
};

async function all<T>(statement: D1PreparedStatement) {
  const result = await statement.all<T>();
  return result.results ?? [];
}

function requireIdentifier(value: string, label: string) {
  if (!/^[A-Za-z0-9:_-]{3,128}$/.test(value)) throw new AssignmentActivationError(`${label} is invalid.`);
  return value;
}

function requireVersion(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 1_000_000) throw new AssignmentActivationError("The roster-slot version is invalid.");
  return value;
}

function expiryInstant(value: string | null) {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999+02:00` : value;
}

function evidence(input: Partial<DatedEvidence> & Pick<DatedEvidence, "id" | "status">): DatedEvidence {
  return {
    id: input.id,
    status: input.status,
    version: input.version ?? null,
    environment: input.environment ?? null,
    integrityState: input.integrityState ?? null,
    evidenceReference: input.evidenceReference ?? null,
    verifiedAt: input.verifiedAt ?? null,
    validFrom: input.validFrom ?? null,
    expiresAt: input.expiresAt ?? null,
  };
}

function gradeEligible(officerGrade: string, minimumGrade: string) {
  const rank = (value: string) => ({ A: 5, B: 4, C: 3, D: 2, E: 1 }[value.replace(/Grade\s*/i, "").trim().toUpperCase() as "A"] ?? 0);
  const officerRank = rank(officerGrade);
  const requiredRank = rank(minimumGrade);
  return officerRank > 0 && requiredRank > 0 && officerRank >= requiredRank;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]));
  return value;
}

async function digest(value: unknown) {
  const encoded = new TextEncoder().encode(JSON.stringify(stableValue(value)));
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", encoded));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readActivationEvidenceRevision(db: D1Database) {
  const row = await db.prepare(`SELECT revision FROM activation_evidence_epoch WHERE singleton = 1`)
    .first<{ revision: number }>();
  const revision = Number(row?.revision);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new AssignmentActivationError("The production evidence clock is unavailable.", 503);
  }
  return revision;
}

function evidencePayloads(facts: AssignmentActivationFacts) {
  return {
    funding: JSON.stringify(facts.funding),
    site: JSON.stringify({ client: facts.client, site: facts.site, post: facts.post, induction: facts.induction, agreements: facts.agreements }),
    launch: JSON.stringify(facts.launchGates),
    officer: JSON.stringify(facts.officer),
    employer: JSON.stringify(facts.workforce),
    schedule: JSON.stringify(facts.schedule),
  };
}

function id(prefix: string, hash: string) {
  return `${prefix}-${hash.slice(0, 24).toUpperCase()}`;
}

async function readCandidate(db: D1Database, rosterSlotId: string, environment: ActivationEnvironment) {
  const dataEnvironment = environment === "production" ? "production" : "demo";
  const integrityState = environment === "production" ? "production_verified" : "synthetic";
  return db.prepare(`SELECT rs.id AS rosterSlotId, rs.version AS slotVersion, rs.status AS slotStatus, rs.booking_id AS bookingId,
    rs.starts_at AS startsAt, rs.ends_at AS endsAt, rs.check_in_due_at AS checkInDueAt, rs.service_date AS serviceDate,
    b.client_id AS clientId, c.approval_status AS clientApprovalStatus, b.contracting_entity_id AS contractingEntityId, b.agreement_version AS orderVersion,
    json_object('clientName',c.organisation_name,'siteName',b.site_name,'siteArea',b.site_area,'postName',b.post_name,
      'startDate',b.start_date,'endDate',b.end_date,'shiftStart',b.shift_start,'shiftEnd',b.shift_end,
      'headcount',b.headcount,'contractMonths',b.contract_months,'rosterPattern',b.roster_pattern,
      'serviceDayCount',b.service_day_count,'shiftCount',b.shift_count,'pricingBreakdown',b.pricing_breakdown,
      'specialistConfiguration',b.specialist_configuration,'creditTermsDays',b.credit_terms_days,
      'fundingModel',b.funding_model,'releaseCadence',b.release_cadence) AS orderDetails, b.client_price_cents AS clientPriceCents,
    rs.officer_offer_cents AS officerRateCents, b.pricing_version AS pricingVersion,
    b.specialist_service_code AS specialistServiceCode,
    rs.calendar_category AS calendarCategory, b.engagement_model AS engagementModel, b.risk_band AS riskBand,
    os.id AS siteId, os.status AS siteStatus, os.version AS siteVersion,
    sp.id AS postId, sp.status AS postStatus, sp.post_orders_version AS postOrdersVersion,
    sp.service_type AS serviceType, sp.purpose_code AS purposeCode, sp.minimum_grade AS minimumGrade
    FROM roster_slots rs
    JOIN bookings b ON b.id = rs.booking_id
    JOIN clients c ON c.id = b.client_id
    JOIN operational_sites os ON os.id = rs.site_id AND os.client_id = b.client_id
    JOIN site_posts sp ON sp.id = rs.post_id AND sp.site_id = os.id AND sp.booking_id = b.id
    WHERE rs.id = ?
      AND c.environment = ? AND c.integrity_state = ?
      AND b.environment = ? AND b.integrity_state = ?
      AND os.environment = ? AND os.integrity_state = ?
      AND sp.environment = ? AND sp.integrity_state = ?
      AND rs.environment = ? AND rs.integrity_state = ?`)
    .bind(rosterSlotId,
      dataEnvironment, integrityState,
      dataEnvironment, integrityState,
      dataEnvironment, integrityState,
      dataEnvironment, integrityState,
      dataEnvironment, integrityState).first<CandidateRow>();
}

async function readWorkforce(db: D1Database, officerId: string) {
  return db.prepare(`SELECT we.id AS engagementId, we.version AS engagementVersion, we.environment, we.model, we.status,
    we.terms_version AS termsVersion, we.review_due_at AS reviewDueAt,
    we.weekly_hour_cap AS weeklyHourCap, we.payroll_status AS payrollStatus,
    we.benefits_status AS benefitsStatus, we.terms_version AS termsVersion,
    emp.id AS employerId, emp.legal_name AS employerLegalName, emp.employer_type AS employerType,
    emp.environment AS employerEnvironment,
    emp.status AS employerStatus, emp.version AS employerVersion, emp.review_due_at AS employerReviewDueAt
    FROM workforce_engagements we JOIN workforce_employers emp ON emp.id = we.employer_id
    WHERE we.officer_id = ? AND we.active_key = we.officer_id AND we.status = 'active'
    ORDER BY we.updated_at DESC LIMIT 1`).bind(officerId).first<WorkforceRow>();
}

async function loadAssignmentActivationFacts(
  db: D1Database,
  request: AssignmentActivationRequest,
  evaluatedAt: string,
): Promise<AssignmentActivationFacts> {
  const environment = request.environment ?? "production";
  const candidate = await readCandidate(db, request.rosterSlotId, environment);
  if (!candidate) throw new AssignmentActivationError("The roster slot, site or post is unavailable.", 404);
  if (environment === 'production' && !await currentClientReview(db,candidate.clientId,evaluatedAt)) candidate.clientApprovalStatus='pending';
  if (candidate.slotVersion !== request.expectedSlotVersion) throw new AssignmentActivationError("The roster slot changed before evaluation.", 409);

  const dataEnvironment = environment === "production" ? "production" : "demo";
  const integrityState = environment === "production" ? "verified" : "synthetic";
  const [launchGates, funding, risk, orders, induction, officer, identityRecord, psiraRecord, passport,
    core, service, purpose, workforce, availability, scheduleDeclaration, travel, employerEvidence, conflicts, hourRows, legacyIntervals,
    invalidCommitmentEvidence] = await Promise.all([
    all<Omit<LaunchGateInput, "hardGate"> & { hardGate: number; version: number }>(db.prepare(`SELECT code, status, hard_gate AS hardGate, version,
      evidence_level AS evidenceLevel, evidence_reference AS evidenceReference,
      verified_at AS verifiedAt, expires_at AS expiresAt FROM launch_controls ORDER BY code`)),
    db.prepare(`SELECT id, environment, integrity_state AS integrityState, provider, currency,
      provider_reference AS providerReference, status, expected_amount_cents AS expectedAmountCents,
      cleared_amount_cents AS clearedAmountCents, evidence_reference AS evidenceReference,
      cleared_at AS clearedAt, reconciled_at AS reconciledAt,
      evidence_verified_at AS verifiedAt, evidence_expires_at AS expiresAt
      FROM booking_funding_reconciliations WHERE active_key = ? LIMIT 1`)
      .bind(candidate.bookingId).first<{ id: string; environment: string; integrityState: string;
        provider: string; providerReference: string; status: string; currency: string; expectedAmountCents: number;
        clearedAmountCents: number; clearedAt: string | null; reconciledAt: string | null; evidenceReference: string | null;
        verifiedAt: string | null; expiresAt: string | null }>(),
    db.prepare(`SELECT id, risk_rules_version AS version, risk_band AS riskBand, status, environment,
      integrity_state AS integrityState, evidence_reference AS evidenceReference,
      approved_at AS verifiedAt, valid_from AS validFrom, expires_at AS expiresAt FROM site_risk_assessments WHERE active_key = ? LIMIT 1`)
      .bind(candidate.siteId).first<{ id: string; version: string; riskBand: string; status: string; environment: string; integrityState: string; evidenceReference: string | null; verifiedAt: string | null; validFrom: string | null; expiresAt: string | null }>(),
    db.prepare(`SELECT id, post_orders_version AS version, status, environment,
      integrity_state AS integrityState, evidence_reference AS evidenceReference,
      approved_at AS verifiedAt, valid_from AS validFrom, expires_at AS expiresAt FROM post_order_approvals WHERE active_key = ? LIMIT 1`)
      .bind(candidate.postId).first<{ id: string; version: string; status: string; environment: string; integrityState: string; evidenceReference: string | null; verifiedAt: string | null; validFrom: string | null; expiresAt: string | null }>(),
    db.prepare(`SELECT id, induction_version AS version, status, environment,
      integrity_state AS integrityState, evidence_reference AS evidenceReference,
      completed_at AS verifiedAt, expires_at AS expiresAt FROM officer_site_inductions WHERE active_key = ? LIMIT 1`)
      .bind(`${request.officerId}:${candidate.siteId}`).first<{ id: string; version: string; status: string; environment: string; integrityState: string; evidenceReference: string | null; verifiedAt: string | null; expiresAt: string | null }>(),
    db.prepare(`SELECT id, approval_status AS approvalStatus, psira_grade AS psiraGrade, psira_expiry AS psiraExpiry,
      flex_available AS flexAvailable, external_work_acknowledged AS externalWorkAcknowledged,
      rest_window_confirmed AS restWindowConfirmed FROM officers WHERE id = ?`)
      .bind(request.officerId).first<{ id: string; approvalStatus: string; psiraGrade: string; psiraExpiry: string; flexAvailable: number; externalWorkAcknowledged: number; restWindowConfirmed: number }>(),
    db.prepare(`SELECT id, status, environment, integrity_state AS integrityState,
      evidence_reference AS evidenceReference, verified_at AS verifiedAt, expires_at AS expiresAt
      FROM compliance_records WHERE officer_id = ? AND record_type = 'identity' ORDER BY verified_at DESC LIMIT 1`)
      .bind(request.officerId).first<{ id: string; status: string; environment: string; integrityState: string; evidenceReference: string | null; verifiedAt: string | null; expiresAt: string | null }>(),
    db.prepare(`SELECT id, status, environment, integrity_state AS integrityState,
      evidence_reference AS evidenceReference, verified_at AS verifiedAt, expires_at AS expiresAt
      FROM compliance_records WHERE officer_id = ? AND record_type = 'psira' ORDER BY verified_at DESC LIMIT 1`)
      .bind(request.officerId).first<{ id: string; status: string; environment: string; integrityState: string; evidenceReference: string | null; verifiedAt: string | null; expiresAt: string | null }>(),
    db.prepare(`SELECT passport_number AS id, updated_at AS version, status, environment, integrity_state AS integrityState,
      evidence_reference AS evidenceReference, last_reviewed_at AS verifiedAt, next_review_at AS expiresAt
      FROM officer_passports WHERE officer_id = ?`).bind(request.officerId)
      .first<{ id: string; version: string; status: string; environment: string; integrityState: string; evidenceReference: string | null; verifiedAt: string | null; expiresAt: string | null }>(),
    db.prepare(`SELECT id, status, environment, integrity_state AS integrityState,
      evidence_reference AS evidenceReference, assessed_at AS verifiedAt, expires_at AS expiresAt
      FROM officer_endorsements WHERE officer_id = ? AND code = 'core_ready'
      ORDER BY assessed_at DESC LIMIT 1`).bind(request.officerId)
      .first<{ id: string; status: string; environment: string; integrityState: string; evidenceReference: string | null; verifiedAt: string | null; expiresAt: string | null }>(),
    db.prepare(`SELECT svc.service_type AS id, svc.qualified, svc.opted_in AS optedIn,
      svc.qualification_expiry AS qualificationExpiresAt, oe.expires_at AS expiresAt, oe.status, oe.environment,
      oe.integrity_state AS integrityState, oe.evidence_reference AS evidenceReference,
      oe.assessed_at AS verifiedAt, oe.id AS evidenceId
      FROM officer_services svc LEFT JOIN officer_endorsements oe ON oe.officer_id = svc.officer_id
        AND oe.category = 'service' AND oe.service_type = svc.service_type
      WHERE svc.officer_id = ? AND svc.service_type = ? ORDER BY oe.assessed_at DESC LIMIT 1`).bind(request.officerId, candidate.serviceType)
      .first<{ id: string; qualified: number; optedIn: number; qualificationExpiresAt: string | null; expiresAt: string | null; status: string | null; environment: string | null; integrityState: string | null; evidenceReference: string | null; verifiedAt: string | null; evidenceId: string | null }>(),
    db.prepare(`SELECT id, status, environment, integrity_state AS integrityState,
      evidence_reference AS evidenceReference, assessed_at AS verifiedAt, expires_at AS expiresAt
      FROM officer_endorsements WHERE officer_id = ? AND category = 'purpose' AND purpose_code = ?
      ORDER BY assessed_at DESC LIMIT 1`).bind(request.officerId, candidate.purposeCode)
      .first<{ id: string; status: string; environment: string; integrityState: string; evidenceReference: string | null; verifiedAt: string | null; expiresAt: string | null }>(),
    readWorkforce(db, request.officerId),
    db.prepare(`SELECT id, status, environment, integrity_state AS integrityState,
      source, evidence_reference AS evidenceReference, rest_confirmed_at AS verifiedAt,
      starts_at AS validFrom, ends_at AS expiresAt, version
      FROM officer_availability_windows WHERE officer_id = ? AND status = 'available'
      AND starts_at <= ? AND ends_at >= ? AND environment = ? AND integrity_state = ?
      AND evidence_reference IS NOT NULL AND rest_confirmed_at <= ? ORDER BY starts_at DESC LIMIT 1`)
      .bind(request.officerId, candidate.startsAt, candidate.endsAt,
        environment === "production" ? "production" : "demo", environment === "production" ? "verified" : "synthetic", evaluatedAt)
      .first<{ id: string; status: string; environment: string; integrityState: string; source: string;
        evidenceReference: string; verifiedAt: string; validFrom: string; expiresAt: string; version: number }>(),
    db.prepare(`SELECT id, version, status, environment, integrity_state AS integrityState,
      evidence_reference AS evidenceReference, declared_at AS verifiedAt, expires_at AS expiresAt
      FROM officer_schedule_declarations
      WHERE officer_id = ? AND environment = ? ORDER BY version DESC LIMIT 1`)
      .bind(request.officerId, dataEnvironment)
      .first<{ id: string; version: number; status: string; environment: string; integrityState: string;
        evidenceReference: string; verifiedAt: string; expiresAt: string }>(),
    db.prepare(`SELECT id, version, status, environment, integrity_state AS integrityState,
      estimated_minutes AS estimatedMinutes, source,
      evidence_reference AS evidenceReference, assessed_at AS verifiedAt, valid_until AS expiresAt
      FROM officer_travel_assessments WHERE active_key = ? LIMIT 1`)
      .bind(`${request.officerId}:${candidate.siteId}`).first<{ id: string; version: number; status: string; environment: string; integrityState: string; estimatedMinutes: number | null; source: string; evidenceReference: string | null; verifiedAt: string | null; expiresAt: string | null }>(),
    all<{ id: string; controlCode: string; status: string; environment: string; integrityState: string; evidenceReference: string | null; verifiedAt: string | null; expiresAt: string | null }>(db.prepare(`SELECT id, control_code AS controlCode, status,
      environment, integrity_state AS integrityState, evidence_reference AS evidenceReference,
      verified_at AS verifiedAt, expires_at AS expiresAt FROM employer_compliance_evidence
      WHERE employer_id = (SELECT employer_id FROM workforce_engagements WHERE officer_id = ? AND active_key = officer_id AND status = 'active' LIMIT 1)
        AND active_key = employer_id || ':' || control_code
      ORDER BY control_code`).bind(request.officerId)),
    all<{ id: string; startsAt: string; endsAt: string; kind: string }>(db.prepare(`SELECT ra.id, rs.starts_at AS startsAt, rs.ends_at AS endsAt, 'assignment' AS kind
      FROM roster_assignments ra JOIN roster_slots rs ON rs.id = ra.roster_slot_id
      WHERE ra.officer_id = ? AND ra.environment = ? AND ra.integrity_state = ?
        AND ra.active_key IS NOT NULL AND ra.roster_slot_id <> ?
        AND ra.status NOT IN ('cancelled','replaced','released')
      UNION ALL
      SELECT rd.id, rs.starts_at, rs.ends_at, 'relief' AS kind
      FROM relief_dispatches rd JOIN roster_slots rs ON rs.id = rd.roster_slot_id
      WHERE rd.replacement_officer_id = ? AND rd.environment = ? AND rd.integrity_state = ? AND rd.roster_slot_id <> ?
        AND rd.status NOT IN ('cancelled','replaced')
      UNION ALL
      SELECT owc.id, owc.starts_at, owc.ends_at, 'external work' AS kind
      FROM officer_work_commitments owc WHERE owc.officer_id = ? AND owc.environment = ? AND owc.status <> 'cancelled'`)
      .bind(request.officerId, dataEnvironment, environment === "production" ? "production_verified" : "synthetic",
        request.rosterSlotId, request.officerId, dataEnvironment,
        environment === "production" ? "production_verified" : "synthetic", request.rosterSlotId,
        request.officerId, dataEnvironment)),
    all<{ isoWeekStart: string; minutes: number }>(db.prepare(`SELECT whr.iso_week_start AS isoWeekStart,
      COALESCE(SUM(whr.reserved_minutes), 0) AS minutes FROM workforce_hour_reservations whr
      JOIN workforce_engagements reserved_we ON reserved_we.id = whr.workforce_engagement_id
      WHERE whr.officer_id = ? AND whr.status = 'active'
        AND reserved_we.environment = ?
        AND NOT EXISTS (SELECT 1 FROM roster_assignments current_assignment
          WHERE current_assignment.id = whr.roster_assignment_id AND current_assignment.roster_slot_id = ?)
      GROUP BY whr.iso_week_start`).bind(request.officerId, dataEnvironment, request.rosterSlotId)),
    all<{ startsAt: string; endsAt: string }>(db.prepare(`SELECT rs.starts_at AS startsAt, rs.ends_at AS endsAt
      FROM roster_assignments ra JOIN roster_slots rs ON rs.id = ra.roster_slot_id
      WHERE ra.officer_id = ? AND ra.environment = ? AND ra.integrity_state = ?
        AND ra.active_key IS NOT NULL AND ra.roster_slot_id <> ?
        AND ra.status NOT IN ('cancelled','replaced','released')
        AND NOT EXISTS (SELECT 1 FROM workforce_hour_reservations whr WHERE whr.roster_assignment_id = ra.id AND whr.status = 'active')
      UNION ALL SELECT rs.starts_at, rs.ends_at FROM relief_dispatches rd JOIN roster_slots rs ON rs.id = rd.roster_slot_id
      WHERE rd.replacement_officer_id = ? AND rd.environment = ? AND rd.integrity_state = ?
        AND rd.roster_slot_id <> ? AND rd.status NOT IN ('cancelled','replaced')
        AND NOT EXISTS (SELECT 1 FROM workforce_hour_reservations whr WHERE whr.relief_dispatch_id = rd.id AND whr.status = 'active')
      UNION ALL SELECT owc.starts_at, owc.ends_at FROM officer_work_commitments owc
      WHERE owc.officer_id = ? AND owc.environment = ? AND owc.status <> 'cancelled'`)
      .bind(request.officerId, dataEnvironment, environment === "production" ? "production_verified" : "synthetic",
        request.rosterSlotId, request.officerId, dataEnvironment,
        environment === "production" ? "production_verified" : "synthetic", request.rosterSlotId,
        request.officerId, dataEnvironment)),
    db.prepare(`SELECT COUNT(*) AS invalidCount FROM officer_work_commitments
      WHERE officer_id = ? AND environment = ? AND status <> 'cancelled'
        AND (integrity_state <> ? OR evidence_reference IS NULL OR length(trim(evidence_reference)) = 0
          OR verified_at IS NULL OR julianday(verified_at) > julianday(?)
          OR expires_at IS NULL OR julianday(expires_at) < julianday(?))`)
      .bind(request.officerId, dataEnvironment, integrityState, evaluatedAt, candidate.endsAt)
      .first<{ invalidCount: number }>(),
  ]);
  if (!officer) throw new AssignmentActivationError("The officer is unavailable.", 404);

  const terms = workforce ? await db.prepare(`SELECT id, terms_version AS version, 'accepted' AS status,
    environment, integrity_state AS integrityState,
    evidence_reference AS evidenceReference, accepted_at AS verifiedAt, expires_at AS expiresAt
    FROM workforce_terms_acceptances WHERE active_key = ? LIMIT 1`).bind(workforce.engagementId)
    .first<{ id: string; version: string; status: string; environment: string; integrityState: string; evidenceReference: string; verifiedAt: string; expiresAt: string | null }>() : null;
  const existingWeekMinutes: Record<string, number> = Object.fromEntries(hourRows.map((row) => [row.isoWeekStart, Number(row.minutes)]));
  for (const interval of legacyIntervals) {
    for (const segment of splitAcrossIsoWeeks(interval.startsAt, interval.endsAt)) {
      existingWeekMinutes[segment.isoWeekStart] = (existingWeekMinutes[segment.isoWeekStart] ?? 0) + segment.minutes;
    }
  }

  const currentSpecialistPricing = isSpecialistPricingVersion(candidate.pricingVersion);
  const legacyUnarmedPricing = candidate.pricingVersion === LEGACY_UNARMED_PRICE_BOOK_VERSION
    && candidate.serviceType === "Unarmed";
  const shiftEconomics = risk && (currentSpecialistPricing || legacyUnarmedPricing)
    ? officerShiftEconomicsForRoster({
    serviceType: candidate.serviceType,
    // Version 32 had no specialist subtype. Ignoring the migration default here
    // preserves only its existing Unarmed economics; Armed and VIP cannot use
    // the legacy price book to bypass Version 33 controls.
    specialistServiceCode: currentSpecialistPricing ? candidate.specialistServiceCode : undefined,
    riskBand: risk.riskBand,
    engagementModel: candidate.engagementModel,
    serviceDate: candidate.serviceDate,
    startsAt: candidate.startsAt,
  }) : null;
  const authoritativePricing = (currentSpecialistPricing || legacyUnarmedPricing) && Boolean(shiftEconomics);
  const officerOfferCents = shiftEconomics?.officerOfferCents ?? 0;
  const statutoryCostCents = workforce?.model === "partner" ? 0 : Math.round(officerOfferCents * 0.15);

  const mandatoryPsiraVerified = environment !== 'production'
    || await officerHasCurrentPsiraVerification(db, request.officerId, candidate.endsAt);
  const facts: AssignmentActivationFacts = {
    environment,
    checkpoint: request.checkpoint ?? "activation",
    evaluatedAt,
    shift: {
      rosterSlotId: candidate.rosterSlotId,
      bookingId: candidate.bookingId,
      siteId: candidate.siteId,
      postId: candidate.postId,
      officerId: request.officerId,
      startsAt: candidate.startsAt,
      endsAt: candidate.endsAt,
      checkInDueAt: candidate.checkInDueAt,
      slotVersion: candidate.slotVersion,
      slotStatus: candidate.slotStatus,
    },
    launchGates: launchGates.map((gate) => ({ ...gate, hardGate: Boolean(gate.hardGate) })),
    funding: {
      reconciliationId: funding?.id ?? null,
      environment: funding?.environment ?? null,
      integrityState: funding?.integrityState ?? null,
      provider: funding?.provider ?? null,
      providerReference: funding?.providerReference ?? null,
      status: funding?.status ?? null,
      currency: funding?.currency ?? null,
      bookingAmountCents: candidate.clientPriceCents,
      expectedAmountCents: funding?.expectedAmountCents ?? 0,
      clearedAmountCents: funding?.clearedAmountCents ?? 0,
      clearedAt: funding?.clearedAt ?? null,
      reconciledAt: funding?.reconciledAt ?? null,
      evidenceReference: funding?.evidenceReference ?? null,
      verifiedAt: funding?.verifiedAt ?? null,
      expiresAt: funding?.expiresAt ?? null,
    },
    client: { id: candidate.clientId, approvalStatus: candidate.clientApprovalStatus, contractingEntityId: candidate.contractingEntityId, orderVersion: candidate.orderVersion, orderDetails: candidate.orderDetails },
    site: {
      id: candidate.siteId,
      status: candidate.siteStatus,
      version: candidate.siteVersion,
      risk: evidence({ id: risk?.id ?? null, status: risk?.status ?? null, version: risk?.version ?? null,
        environment: risk?.environment, integrityState: risk?.integrityState,
        evidenceReference: risk?.evidenceReference, verifiedAt: risk?.verifiedAt, validFrom: risk?.validFrom, expiresAt: risk?.expiresAt }),
    },
    post: {
      id: candidate.postId,
      status: candidate.postStatus,
      postOrdersVersion: candidate.postOrdersVersion,
      serviceType: candidate.serviceType,
      purposeCode: candidate.purposeCode,
      minimumGrade: candidate.minimumGrade,
      orders: evidence({ id: orders?.id ?? null, status: orders?.status ?? null, version: orders?.version ?? null,
        environment: orders?.environment, integrityState: orders?.integrityState,
        evidenceReference: orders?.evidenceReference, verifiedAt: orders?.verifiedAt, validFrom: orders?.validFrom, expiresAt: orders?.expiresAt }),
    },
    induction: evidence({ id: induction?.id ?? null, status: induction?.status ?? null, version: induction?.version ?? null,
      environment: induction?.environment, integrityState: induction?.integrityState,
      evidenceReference: induction?.evidenceReference, verifiedAt: induction?.verifiedAt, expiresAt: induction?.expiresAt }),
    officer: {
      id: officer.id,
      approvalStatus: officer.approvalStatus,
      psiraGrade: officer.psiraGrade,
      gradeEligible: gradeEligible(officer.psiraGrade, candidate.minimumGrade),
      psiraExpiry: expiryInstant(officer.psiraExpiry),
      identity: evidence({ id: identityRecord?.id ?? null, status: identityRecord?.status ?? null,
        environment: identityRecord?.environment, integrityState: identityRecord?.integrityState,
        evidenceReference: identityRecord?.evidenceReference, verifiedAt: identityRecord?.verifiedAt, expiresAt: identityRecord?.expiresAt }),
      psira: evidence({ id: psiraRecord?.id ?? null, status: mandatoryPsiraVerified ? psiraRecord?.status ?? null : "unverified",
        environment: psiraRecord?.environment, integrityState: psiraRecord?.integrityState,
        evidenceReference: psiraRecord?.evidenceReference, verifiedAt: psiraRecord?.verifiedAt, expiresAt: psiraRecord?.expiresAt }),
      core: evidence({ id: core?.id ?? null, status: core?.status ?? null,
        environment: core?.environment, integrityState: core?.integrityState,
        evidenceReference: core?.evidenceReference, verifiedAt: core?.verifiedAt, expiresAt: core?.expiresAt }),
      service: { ...evidence({ id: service?.evidenceId ?? null, status: service?.status ?? null,
        environment: service?.environment, integrityState: service?.integrityState,
        evidenceReference: service?.evidenceReference, verifiedAt: service?.verifiedAt, expiresAt: service?.expiresAt }),
        qualified: Boolean(service?.qualified), optedIn: Boolean(service?.optedIn),
        qualificationExpiresAt: expiryInstant(service?.qualificationExpiresAt ?? null) },
      purpose: evidence({ id: purpose?.id ?? null, status: purpose?.status ?? null,
        environment: purpose?.environment, integrityState: purpose?.integrityState,
        evidenceReference: purpose?.evidenceReference, verifiedAt: purpose?.verifiedAt, expiresAt: purpose?.expiresAt }),
      passport: evidence({ id: passport?.id ?? null, status: passport?.status ?? null, version: passport?.version ?? null,
        environment: passport?.environment, integrityState: passport?.integrityState,
        evidenceReference: passport?.evidenceReference, verifiedAt: passport?.verifiedAt, expiresAt: passport?.expiresAt }),
    },
    workforce: {
      engagementId: workforce?.engagementId ?? null,
      engagementVersion: workforce?.engagementVersion ?? null,
      environment: workforce?.environment ?? null,
      model: workforce?.model ?? null,
      status: workforce?.status ?? null,
      termsVersion: workforce?.termsVersion ?? null,
      reviewDueAt: workforce?.reviewDueAt ?? null,
      weeklyHourCap: workforce?.weeklyHourCap ?? null,
      payrollStatus: workforce?.payrollStatus ?? null,
      benefitsStatus: workforce?.benefitsStatus ?? null,
      terms: evidence({ id: terms?.id ?? null, status: terms?.status ?? null, version: terms?.version ?? null,
        environment: terms?.environment, integrityState: terms?.integrityState,
        evidenceReference: terms?.evidenceReference, verifiedAt: terms?.verifiedAt, expiresAt: terms?.expiresAt }),
      employer: {
        id: workforce?.employerId ?? null,
        legalName: workforce?.employerLegalName ?? null,
        employerType: workforce?.employerType ?? null,
        environment: workforce?.employerEnvironment ?? null,
        status: workforce?.employerStatus ?? null,
        version: workforce?.employerVersion ?? null,
        reviewDueAt: workforce?.employerReviewDueAt ?? null,
        evidence: employerEvidence.map((item) => evidence({ id: item.id,
          status: item.status, version: item.controlCode, environment: item.environment, integrityState: item.integrityState,
          evidenceReference: item.evidenceReference,
          verifiedAt: item.verifiedAt, expiresAt: item.expiresAt })),
      },
    },
    schedule: {
      available: Boolean(availability),
      availability: evidence({ id: availability?.id ?? null, status: availability?.status ?? null,
        version: availability?.version ?? null, environment: availability?.environment,
        integrityState: availability?.integrityState, evidenceReference: availability?.evidenceReference,
        verifiedAt: availability?.verifiedAt, validFrom: availability?.validFrom, expiresAt: availability?.expiresAt }),
      externalDeclarationCurrent: Boolean(officer.externalWorkAcknowledged && officer.restWindowConfirmed
        && scheduleDeclaration?.status === "current"
        && Number(invalidCommitmentEvidence?.invalidCount ?? 0) === 0),
      declaration: evidence({ id: scheduleDeclaration?.id ?? null, status: scheduleDeclaration?.status ?? null,
        version: scheduleDeclaration?.version ?? null, environment: scheduleDeclaration?.environment,
        integrityState: scheduleDeclaration?.integrityState,
        evidenceReference: scheduleDeclaration?.evidenceReference,
        verifiedAt: scheduleDeclaration?.verifiedAt, expiresAt: scheduleDeclaration?.expiresAt }),
      conflicts,
      travel: { ...evidence({ id: travel?.id ?? null, status: travel?.status ?? null, version: travel?.version ?? null,
        environment: travel?.environment, integrityState: travel?.integrityState,
        evidenceReference: travel?.evidenceReference, verifiedAt: travel?.verifiedAt, expiresAt: travel?.expiresAt }),
        feasible: travel?.status === "feasible", estimatedMinutes: travel?.estimatedMinutes ?? null },
      existingWeekMinutes,
    },
    compensation: {
      pricingVersion: candidate.pricingVersion,
      authoritativePricing,
      rosterServiceDate: candidate.serviceDate,
      derivedServiceDate: shiftEconomics?.serviceDate ?? null,
      serviceDateMatchesStart: shiftEconomics?.serviceDateMatchesStart ?? false,
      storedCalendarCategory: candidate.calendarCategory,
      calendarCategory: shiftEconomics?.calendarCategory ?? null,
      storedOfficerOfferCents: candidate.officerRateCents,
      ordinaryWageCents: shiftEconomics?.ordinaryWageCents ?? 0,
      holidayPremiumCents: shiftEconomics?.holidayPremiumCents ?? 0,
      statutoryCostCents,
      officerOfferCents,
      fundedOfferCents: officerOfferCents,
    },
  };
  facts.agreements = await readActivationAgreements(db, facts);
  return facts;
}

/** The only assignment-readiness service. Every command and revalidation calls this function. */
export async function evaluateAssignmentActivation(db: D1Database, request: AssignmentActivationRequest) {
  requireIdentifier(request.rosterSlotId, "Roster slot");
  requireIdentifier(request.officerId, "Officer");
  requireIdentifier(request.activationKey, "Activation key");
  requireVersion(request.expectedSlotVersion);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const revisionBefore = await readActivationEvidenceRevision(db);
    const evaluatedAt = new Date().toISOString();
    const facts = await loadAssignmentActivationFacts(db, request, evaluatedAt);
    const specialistPack = facts.environment === "production"
      ? await db.prepare(`SELECT b.specialist_service_code AS serviceCode, EXISTS(
          SELECT 1 FROM specialist_deployment_packs p JOIN specialist_pack_validation_v34 v ON v.id=p.id
          WHERE p.booking_id=b.id AND p.status='approved' AND v.valid=1
          AND EXISTS(SELECT 1 FROM json_each(p.content,'$.officerIds') WHERE value=?)) AS ready
          FROM bookings b WHERE b.id=?`).bind(request.officerId,facts.shift.bookingId).first<{serviceCode:string;ready:number}>()
      : null;
    const revisionAfter = await readActivationEvidenceRevision(db);
    if (revisionBefore !== revisionAfter) continue;
    const result = evaluateActivationFacts(facts);
    if (specialistPack && specialistPack.serviceCode !== "standard_unarmed" && specialistPack.ready !== 1) {
      result.blockers.push({code:"SPECIALIST_APPROVED_PACK_REQUIRED",category:"site",detail:"A current independently approved specialist pack must name this officer and cover the quote, roster, evidence and full cleared funding."});
      result.ready=false;
    }
    const hashFacts = { ...facts, evaluatedAt: undefined };
    return {
      facts,
      result,
      sourceRevision: revisionAfter,
      evaluationHash: await digest({ policy: ACTIVATION_POLICY_VERSION, sourceRevision: revisionAfter, facts: hashFacts }),
    };
  }
  throw new AssignmentActivationError("Live funding, evidence, workforce or schedule facts changed during evaluation; retry.", 409);
}

async function existingCommand(db: D1Database, activationKey: string) {
  return db.prepare(`SELECT id, request_hash AS requestHash, state, roster_assignment_id AS rosterAssignmentId,
    shift_id AS shiftId FROM assignment_activation_commands WHERE activation_key = ?`).bind(activationKey)
    .first<{ id: string; requestHash: string; state: string; rosterAssignmentId: string | null; shiftId: string | null }>();
}

async function requestHash(request: AssignmentActivationRequest) {
  return digest({ rosterSlotId: request.rosterSlotId, officerId: request.officerId,
    expectedSlotVersion: request.expectedSlotVersion, environment: request.environment ?? "production" });
}

function commitFailureBlocker(message: string) {
  const rules: Array<[RegExp, string, ActivationBlocker["category"], string]> = [
    [/required_launch_gate/i, "LAUNCH_CHANGED_DURING_ACTIVATION", "launch", "A required launch gate changed before the atomic commit completed."],
    [/cleared_reconciled_funding|funding/i, "FUNDING_CHANGED_DURING_ACTIVATION", "funding", "Cleared and reconciled funding no longer passed the database guard."],
    [/officer_work_rest|officer_work_overlap|UNIQUE constraint failed: roster_assignments\.active_key/i, "SLOT_OR_REST_CONFLICT", "concurrency", "The slot or officer rest window was claimed by another committed transaction."],
    [/weekly_cap/i, "WEEKLY_HOUR_CAP_CONFLICT", "concurrency", "Another committed reservation caused the Direct Flex weekly ceiling to be exceeded."],
    [/evidence_token_stale|evidence clock|source revision/i, "EVIDENCE_CHANGED_DURING_ACTIVATION", "concurrency", "Authoritative funding, evidence, workforce or schedule facts changed before the atomic commit."],
  ];
  const match = rules.find(([pattern]) => pattern.test(message));
  return match
    ? { code: match[1], category: match[2], detail: match[3] }
    : { code: "ATOMIC_COMMIT_REJECTED", category: "concurrency" as const, detail: "A final database invariant changed or failed; the complete activation was rolled back." };
}

async function recordReadyCommandBlockers(
  db: D1Database,
  commandId: string,
  evaluation: Awaited<ReturnType<typeof evaluateAssignmentActivation>>,
) {
  const sequenceRow = await db.prepare(`SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence
    FROM assignment_activation_decisions WHERE command_id = ?`).bind(commandId).first<{ sequence: number }>();
  const sequence = Number(sequenceRow?.sequence ?? 2);
  const decisionId = `AD-${crypto.randomUUID()}`;
  const now = evaluation.facts.evaluatedAt;
  const statements: D1PreparedStatement[] = [
    db.prepare(`UPDATE assignment_activation_commands
      SET state = 'blocked', completed_at = ?, version = version + 1
      WHERE id = ? AND state = 'ready'`).bind(now, commandId),
    db.prepare(`INSERT INTO assignment_activation_decisions
      (id, command_id, sequence, checkpoint, decision, environment, summary, evaluation_hash, evaluated_at)
      SELECT ?, id, ?, 'activation', 'blocked', 'production', ?, ?, ?
      FROM assignment_activation_commands WHERE id = ? AND state = 'blocked' AND completed_at = ?`)
      .bind(decisionId, sequence, `${evaluation.result.blockers.length} blocker(s) stopped activation.`,
        evaluation.evaluationHash, now, commandId, now),
    ...evaluation.result.blockers.map((blocker, index) => db.prepare(`INSERT INTO assignment_activation_blockers
      (id, decision_id, code, category, detail, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(`${decisionId}-B${index + 1}`, decisionId, blocker.code, blocker.category, blocker.detail, now)),
  ];
  await db.batch(statements);
}

async function recordActivationCommitFailure(
  db: D1Database,
  request: AssignmentActivationRequest,
  actorId: string,
  hash: string,
  message: string,
) {
  const prior = await existingCommand(db, request.activationKey);
  if (prior?.state === "activated" || prior?.state === "blocked") return prior;
  if (prior && prior.requestHash !== hash) return prior;
  const commandId = prior?.id ?? id("AC", await digest(request.activationKey));
  const sequence = prior ? 2 : 1;
  const decisionId = id("AD", await digest(`${request.activationKey}:commit-failed:${sequence}`));
  const blocker = commitFailureBlocker(message);
  const now = new Date().toISOString();
  const commandStatement = prior
    ? db.prepare(`UPDATE assignment_activation_commands SET state = 'blocked', completed_at = ?, version = version + 1
        WHERE id = ? AND state = 'ready'`).bind(now, commandId)
    : db.prepare(`INSERT INTO assignment_activation_commands
        (id, activation_key, request_hash, roster_slot_id, officer_id, expected_slot_version, environment,
         integrity_state, state, roster_assignment_id, shift_id, requested_by, requested_at, completed_at, version)
        VALUES (?, ?, ?, ?, ?, ?, 'production', 'production_candidate', 'blocked', NULL, NULL, ?, ?, ?, 1)`)
      .bind(commandId, request.activationKey, hash, request.rosterSlotId, request.officerId,
        request.expectedSlotVersion, actorId, now, now);
  await db.batch([
    commandStatement,
    db.prepare(`INSERT INTO assignment_activation_decisions
      (id, command_id, sequence, checkpoint, decision, environment, summary, evaluation_hash, evaluated_at)
      VALUES (?, ?, ?, 'activation', 'blocked', 'production', ?, ?, ?)`)
      .bind(decisionId, commandId, sequence, blocker.detail, await digest({ request, blocker, now }), now),
    db.prepare(`INSERT INTO assignment_activation_blockers
      (id, decision_id, code, category, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(`${decisionId}-B1`, decisionId, blocker.code, blocker.category, blocker.detail, now),
  ]);
  return existingCommand(db, request.activationKey);
}

export async function recordAssignmentActivationEvaluation(
  db: D1Database,
  request: AssignmentActivationRequest,
  actorId: string,
) {
  const hash = await requestHash(request);
  const existing = await existingCommand(db, request.activationKey);
  if (existing) {
    if (existing.requestHash !== hash) throw new AssignmentActivationError("That activation key was already used for a different request.", 409);
    return existing;
  }
  const evaluation = await evaluateAssignmentActivation(db, request);
  const commandId = id("AC", await digest(request.activationKey));
  const decisionId = id("AD", await digest(`${request.activationKey}:evaluation`));
  const state = evaluation.result.ready ? "ready" : "blocked";
  const integrityState = (request.environment ?? "production") === "production"
    ? "production_candidate"
    : "synthetic_demo_only";
  const summary = evaluation.result.ready ? "Every production activation condition passed at evaluation time."
    : `${evaluation.result.blockers.length} activation blocker${evaluation.result.blockers.length === 1 ? "" : "s"} recorded.`;
  try {
    await db.batch([
      db.prepare(`INSERT INTO assignment_activation_commands
        (id, activation_key, request_hash, roster_slot_id, officer_id, expected_slot_version, environment,
         integrity_state, state, roster_assignment_id, shift_id, requested_by, requested_at, completed_at, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, 1)`)
        .bind(commandId, request.activationKey, hash, request.rosterSlotId, request.officerId,
          request.expectedSlotVersion, request.environment ?? "production", integrityState, state, actorId,
          evaluation.facts.evaluatedAt, evaluation.facts.evaluatedAt),
      db.prepare(`INSERT INTO assignment_activation_decisions
        (id, command_id, sequence, checkpoint, decision, environment, summary, evaluation_hash, evaluated_at)
        VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)`)
        .bind(decisionId, commandId, request.checkpoint ?? "activation", state, request.environment ?? "production",
          summary, evaluation.evaluationHash, evaluation.facts.evaluatedAt),
      ...evaluation.result.blockers.map((blocker, index) => db.prepare(`INSERT INTO assignment_activation_blockers
        (id, decision_id, code, category, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(`${decisionId}-B${index + 1}`, decisionId, blocker.code, blocker.category, blocker.detail, evaluation.facts.evaluatedAt)),
    ]);
  } catch (cause) {
    const raced = await existingCommand(db, request.activationKey);
    if (raced) {
      if (raced.requestHash !== hash) {
        throw new AssignmentActivationError("That activation key was already used for a different request.", 409);
      }
      return raced;
    }
    throw cause;
  }
  return { id: commandId, requestHash: hash, state, rosterAssignmentId: null, shiftId: null };
}

export async function activateAssignment(
  db: D1Database,
  request: AssignmentActivationRequest,
  actorId: string,
) {
  if (request.environment && request.environment !== "production") {
    throw new AssignmentActivationError("Synthetic demo commands cannot be promoted into production activation.", 403);
  }
  const hash = await requestHash(request);
  let prior = await existingCommand(db, request.activationKey);
  if (prior) {
    if (prior.requestHash !== hash) throw new AssignmentActivationError("That activation key was already used for a different request.", 409);
    if (prior.state === "activated") return prior;
    if (prior.state === "blocked") throw new AssignmentActivationError("That activation command is blocked; use a new key after remediation.", 423);
    if (prior.state !== "ready") throw new AssignmentActivationError("That activation command is already being processed.", 409);
  }
  if (!prior) {
    prior = await recordAssignmentActivationEvaluation(
      db,
      { ...request, environment: "production", checkpoint: "activation" },
      actorId,
    );
    if (prior.state === "activated") return prior;
    if (prior.state === "blocked") {
      const blocker = await db.prepare(`SELECT b.detail FROM assignment_activation_blockers b
        JOIN assignment_activation_decisions d ON d.id = b.decision_id
        WHERE d.command_id = ? ORDER BY d.sequence DESC, b.id LIMIT 1`)
        .bind(prior.id).first<{ detail: string }>();
      throw new AssignmentActivationError(
        blocker?.detail ?? "That activation command is blocked; use a new key after remediation.",
        423,
      );
    }
    if (prior.state !== "ready") {
      throw new AssignmentActivationError("That activation command is already being processed.", 409);
    }
  }

  const evaluation = await evaluateAssignmentActivation(db, { ...request, environment: "production", checkpoint: "activation" });
  if (!evaluation.result.ready) {
    await recordReadyCommandBlockers(db, prior.id, evaluation);
    throw new AssignmentActivationError(evaluation.result.blockers[0]?.detail ?? "Assignment activation is blocked.", 423);
  }

  const keyHash = await digest(request.activationKey);
  const commandId = prior.id;
  const assignmentId = id("RAA", keyHash);
  const shiftId = id("SHA", keyHash);
  const snapshotId = id("AAS", keyHash);
  const decisionId = id("AD", await digest(`${request.activationKey}:activated`));
  const evidenceTokenId = id("AET", await digest(`${request.activationKey}:activation:${evaluation.evaluationHash}`));
  const now = evaluation.facts.evaluatedAt;
  const facts = evaluation.facts;
  const workforce = facts.workforce;
  const employer = workforce.employer;
  const payloads = evidencePayloads(facts);
  if (!facts.funding.reconciliationId || !facts.site.risk.id || !facts.post.orders.id || !facts.induction.id
    || !workforce.engagementId || !employer.id || !employer.legalName || employer.version === null || !workforce.terms.id
    || !workforce.model) throw new AssignmentActivationError("The verified activation plan is incomplete.", 500);

  const statements: D1PreparedStatement[] = [
    db.prepare(`INSERT INTO assignment_evidence_tokens
      (id, command_id, checkpoint, source_revision, evaluation_hash, evaluated_at,
       roster_slot_id, officer_id, expected_slot_version, environment,
       funding_evidence, site_evidence, launch_evidence, officer_evidence,
       employer_evidence, schedule_evidence, created_at)
      SELECT ?, ?, 'activation', ?, ?, ?, ?, ?, ?, 'production', ?, ?, ?, ?, ?, ?, ?
      FROM activation_evidence_epoch epoch
      WHERE epoch.singleton = 1 AND epoch.revision = ?`)
      .bind(evidenceTokenId, commandId, evaluation.sourceRevision, evaluation.evaluationHash, now,
        request.rosterSlotId, request.officerId, request.expectedSlotVersion,
        payloads.funding, payloads.site, payloads.launch, payloads.officer, payloads.employer, payloads.schedule,
        now, evaluation.sourceRevision),
    db.prepare(`INSERT INTO shifts
      (id, booking_id, officer_id, scheduled_date, environment, integrity_state, status, check_in_at, check_out_at,
       passport_verification_status, passport_verified_at, passport_scan_id,
       client_signoff_status, signed_off_at, earnings_cents)
      VALUES (?, ?, ?, ?, 'production', 'production_verified', 'reserved', NULL, NULL, 'not_checked', NULL, NULL, 'not_due', NULL, ?)`)
      .bind(shiftId, facts.shift.bookingId, request.officerId, facts.shift.startsAt.slice(0, 10), facts.compensation.fundedOfferCents),
    db.prepare(`INSERT INTO roster_assignments
      (id, roster_slot_id, officer_id, shift_id, assignment_kind, environment, integrity_state, status, active_key, assigned_by,
       assigned_at, confirmed_at, released_at, version)
      VALUES (?, ?, ?, ?, 'primary', 'production', 'production_verified', 'reserved', NULL, ?, ?, NULL, NULL, 1)`)
      .bind(assignmentId, request.rosterSlotId, request.officerId, shiftId, actorId, now),
    db.prepare(`UPDATE assignment_activation_commands SET state = 'reserved', integrity_state = 'production_verified',
        roster_assignment_id = ?, shift_id = ?, completed_at = NULL, version = version + 1
        WHERE id = ? AND request_hash = ? AND state = 'ready'`)
      .bind(assignmentId, shiftId, commandId, hash),
    db.prepare(`INSERT INTO assignment_workforce_snapshots
      (id, roster_assignment_id, workforce_engagement_id, officer_id, employer_id, workforce_model,
       employer_legal_name, terms_version, decision, blockers, environment, captured_at)
      SELECT ?, ?, we.id, ?, emp.id, we.model, emp.legal_name, wta.terms_version,
        'production_verified', '[]', 'production', token.created_at
      FROM workforce_engagements we
      JOIN workforce_employers emp ON emp.id = we.employer_id
      JOIN workforce_terms_acceptances wta ON wta.active_key = we.id
      JOIN assignment_evidence_tokens token ON token.command_id = ? AND token.checkpoint = 'activation'
        AND token.officer_id = we.officer_id
      WHERE we.id = ? AND we.officer_id = ? AND we.environment = 'production'
        AND we.status = 'active' AND we.active_key = we.officer_id`)
      .bind(id("AWS", keyHash), assignmentId, request.officerId, commandId,
        workforce.engagementId, request.officerId),
    db.prepare(`INSERT INTO assignment_activation_snapshots
      (id, command_id, roster_assignment_id, shift_id, environment, integrity_state, booking_id, client_id,
       site_id, site_version, post_id, officer_id, funding_reconciliation_id, risk_assessment_id,
       post_order_approval_id, induction_id, workforce_engagement_id, workforce_model, employer_id,
       employer_legal_name, employer_version, terms_acceptance_id, terms_version, pricing_version,
       calendar_category, ordinary_wage_cents, holiday_premium_cents, statutory_cost_cents,
       funded_offer_cents, reserved_minutes, shift_starts_at, shift_ends_at, funding_evidence, site_evidence,
       launch_evidence, officer_evidence, employer_evidence, schedule_evidence, evidence_valid_through, final, created_at)
      SELECT ?, ?, ?, ?, 'production', 'production_verified', rs.booking_id, b.client_id, rs.site_id,
       os.version, rs.post_id, ?, fr.id, sra.id, poa.id, osi.id, we.id, we.model, emp.id, emp.legal_name,
       emp.version, wta.id, wta.terms_version, b.pricing_version, ?, ?, ?, ?, ?, ?,
       rs.starts_at, rs.ends_at, token.funding_evidence, token.site_evidence,
       token.launch_evidence, token.officer_evidence, token.employer_evidence,
       token.schedule_evidence, rs.ends_at, 1, token.created_at
      FROM roster_slots rs JOIN bookings b ON b.id = rs.booking_id
      JOIN operational_sites os ON os.id = rs.site_id JOIN site_posts sp ON sp.id = rs.post_id
      JOIN booking_funding_reconciliations fr ON fr.active_key = b.id
      JOIN site_risk_assessments sra ON sra.active_key = os.id
      JOIN post_order_approvals poa ON poa.active_key = sp.id
      JOIN officer_site_inductions osi ON osi.active_key = ? || ':' || os.id
      JOIN workforce_engagements we ON we.officer_id = ? AND we.active_key = we.officer_id AND we.status = 'active'
      JOIN workforce_employers emp ON emp.id = we.employer_id
      JOIN workforce_terms_acceptances wta ON wta.active_key = we.id
      JOIN assignment_evidence_tokens token ON token.command_id = ? AND token.checkpoint = 'activation'
        AND token.roster_slot_id = rs.id AND token.officer_id = ?
      WHERE rs.id = ? AND rs.version = ?`)
      .bind(snapshotId, commandId, assignmentId, shiftId, request.officerId,
        facts.compensation.calendarCategory,
        facts.compensation.ordinaryWageCents, facts.compensation.holidayPremiumCents,
        facts.compensation.statutoryCostCents, facts.compensation.fundedOfferCents,
        evaluation.result.weekSegments.reduce((sum, segment) => sum + segment.minutes, 0),
        request.officerId, request.officerId, commandId, request.officerId,
        request.rosterSlotId, request.expectedSlotVersion),
  ];
  if (workforce.model === "direct_flex") {
    const capMinutes = (workforce.weeklyHourCap ?? 0) * 60;
    for (const [index, segment] of evaluation.result.weekSegments.entries()) {
      statements.push(db.prepare(`INSERT INTO workforce_hour_reservations
        (id, command_id, roster_assignment_id, relief_dispatch_id, officer_id, workforce_engagement_id,
         source_type, source_id, iso_week_start, iso_week_end, segment_starts_at, segment_ends_at,
         reserved_minutes, weekly_cap_minutes, status, active_key, created_at, released_at, release_reason)
        VALUES (?, ?, ?, NULL, ?, ?, 'assignment', ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, NULL, NULL)`)
        .bind(`${id("WHR", keyHash)}-${index + 1}`, commandId, assignmentId, request.officerId,
          workforce.engagementId, assignmentId, segment.isoWeekStart, segment.isoWeekEnd, segment.startsAt,
          segment.endsAt, segment.minutes, capMinutes, `${request.officerId}:${segment.isoWeekStart}:${assignmentId}`, now));
    }
  }
  const start = new Date(facts.shift.startsAt).getTime();
  for (const [checkpoint, offset] of [["t_minus_24", 24], ["t_minus_2", 2], ["check_in", 0.5]] as const) {
    statements.push(db.prepare(`INSERT INTO assignment_revalidations
      (id, snapshot_id, checkpoint, scheduled_at, status, decision_id, evaluated_at, created_at)
      VALUES (?, ?, ?, ?, 'pending', NULL, NULL, ?)`)
      .bind(`${id("ARV", keyHash)}-${checkpoint}`, snapshotId, checkpoint, new Date(start - offset * 60 * 60 * 1000).toISOString(), now));
  }
  statements.push(
    db.prepare(`INSERT INTO assignment_activation_decisions
      (id, command_id, sequence, checkpoint, decision, environment, summary, evaluation_hash, evaluated_at)
      VALUES (?, ?, ?, 'activation', 'activated', 'production', ?, ?, ?)`)
      .bind(decisionId, commandId, 2,
        `Activated under ${ACTIVATION_POLICY_VERSION}; all verified records frozen exactly once.`, evaluation.evaluationHash, now),
    db.prepare(`UPDATE roster_slots SET status = 'scheduled', version = version + 1, updated_at = ?
      WHERE id = ? AND version = ? AND status IN ('scheduled','uncovered')`).bind(now, request.rosterSlotId, request.expectedSlotVersion),
    db.prepare(`UPDATE roster_assignments SET status = 'confirmed', active_key = roster_slot_id,
      confirmed_at = ?, version = version + 1 WHERE id = ? AND status = 'reserved' AND active_key IS NULL`)
      .bind(now, assignmentId),
    db.prepare(`UPDATE shifts SET status = 'confirmed' WHERE id = ? AND status = 'reserved'`).bind(shiftId),
    db.prepare(`UPDATE assignment_activation_commands SET state = 'activated', completed_at = ?, version = version + 1
      WHERE id = ? AND state = 'reserved'`).bind(now, commandId),
  );

  try {
    await db.batch(statements);
  } catch (cause) {
    const raced = await existingCommand(db, request.activationKey);
    if (raced?.requestHash === hash && raced.state === "activated") return raced;
    const message = cause instanceof Error ? cause.message : "Atomic activation failed.";
    await recordActivationCommitFailure(db, request, actorId, hash, message);
    throw new AssignmentActivationError(`Atomic activation rolled back: ${message}`, 409);
  }
  const activated = await existingCommand(db, request.activationKey);
  if (!activated || activated.state !== "activated") throw new AssignmentActivationError("Atomic activation did not produce a final command.", 500);
  return activated;
}

export async function releaseAssignmentHourReservations(
  db: D1Database,
  rosterAssignmentId: string,
  reason: "cancelled" | "replaced" | "released",
  actorId: string,
) {
  requireIdentifier(rosterAssignmentId, "Roster assignment");
  const releasedAt = new Date().toISOString();
  const results = await db.batch([
    db.prepare(`UPDATE roster_assignments SET status = ?, active_key = NULL,
      released_at = ?, version = version + 1
      WHERE id = ? AND status = 'confirmed' AND active_key = roster_slot_id
        AND environment = 'production' AND integrity_state = 'production_verified'
        AND EXISTS (
          SELECT 1 FROM assignment_activation_snapshots snap
          JOIN assignment_activation_commands c ON c.id = snap.command_id
            AND c.state = 'activated' AND c.roster_assignment_id = roster_assignments.id
            AND c.shift_id = snap.shift_id AND c.roster_slot_id = roster_assignments.roster_slot_id
          JOIN shifts sh ON sh.id = snap.shift_id AND sh.status = 'confirmed'
            AND sh.check_in_at IS NULL AND sh.check_out_at IS NULL
            AND sh.environment = 'production' AND sh.integrity_state = 'production_verified'
          WHERE snap.roster_assignment_id = roster_assignments.id AND snap.final = 1
            AND snap.environment = 'production' AND snap.integrity_state = 'production_verified'
        )`)
      .bind(reason, releasedAt, rosterAssignmentId),
    db.prepare(`INSERT INTO audit_events
      (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
      SELECT ?, 'operations', ?, 'assignment_hours_released', 'roster_assignment', ra.id, ?, ?
      FROM roster_assignments ra WHERE ra.id = ? AND ra.status = ? AND ra.released_at = ?`)
      .bind(`AUD-${crypto.randomUUID()}`, actorId,
        `Active hour reservations released because the assignment was ${reason}.`, releasedAt,
        rosterAssignmentId, reason, releasedAt),
  ]);
  if (!results[0]?.meta.changes || !results[1]?.meta.changes) {
    throw new AssignmentActivationError("The assignment could not be released from its current state.", 409);
  }
}

export async function revalidateAssignment(
  db: D1Database,
  shiftId: string,
  checkpoint: Exclude<ActivationCheckpoint, "activation">,
  actorId: string,
  transitionCheckIn = false,
) {
  requireIdentifier(shiftId, "Shift");
  if (transitionCheckIn && checkpoint !== "check_in") throw new AssignmentActivationError("Only check-in revalidation may transition a shift.");
  if (checkpoint === "check_in" && !transitionCheckIn) {
    throw new AssignmentActivationError("Check-in revalidation must atomically transition the shift.", 409);
  }
  const activation = await db.prepare(`SELECT snap.id AS snapshotId, snap.command_id AS commandId,
    snap.roster_assignment_id AS rosterAssignmentId, snap.officer_id AS officerId,
    c.activation_key AS activationKey, c.roster_slot_id AS rosterSlotId,
    rs.version AS slotVersion, rs.starts_at AS startsAt, rs.ends_at AS endsAt,
    rs.check_in_due_at AS checkInDueAt,
    rv.id AS revalidationId, rv.status AS revalidationStatus, rv.scheduled_at AS scheduledAt,
    ra.status AS assignmentStatus, ra.active_key AS assignmentActiveKey,
    sh.status AS shiftStatus, sh.check_in_at AS checkInAt
    FROM assignment_activation_snapshots snap
    JOIN assignment_activation_commands c ON c.id = snap.command_id AND c.state = 'activated'
    JOIN roster_slots rs ON rs.id = c.roster_slot_id
      AND rs.booking_id = snap.booking_id AND rs.site_id = snap.site_id AND rs.post_id = snap.post_id
      AND rs.starts_at = snap.shift_starts_at AND rs.ends_at = snap.shift_ends_at
    JOIN roster_assignments ra ON ra.id = snap.roster_assignment_id
      AND ra.roster_slot_id = c.roster_slot_id AND ra.officer_id = snap.officer_id AND ra.shift_id = snap.shift_id
    JOIN shifts sh ON sh.id = snap.shift_id AND sh.booking_id = snap.booking_id
      AND sh.officer_id = snap.officer_id AND sh.earnings_cents = snap.funded_offer_cents
    JOIN assignment_revalidations rv ON rv.snapshot_id = snap.id AND rv.checkpoint = ?
    WHERE snap.shift_id = ? AND snap.environment = 'production' AND snap.final = 1`)
    .bind(checkpoint, shiftId).first<{ snapshotId: string; commandId: string; rosterAssignmentId: string;
      officerId: string; activationKey: string; rosterSlotId: string; slotVersion: number; startsAt: string; endsAt: string;
      checkInDueAt: string;
      revalidationId: string; revalidationStatus: string; scheduledAt: string; assignmentStatus: string;
      assignmentActiveKey: string | null; shiftStatus: string; checkInAt: string | null }>();
  if (!activation) throw new AssignmentActivationError("No final production activation snapshot exists for this shift.", 404);
  if (activation.assignmentStatus !== "confirmed" || activation.assignmentActiveKey !== activation.rosterSlotId
    || ["cancelled", "replaced", "released"].includes(activation.assignmentStatus)) {
    throw new AssignmentActivationError("The active assignment was cancelled, replaced or released before revalidation.", 409);
  }
  if (checkpoint === "check_in" && activation.shiftStatus !== "confirmed" && activation.shiftStatus !== "on_post") {
    throw new AssignmentActivationError("The shift is not in a check-in eligible state.", 409);
  }
  if (activation.revalidationStatus === "passed") {
    if (checkpoint === "check_in" && (activation.shiftStatus !== "on_post" || !activation.checkInAt)) {
      throw new AssignmentActivationError("The passed check-in record is inconsistent with the shift state.", 409);
    }
    return { ready: true, idempotent: true };
  }
  if (activation.revalidationStatus === "failed") return { ready: false, idempotent: true };
  if (activation.revalidationStatus !== "pending") {
    throw new AssignmentActivationError("That revalidation checkpoint is already being processed.", 409);
  }

  const dueAt = new Date(activation.scheduledAt).getTime();
  const currentTime = Date.now();
  if (!Number.isFinite(dueAt) || currentTime < dueAt) {
    throw new AssignmentActivationError(`${checkpoint} revalidation is not due yet.`, 409);
  }
  const shiftEnd = new Date(activation.endsAt).getTime();
  if (!Number.isFinite(shiftEnd) || currentTime >= shiftEnd) {
    throw new AssignmentActivationError("The scheduled shift has ended; activation, revalidation and check-in are closed.", 409);
  }
  if (checkpoint === "check_in") {
    const checkInDeadline = new Date(activation.checkInDueAt).getTime();
    if (!Number.isFinite(checkInDeadline) || currentTime > checkInDeadline) {
      throw new AssignmentActivationError("The roster check-in deadline has passed; Operations must replace or cancel the assignment.", 409);
    }
  }
  const requiredCheckpoints = checkpoint === "t_minus_2"
    ? ["t_minus_24"]
    : checkpoint === "check_in"
      ? ["t_minus_24", "t_minus_2"]
      : [];
  if (requiredCheckpoints.length) {
    const placeholders = requiredCheckpoints.map(() => "?").join(",");
    const passed = await all<{ checkpoint: string }>(db.prepare(`SELECT checkpoint FROM assignment_revalidations
      WHERE snapshot_id = ? AND checkpoint IN (${placeholders}) AND status = 'passed'`)
      .bind(activation.snapshotId, ...requiredCheckpoints));
    const passedSet = new Set(passed.map((item) => item.checkpoint));
    const missing = requiredCheckpoints.filter((required) => !passedSet.has(required));
    if (missing.length) {
      throw new AssignmentActivationError(
        `${missing.map((item) => item === "t_minus_24" ? "T−24" : "T−2").join(" and ")} revalidation must pass before ${checkpoint === "check_in" ? "check-in" : "T−2"}.`,
        409,
      );
    }
  }

  const evaluation = await evaluateAssignmentActivation(db, {
    rosterSlotId: activation.rosterSlotId,
    officerId: activation.officerId,
    expectedSlotVersion: activation.slotVersion,
    activationKey: `${activation.activationKey}:${checkpoint}`,
    environment: "production",
    checkpoint,
  });
  const sequenceRow = await db.prepare(`SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence
    FROM assignment_activation_decisions WHERE command_id = ?`).bind(activation.commandId).first<{ sequence: number }>();
  const sequence = Number(sequenceRow?.sequence ?? 2);
  const decisionId = `AD-${crypto.randomUUID()}`;
  const now = evaluation.facts.evaluatedAt;
  const decision = evaluation.result.ready ? "passed" : "failed";
  const payloads = evidencePayloads(evaluation.facts);
  const evidenceTokenId = id("AET", await digest(`${activation.commandId}:${checkpoint}:${evaluation.evaluationHash}`));
  const decisionStatements: D1PreparedStatement[] = [
    db.prepare(`INSERT INTO assignment_evidence_tokens
      (id, command_id, checkpoint, source_revision, evaluation_hash, evaluated_at,
       roster_slot_id, officer_id, expected_slot_version, environment,
       funding_evidence, site_evidence, launch_evidence, officer_evidence,
       employer_evidence, schedule_evidence, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'production', ?, ?, ?, ?, ?, ?, ?
      FROM activation_evidence_epoch epoch
      WHERE epoch.singleton = 1 AND epoch.revision = ?`)
      .bind(evidenceTokenId, activation.commandId, checkpoint, evaluation.sourceRevision,
        evaluation.evaluationHash, now, activation.rosterSlotId, activation.officerId,
        activation.slotVersion, payloads.funding, payloads.site, payloads.launch,
        payloads.officer, payloads.employer, payloads.schedule, now, evaluation.sourceRevision),
    db.prepare(`INSERT INTO assignment_activation_decisions
      (id, command_id, sequence, checkpoint, decision, environment, summary, evaluation_hash, evaluated_at)
      VALUES (?, ?, ?, ?, ?, 'production', ?, ?, ?)`)
      .bind(decisionId, activation.commandId, sequence, checkpoint, decision,
        evaluation.result.ready ? `${checkpoint} revalidation passed under ${ACTIVATION_POLICY_VERSION}.`
          : `${evaluation.result.blockers.length} blocker(s) stopped ${checkpoint} revalidation.`,
        evaluation.evaluationHash, now),
    ...evaluation.result.blockers.map((blocker, index) => db.prepare(`INSERT INTO assignment_activation_blockers
      (id, decision_id, code, category, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(`${decisionId}-B${index + 1}`, decisionId, blocker.code, blocker.category, blocker.detail, now)),
  ];
  const statements: D1PreparedStatement[] = [...decisionStatements];
  if (checkpoint === "check_in" && evaluation.result.ready) {
    statements.push(
      db.prepare(`UPDATE assignment_revalidations SET status = 'transitioning', decision_id = ?, evaluated_at = ?
        WHERE id = ? AND status = 'pending'`).bind(decisionId, now, activation.revalidationId),
      db.prepare(`UPDATE shifts SET status = 'on_post', check_in_at = ?
        WHERE id = ? AND status = 'confirmed' AND check_in_at IS NULL`).bind(now, shiftId),
      db.prepare(`UPDATE assignment_revalidations SET status = 'passed'
        WHERE id = ? AND status = 'transitioning' AND decision_id = ?`).bind(activation.revalidationId, decisionId),
    );
  } else {
    statements.push(db.prepare(`UPDATE assignment_revalidations SET status = ?, decision_id = ?, evaluated_at = ?
      WHERE id = ? AND status = 'pending'`).bind(decision, decisionId, now, activation.revalidationId));
  }
  try {
    await db.batch(statements);
  } catch (cause) {
    const raced = await db.prepare(`SELECT rv.status, sh.status AS shiftStatus, sh.check_in_at AS checkInAt
      FROM assignment_revalidations rv JOIN assignment_activation_snapshots snap ON snap.id = rv.snapshot_id
      JOIN shifts sh ON sh.id = snap.shift_id WHERE rv.id = ?`).bind(activation.revalidationId)
      .first<{ status: string; shiftStatus: string; checkInAt: string | null }>();
    if (raced?.status === "passed" && (checkpoint !== "check_in" || (raced.shiftStatus === "on_post" && raced.checkInAt))) {
      return { ready: true, idempotent: true };
    }
    const currentRevision = await readActivationEvidenceRevision(db);
    if (currentRevision !== evaluation.sourceRevision) {
      throw new AssignmentActivationError(
        "Live funding, evidence, workforce or schedule facts changed before commit. The revalidation remains pending and must be retried.",
        409,
      );
    }
    throw new AssignmentActivationError(cause instanceof Error ? cause.message : "Revalidation could not be committed.", 409);
  }
  return { ready: evaluation.result.ready, idempotent: false, blockers: evaluation.result.blockers };
}

export async function runDueAssignmentRevalidations(db: D1Database, actorId: string) {
  const due = await all<{ shiftId: string; checkpoint: "t_minus_24" | "t_minus_2" }>(db.prepare(`SELECT snap.shift_id AS shiftId,
    rv.checkpoint FROM assignment_revalidations rv
    JOIN assignment_activation_snapshots snap ON snap.id = rv.snapshot_id AND snap.environment = 'production' AND snap.final = 1
    JOIN assignment_activation_commands c ON c.id = snap.command_id AND c.state = 'activated'
    JOIN roster_assignments ra ON ra.id = snap.roster_assignment_id AND ra.status = 'confirmed' AND ra.active_key = c.roster_slot_id
    JOIN roster_slots rs ON rs.id = c.roster_slot_id AND rs.ends_at = snap.shift_ends_at
    WHERE rv.status = 'pending' AND rv.checkpoint IN ('t_minus_24','t_minus_2')
      AND julianday(rv.scheduled_at) <= julianday(CURRENT_TIMESTAMP)
      AND julianday(CURRENT_TIMESTAMP) < julianday(rs.ends_at)
    ORDER BY rv.scheduled_at LIMIT 50`));
  const results: Array<{ shiftId: string; checkpoint: "t_minus_24" | "t_minus_2"; ready: boolean; error?: string }> = [];
  for (const item of due) {
    try {
      const result = await revalidateAssignment(db, item.shiftId, item.checkpoint, actorId);
      results.push({ ...item, ready: result.ready });
    } catch (cause) {
      results.push({ ...item, ready: false, error: cause instanceof Error ? cause.message : "Revalidation failed." });
    }
  }
  return results;
}
