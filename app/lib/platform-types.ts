export type IntegrationStatus = "healthy" | "sandbox_ready" | "not_connected" | "degraded" | "blocked";

export type PlatformIntegration = {
  key: string;
  capability: string;
  provider: string;
  mode: string;
  status: IntegrationStatus;
  requiredForPilot: boolean;
  configurationVersion: string;
  capabilities: string[];
  detail: string;
  lastHealthState: string;
  lastHealthCheckedAt: string | null;
  lastEventAt: string | null;
};

export type PlatformIdentityCase = {
  id: string;
  applicationId: string | null;
  officerId: string | null;
  applicantName: string | null;
  provider: string;
  providerReference: string | null;
  status: string;
  decision: string | null;
  checks: string[];
  reasonCodes: string[];
  createdAt: string;
  updatedAt: string;
};

export type PlatformPaymentOrder = {
  id: string;
  bookingId: string;
  clientName: string;
  provider: string;
  providerReference: string | null;
  currency: string;
  amountCents: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type PlatformServiceRequest = {
  id: string;
  requestedByRole: string;
  requestedById: string;
  clientId: string | null;
  officerId: string | null;
  bookingId: string | null;
  shiftId: string | null;
  category: string;
  summary: string;
  detail: string;
  priority: string;
  status: string;
  ownerId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type PlatformTimesheet = {
  id: string;
  shiftId: string;
  bookingId: string;
  siteName: string;
  officerName: string;
  serviceDate: string;
  scheduledMinutes: number;
  recordedMinutes: number;
  payableMinutes: number | null;
  grossWageCents: number;
  calendarCategory: string;
  clientEvidenceStatus: string;
  operationsStatus: string;
  workforceModel: string | null;
  employerName: string | null;
  payrollRunId: string | null;
  backendHandoffStatus: string | null;
  employeeDeductionCents: number | null;
  netPayCents: number | null;
  policyVersion: string | null;
  calculationVersion: string | null;
  submittedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  version: number;
};

export type PlatformInvoice = {
  id: string;
  bookingId: string;
  clientName: string;
  siteName: string;
  servicePeriodStart: string;
  servicePeriodEnd: string;
  currency: string;
  subtotalCents: number;
  taxCents: number | null;
  totalCents: number | null;
  allocatedCents: number;
  status: string;
  fundingStatus: string;
  taxTreatment: string;
  paymentReference: string | null;
  issueReference: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type PlatformWorkflowSection = {
  key: string;
  label: string;
  state: "connected" | "adapter_ready" | "building" | "blocked";
  detail: string;
  remaining: string;
};

export type PlatformReadinessControl = {
  code: string;
  category: string;
  label: string;
  status: "ready" | "blocked" | "pending";
  requiredForIntegrationReady: boolean;
  evidenceReference: string | null;
  detail: string;
  checkedAt: string;
  checkedBy: string;
};

export type PlatformJobRun = {
  id: string;
  jobKey: string;
  trigger: string;
  status: string;
  processedCount: number;
  failureCount: number;
  detail: string;
  startedAt: string;
  completedAt: string | null;
};

export type PlatformNotification = {
  id: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
};

export type PlatformPayrollPolicy = {
  id: string;
  version: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  policyHash: string;
  sourceReferences: string[];
  createdBy: string;
  reviewedBy: string | null;
  approvedBy: string | null;
  activatedAt: string | null;
  ruleSummary: {
    taxBrackets: number;
    uifEmployeeRateBasisPoints: number;
    uifEmployerRateBasisPoints: number;
    sdlEmployerRateBasisPoints: number;
    coidaConfigured: boolean;
    leaveDivisor: number | null;
  };
  blockers: string[];
};

export type PlatformPayrollRun = {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: string;
  grossCents: number;
  employeeDeductionCents: number | null;
  netPayCents: number | null;
  employerCostCents: number | null;
  itemCount: number;
  policyVersion: string | null;
  calculationVersion: string | null;
  createdBy: string;
  approvedBy: string | null;
  secondApprovedBy: string | null;
  version: number;
  approvalBlockers: string[];
};

export type PlatformOperatorAccount = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  mfaStatus: string;
  mfaVerifiedAt: string | null;
  approvalLimitCents: number;
  roles: string[];
};

export type PlatformOperatorPolicy = {
  actionCode: string;
  label: string;
  requiredRole: string;
  mfaMaxAgeMinutes: number;
  maxAmountCents: number | null;
  secondApprovalRequired: boolean;
  status: string;
};

export type PlatformOperatorApproval = {
  id: string;
  actionCode: string;
  aggregateType: string;
  aggregateId: string;
  amountCents: number;
  status: string;
  requestedBy: string;
  firstApprovedBy: string | null;
  secondApprovedBy: string | null;
  expiresAt: string;
  version: number;
};

export type PlatformState = {
  environment: "demo";
  generatedAt: string;
  summary: {
    healthyIntegrations: number;
    requiredIntegrations: number;
    openServiceRequests: number;
    queuedOutboxEvents: number;
    pendingWebhooks: number;
    activeIdentityCases: number;
    unreconciledPayments: number;
    timesheetsAwaitingReview: number;
    invoicesAwaitingHandoff: number;
    payrollHandoffs: number;
    externalIntegrationsRemaining: number;
    readyControls: number;
    requiredControls: number;
    unreadOperatorNotifications: number;
    payrollRunsAwaitingApproval: number;
    operatorApprovalsPending: number;
  };
  sections: PlatformWorkflowSection[];
  integrations: PlatformIntegration[];
  identityCases: PlatformIdentityCase[];
  paymentOrders: PlatformPaymentOrder[];
  serviceRequests: PlatformServiceRequest[];
  timesheets: PlatformTimesheet[];
  invoices: PlatformInvoice[];
  readinessControls: PlatformReadinessControl[];
  jobRuns: PlatformJobRun[];
  notifications: PlatformNotification[];
  payroll: {
    engineVersion: "payroll-engine-v2";
    creditTermsDays: 0;
    fundingModel: "advance_only";
    livePolicyActivated: false;
    reserveCyclesRequired: 2;
    reserveVerified: false;
    requiredReserveCents: number;
    policies: PlatformPayrollPolicy[];
    runs: PlatformPayrollRun[];
  };
  operatorControls: {
    currentActorId: string;
    currentActorRoles: string[];
    currentActorMfaStatus: string;
    accounts: PlatformOperatorAccount[];
    policies: PlatformOperatorPolicy[];
    approvals: PlatformOperatorApproval[];
  };
};

export type PlatformAction =
  | { action: "refresh_integration_health" }
  | { action: "triage_service_request"; requestId: string; version: number }
  | { action: "resolve_service_request"; requestId: string; version: number; resolution: string }
  | { action: "approve_timesheet"; timesheetId: string; version: number }
  | { action: "review_invoice"; invoiceId: string; version: number }
  | { action: "calculate_payroll_run"; payrollRunId: string }
  | { action: "approve_payroll_run"; payrollRunId: string; version: number }
  | { action: "second_approve_payroll_run"; payrollRunId: string; version: number }
  | { action: "run_platform_maintenance" };
