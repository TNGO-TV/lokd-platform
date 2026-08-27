export type WorkforceModel = "direct_flex" | "partner" | "managed";
export type LaunchGateStatus = "passed" | "reported" | "pending" | "blocked";

export const REQUIRED_LAUNCH_GATE_CODES = [
  "G0_PHASE1_SCOPE",
  "G1_PSIRA_PAPERWORK",
  "G2_CONTROL_ROOM_INSPECTION",
  "G3_PSIRA_CERTIFICATE",
  "G4_WORKFORCE_ENGINE",
  "G5_WORKFORCE_TERMS",
  "G6_IDENTITY_PROVIDER",
  "G7_CLIENT_FUNDS",
  "G8_PAYROLL_INSURANCE",
  "G9_PRODUCTION_CONTROLS",
] as const;

export type LaunchGateInput = {
  code: string;
  status: LaunchGateStatus;
  hardGate: boolean;
  evidenceLevel?: string | null;
  evidenceReference?: string | null;
  verifiedAt?: string | null;
  expiresAt?: string | null;
};

export type WorkforceActivationInput = {
  launchGates: LaunchGateInput[];
  siteActive: boolean;
  bookingFunded: boolean;
  postOrdersApproved: boolean;
  engagementStatus: string | null;
  model: WorkforceModel | null;
  employerStatus: string | null;
  employerComplianceCurrent: boolean;
  payrollStatus: string | null;
  benefitsStatus: string | null;
  termsVersion: string | null;
  passportEligible: boolean;
};

export function launchGateDecision(gates: LaunchGateInput[], validThrough = new Date().toISOString()) {
  const blockers: string[] = [];
  const validThroughTime = new Date(validThrough).getTime();
  if (!Number.isFinite(validThroughTime)) return { ready: false, blockers: ["INVALID:VALID_THROUGH"] };
  const isValidPass = (gate: LaunchGateInput) => {
    const verifiedEvidence = gate.evidenceLevel === "system_verified" || gate.evidenceLevel === "independently_verified";
    const verifiedAt = gate.verifiedAt ? new Date(gate.verifiedAt).getTime() : Number.NaN;
    const expiry = gate.expiresAt ? new Date(gate.expiresAt).getTime() : null;
    return gate.status === "passed"
      && verifiedEvidence
      && Boolean(gate.evidenceReference)
      && Number.isFinite(verifiedAt)
      && (expiry === null || (Number.isFinite(expiry) && expiry >= validThroughTime));
  };
  for (const code of REQUIRED_LAUNCH_GATE_CODES) {
    const matching = gates.filter((gate) => gate.code === code);
    if (!matching.length) {
      blockers.push(`MISSING:${code}`);
      continue;
    }
    if (matching.length !== 1) {
      blockers.push(`DUPLICATE:${code}`);
      continue;
    }
    const gate = matching[0];
    if (!isValidPass(gate)) blockers.push(code);
  }
  for (const gate of gates) {
    if (REQUIRED_LAUNCH_GATE_CODES.includes(gate.code as (typeof REQUIRED_LAUNCH_GATE_CODES)[number])) continue;
    if (gate.hardGate && !isValidPass(gate)) blockers.push(gate.code);
  }
  return { ready: blockers.length === 0, blockers };
}

export function workforceActivationDecision(input: WorkforceActivationInput) {
  const blockers: string[] = [];
  const launch = launchGateDecision(input.launchGates);
  if (!launch.ready) blockers.push(...launch.blockers.map((code) => `Launch gate ${code} is not passed.`));
  if (!input.siteActive) blockers.push("The operational site is not active.");
  if (!input.bookingFunded) blockers.push("Client funding is not cleared.");
  if (!input.postOrdersApproved) blockers.push("Post orders are not approved.");
  if (!input.passportEligible) blockers.push("The officer does not pass current Passport controls.");
  if (!input.model || input.engagementStatus !== "active") blockers.push("No active workforce engagement exists.");
  if (!input.employerStatus || input.employerStatus !== "current") blockers.push("The employer of record is not current.");
  if (!input.employerComplianceCurrent) blockers.push("Employer compliance is incomplete or expired.");
  if (!input.termsVersion) blockers.push("No accepted workforce terms version is recorded.");
  if (input.model === "direct_flex" || input.model === "managed") {
    if (input.payrollStatus !== "ready") blockers.push("Direct payroll activation is not ready.");
    if (input.benefitsStatus !== "ready") blockers.push("Direct employment benefit controls are not ready.");
  }
  if (input.model === "partner" && input.payrollStatus !== "partner_confirmed") {
    blockers.push("The partner has not confirmed payroll responsibility.");
  }
  if (input.model === "partner" && input.benefitsStatus !== "partner_confirmed") {
    blockers.push("The partner has not confirmed statutory benefit responsibility.");
  }
  return { ready: blockers.length === 0, blockers };
}

export function durationHours(startsAt: string, endsAt: string) {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return (end - start) / 3_600_000;
}

export function isoWeekDateRange(serviceDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) throw new Error("Use an ISO service date.");
  const date = new Date(`${serviceDate}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) throw new Error("Use a valid service date.");
  const day = date.getUTCDay() || 7;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { monday: monday.toISOString().slice(0, 10), sunday: sunday.toISOString().slice(0, 10) };
}

export function directFlexHoursDecision(existingHours: number, candidateHours: number, weeklyHourCap = 24) {
  const safeExisting = Number.isFinite(existingHours) ? Math.max(0, existingHours) : 0;
  const safeCandidate = Number.isFinite(candidateHours) ? Math.max(0, candidateHours) : 0;
  const projectedHours = safeExisting + safeCandidate;
  return {
    eligible: safeCandidate > 0 && projectedHours <= weeklyHourCap,
    projectedHours,
    weeklyHourCap,
  };
}
