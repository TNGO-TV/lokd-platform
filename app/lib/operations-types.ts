export type OperationalState = "operational" | "scheduled" | "attention" | "critical" | "inactive";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "acknowledged" | "investigating" | "resolved" | "closed";
export type ExceptionPriority = "P0" | "P1" | "P2" | "P3";
export type ExceptionStatus = "new" | "acknowledged" | "investigating" | "resolved" | "closed";
export type CoverageState = "confirmed" | "arrival_at_risk" | "check_in_missing" | "on_post" | "uncovered" | "relief_active" | "completed" | "cancelled";
export type ReliefStatus = "case_open" | "offer_pending" | "accepted" | "arrived" | "cancelled" | "closed";
export type WorkforceModel = "direct_flex" | "partner" | "managed";
export type LaunchGateStatus = "passed" | "reported" | "pending" | "blocked";
export type AssignmentActivationState = "ready" | "blocked" | "reserved" | "activated";

export type OperationsActivationBlocker = {
  code: string;
  category: string;
  detail: string;
};

export type OperationsAssignmentActivation = {
  commandId: string | null;
  activationKey: string | null;
  rosterSlotId: string;
  slotVersion: number;
  bookingId: string;
  clientName: string;
  siteName: string;
  postName: string;
  officerId: string;
  officerName: string;
  startsAt: string;
  endsAt: string;
  environment: "production" | "demo_synthetic";
  integrityState: "production_candidate" | "production_verified" | "synthetic_demo_only";
  recordKind: "production" | "synthetic_rehearsal";
  state: AssignmentActivationState;
  lastDecisionAt: string;
  workforceModel: WorkforceModel | null;
  employerName: string | null;
  termsVersion: string | null;
  fundedWageCents: number;
  statutoryCostCents: number;
  pricingVersion: string;
  fundingStatus: string;
  fundingReference: string | null;
  reservedMinutes: number;
  hourSegments: Array<{ isoWeekStart: string; isoWeekEnd: string; minutes: number }>;
  evidenceValidThrough: string | null;
  revalidation: {
    nextCheckpoint: "t_minus_24" | "t_minus_2" | "check_in" | null;
    nextDueAt: string | null;
    status: string;
  };
  blockers: OperationsActivationBlocker[];
  databaseProtected: boolean;
  productionAuthorised: boolean;
};

export type OperationsSignal = {
  id: string;
  type: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  source: "simulated";
  integrityState: "synthetic";
  capturedAt: string;
  receivedAt: string;
  ageMinutes: number;
};

export type OperationsPost = {
  id: string;
  name: string;
  serviceType: string;
  purposeCode: string;
  minimumGrade: string;
  postOrdersVersion: string;
  status: string;
  bookingId: string | null;
};

export type OperationsDeployment = {
  shiftId: string | null;
  bookingId: string | null;
  officerName: string | null;
  passportStatus: string | null;
  postName: string | null;
  scheduledDate: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  status: string | null;
  checkInAt: string | null;
};

export type OperationsReliefDispatch = {
  id: string;
  replacementOfficerId: string;
  replacementOfficerName: string;
  status: ReliefStatus;
  reasonCode: string;
  priority: ExceptionPriority;
  requestedBy: string;
  requestedAt: string;
  responseDueAt: string;
  targetArrivalAt: string | null;
  acceptedAt: string | null;
  arrivedAt: string | null;
  version: number;
};

export type OperationsRosterSlot = {
  id: string;
  siteId: string;
  siteName: string;
  area: string;
  postId: string;
  postName: string;
  bookingId: string;
  shiftId: string | null;
  officerId: string | null;
  officerName: string | null;
  officerGrade: string | null;
  passportStatus: string | null;
  serviceType: string;
  serviceDate: string;
  startsAt: string;
  endsAt: string;
  arrivalDueAt: string;
  checkInDueAt: string;
  status: string;
  coverageState: CoverageState;
  coverageLabel: string;
  minutesToStart: number;
  arrivalEvidence: "checked_in" | "not_recorded";
  absenceReason: string | null;
  version: number;
  relief: OperationsReliefDispatch | null;
};

export type OperationsReserveOfficer = {
  id: string;
  fullName: string;
  city: string;
  psiraGrade: string;
  passportStatus: string;
  serviceTypes: string[];
  eligibleSlotIds: string[];
  eligibilityLabel: string;
};

