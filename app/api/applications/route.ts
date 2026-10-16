import {blockedTestSurface,rehearsalEnv} from '../../lib/test-surface-runtime';
import {readRequestText, RequestBodyError} from '../../lib/request-body';
import { applicationPsiraDeclaration, psiraIntakeStatus } from '../../lib/psira-pathway';
import { psiraNumber as validatePsiraNumber } from '../../lib/psira-verification';
import { env } from "cloudflare:workers";
import { completeDemoIdentityVerification, PlatformWorkflowError, recordDemoIdentityOutcome, startDemoIdentityVerification } from "../../lib/integration-server";
import { tokenHash } from "../../lib/passport-server";
import { PilotAccessError, pilotStage, requirePilotApiRole, requireSameOriginJson } from "../../lib/pilot-runtime";

export const dynamic = "force-dynamic";

const pathways = new Set(["qualified", "training"]);
const provinces = new Set(["Gauteng", "Western Cape", "Free State", "KwaZulu-Natal", "Eastern Cape", "Mpumalanga", "Limpopo", "North West", "Northern Cape"]);
const psiraStatuses = new Set(["active", "expired", "in_training", "not_registered"]);
const grades = new Set(["Grade A", "Grade B", "Grade C", "Grade D", "Grade E"]);
const serviceOptions = new Set(["Unarmed", "Armed", "VIP"]);
const purposeOptions = new Set(["Commercial access", "Construction site", "School", "Retail", "Residential", "Event", "Logistics / industrial"]);
const trainingOptions = new Set(["Entry-level security training", "Security grade upgrade", "Firearms training", "Armed-work readiness", "VIP / close-protection training"]);
const privacyNoticeVersion = "officer-interest-2026-08-22-v2";

class ApplicationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type ApplicationInput = {
  pathway?: unknown;
  fullName?: unknown;
  mobile?: unknown;
  email?: unknown;
  city?: unknown;
  province?: unknown;
  psiraStatus?: unknown;
  psiraNumber?: unknown;
  psiraGrade?: unknown;
  services?: unknown;
  purposes?: unknown;
  training?: unknown;
  over18Confirmed?: unknown;
  eligibilityAcknowledged?: unknown;
  contactConsent?: unknown;
  company?: unknown;
};

function getDb(): D1Database {
  if (!env.DB) throw new ApplicationError("The application service is temporarily unavailable.", 503);
  return env.DB;
}

function cleanText(value: unknown, name: string, minimum: number, maximum: number) {
  if (typeof value !== "string") throw new ApplicationError(`${name} is required.`);
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (cleaned.length < minimum || cleaned.length > maximum) throw new ApplicationError(`${name} is not valid.`);
  return cleaned;
}

function normaliseMobile(value: unknown) {
  const raw = cleanText(value, "Mobile number", 9, 24);
  const digits = raw.replace(/\D/g, "");
  if (/^0\d{9}$/.test(digits)) return `+27${digits.slice(1)}`;
  if (/^27\d{9}$/.test(digits)) return `+${digits}`;
  throw new ApplicationError("Enter a valid South African mobile number.");
}

function normaliseEmail(value: unknown) {
  const email = cleanText(value, "Email address", 5, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApplicationError("Enter a valid email address.");
  return email;
}

function allowedList(value: unknown, allowed: Set<string>, field: string, maximum: number) {
  if (!Array.isArray(value)) throw new ApplicationError(`${field} must be selected.`);
  const values = [...new Set(value.filter((item): item is string => typeof item === "string" && allowed.has(item)))];
  if (!values.length || values.length > maximum) throw new ApplicationError(`Choose a valid ${field.toLowerCase()}.`);
  return values;
}

function responseError(cause: unknown) {
  const error = cause instanceof ApplicationError || cause instanceof RequestBodyError || cause instanceof PilotAccessError || cause instanceof PlatformWorkflowError
    ? cause
    : new ApplicationError("We could not complete that application request.", 500);
  return response({ error: error.message }, error.status);
}

function response(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: {
    "cache-control": "no-store, private",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    vary: "x-lokd-verified-email",
  } });
}

