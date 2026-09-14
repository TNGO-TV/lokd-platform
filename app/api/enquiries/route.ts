import { env } from "cloudflare:workers";
import { PilotAccessError, requirePilotApiRole, requireSameOriginJson } from "../../lib/pilot-runtime";

export const dynamic = "force-dynamic";

const siteTypes = new Set(["commercial_property", "logistics_industrial", "construction", "residential_estate", "education", "retail", "other"]);
const startWindows = new Set(["within_30_days", "one_to_three_months", "three_to_six_months", "planning"]);
const serviceTypes = new Set(["scheduled_unarmed_fixed_site", "armed_static", "armed_movement", "vip_unarmed", "vip_armed", "vip_protective_driver", "vip_team"]);
const privacyNoticeVersion = "client-enquiry-2026-09-01-v1";

class EnquiryError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

function getDb() {
  if (!env.DB) throw new EnquiryError("The enquiry service is temporarily unavailable.", 503);
  return env.DB;
}

function clean(value: unknown, label: string, minimum: number, maximum: number) {
  if (typeof value !== "string") throw new EnquiryError(`${label} is required.`);
  const result = value.trim().replace(/\s+/g, " ");
  if (result.length < minimum || result.length > maximum) throw new EnquiryError(`${label} is not valid.`);
  return result;
}

function email(value: unknown) {
  const result = clean(value, "Email address", 5, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new EnquiryError("Enter a valid email address.");
  return result;
}

function mobile(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const digits = value.replace(/\D/g, "");
  if (/^0\d{9}$/.test(digits)) return `+27${digits.slice(1)}`;
  if (/^27\d{9}$/.test(digits)) return `+${digits}`;
  throw new EnquiryError("Enter a valid South African mobile number or leave it blank.");
}

function reply(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: {
    "cache-control": "no-store, private",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-robots-tag": "noindex, nofollow",
    vary: "x-lokd-verified-email",
  } });
}

function failure(cause: unknown) {
  const error = cause instanceof EnquiryError || cause instanceof PilotAccessError
    ? cause : new EnquiryError("We could not complete that enquiry request.", 500);
  return reply({ error: error.message }, error.status);
}

function requireSignedInOperations(request: Request) {
  if (!request.headers.get("x-lokd-verified-email")) throw new EnquiryError("Sign in to Operations to continue.", 401);
  return requirePilotApiRole(request, "operations");
}

