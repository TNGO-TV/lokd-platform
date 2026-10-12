export type OfficerConversionRoute = "assigned_officer_conversion" | "private_recruitment_enquiry";
export type OfficerConversionSpecialistCategory = "standard" | "armed" | "vip_tactical";

export const OFFICER_CONVERSION_POLICY = {
  version: "ZA-CONVERSION-2026-01",
  clauseVersion: "ZA-PERMANENT-ENGAGEMENT-2026-01",
  peaGateCode: "C1_PEA_REGISTRATION",
  tailMonths: 6,
  directRecruitmentRateBps: 1_500,
  officerPaysFee: false,
  clientCreditTermsDays: 0,
} as const;

export const PERMANENT_ENGAGEMENT_CLAUSE =
  "If a client or related party offers permanent or indirect employment to an officer introduced or assigned by LOKD, the client must notify LOKD before the offer. The officer remains free to accept and is never charged. The applicable client conversion fee becomes payable only when the offer is accepted or employment starts, and applies during the assignment and for six months after the later of the final assignment or introduction. Completion requires LOKD payroll and leave close-out, the client employer pack, and applicable PSiRA transfer formalities.";

type FeeInput = {
  route: OfficerConversionRoute;
  officerGrade: string;
  specialistCategory: OfficerConversionSpecialistCategory;
  completedServiceMonths: number;
  annualGuaranteedCashCents?: number | null;
};

function gradeMinimumCents(grade: string) {
  const normalized = grade.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (normalized.includes("supervisor") || normalized.endsWith("a") || normalized === "a") return 1_500_000;
  if (normalized.endsWith("b") || normalized === "b") return 1_400_000;
  if (["c", "d", "e"].some((value) => normalized.endsWith(value) || normalized === value)) return 1_250_000;
  throw new Error("A supported PSiRA grade is required to calculate the conversion fee.");
}

export function conversionTenurePercent(completedServiceMonths: number) {
  if (!Number.isInteger(completedServiceMonths) || completedServiceMonths < 0 || completedServiceMonths > 600) {
    throw new Error("Completed service months must be a whole number between 0 and 600.");
  }
  if (completedServiceMonths <= 3) return 100;
  if (completedServiceMonths <= 6) return 75;
  if (completedServiceMonths <= 12) return 50;
  return 25;
}

export function calculateOfficerConversionFee(input: FeeInput) {
  const minimumFeeCents = input.specialistCategory === "vip_tactical"
    ? 2_500_000
    : gradeMinimumCents(input.officerGrade) + (input.specialistCategory === "armed" ? 500_000 : 0);
  const tenurePercent = input.route === "assigned_officer_conversion"
    ? conversionTenurePercent(input.completedServiceMonths)
    : 100;
  if (input.route === "private_recruitment_enquiry") {
    const annualGuaranteedCashCents = input.annualGuaranteedCashCents ?? 0;
    if (!Number.isInteger(annualGuaranteedCashCents) || annualGuaranteedCashCents <= 0 || annualGuaranteedCashCents > 1_000_000_000) {
      throw new Error("First-year guaranteed cash remuneration is required for a private recruitment enquiry.");
    }
    const percentageFeeCents = Math.round((annualGuaranteedCashCents * OFFICER_CONVERSION_POLICY.directRecruitmentRateBps) / 10_000);
    return {
      minimumFeeCents,
      tenurePercent,
      percentageFeeCents,
      calculatedFeeCents: Math.max(minimumFeeCents, percentageFeeCents),
    };
  }
  return {
    minimumFeeCents,
    tenurePercent,
    percentageFeeCents: null,
    calculatedFeeCents: Math.round((minimumFeeCents * tenurePercent) / 100),
  };
}

export type OfficerConversionReadinessInput = {
  status: string;
  clauseAcknowledged: boolean;
  offerAccepted: boolean;
  clientEmployerPackReady: boolean;
  lokdPayrollCloseoutReady: boolean;
  psiraTransferReady: boolean;
  feePaid: boolean;
};

export function officerConversionReadiness(input: OfficerConversionReadinessInput) {
  const blockers: string[] = [];
  if (input.status === "withdrawn") blockers.push("The case has been withdrawn.");
  if (!input.clauseAcknowledged) blockers.push("The client has not acknowledged the permanent-engagement clause.");
  if (!input.offerAccepted) blockers.push("No accepted client employment offer is recorded.");
  if (!input.clientEmployerPackReady) blockers.push("The client employer, payroll and employment-contract pack is incomplete.");
  if (!input.lokdPayrollCloseoutReady) blockers.push("LOKD final payroll and leave close-out is incomplete.");
  if (!input.psiraTransferReady) blockers.push("Applicable PSiRA transfer or employment formalities are incomplete.");
  if (!input.feePaid) blockers.push("The client conversion fee has not been cleared.");
  return { ready: blockers.length === 0, blockers };
}