async function ensureDemoApplications(db: D1Database) {
  const now = new Date().toISOString();
  const retention = new Date();
  retention.setUTCFullYear(retention.getUTCFullYear() + 1);
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO officer_applications
      (id, pathway, full_name, mobile_normalized, email_normalized, city, province, psira_status,
       psira_number, psira_grade, service_interests, purpose_interests, training_interests,
       over_18_confirmed, eligibility_acknowledged, privacy_notice_version, privacy_acknowledged_at,
       identity_verification_status, identity_consent_version, identity_consented_at,
       environment, integrity_state, status, source, retention_review_at, created_at, updated_at)
      VALUES ('APP-DEMO-001', 'qualified', 'Neo Mahlangu', '+27820000001', 'neo.demo@lokd.example',
       'Johannesburg', 'Gauteng', 'active', 'PSIRA-DEMO-1001', 'Grade B', '["Unarmed","Armed"]',
       '["Commercial access","Logistics / industrial"]', '[]', 1, 1, ?, ?, 'not_started',
       'demo-identity-consent-v1', ?, 'demo', 'synthetic', 'submitted', 'demo_seed', ?, ?, ?)`)
      .bind(privacyNoticeVersion, now, now, retention.toISOString(), now, now),
    db.prepare(`INSERT OR IGNORE INTO officer_applications
      (id, pathway, full_name, mobile_normalized, email_normalized, city, province, psira_status,
       psira_number, psira_grade, service_interests, purpose_interests, training_interests,
       over_18_confirmed, eligibility_acknowledged, privacy_notice_version, privacy_acknowledged_at,
       identity_verification_status, identity_consent_version, identity_consented_at,
       environment, integrity_state, status, source, retention_review_at, created_at, updated_at)
      VALUES ('APP-DEMO-002', 'training', 'Amahle Nkosi', '+27820000002', 'amahle.demo@lokd.example',
       'Soweto', 'Gauteng', 'not_registered', NULL, NULL, '["Unarmed"]',
       '["Retail","School"]', '["Entry-level security training"]', 1, 1, ?, ?, 'not_started',
       'demo-identity-consent-v1', ?, 'demo', 'synthetic', 'submitted', 'demo_seed', ?, ?, ?)`)
      .bind(privacyNoticeVersion, now, now, retention.toISOString(), now, now),
  ]);
}

export async function GET(request: Request) {
 const blockedTest = await blockedTestSurface(request); if (blockedTest) return blockedTest;

  try {
    requirePilotApiRole(request, "operations");
    const db = rehearsalEnv.DB;
    if (!db) throw new ApplicationError("The test application service is unavailable.", 503);
    if (pilotStage() === "demo") await ensureDemoApplications(db);
    const result = await db.prepare(`SELECT id, pathway, full_name AS fullName, mobile_normalized AS mobile,
      email_normalized AS email, city, province, psira_status AS psiraStatus, psira_number AS psiraNumber,
      psira_grade AS psiraGrade, service_interests AS services, purpose_interests AS purposes,
      training_interests AS training, identity_verification_status AS identityStatus, status, source,
      created_at AS createdAt, updated_at AS updatedAt FROM officer_applications
      WHERE environment = 'demo' AND integrity_state = 'synthetic'
      ORDER BY CASE WHEN source = 'demo_seed' THEN 1 ELSE 0 END, created_at DESC LIMIT 50`).all<{
        id: string; pathway: string; fullName: string; mobile: string; email: string; city: string; province: string;
        psiraStatus: string; psiraNumber: string | null; psiraGrade: string | null; services: string;
        purposes: string; training: string; identityStatus: string; status: string; source: string;
        createdAt: string; updatedAt: string;
      }>();
    return response({ applications: (result.results ?? []).map((item) => ({
      ...item,
      psiraVerificationRequired: applicationPsiraDeclaration(item.pathway, item.psiraStatus) === "registered",
      services: JSON.parse(item.services) as string[],
      purposes: JSON.parse(item.purposes) as string[],
      training: JSON.parse(item.training) as string[],
    })) });
  } catch (cause) {
    return responseError(cause);
  }
}

export async function PATCH(request: Request) {
 const blockedTest = await blockedTestSurface(request); if (blockedTest) return blockedTest;

  try {
    requireSameOriginJson(request);
    const actor = requirePilotApiRole(request, "operations");
    if (pilotStage() !== "demo") throw new ApplicationError("Demo application transitions are disabled outside the isolated demo environment.", 423);
    const raw = await readRequestText(request, 16_000);
    let input: { id?: unknown; action?: unknown };
    try { input = JSON.parse(raw) as { id?: unknown; action?: unknown }; }
    catch { throw new ApplicationError("The request body is not valid JSON."); }
    const id = cleanText(input.id, "Application reference", 8, 80);
    const action = cleanText(input.action, "Review action", 4, 40);
    const db = rehearsalEnv.DB;
    if (!db) throw new ApplicationError("The test application service is unavailable.", 503);
    if (action === "start_demo_identity") {
      await startDemoIdentityVerification(db, id, actor.email);
      return response({ ok: true });
    }
    if (action === "complete_demo_identity") {
      await completeDemoIdentityVerification(db, id, actor.email);
      return response({ ok: true });
    }
    if (["demo_identity_manual_review", "demo_identity_rejected", "demo_identity_expired"].includes(action)) {
      const outcome = action.replace("demo_identity_", "") as "manual_review" | "rejected" | "expired";
      await recordDemoIdentityOutcome(db, id, actor.email, outcome);
      return response({ ok: true });
    }
    if (action === "issue_demo_network_profile") {
      const application = await db.prepare(`SELECT id, full_name AS fullName, mobile_normalized AS mobile,
        email_normalized AS email, city, psira_status AS psiraStatus, psira_number AS psiraNumber,
        psira_grade AS psiraGrade, service_interests AS services
        FROM officer_applications WHERE id = ? AND status = 'assessment_ready'
         AND identity_verification_status = 'demo_verified' AND officer_id IS NULL
         AND environment = 'demo' AND integrity_state = 'synthetic'`)
        .bind(id).first<{ id: string; fullName: string; mobile: string; email: string; city: string;
          psiraStatus: string; psiraNumber: string | null; psiraGrade: string | null; services: string }>();
      if (!application || application.psiraStatus !== "active" || !application.psiraNumber || !application.psiraGrade) {
        throw new ApplicationError("A synthetic current PSiRA number, grade and completed assessment are required for this rehearsal.", 409);
      }
      const suffix = application.id.replace(/^APP-/, "");
      const officerId = `OFF-${suffix}`;
      const publicToken = `lokd_demo_network_${application.id}_${officerId}`;
      const publicTokenHash = await tokenHash(publicToken);
      const now = new Date().toISOString();
      const nextReview = new Date();
      nextReview.setUTCDate(nextReview.getUTCDate() + 30);
      const psiraExpiry = new Date();
      psiraExpiry.setUTCFullYear(psiraExpiry.getUTCFullYear() + 1);
      const interested = new Set(JSON.parse(application.services) as string[]);
      const serviceStatements = ["Unarmed", "Armed", "VIP"].map((service) => db.prepare(`INSERT INTO officer_services
        (officer_id, service_type, qualified, opted_in, qualification_expiry)
        VALUES (?, ?, ?, 0, NULL)`).bind(officerId, service, service === "Unarmed" && interested.has(service) ? 1 : 0));
      await db.batch([
        db.prepare(`INSERT INTO officers
          (id, full_name, mobile, email, city, psira_number, psira_grade, psira_expiry,
           approval_status, banking_status, flex_available, external_work_acknowledged,
           rest_window_confirmed, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'network_demo_only', 'unverified', 0, 0, 0, ?)`)
          .bind(officerId, application.fullName, application.mobile, application.email, application.city,
            application.psiraNumber, application.psiraGrade, psiraExpiry.toISOString().slice(0, 10), now),
        db.prepare(`INSERT INTO officer_passports
          (officer_id, passport_number, public_token_hash, status, readiness_label, environment,
           integrity_state, evidence_reference, issued_at, last_reviewed_at, next_review_at, updated_at)
          VALUES (?, ?, ?, 'restricted', 'Network profile · production verification pending', 'demo',
           'synthetic', ?, ?, ?, ?, ?)`)
          .bind(officerId, `LOKD-DEMO-${suffix}`, publicTokenHash,
            `demo:network-profile:${application.id}`, now, now, nextReview.toISOString(), now),
        ...serviceStatements,
        db.prepare(`INSERT INTO compliance_records
          (id, officer_id, record_type, status, environment, integrity_state, evidence_reference,
           verified_at, expires_at, next_due_at)
          VALUES (?, ?, 'Identity workflow rehearsal', 'demo_only', 'demo', 'synthetic', ?, ?, NULL, ?)`)
          .bind(`CMP-ID-${suffix}`, officerId, `demo:identity:${application.id}`, now, nextReview.toISOString()),
        db.prepare(`UPDATE officer_applications SET officer_id = ?, status = 'network_profile_created', updated_at = ?
          WHERE id = ? AND status = 'assessment_ready' AND officer_id IS NULL
           AND environment = 'demo' AND integrity_state = 'synthetic'`)
          .bind(officerId, now, application.id),
        db.prepare(`UPDATE identity_verification_cases SET officer_id = ?, updated_at = ?
          WHERE application_id = ? AND officer_id IS NULL AND status = 'verified'
           AND environment = 'demo' AND integrity_state = 'synthetic'`)
          .bind(officerId, now, application.id),
        db.prepare(`INSERT INTO audit_events
          (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
          VALUES (?, 'operations', ?, 'demo_network_profile_issued', 'officer', ?,
           'DEMO ONLY: created a restricted Verified Network profile. No employment, payroll route or paid-work eligibility was created.', ?)`)
          .bind(`AUD-${crypto.randomUUID()}`, actor.email, officerId, now),
      ]);
      return response({
        ok: true,
        officerId,
        verificationPath: `/verify?token=${encodeURIComponent(publicToken)}`,
      });
    }
    const now = new Date().toISOString();
    let detail: string;
    let result: D1Result<unknown>;
    if (action === "route_training") {
      detail = "Applicant routed to the LOKD Academy training pathway for demo planning.";
      result = await db.prepare(`UPDATE officer_applications SET status = 'training_recommended', updated_at = ?
        WHERE id = ? AND environment = 'demo' AND integrity_state = 'synthetic'`).bind(now, id).run();
    } else if (action === "approve_assessment") {
      detail = "Applicant cleared for a LOKD assessment in demo mode after the evidenced synthetic identity case; this is not operational approval.";
      result = await db.prepare(`UPDATE officer_applications SET status = 'assessment_ready', updated_at = ?
        WHERE id = ? AND identity_verification_status = 'demo_verified'
          AND environment = 'demo' AND integrity_state = 'synthetic'
          AND EXISTS (SELECT 1 FROM identity_verification_cases identity
            WHERE identity.application_id = officer_applications.id AND identity.status = 'verified'
              AND identity.evidence_reference IS NOT NULL AND identity.completed_at IS NOT NULL
              AND identity.environment = officer_applications.environment
              AND identity.integrity_state = officer_applications.integrity_state)`)
        .bind(now, id).run();
    } else {
      throw new ApplicationError("Choose a valid application review action.");
    }
    if (!result.meta.changes) throw new ApplicationError("That application could not be found.", 404);
    await db.prepare(`INSERT INTO audit_events
      (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
      VALUES (?, 'operations', ?, 'application_demo_reviewed', 'officer_application', ?, ?, ?)`)
      .bind(`AUD-${crypto.randomUUID()}`, actor.email, id, detail, now).run();
    return response({ ok: true });
  } catch (cause) {
    return responseError(cause);
  }
}

export async function submitOfficerApplication(request: Request, database?:D1Database) {
  try {
    requireSameOriginJson(request);
    const raw = await readRequestText(request, 16_000);
    let input: ApplicationInput;
    try { input = JSON.parse(raw) as ApplicationInput; }
    catch { throw new ApplicationError("The application body is not valid JSON."); }
    if (typeof input.company === "string" && input.company.trim()) return response({ reference: "LOKD-RECEIVED" }, 202);

    const pathway = cleanText(input.pathway, "Pathway", 4, 20);
    if (!pathways.has(pathway)) throw new ApplicationError("Choose an application pathway.");
    const fullName = cleanText(input.fullName, "Full name", 3, 100);
    const mobile = normaliseMobile(input.mobile);
    const email = normaliseEmail(input.email);
    const city = cleanText(input.city, "City", 2, 80);
    const province = cleanText(input.province, "Province", 4, 40);
    if (!provinces.has(province)) throw new ApplicationError("Choose a valid province.");
    const psiraStatus = cleanText(input.psiraStatus, "PSiRA position", 4, 30);
    if (!psiraStatuses.has(psiraStatus)) throw new ApplicationError("Choose a valid PSiRA position.");
    const declaration = applicationPsiraDeclaration(pathway, psiraStatus);
    const psiraRequired = declaration === 'registered';
    let psiraNumber: string | null = null;
    if (psiraRequired) {
      try { psiraNumber = validatePsiraNumber(input.psiraNumber); }
      catch { throw new ApplicationError('Enter your numeric PSiRA number. Verification is mandatory for registered-officer applications.'); }
    }
    const requestedGrade = typeof input.psiraGrade === 'string' ? input.psiraGrade.trim() : '';
    const psiraGrade = psiraRequired && grades.has(requestedGrade) ? requestedGrade : null;
    const services = allowedList(input.services, serviceOptions, "Work category", 3);
    const purposes = allowedList(input.purposes, purposeOptions, "Work environment", 7);
    const training = pathway === "training" ? allowedList(input.training, trainingOptions, "Training area", 5) : [];
    if (input.over18Confirmed !== true) throw new ApplicationError("You must confirm that you are at least 18 years old.");
    if (input.eligibilityAcknowledged !== true) throw new ApplicationError("Confirm that you understand the PSiRA eligibility requirements.");
    if (input.contactConsent !== true) throw new ApplicationError("Consent is required to save and respond to this application.");

    const db = database??getDb();
    const now = new Date();
    const nowIso = now.toISOString();
    const retentionReview = new Date(now);
    retentionReview.setUTCFullYear(retentionReview.getUTCFullYear() + 1);
    // An anonymous phone/email is contact data, not proof of ownership. Preserve
    // each submission independently; account linking uses verified email and then
    // owner_user_id in signup-server. Never reveal or reserve another person's case.
    const id = `APP-${crypto.randomUUID().toUpperCase()}`;

    const application = db.prepare(`INSERT INTO officer_applications
      (id, pathway, full_name, mobile_normalized, email_normalized, city, province, psira_status,
       psira_number, psira_grade, service_interests, purpose_interests, training_interests, over_18_confirmed,
       eligibility_acknowledged, privacy_notice_version, privacy_acknowledged_at,
       identity_verification_status, identity_consent_version, identity_consented_at,
       environment, integrity_state, status, source, retention_review_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, 'consent_pending', NULL, NULL,
       'prelaunch', 'user_submitted', ?, 'homepage', ?, ?, ?)`)
      .bind(id, pathway, fullName, mobile, email, city, province, psiraStatus, psiraNumber, psiraGrade,
        JSON.stringify(services), JSON.stringify(purposes), JSON.stringify(training), privacyNoticeVersion, nowIso,
        psiraIntakeStatus(declaration), retentionReview.toISOString(), nowIso, nowIso);

    const audit = db.prepare(`INSERT INTO audit_events
      (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
      VALUES (?, 'applicant', ?, 'officer_interest_submitted', 'officer_application', ?, ?, ?)`)
      .bind(`AUD-${crypto.randomUUID()}`, id, id, "Homepage work, purpose and training interests received; identity and credentials remain unverified.", nowIso);
    // D1 batches are atomic: never acknowledge an unaudited or partially saved intake.
    await db.batch([application, audit]);

    return response({ reference: id, psiraVerificationRequired: psiraRequired, pathwayStatus: psiraIntakeStatus(declaration) }, 202);
  } catch (cause) {
    return responseError(cause);
  }
}

export async function POST(request:Request){return submitOfficerApplication(request);}
