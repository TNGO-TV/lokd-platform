import {
  launchGateDecision,
  type LaunchGateInput,
  type WorkforceModel,
} from "./workforce-core";

export const ACTIVATION_POLICY_VERSION = "LOKD-ACTIVATION-2026.09-v2";
export const MINIMUM_REST_MINUTES = 8 * 60;
export const REQUIRED_EMPLOYER_EVIDENCE = [
  "psira",
  "nbcpss",
  "psspf",
  "uif",
  "coida",
  "insurance",
  "service_agreement",
] as const;

export type ActivationEnvironment = "production" | "demo_synthetic";
export type ActivationCheckpoint = "activation" | "t_minus_24" | "t_minus_2" | "check_in";

export type ActivationBlocker = {
  code: string;
  category: "launch" | "funding" | "site" | "officer" | "workforce" | "schedule" | "compensation" | "concurrency";
  detail: string;
};

export type DatedEvidence = {
  id: string | null;
  status: string | null;
  version?: string | number | null;
  environment: string | null;
  integrityState: string | null;
  evidenceReference: string | null;
  verifiedAt: string | null;
  validFrom?: string | null;
  expiresAt: string | null;
};

export type IsoWeekSegment = {
  isoWeekStart: string;
  isoWeekEnd: string;
  startsAt: string;
  endsAt: string;
  minutes: number;
};

export type AssignmentActivationFacts = {
  environment: ActivationEnvironment;
  checkpoint: ActivationCheckpoint;
  evaluatedAt: string;
  shift: {
    rosterSlotId: string;
    bookingId: string;
    siteId: string;
    postId: string;
    officerId: string;
    startsAt: string;
    endsAt: string;
    checkInDueAt?: string | null;
    slotVersion: number;
    slotStatus: string;
  };
  launchGates: LaunchGateInput[];
  funding: {
    reconciliationId: string | null;
    environment: string | null;
    integrityState: string | null;
    provider: string | null;
    providerReference: string | null;
    status: string | null;
    currency: string | null;
    bookingAmountCents: number;
    expectedAmountCents: number;
    clearedAmountCents: number;
    clearedAt: string | null;
    reconciledAt: string | null;
    evidenceReference: string | null;
    verifiedAt: string | null;
    expiresAt: string | null;
  };
  agreements?: { ready: boolean; missing: string[]; receipts: Array<{id:string;hash:string;documentId:string;documentVersion:string;contextHash:string}> };
  client: { id: string; approvalStatus: string; contractingEntityId?: string | null; orderVersion?: number; orderDetails?: string };
  site: { id: string; status: string; version: number; risk: DatedEvidence };
  post: {
    id: string;
    status: string;
    postOrdersVersion: string;
    serviceType?: string;
    purposeCode?: string;
    minimumGrade?: string;
    orders: DatedEvidence;
  };
  induction: DatedEvidence;
  officer: {
    id: string;
    approvalStatus: string;
    psiraGrade?: string;
    gradeEligible: boolean;
    psiraExpiry: string | null;
    identity: DatedEvidence;
    psira: DatedEvidence;
    core: DatedEvidence;
    service: DatedEvidence & { qualified: boolean; optedIn: boolean; qualificationExpiresAt: string | null };
    purpose: DatedEvidence;
    passport: DatedEvidence;
  };
  workforce: {
    engagementId: string | null;
    engagementVersion?: number | null;
    environment: string | null;
    model: WorkforceModel | null;
    status: string | null;
    termsVersion: string | null;
    reviewDueAt: string | null;
    weeklyHourCap: number | null;
    payrollStatus: string | null;
    benefitsStatus: string | null;
    terms: DatedEvidence;
    employer: {
      id: string | null;
      legalName: string | null;
      employerType: string | null;
      environment: string | null;
      status: string | null;
      version: number | null;
      reviewDueAt: string | null;
      evidence: DatedEvidence[];
    };
  };
  schedule: {
    available: boolean;
    availability: DatedEvidence;
    externalDeclarationCurrent: boolean;
    declaration: DatedEvidence;
    conflicts: Array<{ id: string; startsAt: string; endsAt: string; kind: string }>;
    travel: DatedEvidence & { feasible: boolean; estimatedMinutes: number | null };
    existingWeekMinutes: Record<string, number>;
  };
  compensation: {
    pricingVersion: string | null;
    authoritativePricing: boolean;
    rosterServiceDate: string | null;
    derivedServiceDate: string | null;
    serviceDateMatchesStart: boolean;
    storedCalendarCategory: string | null;
    calendarCategory: string | null;
    storedOfficerOfferCents: number;
    ordinaryWageCents: number;
    holidayPremiumCents: number;
    statutoryCostCents: number;
    officerOfferCents: number;
    fundedOfferCents: number;
  };
};

