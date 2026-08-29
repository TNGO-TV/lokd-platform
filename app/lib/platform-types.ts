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
  };
  sections: PlatformWorkflowSection[];
  integrations: PlatformIntegration[];
  identityCases: PlatformIdentityCase[];
  paymentOrders: PlatformPaymentOrder[];
  serviceRequests: PlatformServiceRequest[];
  timesheets: PlatformTimesheet[];
  invoices: PlatformInvoice[];
};

export type PlatformAction =
  | { action: "refresh_integration_health" }
  | { action: "triage_service_request"; requestId: string; version: number }
  | { action: "resolve_service_request"; requestId: string; version: number; resolution: string }
  | { action: "approve_timesheet"; timesheetId: string; version: number }
  | { action: "review_invoice"; invoiceId: string; version: number };
