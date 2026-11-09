import { HOURLY_PAY_POLICY_DEFAULTS } from './payroll-engine';
import type { BookingModel } from './booking-models';
export type { BookingModel } from './booking-models';
export type WorkforceModel = "direct_flex" | "managed";
export type PayBasis = "hourly" | "monthly";
export const payBasisLabel = (type: string | null | undefined) => type === 'hourly' ? 'Hourly pay' : type === 'monthly' ? 'Monthly salary' : 'Pay basis not recorded';
export const legacyPayBasisForModel = (model: string | null): PayBasis | null => model === 'direct_flex' ? 'hourly' : model === 'managed' ? 'monthly' : null;
export const BOOKING_WORKFORCE_ROUTES = { bolt: ["direct_flex", "managed"], flex: ["direct_flex", "managed"], fixed: ["direct_flex", "managed"] } as const;
export function bookingWorkforceRouteDecision(bookingModel:string|null|undefined,route:string|null,payBasis=legacyPayBasisForModel(route)){
 if(!bookingModel||!Object.hasOwn(BOOKING_WORKFORCE_ROUTES,bookingModel))return {ready:false,code:"BOOKING_MODEL_INVALID",detail:"Record LOKD Bolt, LOKD Flex or LOKD Fixed before activating an assignment.",warnings:[] as string[]};
 const ready=route==='direct_flex'||route==='managed';
 return {ready,code:ready?null:"BOOKING_WORKFORCE_ROUTE_MISMATCH",detail:ready?null:"A directly employed LOKD officer record is required.",warnings:bookingModel==='fixed'&&payBasis==='hourly'?['Review hourly pay for this LOKD Fixed roster.']:[]};
}
export function workforceReadinessStatuses(model: WorkforceModel) { if(!['direct_flex','managed'].includes(model))throw new Error('Only LOKD employment routes are supported.'); return { payrollStatus: 'ready', benefitsStatus: 'ready' }; }
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
  bookingModel: BookingModel | null;
  launchGates: LaunchGateInput[];
  siteActive: boolean;
  bookingFunded: boolean;
  postOrdersApproved: boolean;
  engagementStatus: string | null;
  model: WorkforceModel | null;
  payBasis?:PayBasis|null;
  employerStatus: string | null;
  employerComplianceCurrent: boolean;
  payrollStatus: string | null;
  benefitsStatus: string | null;
  termsVersion: string | null;
  passportEligible: boolean;
};

export function launchGateDecision(
  gates: LaunchGateInput[],
  validThrough = new Date().toISOString(),
  evaluatedAt = new Date().toISOString(),
) {
  const blockers: string[] = [];
  const validThroughTime = new Date(validThrough).getTime();
  const evaluatedTime = new Date(evaluatedAt).getTime();
  if (!Number.isFinite(validThroughTime) || !Number.isFinite(evaluatedTime)) {
    return { ready: false, blockers: ["INVALID:VALID_THROUGH"] };
  }
  const isValidPass = (gate: LaunchGateInput) => {
    const verifiedEvidence = gate.evidenceLevel === "system_verified" || gate.evidenceLevel === "independently_verified";
    const verifiedAt = gate.verifiedAt ? new Date(gate.verifiedAt).getTime() : Number.NaN;
    const expiry = gate.expiresAt ? new Date(gate.expiresAt).getTime() : Number.NaN;
    return gate.status === "passed"
      && gate.hardGate
      && verifiedEvidence
      && Boolean(gate.evidenceReference)
      && Number.isFinite(verifiedAt)
      && verifiedAt <= evaluatedTime
      && Number.isFinite(expiry)
      && expiry >= validThroughTime
      && expiry >= evaluatedTime;
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
  const blockers: string[] = [],warnings:string[]=[];
  const route = bookingWorkforceRouteDecision(input.bookingModel, input.model,input.payBasis??undefined);
  if (!route.ready && route.detail) blockers.push(route.detail);
  const launch = launchGateDecision(input.launchGates);
  if (!launch.ready) blockers.push(...launch.blockers.map((code) => `Launch gate ${code} is not passed.`));
  if (!input.siteActive) blockers.push("The operational site is not active.");
  if (!input.bookingFunded) blockers.push("Client funding is not cleared.");
  if (!input.postOrdersApproved) blockers.push("Post orders are not approved.");
  if (!input.passportEligible) blockers.push("The officer does not pass current Passport controls.");
  if (!input.model || input.engagementStatus !== "active") blockers.push("No active workforce engagement exists.");
  if (!input.employerStatus) blockers.push("The employer record is missing."); else if(input.employerStatus!=="current")warnings.push("Employer compliance requires review.");
  if (!input.employerComplianceCurrent) warnings.push("Employer compliance is incomplete or expired.");
  if (!input.termsVersion) blockers.push("No accepted workforce terms version is recorded.");
  if (input.model === "direct_flex" || input.model === "managed") {
    if (input.payrollStatus !== "ready") warnings.push("Direct payroll activation is not ready.");
    if (input.benefitsStatus !== "ready") warnings.push("Direct employment benefit controls are not ready.");
  }
  return { ready: blockers.length === 0, blockers, warnings:[...warnings,...route.warnings] };
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

export function directFlexHoursDecision(existingHours: number, candidateHours: number, weeklyHourCap = HOURLY_PAY_POLICY_DEFAULTS.weeklyHourThreshold) {
  const safeExisting = Number.isFinite(existingHours) ? Math.max(0, existingHours) : 0;
  const safeCandidate = Number.isFinite(candidateHours) ? Math.max(0, candidateHours) : 0;
  const projectedHours = safeExisting + safeCandidate;
  return {
    eligible: safeCandidate > 0,
    warnings: projectedHours > weeklyHourCap ? ["Weekly hours exceed the hourly-pay review threshold."] : [],
    projectedHours,
    weeklyHourCap,
  };
}
