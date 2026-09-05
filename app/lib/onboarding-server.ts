import { ensureDemoOperator } from "./integration-server";
import {
  CONTRACT_TEMPLATE_SPECS,
  CONTROLLED_ONBOARDING_FLOW_VERSION,
  DEMO_CONTRACT_WATERMARK,
  PRODUCTION_ONBOARDING_BLOCKERS,
  evaluateControlledPilotRehearsal,
} from "./onboarding-core";
import type {
  ContractEnvelopeState,
  ContractTemplateState,
  ControlledPilotRehearsal,
  OnboardingCase,
  OnboardingChecklistItem,
  OnboardingScope,
  OnboardingState,
  WorkspaceInvitationState,
} from "./onboarding-types";
import type { PilotPrincipal } from "./pilot-runtime";

const DEMO_CHECKER_ID = "onboarding-checker@lokd.invalid";
const DEMO_ONBOARDING_OWNER_ID = "demo-onboarding-owner@lokd.invalid";
const CLIENT_CASE_ID = "ONB-DEMO-CLIENT-001";
const OFFICER_CASE_ID = "ONB-DEMO-OFFICER-001";
const OPERATIONS_CASE_ID = "ONB-DEMO-OPS-001";

export class OnboardingWorkflowError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");
}

function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

function jsonList(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function checklistSeed() {
  return [
    [CLIENT_CASE_ID, "CLIENT_ENTITY", "Client entity and authorised contact", "identity", 10],
    [CLIENT_CASE_ID, "CLIENT_TERMS", "Client agreement variables and signatory", "contracts", 20],
    [CLIENT_CASE_ID, "CLIENT_FUNDING", "Advance-only funding instruction", "funding", 30],
    [CLIENT_CASE_ID, "CLIENT_ACCESS", "Client workspace access", "access", 40],
    [OFFICER_CASE_ID, "OFFICER_IDENTITY", "Identity verification rehearsal", "identity", 10],
    [OFFICER_CASE_ID, "OFFICER_PSIRA", "PSiRA grade and expiry rehearsal", "compliance", 20],
    [OFFICER_CASE_ID, "OFFICER_BANK", "Verified payroll destination rehearsal", "banking", 30],
    [OFFICER_CASE_ID, "OFFICER_TERMS", "Employment and payroll-consent variables", "contracts", 40],
    [OFFICER_CASE_ID, "OFFICER_ACCESS", "Officer workspace access", "access", 50],
    [OPERATIONS_CASE_ID, "OPS_ACCOUNT", "Named Operations account", "identity", 10],
    [OPERATIONS_CASE_ID, "OPS_MFA", "Recent MFA control", "access", 20],
    [OPERATIONS_CASE_ID, "OPS_ROLES", "Role and approval-limit assignment", "access", 30],
    [OPERATIONS_CASE_ID, "OPS_SEPARATION", "Maker/checker separation", "governance", 40],
  ] as const;
}

function envelopeVariables(templateCode: string) {
  if (templateCode === "CLIENT_MSA") {
    return {
      legalEntityName: "Northbridge Property Services",
      registrationNumber: "DEMO-REG-001",
      registeredAddress: "Synthetic Johannesburg address",
      authorisedContactName: "Nadia Jacobs",
      authorisedContactEmail: "nadia@northbridge.example",
      billingAddress: "Synthetic Johannesburg billing address",
      vatNumber: "DEMO-VAT-001",
    };
  }
  if (templateCode === "SERVICE_ORDER") {
    return {
      clientName: "Northbridge Property Services",
      siteName: "Northbridge Rosebank Offices",
      siteAddress: "Synthetic Rosebank site",
      serviceType: "Unarmed fixed-site security",
      purposeCode: "commercial_access",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      shiftPattern: "Monday–Saturday day shift",
      minimumGrade: "Grade C",
      priceCents: 1_200_000,
      currency: "ZAR",
      paymentReference: "DEMO-CLEARING-001",
      creditTermsDays: 0,
    };
  }
  if (templateCode === "OFFICER_EMPLOYMENT") {
    return {
      officerLegalName: "Lerato Khumalo",
      identityToken: "demo-tokenised-identity",
      residentialAddress: "Synthetic Johannesburg address",
      psiraNumber: "PSIRA-1842",
      psiraGrade: "Grade B",
      role: "Security officer",
      startDate: "2026-09-01",
      payFrequency: "weekly",
      baseRateCents: 4_350,
      payrollPolicyVersion: "ZA-2027-SHADOW-CANDIDATE",
    };
  }
  return {
    officerLegalName: "Lerato Khumalo",
    payFrequency: "weekly",
    paymentDestinationToken: "demo-tokenised-bank-destination",
    payeTreatment: "statutory calculation",
    uifTreatment: "employee and employer contribution",
    providentTreatment: "separate employee and employer lines",
    councilTreatment: "itemised lawful deduction",
    policyVersion: "ZA-2027-SHADOW-CANDIDATE",
  };
}

export async function ensureOnboardingDemoData(
  db: D1Database,
) {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString();
  const actorId = await ensureDemoOperator(db, DEMO_ONBOARDING_OWNER_ID, now);
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO operator_accounts
      (id, email, display_name, status, mfa_status, mfa_verified_at,
       approval_limit_cents, environment, integrity_state, version, created_at, updated_at)
      VALUES (?, ?, 'Synthetic onboarding checker', 'active', 'verified', ?, 0,
       'demo', 'synthetic', 1, ?, ?)`).bind(DEMO_CHECKER_ID, DEMO_CHECKER_ID, now, now, now),
    ...["operations_owner", "compliance_reviewer"].map((role) =>
      db.prepare(`INSERT OR IGNORE INTO operator_role_assignments
        (id, operator_id, role, status, environment, integrity_state, granted_by, granted_at, revoked_at)
        VALUES (?, ?, ?, 'active', 'demo', 'synthetic', 'demo-bootstrap', ?, NULL)`)
        .bind(`ROLE-${DEMO_CHECKER_ID}-${role}`, DEMO_CHECKER_ID, role, now),
    ),
    db.prepare(`INSERT OR IGNORE INTO onboarding_cases
      (id, subject_type, subject_id, display_name, contact_email_normalized,
       status, current_stage, owner_id, identity_status, compliance_status,
       contract_status, banking_status, access_status, environment, integrity_state,
       version, created_at, updated_at, completed_at)
      VALUES (?, 'client', 'CL-001', 'Northbridge Property Services',
       'nadia@northbridge.example', 'complete', 'ready_for_pilot', ?, 'verified_demo',
       'verified_demo', 'signed_demo', 'not_required', 'active_demo', 'demo', 'synthetic',
       1, ?, ?, ?)`).bind(CLIENT_CASE_ID, actorId, now, now, now),
    db.prepare(`INSERT OR IGNORE INTO onboarding_cases
      (id, subject_type, subject_id, display_name, contact_email_normalized,
       status, current_stage, owner_id, identity_status, compliance_status,
       contract_status, banking_status, access_status, environment, integrity_state,
       version, created_at, updated_at, completed_at)
      VALUES (?, 'officer', 'OFF-001', 'Lerato Khumalo', 'lerato@example.co.za',
       'complete', 'ready_for_pilot', ?, 'verified_demo', 'verified_demo', 'signed_demo',
       'verified_demo', 'active_demo', 'demo', 'synthetic', 1, ?, ?, ?)`)
      .bind(OFFICER_CASE_ID, actorId, now, now, now),
    db.prepare(`INSERT OR IGNORE INTO onboarding_cases
      (id, subject_type, subject_id, display_name, contact_email_normalized,
       status, current_stage, owner_id, identity_status, compliance_status,
       contract_status, banking_status, access_status, environment, integrity_state,
       version, created_at, updated_at, completed_at)
      VALUES (?, 'operations', ?, 'Operations owner', ?, 'complete', 'ready_for_pilot', ?,
       'verified_demo', 'verified_demo', 'not_required', 'not_required', 'active_demo',
       'demo', 'synthetic', 1, ?, ?, ?)`)
      .bind(OPERATIONS_CASE_ID, actorId, DEMO_ONBOARDING_OWNER_ID, actorId, now, now, now),
  ]);

  const checklistStatements = await Promise.all(
    checklistSeed().map(async ([caseId, code, label, category, sortOrder]) => {
      const evidenceReference = `demo://onboarding/${caseId}/${code}`;
      const evidenceHash = await sha256(evidenceReference);
      return db.prepare(`INSERT OR IGNORE INTO onboarding_checklist_items
        (id, case_id, code, label, category, required, status, evidence_reference,
         evidence_hash, verified_by, verified_at, expires_at, sort_order, environment,
         integrity_state, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, 'verified_demo', ?, ?, ?, ?, NULL, ?, 'demo',
         'synthetic', 1, ?, ?)`).bind(
          `CHK-${caseId}-${code}`,
          caseId,
          code,
          label,
          category,
          evidenceReference,
          evidenceHash,
          DEMO_CHECKER_ID,
          now,
          sortOrder,
          now,
          now,
        );
    }),
  );
  await db.batch(checklistStatements);

  const templateStatements: D1PreparedStatement[] = [];
  const envelopeStatements: D1PreparedStatement[] = [];
  for (const spec of CONTRACT_TEMPLATE_SPECS) {
    const id = `TPL-DEMO-${spec.code}-V1`;
    const variableSchemaJson = JSON.stringify(spec.variables);
    const templateHash = await sha256(`${spec.code}:${variableSchemaJson}:demo-v1`);
    templateStatements.push(
      db.prepare(`INSERT OR IGNORE INTO contract_template_versions
        (id, template_code, label, jurisdiction, template_version, variable_schema_json,
         body_reference, template_hash, status, watermark, approved_by, approved_at,
         effective_from, effective_to, environment, integrity_state, active_key, version,
         created_at, updated_at)
        VALUES (?, ?, ?, 'ZA', 'demo-v1', ?, ?, ?, 'demo_approved', ?, ?, ?, ?, NULL,
         'demo', 'synthetic', ?, 1, ?, ?)`).bind(
          id,
          spec.code,
          spec.label,
          variableSchemaJson,
          `demo://contract-template/${spec.code}/body`,
          templateHash,
          DEMO_CONTRACT_WATERMARK,
          DEMO_CHECKER_ID,
          now,
          now.slice(0, 10),
          `demo:${spec.code}`,
          now,
          now,
        ),
    );
    const caseId = spec.subjectType === "client" ? CLIENT_CASE_ID : OFFICER_CASE_ID;
    const subjectId = spec.subjectType === "client" ? "CL-001" : "OFF-001";
    const variablesJson = JSON.stringify(envelopeVariables(spec.code));
    const variablesHash = await sha256(variablesJson);
    const documentHash = await sha256(`${templateHash}:${variablesHash}:demo-document`);
    envelopeStatements.push(
      db.prepare(`INSERT OR IGNORE INTO contract_envelopes
        (id, onboarding_case_id, template_version_id, subject_type, subject_id,
         variables_json, variables_hash, document_reference, document_hash, status,
         watermark, generated_by, approved_by, signed_by_email, generated_at, approved_at,
         signed_at, environment, integrity_state, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'demo_signed', ?, ?, ?, ?, ?, ?, ?,
         'demo', 'synthetic', 1, ?, ?)`).bind(
          `ENV-DEMO-${spec.code}-001`,
          caseId,
          id,
          spec.subjectType,
          subjectId,
          variablesJson,
          variablesHash,
          `demo://contract-envelope/${spec.code}/preview`,
          documentHash,
          DEMO_CONTRACT_WATERMARK,
          actorId,
          DEMO_CHECKER_ID,
          spec.subjectType === "client" ? "nadia@northbridge.example" : "lerato@example.co.za",
          now,
          now,
          now,
          now,
          now,
        ),
    );
  }
  await db.batch(templateStatements);
  await db.batch(envelopeStatements);

  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO workspace_access_invitations
      (id, onboarding_case_id, email_normalized, role, client_id, officer_id, operator_id,
       status, requested_by, approved_by, requested_at, approved_at, claimed_at,
       activated_at, expires_at, environment, integrity_state, active_key, version,
       created_at, updated_at)
      SELECT 'INV-DEMO-CLIENT-001', ?, 'nadia@northbridge.example', 'client', client.id,
       NULL, NULL, 'demo_active', ?, ?, ?, ?, ?, ?, ?, 'demo', 'synthetic',
       'demo:client:nadia@northbridge.example', 1, ?, ?
      FROM clients client WHERE client.id = 'CL-001' AND client.environment = 'demo'
       AND client.integrity_state = 'synthetic'`)
      .bind(CLIENT_CASE_ID, actorId, DEMO_CHECKER_ID, now, now, now, now, expiresAt, now, now),
    db.prepare(`INSERT OR IGNORE INTO workspace_access_invitations
      (id, onboarding_case_id, email_normalized, role, client_id, officer_id, operator_id,
       status, requested_by, approved_by, requested_at, approved_at, claimed_at,
       activated_at, expires_at, environment, integrity_state, active_key, version,
       created_at, updated_at)
      SELECT 'INV-DEMO-OFFICER-001', ?, 'lerato@example.co.za', 'officer', NULL,
       officer.id, NULL, 'demo_active', ?, ?, ?, ?, ?, ?, ?, 'demo', 'synthetic',
       'demo:officer:lerato@example.co.za', 1, ?, ?
      FROM officers officer WHERE officer.id = 'OFF-001'
       AND NOT EXISTS (SELECT 1 FROM workspace_access_invitations existing
        WHERE existing.active_key = 'production:officer:lerato@example.co.za')`)
      .bind(OFFICER_CASE_ID, actorId, DEMO_CHECKER_ID, now, now, now, now, expiresAt, now, now),
    db.prepare(`INSERT OR IGNORE INTO workspace_access_invitations
      (id, onboarding_case_id, email_normalized, role, client_id, officer_id, operator_id,
       status, requested_by, approved_by, requested_at, approved_at, claimed_at,
       activated_at, expires_at, environment, integrity_state, active_key, version,
       created_at, updated_at)
      VALUES ('INV-DEMO-OPS-001', ?, ?, 'operations', NULL, NULL, ?, 'demo_active', ?, ?,
       ?, ?, ?, ?, ?, 'demo', 'synthetic', ?, 1, ?, ?)`)
      .bind(
        OPERATIONS_CASE_ID,
        DEMO_ONBOARDING_OWNER_ID,
        actorId,
        actorId,
        DEMO_CHECKER_ID,
        now,
        now,
        now,
        now,
        expiresAt,
        `demo:operations:${DEMO_ONBOARDING_OWNER_ID}`,
        now,
        now,
      ),
  ]);
  return actorId;
}

async function readCases(
  db: D1Database,
  scope: OnboardingScope,
  principal: PilotPrincipal,
) {
  const scopedEntityId = scope === "client"
    ? principal.clientId
    : scope === "officer"
      ? principal.officerId
      : null;
  if (scope !== "operations" && !principal.owner && !scopedEntityId) {
    throw new OnboardingWorkflowError(
      "This account is not assigned to an onboarding entity.",
      403,
    );
  }
  const scopeWhere = scope === "operations"
    ? ""
    : principal.owner
      ? "AND subject_type = ?"
      : "AND subject_type = ? AND subject_id = ?";
  const statement = db.prepare(`SELECT id, subject_type AS subjectType, subject_id AS subjectId,
    display_name AS displayName, contact_email_normalized AS contactEmail, status,
    current_stage AS currentStage, identity_status AS identityStatus,
    compliance_status AS complianceStatus, contract_status AS contractStatus,
    banking_status AS bankingStatus, access_status AS accessStatus, version,
    updated_at AS updatedAt, completed_at AS completedAt
    FROM onboarding_cases WHERE environment = 'demo' AND integrity_state = 'synthetic'
    ${scopeWhere} ORDER BY CASE subject_type WHEN 'client' THEN 1 WHEN 'officer' THEN 2 ELSE 3 END`);
  const rows = scope === "operations"
    ? await statement.all<Omit<OnboardingCase, "checklist">>()
    : principal.owner
      ? await statement.bind(scope).all<Omit<OnboardingCase, "checklist">>()
      : await statement
          .bind(scope, scopedEntityId)
          .all<Omit<OnboardingCase, "checklist">>();
  const cases: OnboardingCase[] = [];
  for (const row of rows.results ?? []) {
    const checklist = await db.prepare(`SELECT id, code, label, category, required, status,
      evidence_reference AS evidenceReference, verified_at AS verifiedAt,
      expires_at AS expiresAt, sort_order AS sortOrder
      FROM onboarding_checklist_items WHERE case_id = ? AND environment = 'demo'
       AND integrity_state = 'synthetic' ORDER BY sort_order, code`)
      .bind(row.id).all<Omit<OnboardingChecklistItem,"required"> & { required: number }>();
    cases.push({
      ...row,
      checklist: (checklist.results ?? []).map((item) => ({
        ...item,
        required: Boolean(item.required),
      })),
    });
  }
  return cases;
}

export async function readOnboardingState(
  db: D1Database,
  scope: OnboardingScope,
  principal: PilotPrincipal,
): Promise<OnboardingState> {
  type RawTemplateRow = Omit<ContractTemplateState, "variables"> & {
    variables: string;
  };
  type RawRehearsalRow = Omit<
    ControlledPilotRehearsal,
    | "steps"
    | "blockers"
    | "creditTermsDays"
    | "fundingModel"
    | "settlementLocked"
    | "productionAuthorised"
  > & {
    steps: string;
    blockers: string;
    creditTermsDays: number;
    fundingModel: string;
    settlementLocked: number;
    productionAuthorised: number;
  };
  const cases = await readCases(db, scope, principal);
  const caseIds = new Set(cases.map((item) => item.id));
  const templatesResult = await db.prepare(`SELECT id, template_code AS templateCode, label,
    template_version AS templateVersion, status, variable_schema_json AS variables,
    watermark, approved_at AS approvedAt FROM contract_template_versions
    WHERE environment = 'demo' AND integrity_state = 'synthetic'
    ORDER BY template_code`).all<RawTemplateRow>();
  const templates = scope === "operations"
    ? (templatesResult.results ?? []).map((item) => ({ ...item, variables: jsonList(item.variables) }))
    : [];
  const envelopesResult = await db.prepare(`SELECT envelope.id,
    envelope.onboarding_case_id AS onboardingCaseId, template.template_code AS templateCode,
    template.label AS templateLabel, envelope.subject_type AS subjectType, envelope.status,
    envelope.watermark, envelope.generated_at AS generatedAt, envelope.signed_at AS signedAt
    FROM contract_envelopes envelope JOIN contract_template_versions template
      ON template.id = envelope.template_version_id
    WHERE envelope.environment = 'demo' AND envelope.integrity_state = 'synthetic'
    ORDER BY envelope.generated_at DESC`).all<ContractEnvelopeState>();
  const envelopes = (envelopesResult.results ?? []).filter((item) => caseIds.has(item.onboardingCaseId));
  const invitationsResult = await db.prepare(`SELECT id, onboarding_case_id AS onboardingCaseId,
    email_normalized AS email, role, status, requested_by AS requestedBy,
    approved_by AS approvedBy, activated_at AS activatedAt, expires_at AS expiresAt
    FROM workspace_access_invitations WHERE environment = 'demo'
      AND integrity_state = 'synthetic' ORDER BY requested_at DESC`)
    .all<WorkspaceInvitationState>();
  const invitations = (invitationsResult.results ?? []).filter((item) => caseIds.has(item.onboardingCaseId));
  const rehearsalResult = await db.prepare(`SELECT id, flow_version AS flowVersion, status,
    steps_json AS steps, blockers_json AS blockers, credit_terms_days AS creditTermsDays,
    funding_model AS fundingModel, settlement_locked AS settlementLocked,
    production_authorised AS productionAuthorised, run_by AS runBy, created_at AS createdAt
    FROM controlled_pilot_rehearsals WHERE environment = 'demo' AND integrity_state = 'synthetic'
    ORDER BY created_at DESC LIMIT 10`).all<RawRehearsalRow>();
  const rehearsals = (rehearsalResult.results ?? []).map((item) => ({
    ...item,
    steps: JSON.parse(item.steps) as ControlledPilotRehearsal["steps"],
    blockers: jsonList(item.blockers),
    creditTermsDays: 0 as const,
    fundingModel: "advance_only" as const,
    settlementLocked: true as const,
    productionAuthorised: false as const,
  }));
  const requiredChecks = cases.reduce(
    (sum, item) => sum + item.checklist.filter((check) => check.required).length,
    0,
  );
  const passedChecks = cases.reduce(
    (sum, item) => sum + item.checklist.filter((check) => check.required && check.status === "verified_demo").length,
    0,
  );
  return {
    environment: "demo",
    generatedAt: new Date().toISOString(),
    productionLocked: true,
    summary: {
      completedCases: cases.filter((item) => item.status === "complete").length,
      totalCases: cases.length,
      passedChecks,
      requiredChecks,
      preparedTemplates: templates.filter((item) => item.status === "demo_approved").length,
      signedDemoEnvelopes: envelopes.filter((item) => item.status === "demo_signed").length,
      activeDemoInvitations: invitations.filter((item) => item.status === "demo_active").length,
      latestRehearsalStatus: rehearsals[0]?.status ?? "not_run",
    },
    cases,
    templates,
    envelopes,
    invitations,
    rehearsals,
    productionBlockers: scope === "operations" ? [...PRODUCTION_ONBOARDING_BLOCKERS] : [
      "This is a synthetic onboarding rehearsal. Production access and signed agreements are not active.",
    ],
  };
}

async function count(db: D1Database, sql: string) {
  const row = await db.prepare(sql).first<{ value: number }>();
  return Number(row?.value ?? 0);
}

export async function runControlledPilotRehearsal(
  db: D1Database,
  actorEmail: string,
) {
  await ensureOnboardingDemoData(db);
  const actorId = await ensureDemoOperator(db, actorEmail);
  const criticalGuards = [
    "offer_advance_funding_insert_guard_v28",
    "offer_advance_funding_update_guard_v28",
    "payroll_settlement_lock_v29",
    "payroll_settlement_insert_lock_v29",
    "workspace_access_insert_guard_v32",
    "controlled_pilot_rehearsal_insert_guard_v32",
  ];
  const guardPlaceholders = criticalGuards.map(() => "?").join(",");
  const guardResult = await db.prepare(`SELECT COUNT(*) AS value FROM sqlite_schema
    WHERE type = 'trigger' AND name IN (${guardPlaceholders})`)
    .bind(...criticalGuards).first<{ value: number }>();
  const rehearsal = evaluateControlledPilotRehearsal({
    completedCases: await count(db, `SELECT COUNT(*) AS value FROM onboarding_cases
      WHERE environment = 'demo' AND integrity_state = 'synthetic' AND status = 'complete'`),
    requiredCases: 3,
    preparedTemplates: await count(db, `SELECT COUNT(*) AS value FROM contract_template_versions
      WHERE environment = 'demo' AND integrity_state = 'synthetic' AND status = 'demo_approved'`),
    requiredTemplates: CONTRACT_TEMPLATE_SPECS.length,
    signedEnvelopes: await count(db, `SELECT COUNT(*) AS value FROM contract_envelopes
      WHERE environment = 'demo' AND integrity_state = 'synthetic' AND status = 'demo_signed'`),
    requiredEnvelopes: CONTRACT_TEMPLATE_SPECS.length,
    activeInvitations: await count(db, `SELECT COUNT(*) AS value FROM workspace_access_invitations
      WHERE environment = 'demo' AND integrity_state = 'synthetic' AND status = 'demo_active'`),
    requiredInvitations: 3,
    criticalDatabaseGuards: Number(guardResult?.value ?? 0),
    requiredDatabaseGuards: criticalGuards.length,
  });
  const stepsJson = JSON.stringify(rehearsal.steps);
  const blockersJson = JSON.stringify(rehearsal.blockers);
  const stepsHash = await sha256(stepsJson);
  const id = `RHR-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO controlled_pilot_rehearsals
    (id, flow_version, status, steps_json, steps_hash, blockers_json,
     credit_terms_days, funding_model, settlement_locked, production_authorised,
     run_by, environment, integrity_state, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, 'advance_only', 1, 0, ?, 'demo', 'synthetic', ?)`)
    .bind(
      id,
      CONTROLLED_ONBOARDING_FLOW_VERSION,
      rehearsal.status,
      stepsJson,
      stepsHash,
      blockersJson,
      actorId,
      now,
    ).run();
  return { id, ...rehearsal, runBy: actorId, createdAt: now };
}
