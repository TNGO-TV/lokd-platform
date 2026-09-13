export type OperatorRole =
  | "operations_owner"
  | "operations_controller"
  | "payroll_preparer"
  | "payroll_reviewer"
  | "finance_approver"
  | "funding_reconciler"
  | "compliance_reviewer";

export type OperatorActionCode =
  | "partner.prepare"
  | "partner.approve"
  | "partner.export"
  | "payment.prepare"
  | "payment.approve"
  | "payment.dispatch_test"
  | "payment.cancel"
  | "payroll.calculate"
  | "payroll.first_approve"
  | "payroll.second_approve"
  | "payroll.export"
  | "settlement.release"
  | "funding.verify"
  | "offer.release"
  | "deployment.activate";

export type OperatorActionPolicy = {
  actionCode: OperatorActionCode;
  label: string;
  requiredRole: OperatorRole;
  mfaMaxAgeMinutes: number;
  maxAmountCents: number | null;
  secondApprovalRequired: boolean;
};

export const OPERATOR_ACTION_POLICIES: OperatorActionPolicy[] = [
  { actionCode: "partner.prepare", label: "Prepare partner invoice payable", requiredRole: "operations_controller", mfaMaxAgeMinutes: 15, maxAmountCents: 25_000_000, secondApprovalRequired: true },
  { actionCode: "partner.approve", label: "Review or suspend partner payable", requiredRole: "finance_approver", mfaMaxAgeMinutes: 5, maxAmountCents: 25_000_000, secondApprovalRequired: true },
  { actionCode: "partner.export", label: "Export approved partner payable", requiredRole: "finance_approver", mfaMaxAgeMinutes: 5, maxAmountCents: 25_000_000, secondApprovalRequired: false },
  { actionCode: "payment.prepare", label: "Prepare employee payment instruction", requiredRole: "payroll_preparer", mfaMaxAgeMinutes: 15, maxAmountCents: 25_000_000, secondApprovalRequired: true },
  { actionCode: "payment.approve", label: "Approve employee payment instruction", requiredRole: "finance_approver", mfaMaxAgeMinutes: 5, maxAmountCents: 25_000_000, secondApprovalRequired: true },
  { actionCode: "payment.dispatch_test", label: "Submit approved test transfer", requiredRole: "finance_approver", mfaMaxAgeMinutes: 5, maxAmountCents: 25_000_000, secondApprovalRequired: true },
  { actionCode: "payment.cancel", label: "Cancel an unsent employee instruction", requiredRole: "finance_approver", mfaMaxAgeMinutes: 5, maxAmountCents: 25_000_000, secondApprovalRequired: false },
  { actionCode: "payroll.calculate", label: "Calculate payroll", requiredRole: "payroll_preparer", mfaMaxAgeMinutes: 30, maxAmountCents: 100_000_000, secondApprovalRequired: false },
  { actionCode: "payroll.first_approve", label: "First payroll approval", requiredRole: "payroll_reviewer", mfaMaxAgeMinutes: 15, maxAmountCents: 50_000_000, secondApprovalRequired: true },
  { actionCode: "payroll.second_approve", label: "Second payroll approval", requiredRole: "finance_approver", mfaMaxAgeMinutes: 15, maxAmountCents: 50_000_000, secondApprovalRequired: true },
  { actionCode: "payroll.export", label: "Create controlled shadow exports", requiredRole: "payroll_preparer", mfaMaxAgeMinutes: 15, maxAmountCents: 50_000_000, secondApprovalRequired: true },
  { actionCode: "settlement.release", label: "Release payroll settlement", requiredRole: "finance_approver", mfaMaxAgeMinutes: 5, maxAmountCents: 25_000_000, secondApprovalRequired: true },
  { actionCode: "funding.verify", label: "Verify cleared client funding", requiredRole: "funding_reconciler", mfaMaxAgeMinutes: 15, maxAmountCents: 100_000_000, secondApprovalRequired: false },
  { actionCode: "offer.release", label: "Release officer offer", requiredRole: "operations_controller", mfaMaxAgeMinutes: 15, maxAmountCents: 10_000_000, secondApprovalRequired: false },
  { actionCode: "deployment.activate", label: "Activate paid deployment", requiredRole: "operations_owner", mfaMaxAgeMinutes: 5, maxAmountCents: 100_000_000, secondApprovalRequired: true },
];

export type OperatorControlInput = {
  actionCode: OperatorActionCode;
  actorId: string;
  roles: OperatorRole[];
  accountStatus: string;
  mfaStatus: string;
  mfaRequired?: boolean;
  mfaVerifiedAt: string | null;
  amountCents: number;
  makerId?: string | null;
  firstApproverId?: string | null;
  now?: Date;
};

export type OperatorControlDecision = {
  allowed: boolean;
  policy: OperatorActionPolicy;
  blockers: string[];
};

export function operatorControlDecision(input: OperatorControlInput): OperatorControlDecision {
  const policy = OPERATOR_ACTION_POLICIES.find((item) => item.actionCode === input.actionCode);
  if (!policy) throw new Error("The operator action has no approved control policy.");
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 0) throw new Error("The controlled amount is invalid.");
  const blockers: string[] = [];
  if (input.accountStatus !== "active") blockers.push("The operator account is not active.");
  if (!input.roles.includes(policy.requiredRole)) blockers.push(`The ${policy.requiredRole.replaceAll("_", " ")} role is required.`);
  if (input.mfaRequired !== false) {
    if (input.mfaStatus !== "verified" || !input.mfaVerifiedAt) {
      blockers.push("A verified Operations MFA challenge is required.");
    } else {
      const ageMs = (input.now ?? new Date()).getTime() - new Date(input.mfaVerifiedAt).getTime();
      if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > policy.mfaMaxAgeMinutes * 60_000) {
        blockers.push(`Operations MFA must be refreshed within ${policy.mfaMaxAgeMinutes} minutes.`);
      }
    }
  }
  if (policy.maxAmountCents !== null && input.amountCents > policy.maxAmountCents) {
    blockers.push("The amount exceeds this operator policy limit.");
  }
  if (input.makerId && input.actorId === input.makerId) blockers.push("The maker cannot approve the same command.");
  if (input.firstApproverId && input.actorId === input.firstApproverId) blockers.push("The first and second approvers must be different operators.");
  return { allowed: blockers.length === 0, policy, blockers };
}

export type AdvanceFundingInput = {
  creditTermsDays: number;
  fundingModel: string;
  bookingAmountCents: number;
  expectedAmountCents: number;
  clearedAmountCents: number;
  status: string;
  evidenceReference: string | null;
};

export function advanceFundingDecision(input: AdvanceFundingInput) {
  const blockers: string[] = [];
  if (input.creditTermsDays !== 0) blockers.push("LOKD does not offer credit terms.");
  if (input.fundingModel !== "advance_only") blockers.push("The booking is not configured for advance-only funding.");
  if (!Number.isSafeInteger(input.bookingAmountCents) || input.bookingAmountCents < 1) blockers.push("The booking amount is invalid.");
  if (input.expectedAmountCents !== input.bookingAmountCents) blockers.push("The funding expectation does not equal the full booking amount.");
  if (input.clearedAmountCents !== input.bookingAmountCents) blockers.push("The full booking amount has not cleared.");
  if (input.status !== "cleared_reconciled") blockers.push("Cleared funding has not been reconciled.");
  if (!input.evidenceReference) blockers.push("Verified clearing evidence is missing.");
  return { ready: blockers.length === 0, blockers };
}