function parsedTime(value: string | null | undefined) {
  if (!value) return Number.NaN;
  return new Date(value).getTime();
}

function parsedExpiry(value: string | null | undefined) {
  if (!value) return Number.NaN;
  return parsedTime(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999+02:00` : value);
}

function present(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function evidencePasses(
  evidence: DatedEvidence,
  validThrough: string,
  statuses: string[],
  evaluatedAt: string,
  environment: ActivationEnvironment,
  requireExpiry = false,
) {
  const validThroughTime = parsedTime(validThrough);
  const verifiedAt = parsedTime(evidence.verifiedAt);
  const evaluatedTime = parsedTime(evaluatedAt);
  const expiresAt = evidence.expiresAt ? parsedExpiry(evidence.expiresAt) : null;
  const expectedEvidenceEnvironment = environment === "production" ? "production" : "demo";
  const expectedIntegrity = environment === "production" ? "verified" : "synthetic";
  return Boolean(evidence.id)
    && statuses.includes(evidence.status ?? "")
    && evidence.environment === expectedEvidenceEnvironment
    && evidence.integrityState === expectedIntegrity
    && present(evidence.evidenceReference)
    && Number.isFinite(verifiedAt)
    && Number.isFinite(evaluatedTime)
    && verifiedAt <= evaluatedTime
    && (!requireExpiry || expiresAt !== null)
    && (expiresAt === null || (Number.isFinite(expiresAt)
      && expiresAt >= validThroughTime
      && expiresAt >= evaluatedTime));
}

function isoDate(value: number) {
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * Splits an absolute interval at Johannesburg ISO-week boundaries.
 * South Africa is UTC+02 year-round, so this deliberately avoids host locale and DST.
 */
export function splitAcrossIsoWeeks(startsAt: string, endsAt: string): IsoWeekSegment[] {
  const start = parsedTime(startsAt);
  const end = parsedTime(endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  if (start % 60_000 !== 0 || end % 60_000 !== 0) return [];
  const offset = 2 * 60 * 60 * 1000;
  const segments: IsoWeekSegment[] = [];
  let cursor = start;
  while (cursor < end) {
    const local = new Date(cursor + offset);
    const day = local.getUTCDay() || 7;
    const weekStartLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - day + 1);
    const nextWeekUtc = weekStartLocal + 7 * 24 * 60 * 60 * 1000 - offset;
    const segmentEnd = Math.min(end, nextWeekUtc);
    segments.push({
      isoWeekStart: isoDate(weekStartLocal),
      isoWeekEnd: isoDate(weekStartLocal + 6 * 24 * 60 * 60 * 1000),
      startsAt: new Date(cursor).toISOString(),
      endsAt: new Date(segmentEnd).toISOString(),
      minutes: (segmentEnd - cursor) / 60_000,
    });
    cursor = segmentEnd;
  }
  return segments;
}

export function intervalsConflictWithRest(
  startsAt: string,
  endsAt: string,
  otherStartsAt: string,
  otherEndsAt: string,
  restMinutes = MINIMUM_REST_MINUTES,
) {
  const start = parsedTime(startsAt);
  const end = parsedTime(endsAt);
  const otherStart = parsedTime(otherStartsAt);
  const otherEnd = parsedTime(otherEndsAt);
  if (![start, end, otherStart, otherEnd].every(Number.isFinite)) return true;
  const restMs = restMinutes * 60_000;
  return otherStart < end + restMs && otherEnd > start - restMs;
}

export function evaluateAssignmentActivation(facts: AssignmentActivationFacts) {
  const blockers: ActivationBlocker[] = [];
  const add = (code: string, category: ActivationBlocker["category"], detail: string) => {
    if (!blockers.some((blocker) => blocker.code === code)) blockers.push({ code, category, detail });
  };
  const endTime = parsedTime(facts.shift.endsAt);
  const startTime = parsedTime(facts.shift.startsAt);
  const evaluatedAt = parsedTime(facts.evaluatedAt);
  const evidenceDeadline = Math.max(endTime, evaluatedAt);
  const weekSegments = splitAcrossIsoWeeks(facts.shift.startsAt, facts.shift.endsAt);
  const expectedDataEnvironment = facts.environment === "production" ? "production" : "demo";
  const expectedIntegrity = facts.environment === "production" ? "verified" : "synthetic";

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime || !weekSegments.length) {
    add("SHIFT_WINDOW_INVALID", "schedule", "The assignment start and end must form a valid whole-minute interval.");
  }
  const slotStatusValid = facts.checkpoint === "activation"
    ? ["scheduled", "uncovered"].includes(facts.shift.slotStatus)
    : facts.shift.slotStatus === "scheduled";
  if (!slotStatusValid) add("ROSTER_SLOT_NOT_ACTIVATABLE", "schedule", "The roster slot is not in an activatable state for this checkpoint.");
  if (!Number.isFinite(evaluatedAt)) add("EVALUATION_TIME_INVALID", "schedule", "The server evaluation time is invalid.");
  if (Number.isFinite(evaluatedAt) && Number.isFinite(endTime) && evaluatedAt >= endTime) {
    add("SHIFT_ALREADY_ENDED", "schedule", "The assignment cannot be activated or revalidated after its scheduled end.");
  } else if (facts.checkpoint === "activation" && Number.isFinite(evaluatedAt)
    && Number.isFinite(startTime) && evaluatedAt >= startTime) {
    add("SHIFT_ALREADY_STARTED", "schedule", "A primary assignment must be activated before its scheduled start.");
  }
  if (facts.checkpoint === "check_in") {
    const checkInDueTime = parsedTime(facts.shift.checkInDueAt);
    if (!Number.isFinite(checkInDueTime) || (Number.isFinite(evaluatedAt) && evaluatedAt > checkInDueTime)) {
      add("CHECK_IN_WINDOW_CLOSED", "schedule", "Check-in must complete no later than the roster slot's check-in deadline.");
    }
  }
  if (facts.environment !== "production") {
    add("PRODUCTION_ENVIRONMENT_REQUIRED", "launch", "Synthetic demo records cannot authorise a live paid deployment.");
  }

  if (!facts.agreements?.ready) add("SIGNED_AGREEMENTS_REQUIRED", "workforce", `Approved signatures for the current order and employer arrangement are required: ${facts.agreements?.missing.join(', ') || 'client MSA, service order and workforce agreement'}.`);

  const launch = launchGateDecision(facts.launchGates, facts.shift.endsAt, facts.evaluatedAt);
  for (const code of launch.blockers) {
    const detail = code.startsWith("MISSING:")
      ? `Required launch gate ${code.slice(8)} is missing.`
      : code.startsWith("DUPLICATE:")
        ? `Required launch gate ${code.slice(10)} is duplicated.`
        : `Required launch gate ${code} is not independently evidenced and valid through shift end.`;
    add(`LAUNCH_${code.replaceAll(":", "_")}`, "launch", detail);
  }
  for (const gate of facts.launchGates.filter((item) => item.hardGate)) {
    const gateVerifiedAt = parsedTime(gate.verifiedAt);
    const gateExpiry = parsedTime(gate.expiresAt);
    if (!Number.isFinite(gateVerifiedAt) || gateVerifiedAt > evaluatedAt
      || !Number.isFinite(gateExpiry) || gateExpiry < evidenceDeadline) {
      add(`LAUNCH_${gate.code}`, "launch", `Required launch gate ${gate.code} is not independently evidenced and current through shift end.`);
    }
  }

  const funding = facts.funding;
  if (!funding.reconciliationId || funding.status !== "cleared_reconciled" || funding.environment !== expectedDataEnvironment
    || funding.integrityState !== expectedIntegrity || !funding.provider
    || (facts.environment === "production" && funding.provider === "demo_manual")
    || !present(funding.providerReference) || !present(funding.evidenceReference)
    || funding.currency !== "ZAR"
    || !Number.isFinite(parsedTime(funding.clearedAt)) || parsedTime(funding.clearedAt) > evaluatedAt
    || !Number.isFinite(parsedTime(funding.reconciledAt)) || parsedTime(funding.reconciledAt) > evaluatedAt
    || !Number.isFinite(parsedTime(funding.verifiedAt)) || parsedTime(funding.verifiedAt) > evaluatedAt
    || !Number.isFinite(parsedTime(funding.expiresAt)) || parsedTime(funding.expiresAt) < evidenceDeadline
    || funding.bookingAmountCents <= 0 || funding.expectedAmountCents !== funding.bookingAmountCents
    || funding.clearedAmountCents < funding.expectedAmountCents) {
    add("FUNDING_NOT_CLEARED_RECONCILED", "funding", "Client funds are not independently cleared, reconciled and valid through shift end.");
  }
  if (facts.client.approvalStatus !== "approved") add("CLIENT_NOT_APPROVED", "site", "The client is not active and approved.");
  if (facts.site.status !== "active") add("SITE_NOT_ACTIVE", "site", "The operational site is not active.");
  if (!evidencePasses(facts.site.risk, facts.shift.endsAt, ["approved"], facts.evaluatedAt, facts.environment, true)) add("SITE_RISK_NOT_APPROVED", "site", "The versioned site risk assessment is missing, unapproved, synthetic or expired.");
  if (!Number.isFinite(parsedTime(facts.site.risk.validFrom)) || parsedTime(facts.site.risk.validFrom) > startTime) {
    add("SITE_RISK_NOT_EFFECTIVE", "site", "The approved site risk assessment is not effective by shift start.");
  }
  if (facts.post.status !== "active") add("POST_NOT_ACTIVE", "site", "The operational post is not active.");
  if (!evidencePasses(facts.post.orders, facts.shift.endsAt, ["approved"], facts.evaluatedAt, facts.environment, true)
    || String(facts.post.orders.version ?? "") !== facts.post.postOrdersVersion) {
    add("POST_ORDERS_NOT_APPROVED", "site", "The active post-orders version is not approved and valid through shift end.");
  }
  if (!Number.isFinite(parsedTime(facts.post.orders.validFrom)) || parsedTime(facts.post.orders.validFrom) > startTime) {
    add("POST_ORDERS_NOT_EFFECTIVE", "site", "The approved post orders are not effective by shift start.");
  }
  if (!evidencePasses(facts.induction, facts.shift.endsAt, ["completed"], facts.evaluatedAt, facts.environment, true)) add("OFFICER_INDUCTION_NOT_APPROVED", "site", "The officer has not completed the current verified site induction.");

  if (facts.officer.approvalStatus !== "approved") add("OFFICER_NOT_APPROVED", "officer", "The officer is not approved for the LOKD Verified Network.");
  if (!evidencePasses(facts.officer.identity, facts.shift.endsAt, ["current"], facts.evaluatedAt, facts.environment, true)) add("IDENTITY_NOT_CURRENT", "officer", "Identity evidence is missing, synthetic or not current through shift end.");
  const psiraExpiry = parsedTime(facts.officer.psiraExpiry);
  if (!evidencePasses(facts.officer.psira, facts.shift.endsAt, ["current"], facts.evaluatedAt, facts.environment, true)
    || !Number.isFinite(psiraExpiry) || psiraExpiry < evidenceDeadline) add("PSIRA_NOT_CURRENT", "officer", "PSiRA evidence or the officer registration expires before shift end or evaluation time.");
  if (!facts.officer.gradeEligible) add("GRADE_INSUFFICIENT", "officer", "The officer's PSiRA grade does not meet the post minimum.");
  if (!evidencePasses(facts.officer.core, facts.shift.endsAt, ["current"], facts.evaluatedAt, facts.environment, true)) add("CORE_READINESS_NOT_CURRENT", "officer", "The core LOKD Ready endorsement is not current through shift end.");
  const serviceQualificationExpiry = parsedTime(facts.officer.service.qualificationExpiresAt);
  if (!facts.officer.service.qualified || !facts.officer.service.optedIn
    || !Number.isFinite(serviceQualificationExpiry) || serviceQualificationExpiry < evidenceDeadline
    || !evidencePasses(facts.officer.service, facts.shift.endsAt, ["current"], facts.evaluatedAt, facts.environment, true)) {
    add("SERVICE_QUALIFICATION_NOT_CURRENT", "officer", "The service qualification or opt-in is missing or expires before shift end.");
  }
  if (!evidencePasses(facts.officer.purpose, facts.shift.endsAt, ["current"], facts.evaluatedAt, facts.environment, true)) add("PURPOSE_ENDORSEMENT_NOT_CURRENT", "officer", "The required purpose endorsement is not current through shift end.");
  if (!evidencePasses(facts.officer.passport, facts.shift.endsAt, ["active", "expiring"], facts.evaluatedAt, facts.environment, true)) add("PASSPORT_NOT_CURRENT", "officer", "The LOKD Passport is not current through shift end.");

  const workforce = facts.workforce;
  const workforceModelValid = ["direct_flex", "managed", "partner"].includes(workforce.model ?? "");
  if (!workforce.engagementId || !workforceModelValid || workforce.status !== "active" || workforce.environment !== expectedDataEnvironment) {
    add("WORKFORCE_ROUTE_MISSING", "workforce", "Verified Network membership alone cannot receive paid work; no active workforce route exists.");
  } else {
    if (!Number.isFinite(parsedTime(workforce.reviewDueAt)) || parsedTime(workforce.reviewDueAt) < evidenceDeadline) add("ENGAGEMENT_REVIEW_EXPIRES", "workforce", "The workforce engagement review date is missing, invalid or expires before shift end or evaluation time.");
    if (!evidencePasses(workforce.terms, facts.shift.endsAt, ["accepted"], facts.evaluatedAt, facts.environment, true)
      || String(workforce.terms.version ?? "") !== workforce.termsVersion) add("TERMS_NOT_ACCEPTED", "workforce", "Current employment or partner terms have not been evidenced at the engagement's accepted version through shift end.");
    if (workforce.model === "direct_flex" || workforce.model === "managed") {
      if (workforce.payrollStatus !== "ready") add("PAYROLL_ROUTE_NOT_READY", "workforce", "The LOKD payroll route is not ready.");
      if (workforce.benefitsStatus !== "ready") add("STATUTORY_BENEFITS_NOT_READY", "workforce", "UIF, COIDA and statutory-benefit treatment is not ready.");
    }
    if (workforce.model === "partner") {
      if (workforce.payrollStatus !== "partner_confirmed") add("PARTNER_PAYROLL_NOT_CONFIRMED", "workforce", "The partner has not confirmed payroll responsibility.");
      if (workforce.benefitsStatus !== "partner_confirmed") add("PARTNER_BENEFITS_NOT_CONFIRMED", "workforce", "The partner has not confirmed statutory-benefit responsibility.");
    }
  }
  const employer = workforce.employer;
  if (!employer.id || employer.status !== "current" || employer.environment !== expectedDataEnvironment) add("EMPLOYER_NOT_CURRENT", "workforce", "The employer of record is not approved for this activation environment.");
  if ((workforce.model === "direct_flex" || workforce.model === "managed") && employer.employerType !== "lokd_employer") add("LOKD_EMPLOYER_REQUIRED", "workforce", "Direct Flex and Managed work require LOKD as employer of record.");
  if (workforce.model === "partner" && employer.employerType !== "partner_company") add("PARTNER_EMPLOYER_REQUIRED", "workforce", "Partner-supplied work requires an approved partner employer of record.");
  if (!Number.isFinite(parsedTime(employer.reviewDueAt)) || parsedTime(employer.reviewDueAt) < evidenceDeadline) add("EMPLOYER_REVIEW_EXPIRES", "workforce", "The employer compliance review date is missing, invalid or expires before shift end or evaluation time.");
  for (const control of REQUIRED_EMPLOYER_EVIDENCE) {
    const evidence = employer.evidence.filter((item) => item.id?.endsWith(`:${control}`) || item.version === control);
    if (evidence.length !== 1 || !evidencePasses(evidence[0], facts.shift.endsAt, ["current"], facts.evaluatedAt, facts.environment, true)) {
      add(`EMPLOYER_${control.toUpperCase()}_INVALID`, "workforce", `Employer ${control.replaceAll("_", " ")} evidence is missing, duplicated or expires before shift end.`);
    }
  }

  if (!facts.schedule.available
    || !evidencePasses(facts.schedule.availability, facts.shift.endsAt, ["available"], facts.evaluatedAt, facts.environment, true)) {
    add("AVAILABILITY_NOT_CONFIRMED", "schedule", "No independently evidenced availability window covers the full assignment.");
  }
  if (!facts.schedule.externalDeclarationCurrent
    || !evidencePasses(facts.schedule.declaration, facts.shift.endsAt, ["current"], facts.evaluatedAt, facts.environment, true)) {
    add("EXTERNAL_WORK_DECLARATION_MISSING", "schedule", "The officer's existing-work and rest declaration is not independently evidenced and current.");
  }
  const conflict = facts.schedule.conflicts.find((item) => intervalsConflictWithRest(
    facts.shift.startsAt,
    facts.shift.endsAt,
    item.startsAt,
    item.endsAt,
  ));
  if (conflict) add("WORK_OR_REST_CONFLICT", "schedule", `Existing ${conflict.kind} ${conflict.id} overlaps the assignment or required rest window.`);
  if (!facts.schedule.travel.feasible || !evidencePasses(facts.schedule.travel, facts.shift.endsAt, ["feasible"], facts.evaluatedAt, facts.environment, true)) {
    add("TRAVEL_NOT_FEASIBLE", "schedule", "Travel feasibility is not evidenced and valid through shift end.");
  }

  if (workforce.model === "direct_flex") {
    const capMinutes = (workforce.weeklyHourCap ?? 0) * 60;
    if (capMinutes <= 0) add("WEEKLY_HOUR_CAP_MISSING", "schedule", "Direct Flex requires a positive weekly hour ceiling.");
    for (const segment of weekSegments) {
      const projected = (facts.schedule.existingWeekMinutes[segment.isoWeekStart] ?? 0) + segment.minutes;
      if (projected > capMinutes) add(`WEEKLY_HOUR_CAP_${segment.isoWeekStart}`, "schedule", `Direct Flex would reserve ${projected} minutes in the ISO week beginning ${segment.isoWeekStart}, above the ${capMinutes}-minute ceiling.`);
    }
  }

  const compensation = facts.compensation;
  if (!compensation.authoritativePricing) {
    add("PRICING_RULES_NOT_AUTHORITATIVE", "compensation", "The roster service, risk band, engagement model or pricing version cannot be priced by the current server rules.");
  }
  if (!compensation.serviceDateMatchesStart || !present(compensation.rosterServiceDate)
    || !present(compensation.derivedServiceDate)) {
    add("ROSTER_SERVICE_DATE_MISMATCH", "compensation", "The roster service date does not match the shift start date in Africa/Johannesburg.");
  }
  if (!present(compensation.storedCalendarCategory)
    || compensation.storedCalendarCategory !== compensation.calendarCategory) {
    add("CALENDAR_CATEGORY_MISMATCH", "compensation", "The stored booking calendar category does not match the category derived from the roster start date.");
  }
  if (compensation.storedOfficerOfferCents !== compensation.officerOfferCents) {
    add("STORED_OFFICER_OFFER_MISMATCH", "compensation", "The stored officer offer does not match the server-priced calendar wage for this roster slot.");
  }
  if (!present(compensation.pricingVersion) || !present(compensation.calendarCategory)
    || compensation.ordinaryWageCents <= 0 || compensation.holidayPremiumCents < 0
    || compensation.statutoryCostCents < 0 || compensation.officerOfferCents <= 0
    || compensation.fundedOfferCents !== compensation.officerOfferCents
    || compensation.ordinaryWageCents + compensation.holidayPremiumCents !== compensation.officerOfferCents) {
    add("COMPENSATION_NOT_FROZEN", "compensation", "Calendar wage, holiday premium, statutory cost and funded officer offer are not a complete frozen set.");
  }

  return {
    policyVersion: ACTIVATION_POLICY_VERSION,
    ready: blockers.length === 0,
    blockers,
    weekSegments,
    validThrough: facts.shift.endsAt,
    compensation: { ...compensation },
  };
}