export type OperationsWorkforceOfficer = {
  officerId: string;
  officerName: string;
  passportStatus: string | null;
  networkStatus: string;
  employmentStatus: "not_employed" | "active" | "pending_activation" | "suspended" | "ended";
  workforceModel: WorkforceModel | null;
  employerName: string | null;
  employerStatus: string | null;
  payrollStatus: string | null;
  benefitsStatus: string | null;
  weeklyHourCap: number | null;
  termsVersion: string | null;
  nextControl: string;
};

export type OperationsLaunchGate = {
  code: string;
  label: string;
  category: string;
  status: LaunchGateStatus;
  evidenceLevel: string;
  evidenceReference: string | null;
  detail: string;
  hardGate: boolean;
  verifiedAt: string | null;
  expiresAt: string | null;
};

export type OperationsSite = {
  id: string;
  clientId: string;
  clientName: string;
  name: string;
  area: string;
  addressLabel: string;
  latitude: number;
  longitude: number;
  riskBand: string;
  serviceType: string;
  geofenceRadiusMeters: number;
  geofenceVersion: number;
  telemetryMode: "simulated";
  state: OperationalState;
  stateLabel: string;
  signalFreshness: "fresh" | "stale" | "unavailable";
  openIncidentCount: number;
  highestIncidentSeverity: IncidentSeverity | null;
  openExceptionCount: number;
  highestExceptionPriority: ExceptionPriority | null;
  nextAction: string;
  posts: OperationsPost[];
  deployment: OperationsDeployment;
  latestSignal: OperationsSignal | null;
};

export type OperationsIncident = {
  id: string;
  siteId: string;
  siteName: string;
  severity: IncidentSeverity;
  category: string;
  summary: string;
  detail: string;
  status: IncidentStatus;
  ownerId: string | null;
  occurredAt: string;
  reportedAt: string;
  slaDueAt: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  version: number;
};

export type OperationsException = {
  id: string;
  siteId: string;
  siteName: string;
  priority: ExceptionPriority;
  exceptionType: string;
  summary: string;
  status: ExceptionStatus;
  ownerId: string | null;
  detectedAt: string;
  slaDueAt: string;
  version: number;
};

export type OperationsEvent = {
  id: string;
  siteId: string;
  siteName: string;
  type: "signal" | "incident" | "incident_event" | "exception" | "relief";
  tone: "green" | "blue" | "amber" | "red" | "neutral";
  title: string;
  detail: string;
  occurredAt: string;
};

export type OperationsCommandState = {
  environment: "demo";
  telemetry: "simulated";
  generatedAt: string;
  timezone: "Africa/Johannesburg";
  refreshAfterMs: number;
  summary: {
    sites: number;
    operational: number;
    scheduled: number;
    attention: number;
    critical: number;
    openIncidents: number;
    openExceptions: number;
    rosterSlots: number;
    coveredSlots: number;
    arrivalWatch: number;
    reliefActive: number;
    coveragePercent: number;
  };
  launch: {
    activationLocked: boolean;
    passedHardGates: number;
    totalHardGates: number;
    reportedGates: number;
    blockers: string[];
    gates: OperationsLaunchGate[];
  };
  workforce: {
    verifiedNetwork: number;
    profilesWithoutEmployment: number;
    activeDirectFlex: number;
    activePartner: number;
    activeManaged: number;
    assignmentsWithEmployerSnapshot: number;
    assignmentsMissingEmployerSnapshot: number;
    officers: OperationsWorkforceOfficer[];
  };
  activation: {
    ready: number;
    blocked: number;
    reserved: number;
    activated: number;
    queue: OperationsAssignmentActivation[];
  };
  sites: OperationsSite[];
  roster: OperationsRosterSlot[];
  reserveOfficers: OperationsReserveOfficer[];
  incidents: OperationsIncident[];
  exceptions: OperationsException[];
  events: OperationsEvent[];
};

export type OperationsAction =
  | {
      action: "create_incident";
      siteId: string;
      severity: IncidentSeverity;
      category: string;
      summary: string;
      detail: string;
    }
  | { action: "acknowledge_incident"; incidentId: string; version: number }
  | { action: "resolve_incident"; incidentId: string; version: number; resolutionNote: string }
  | { action: "acknowledge_exception"; exceptionId: string; version: number }
  | {
      action: "open_relief_case";
      rosterSlotId: string;
      version: number;
      replacementOfficerId: string;
      reasonCode: "arrival_not_assured" | "officer_unavailable" | "client_request" | "operations_contingency";
    }
  | { action: "cancel_relief"; reliefDispatchId: string; version: number }
  | {
      action: "evaluate_assignment_activation";
      rosterSlotId: string;
      officerId: string;
      expectedSlotVersion: number;
    };
