import type { PassportEndorsement, PassportStatus, ServiceType } from "./pilot-types";

export type ReadinessInput = {
  assignmentDate: string;
  fundingStatus: string;
  approvalStatus: string;
  psiraGrade: string;
  minimumGrade: string;
  psiraExpiry: string;
  passportStatus: PassportStatus;
  passportNextReviewAt: string | null;
  serviceType: ServiceType;
  serviceQualified: boolean;
  serviceOptedIn: boolean;
  requireServiceOptIn?: boolean;
  qualificationExpiry: string | null;
  purposeCode: string;
  endorsements: PassportEndorsement[];
};

export type ReadinessResult = {
  eligible: boolean;
  displayStatus: PassportStatus;
  blockers: string[];
  warnings: string[];
};

const gradeRank: Record<string, number> = {
  "Grade A": 5,
  "Grade B": 4,
  "Grade C": 3,
  "Grade D": 2,
  "Grade E": 1,
};

function covers(date: string | null, assignmentDate: string) {
  return !date || date.slice(0, 10) >= assignmentDate.slice(0, 10);
}

function isEndorsementCurrent(endorsement: PassportEndorsement | undefined, assignmentDate: string) {
  return Boolean(
    endorsement
    && endorsement.status === "current"
    && covers(endorsement.expiresAt, assignmentDate)
    && covers(endorsement.nextDueAt, assignmentDate),
  );
}

export function evaluateReadiness(input: ReadinessInput): ReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const storedStatus = input.passportStatus;

  if (input.fundingStatus !== "paid_in_full") blockers.push("Client term funding is not confirmed.");
  if (input.approvalStatus !== "approved") blockers.push("Officer approval is not active.");
  if (!covers(input.psiraExpiry, input.assignmentDate)) blockers.push("PSiRA registration will not be current for this assignment.");
  if ((gradeRank[input.psiraGrade] ?? 0) < (gradeRank[input.minimumGrade] ?? 99)) blockers.push(`The assignment requires ${input.minimumGrade} or higher.`);
  if (["restricted", "training", "remediation", "suspended", "revoked"].includes(storedStatus)) blockers.push(`LOKD Passport is ${storedStatus}.`);
  if (!covers(input.passportNextReviewAt, input.assignmentDate)) blockers.push("LOKD Passport review is due before this assignment.");

  if (!input.serviceQualified) blockers.push(`${input.serviceType} service eligibility is not approved.`);
  if (input.requireServiceOptIn && !input.serviceOptedIn) blockers.push(`${input.serviceType} offer notifications are switched off.`);
  if (!covers(input.qualificationExpiry, input.assignmentDate)) blockers.push(`${input.serviceType} qualification expires before this assignment.`);

  const core = input.endorsements.find((item) => item.code === "core_ready");
  const service = input.endorsements.find((item) => item.category === "service" && item.serviceType === input.serviceType);
  const purpose = input.endorsements.find((item) => item.category === "purpose" && item.purposeCode === input.purposeCode);
  if (!isEndorsementCurrent(core, input.assignmentDate)) blockers.push("Core LOKD Ready assessment is not current.");
  if (!isEndorsementCurrent(service, input.assignmentDate)) blockers.push(`${input.serviceType} readiness endorsement is not current.`);
  if (!isEndorsementCurrent(purpose, input.assignmentDate)) blockers.push("The required purpose endorsement is not current.");

  let displayStatus: PassportStatus = storedStatus;
  if (blockers.length && !["suspended", "revoked"].includes(storedStatus)) displayStatus = "restricted";
  if (!blockers.length && input.passportNextReviewAt) {
    const due = new Date(`${input.passportNextReviewAt.slice(0, 10)}T23:59:59+02:00`).getTime();
    const assignment = new Date(`${input.assignmentDate.slice(0, 10)}T00:00:00+02:00`).getTime();
    if (due - assignment <= 30 * 24 * 60 * 60 * 1000) {
      displayStatus = "expiring";
      warnings.push(`Next Passport review is due ${input.passportNextReviewAt.slice(0, 10)}.`);
    }
  }

  return { eligible: blockers.length === 0, displayStatus, blockers, warnings };
}