export async function submitClientEnquiry(request: Request,database?:D1Database) {
  try {
    requireSameOriginJson(request);
    const raw = await request.text();
    if (raw.length > 14_000) throw new EnquiryError("The enquiry is too large.", 413);
    let input: Record<string, unknown>;
    try { input = JSON.parse(raw) as Record<string, unknown>; }
    catch { throw new EnquiryError("The enquiry body is not valid JSON."); }
    if (typeof input.company === "string" && input.company.trim()) return reply({ reference: "LOKD-RECEIVED" }, 202);

    const organisationName = clean(input.organisationName, "Organisation name", 2, 120);
    const contactName = clean(input.contactName, "Contact name", 3, 100);
    const emailNormalized = email(input.email);
    const mobileNormalized = mobile(input.mobile);
    const siteArea = clean(input.siteArea, "Site area", 2, 100);
    const siteType = clean(input.siteType, "Site type", 3, 40);
    if (!siteTypes.has(siteType)) throw new EnquiryError("Choose a valid site type.");
    const requiredStart = clean(input.requiredStart, "Required start", 3, 40);
    if (!startWindows.has(requiredStart)) throw new EnquiryError("Choose a valid planning window.");
    const serviceType = typeof input.serviceType === "string" && input.serviceType
      ? clean(input.serviceType, "Security service", 3, 60)
      : "scheduled_unarmed_fixed_site";
    if (!serviceTypes.has(serviceType)) throw new EnquiryError("Choose a valid security service.");
    const message = clean(input.message, "Site brief", 20, 2_000);
    if (input.advanceFundingAcknowledged !== true) throw new EnquiryError("Confirm that LOKD offers no credit terms and requires cleared advance funding.");
    if (input.privacyConsent !== true) throw new EnquiryError("Consent is required to save and respond to this enquiry.");

    const db = database??getDb();
    const existing = await db.prepare(`SELECT id FROM client_enquiries
      WHERE email_normalized = ? AND organisation_name = ?
        AND environment = 'prelaunch' AND integrity_state = 'user_submitted'
        AND datetime(created_at, '+24 hours') >= datetime('now') LIMIT 1`)
      .bind(emailNormalized, organisationName).first<{ id: string }>();
    if (existing) return reply({ reference: "LOKD-RECEIVED" }, 202);

    const now = new Date();
    const nowIso = now.toISOString();
    const retention = new Date(now);
    retention.setUTCFullYear(retention.getUTCFullYear() + 1);
    const id = `ENQ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    await db.batch([
      db.prepare(`INSERT INTO client_enquiries
        (id, organisation_name, contact_name, email_normalized, mobile_normalized, site_area,
         site_type, required_start, message, service_type, funding_model, credit_terms_days,
         privacy_notice_version, privacy_acknowledged_at, status, owner_id, resolution,
         environment, integrity_state, retention_review_at, created_at, updated_at, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'advance_only', 0,
         ?, ?, 'new', NULL, NULL, 'prelaunch', 'user_submitted', ?, ?, ?, 1)`)
        .bind(id, organisationName, contactName, emailNormalized, mobileNormalized, siteArea,
          siteType, requiredStart, message, serviceType, privacyNoticeVersion, nowIso, retention.toISOString(), nowIso, nowIso),
      db.prepare(`INSERT INTO audit_events
        (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
        VALUES (?, 'client_enquiry', ?, 'public_client_enquiry_submitted', 'client_enquiry', ?,
         'A public service enquiry was received. No quotation, booking, credit or deployment was created.', ?)`)
        .bind(`AUD-${crypto.randomUUID()}`, id, id, nowIso),
    ]);
    return reply({ reference: id }, 202);
  } catch (cause) { return failure(cause); }
}

export async function POST(request:Request){return submitClientEnquiry(request);}

export async function GET(request: Request) {
  try {
    requireSignedInOperations(request);
    const result = await getDb().prepare(`SELECT id, organisation_name AS organisationName,
      contact_name AS contactName, email_normalized AS email, mobile_normalized AS mobile,
      site_area AS siteArea, site_type AS siteType, required_start AS requiredStart,
      service_type AS serviceType, message, status, owner_id AS ownerId, resolution, created_at AS createdAt,
      updated_at AS updatedAt, version FROM client_enquiries
      WHERE environment = 'prelaunch' AND integrity_state = 'user_submitted'
      ORDER BY CASE status WHEN 'new' THEN 1 WHEN 'triaged' THEN 2 ELSE 3 END, created_at DESC LIMIT 100`)
      .all<Record<string, unknown>>();
    return reply({ enquiries: result.results ?? [] });
  } catch (cause) { return failure(cause); }
}

export async function PATCH(request: Request) {
  try {
    requireSameOriginJson(request);
    const actor = requireSignedInOperations(request);
    const raw = await request.text();
    if (raw.length > 4_000) throw new EnquiryError("The update is too large.", 413);
    let input: Record<string, unknown>;
    try { input = JSON.parse(raw) as Record<string, unknown>; }
    catch { throw new EnquiryError("The update body is not valid JSON."); }
    const id = clean(input.id, "Enquiry reference", 5, 80);
    const action = clean(input.action, "Action", 4, 20);
    const version = typeof input.version === "number" && Number.isSafeInteger(input.version) ? input.version : 0;
    if (version < 1) throw new EnquiryError("Refresh the enquiry before updating it.", 409);
    const current = await getDb().prepare(`SELECT updated_at AS updatedAt FROM client_enquiries
      WHERE id=? AND version=? AND environment='prelaunch' AND integrity_state='user_submitted'`)
      .bind(id, version).first<{ updatedAt: string }>();
    if (!current) throw new EnquiryError("That enquiry changed. Refresh before trying again.", 409);
    // Consecutive valid reviews may share a clock millisecond. Preserve the
    // database's strictly increasing audit timestamp without asking for a retry.
    const now = new Date(Math.max(Date.now(), Date.parse(current.updatedAt) + 1)).toISOString();
    let result: D1Result<unknown>;
    if (action === "triage") {
      result = await getDb().prepare(`UPDATE client_enquiries SET status='triaged', owner_id=?,
        updated_at=?, version=version+1 WHERE id=? AND status='new' AND version=?
        AND environment='prelaunch' AND integrity_state='user_submitted'`)
        .bind(actor.email, now, id, version).run();
    } else if (action === "close") {
      const resolution = clean(input.resolution, "Resolution", 3, 600);
      result = await getDb().prepare(`UPDATE client_enquiries SET status='closed', owner_id=?,
        resolution=?, updated_at=?, version=version+1 WHERE id=? AND status IN ('new','triaged') AND version=?
        AND environment='prelaunch' AND integrity_state='user_submitted'`)
        .bind(actor.email, resolution, now, id, version).run();
    } else throw new EnquiryError("Choose a valid enquiry action.");
    if (!result.meta.changes) throw new EnquiryError("That enquiry changed. Refresh before trying again.", 409);
    await getDb().prepare(`INSERT INTO audit_events
      (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
      VALUES (?, 'operations', ?, 'client_enquiry_reviewed', 'client_enquiry', ?, ?, ?)`)
      .bind(`AUD-${crypto.randomUUID()}`, actor.email, id, `Enquiry ${action} recorded by Operations.`, now).run();
    return reply({ ok: true });
  } catch (cause) { return failure(cause); }
}
