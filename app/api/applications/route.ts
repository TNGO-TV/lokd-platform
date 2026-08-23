import { env } from "cloudflare:workers";

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
  const error = cause instanceof ApplicationError ? cause : new ApplicationError("We could not save your application.", 500);
  return Response.json({ error: error.message }, { status: error.status });
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
       identity_verification_status, status, source, retention_review_at, created_at, updated_at)
      VALUES ('APP-DEMO-001', 'qualified', 'Neo Mahlangu', '+27820000001', 'neo.demo@lokd.example',
       'Johannesburg', 'Gauteng', 'active', 'PSIRA-DEMO-1001', 'Grade B', '["Unarmed","Armed"]',
       '["Commercial access","Logistics / industrial"]', '[]', 1, 1, ?, ?, 'not_started',
       'submitted', 'demo_seed', ?, ?, ?)`).bind(privacyNoticeVersion, now, retention.toISOString(), now, now),
    db.prepare(`INSERT OR IGNORE INTO officer_applications
      (id, pathway, full_name, mobile_normalized, email_normalized, city, province, psira_status,
       psira_number, psira_grade, service_interests, purpose_interests, training_interests,
       over_18_confirmed, eligibility_acknowledged, privacy_notice_version, privacy_acknowledged_at,
       identity_verification_status, status, source, retention_review_at, created_at, updated_at)
      VALUES ('APP-DEMO-002', 'training', 'Amahle Nkosi', '+27820000002', 'amahle.demo@lokd.example',
       'Soweto', 'Gauteng', 'not_registered', NULL, NULL, '["Unarmed"]',
       '["Retail","School"]', '["Entry-level security training"]', 1, 1, ?, ?, 'not_started',
       'submitted', 'demo_seed', ?, ?, ?)`).bind(privacyNoticeVersion, now, retention.toISOString(), now, now),
  ]);
}

export async function GET() {
  try {
    const db = getDb();
    await ensureDemoApplications(db);
    const result = await db.prepare(`SELECT id, pathway, full_name AS fullName, mobile_normalized AS mobile,
      email_normalized AS email, city, province, psira_status AS psiraStatus, psira_number AS psiraNumber,
      psira_grade AS psiraGrade, service_interests AS services, purpose_interests AS purposes,
      training_interests AS training, identity_verification_status AS identityStatus, status, source,
      created_at AS createdAt, updated_at AS updatedAt FROM officer_applications
      ORDER BY CASE WHEN source = 'demo_seed' THEN 1 ELSE 0 END, created_at DESC LIMIT 50`).all<{
        id: string; pathway: string; fullName: string; mobile: string; email: string; city: string; province: string;
        psiraStatus: string; psiraNumber: string | null; psiraGrade: string | null; services: string;
        purposes: string; training: string; identityStatus: string; status: string; source: string;
        createdAt: string; updatedAt: string;
      }>();
    return Response.json({ applications: (result.results ?? []).map((item) => ({
      ...item,
      services: JSON.parse(item.services) as string[],
      purposes: JSON.parse(item.purposes) as string[],
      training: JSON.parse(item.training) as string[],
    })) });
  } catch (cause) {
    return responseError(cause);
  }
}

export async function PATCH(request: Request) {
  try {
    const input = await request.json() as { id?: unknown; action?: unknown };
    const id = cleanText(input.id, "Application reference", 8, 80);
    const action = cleanText(input.action, "Review action", 4, 40);
    const transitions: Record<string, { identity: string; status: string; detail: string }> = {
      start_demo_identity: {
        identity: "checking",
        status: "verification_in_progress",
        detail: "Demo identity workflow started. No external identity or PSiRA provider has been called.",
      },
      complete_demo_identity: {
        identity: "demo_verified",
        status: "credentials_review",
        detail: "Demo identity step completed for workflow testing only; production verification remains required.",
      },
      route_training: {
        identity: "not_started",
        status: "training_recommended",
        detail: "Applicant routed to the LOKD Academy training pathway for demo planning.",
      },
      approve_assessment: {
        identity: "demo_verified",
        status: "assessment_ready",
        detail: "Applicant cleared for a LOKD assessment in demo mode; this is not operational approval.",
      },
    };
    const transition = transitions[action];
    if (!transition) throw new ApplicationError("Choose a valid application review action.");
    const db = getDb();
    const now = new Date().toISOString();
    const result = await db.prepare(`UPDATE officer_applications SET identity_verification_status = ?,
      identity_provider = CASE WHEN ? = 'demo_verified' THEN 'demo_only' ELSE identity_provider END,
      identity_verified_at = CASE WHEN ? = 'demo_verified' THEN ? ELSE identity_verified_at END,
      status = ?, updated_at = ? WHERE id = ?`)
      .bind(transition.identity, transition.identity, transition.identity, now, transition.status, now, id).run();
    if (!result.meta.changes) throw new ApplicationError("That application could not be found.", 404);
    await db.prepare(`INSERT INTO audit_events
      (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
      VALUES (?, 'operations', 'OPS-DEMO', 'application_demo_reviewed', 'officer_application', ?, ?, ?)`)
      .bind(`AUD-${crypto.randomUUID()}`, id, transition.detail, now).run();
    return Response.json({ ok: true });
  } catch (cause) {
    return responseError(cause);
  }
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 16_000) throw new ApplicationError("The application is too large.", 413);
    const input = (await request.json()) as ApplicationInput;
    if (typeof input.company === "string" && input.company.trim()) return Response.json({ reference: "LOKD-RECEIVED" }, { status: 202 });

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
    const psiraNumber = typeof input.psiraNumber === "string" && input.psiraNumber.trim() ? cleanText(input.psiraNumber, "PSiRA number", 3, 40) : null;
    const requestedGrade = typeof input.psiraGrade === "string" ? input.psiraGrade.trim() : "";
    const psiraGrade = (psiraStatus === "active" || psiraStatus === "expired") && grades.has(requestedGrade) ? requestedGrade : null;
    const services = allowedList(input.services, serviceOptions, "Work category", 3);
    const purposes = allowedList(input.purposes, purposeOptions, "Work environment", 7);
    const training = pathway === "training" ? allowedList(input.training, trainingOptions, "Training area", 5) : [];
    if (input.over18Confirmed !== true) throw new ApplicationError("You must confirm that you are at least 18 years old.");
    if (input.eligibilityAcknowledged !== true) throw new ApplicationError("Confirm that you understand the PSiRA eligibility requirements.");
    if (input.contactConsent !== true) throw new ApplicationError("Consent is required to save and respond to this application.");

    const db = getDb();
    const now = new Date();
    const nowIso = now.toISOString();
    const retentionReview = new Date(now);
    retentionReview.setUTCFullYear(retentionReview.getUTCFullYear() + 1);
    const existing = await db.prepare(`SELECT id, status FROM officer_applications WHERE mobile_normalized = ?`).bind(mobile).first<{ id: string; status: string }>();
    const id = existing?.id ?? `APP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    if (existing?.status === "converted" || existing?.status === "withdrawn") {
      return Response.json({ reference: id }, { status: 202 });
    }

    await db.prepare(`INSERT INTO officer_applications
      (id, pathway, full_name, mobile_normalized, email_normalized, city, province, psira_status,
       psira_number, psira_grade, service_interests, purpose_interests, training_interests, over_18_confirmed,
       eligibility_acknowledged, privacy_notice_version, privacy_acknowledged_at,
       identity_verification_status, status, source, retention_review_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, 'not_started', 'submitted', 'homepage', ?, ?, ?)
      ON CONFLICT(mobile_normalized) DO UPDATE SET pathway = excluded.pathway, full_name = excluded.full_name,
       email_normalized = excluded.email_normalized, city = excluded.city, province = excluded.province,
       psira_status = excluded.psira_status, psira_number = excluded.psira_number, psira_grade = excluded.psira_grade,
       service_interests = excluded.service_interests, purpose_interests = excluded.purpose_interests,
       training_interests = excluded.training_interests,
       over_18_confirmed = 1, eligibility_acknowledged = 1,
       privacy_notice_version = excluded.privacy_notice_version, privacy_acknowledged_at = excluded.privacy_acknowledged_at,
       status = 'submitted', retention_review_at = excluded.retention_review_at, updated_at = excluded.updated_at`)
      .bind(id, pathway, fullName, mobile, email, city, province, psiraStatus, psiraNumber, psiraGrade,
        JSON.stringify(services), JSON.stringify(purposes), JSON.stringify(training), privacyNoticeVersion, nowIso,
        retentionReview.toISOString(), nowIso, nowIso).run();

    await db.prepare(`INSERT INTO audit_events
      (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
      VALUES (?, 'applicant', ?, 'officer_interest_submitted', 'officer_application', ?, ?, ?)`)
      .bind(`AUD-${crypto.randomUUID()}`, id, id, "Homepage work, purpose and training interests received; identity and credentials remain unverified.", nowIso).run();

    return Response.json({ reference: id }, { status: 202 });
  } catch (cause) {
    return responseError(cause);
  }
}
