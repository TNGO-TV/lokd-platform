export type OnboardingScope = "operations" | "client" | "officer";

export type OnboardingChecklistItem = {
  id: string;
  code: string;
  label: string;
  category: string;
  required: boolean;
  status: string;
  evidenceReference: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  sortOrder: number;
};

export type OnboardingCase = {
  id: string;
  subjectType: "client" | "officer" | "operations";
  subjectId: string;
  displayName: string;
  contactEmail: string;
  status: string;
  currentStage: string;
  identityStatus: string;
  complianceStatus: string;
  contractStatus: string;
  bankingStatus: string;
  accessStatus: string;
  version: number;
  updatedAt: string;
  completedAt: string | null;
  checklist: OnboardingChecklistItem[];
};

export type ContractTemplateState = {
  id: string;
  templateCode: string;
  label: string;
  templateVersion: string;
  status: string;
  variables: string[];
  watermark: string | null;
  approvedAt: string | null;
};

export type ContractEnvelopeState = {
  id: string;
  onboardingCaseId: string;
  templateCode: string;
  templateLabel: string;
  subjectType: string;
  status: string;
  watermark: string | null;
  generatedAt: string;
  signedAt: string | null;
};

export type WorkspaceInvitationState = {
  id: string;
  onboardingCaseId: string;
  email: string;
  role: string;
  status: string;
  requestedBy: string;
  approvedBy: string | null;
  activatedAt: string | null;
  expiresAt: string;
};

export type ControlledPilotStep = {
  code: string;
  label: string;
  status: "passed" | "blocked";
  detail: string;
};

export type ControlledPilotRehearsal = {
  id: string;
  flowVersion: string;
  status: "passed" | "blocked";
  steps: ControlledPilotStep[];
  blockers: string[];
  creditTermsDays: 0;
  fundingModel: "advance_only";
  settlementLocked: true;
  productionAuthorised: false;
  runBy: string;
  createdAt: string;
};

export type OnboardingState = {
  environment: "demo";
  generatedAt: string;
  productionLocked: true;
  summary: {
    completedCases: number;
    totalCases: number;
    passedChecks: number;
    requiredChecks: number;
    preparedTemplates: number;
    signedDemoEnvelopes: number;
    activeDemoInvitations: number;
    latestRehearsalStatus: "passed" | "blocked" | "not_run";
  };
  cases: OnboardingCase[];
  templates: ContractTemplateState[];
  envelopes: ContractEnvelopeState[];
  invitations: WorkspaceInvitationState[];
  rehearsals: ControlledPilotRehearsal[];
  productionBlockers: string[];
};

export type OnboardingAction =
  | { action: "run_controlled_pilot_rehearsal" }
  | { action: "refresh_onboarding" };
