import { advanceFundingDecision } from "./operator-controls";
import {
  ZA_2027_SARS_POLICY_CANDIDATE,
} from "./payroll-engine";
import { runPayrollShadowValidation } from "./payroll-shadow";
import type { ControlledPilotStep } from "./onboarding-types";

export const CONTROLLED_ONBOARDING_FLOW_VERSION =
  "LOKD-CONTROLLED-ONBOARDING-2026.09-v1";

export const DEMO_CONTRACT_WATERMARK =
  "SIMULATION ONLY — NOT A CONTRACT";

export const CONTRACT_TEMPLATE_SPECS = [
  {
    code: "CLIENT_MSA",
    label: "Client master service agreement",
    subjectType: "client",
    variables: [
      "legalEntityName",
      "registrationNumber",
      "registeredAddress",
      "authorisedContactName",
      "authorisedContactEmail",
      "billingAddress",
      "vatNumber",
    ],
  },
  {
    code: "SERVICE_ORDER",
    label: "Service order and SLA",
    subjectType: "client",
    variables: [
      "clientName",
      "siteName",
      "siteAddress",
      "serviceType",
      "purposeCode",
      "startDate",
      "endDate",
      "shiftPattern",
      "minimumGrade",
      "priceCents",
      "currency",
      "paymentReference",
      "creditTermsDays",
    ],
  },
  {
    code: "OFFICER_EMPLOYMENT",
    label: "Officer employment agreement",
    subjectType: "officer",
    variables: [
      "officerLegalName",
      "identityToken",
      "residentialAddress",
      "psiraNumber",
      "psiraGrade",
      "role",
      "startDate",
      "payFrequency",
      "baseRateCents",
      "payrollPolicyVersion",
    ],
  },
  {
    code: "OFFICER_PAYROLL_CONSENT",
    label: "Payroll and lawful-deduction consent",
    subjectType: "officer",
    variables: [
      "officerLegalName",
      "payFrequency",
      "paymentDestinationToken",
      "payeTreatment",
      "uifTreatment",
      "providentTreatment",
      "councilTreatment",
      "policyVersion",
    ],
  },
] as const;

export const PRODUCTION_ONBOARDING_BLOCKERS = [
  "Approved final legal template bodies and signatory mandates must be loaded before production contract generation.",
  "Production identity and PSiRA verification providers are not connected.",
  "Verified client-clearing reconciliation is not connected to the selected payment provider.",
  "Named Operations users still require live MFA enrolment and maker/checker role assignment.",
  "COIDA classification and the remaining employer evidence must be approved.",
  "Payroll settlement and disbursement remain locked until separate controlled-pilot authorisation.",
] as const;

export type RehearsalFacts = {
  completedCases: number;
  requiredCases: number;
  preparedTemplates: number;
  requiredTemplates: number;
  signedEnvelopes: number;
  requiredEnvelopes: number;
  activeInvitations: number;
  requiredInvitations: number;
  criticalDatabaseGuards: number;
  requiredDatabaseGuards: number;
};

function step(
  code: string,
  label: string,
  passed: boolean,
  detail: string,
): ControlledPilotStep {
  return { code, label, status: passed ? "passed" : "blocked", detail };
}

export function evaluateControlledPilotRehearsal(facts: RehearsalFacts) {
  const funding = advanceFundingDecision({
    creditTermsDays: 0,
    fundingModel: "advance_only",
    bookingAmountCents: 1_200_000,
    expectedAmountCents: 1_200_000,
    clearedAmountCents: 1_200_000,
    status: "cleared_reconciled",
    evidenceReference: "demo://clearing-evidence/controlled-rehearsal",
  });
  const payroll = runPayrollShadowValidation(
    ZA_2027_SARS_POLICY_CANDIDATE,
  );
  const steps = [
    step(
      "ONBOARDING_CASES",
      "Client, officer and Operations onboarding",
      facts.completedCases === facts.requiredCases && facts.requiredCases === 3,
      `${facts.completedCases}/${facts.requiredCases} synthetic cases completed with evidence-linked checklists.`,
    ),
    step(
      "CONTRACT_VARIABLES",
      "Versioned contract variables",
      facts.preparedTemplates === facts.requiredTemplates && facts.requiredTemplates === CONTRACT_TEMPLATE_SPECS.length,
      `${facts.preparedTemplates}/${facts.requiredTemplates} watermarked template schemas prepared without representing them as final legal agreements.`,
    ),
    step(
      "CONTRACT_ENVELOPES",
      "Controlled contract-envelope rehearsal",
      facts.signedEnvelopes === facts.requiredEnvelopes && facts.requiredEnvelopes === CONTRACT_TEMPLATE_SPECS.length,
      `${facts.signedEnvelopes}/${facts.requiredEnvelopes} synthetic envelopes generated, approved and signed by distinct demo actors.`,
    ),
    step(
      "WORKSPACE_ACCESS",
      "Role-bound workspace provisioning",
      facts.activeInvitations === facts.requiredInvitations && facts.requiredInvitations === 3,
      `${facts.activeInvitations}/${facts.requiredInvitations} synthetic client, officer and Operations access records preserve entity and hostname boundaries.`,
    ),
    step(
      "ADVANCE_FUNDING",
      "Commercial readiness confirmed",
      funding.ready,
      funding.ready
        ? "The full synthetic service amount is confirmed and reconciled with zero credit days before offer release."
        : funding.blockers.join(" "),
    ),
    step(
      "DATABASE_GUARDS",
      "Offer, activation and settlement database guards",
      facts.criticalDatabaseGuards === facts.requiredDatabaseGuards,
      `${facts.criticalDatabaseGuards}/${facts.requiredDatabaseGuards} critical guards are present.`,
    ),
    step(
      "PAYROLL_SHADOW",
      "Shadow payroll and statutory calculations",
      payroll.status === "passed" && payroll.failedCount === 0,
      `${payroll.passedCount}/${payroll.scenarioCount} payroll scenarios passed; no payment instruction was created.`,
    ),
    step(
      "SETTLEMENT_LOCK",
      "Settlement boundary",
      payroll.settlementLocked && !payroll.activationEligible,
      "Payout, payslip issue and settlement remain database-locked after the rehearsal.",
    ),
  ];
  return {
    status: steps.every((item) => item.status === "passed")
      ? ("passed" as const)
      : ("blocked" as const),
    steps,
    blockers: [...PRODUCTION_ONBOARDING_BLOCKERS],
    creditTermsDays: 0 as const,
    fundingModel: "advance_only" as const,
    settlementLocked: true as const,
    productionAuthorised: false as const,
  };
}
