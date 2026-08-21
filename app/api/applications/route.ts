import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

const pathways = new Set(["qualified", "training"]);
const provinces = new Set(["Gauteng", "Western Cape", "Free State", "KwaZulu-Natal", "Eastern Cape", "Mpumalanga", "Limpopo", "North West", "Northern Cape"]);
const psiraStatuses = new Set(["active", "expired", "in_training", "not_registered"]);
const grades = new Set(["Grade A", "Grade B", "Grade C", "Grade D", "Grade E"]);
const serviceOptions = new Set(["Unarmed", "Armed", "VIP"]);
const trainingOptions = new Set(["Entry-level security training", "Security grade upgrade", "Firearms training", "Armed-work readiness", "VIP / close-protection training"]);
const privacyNoticeVersion = "officer-interest-2026-08-22-v1";

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
       psira_number, psira_grade, service_interests, training_interests, over_18_confirmed,
       eligibility_acknowledged, privacy_notice_version, privacy_acknowledged_at,
       identity_verification_status, status, source, retention_review_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, 'not_started', 'submitted', 'homepage', ?, ?, ?)
      ON CONFLICT(mobile_normalized) DO UPDATE SET pathway = excluded.pathway, full_name = excluded.full_name,
       email_normalized = excluded.email_normalized, city = excluded.city, province = excluded.province,
       psira_status = excluded.psira_status, psira_number = excluded.psira_number, psira_grade = excluded.psira_grade,
       service_interests = excluded.service_interests, training_interests = excluded.training_interests,
       over_18_confirmed = 1, eligibility_acknowledged = 1,
       privacy_notice_version = excluded.privacy_notice_version, privacy_acknowledged_at = excluded.privacy_acknowledged_at,
       status = 'submitted', retention_review_at = excluded.retention_review_at, updated_at = excluded.updated_at`)
      .bind(id, pathway, fullName, mobile, email, city, province, psiraStatus, psiraNumber, psiraGrade,
        JSON.stringify(services), JSON.stringify(training), privacyNoticeVersion, nowIso,
        retentionReview.toISOString(), nowIso, nowIso).run();

    await db.prepare(`INSERT INTO audit_events
      (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
      VALUES (?, 'applicant', ?, 'officer_interest_submitted', 'officer_application', ?, ?, ?)`)
      .bind(`AUD-${crypto.randomUUID()}`, id, id, "Homepage interest submission received; identity and credentials remain unverified.", nowIso).run();

    return Response.json({ reference: id }, { status: 202 });
  } catch (cause) {
    return responseError(cause);
  }
}
