import { env } from "cloudflare:workers";
import { agreementHash } from "../../lib/agreement-acceptance";
import { OfficerAccessError, officerApiActor, requireOfficerJson } from "../../lib/officer-api-access";
import { officerEmailStatement } from "../../lib/officer-email";
import { deliverTrainingBookingEmails } from "../../lib/operational-delivery";
import { readRequestText, RequestBodyError } from "../../lib/request-body";
import { currentIntakeMonth, trainingCourse, trainingIdStatuses, trainingPsiraStatuses } from "../../lib/training-courses";
import { readTrainingBookings } from "../../lib/training-bookings";

export const dynamic = "force-dynamic";
const privacyVersion = "training-booking-2026-11-07-v1";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class TrainingError extends Error { readonly status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }
const response = (payload: unknown, status = 200) => Response.json(payload, { status, headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", vary: "x-lokd-verified-email" } });
function fail(cause: unknown) {
  const error = cause instanceof TrainingError || cause instanceof RequestBodyError || cause instanceof OfficerAccessError ? cause : new TrainingError("We could not complete your training request. Retry the original request to check its status.", 500);
  return response({ error: error.message }, error.status);
}
function database() { if (!env.DB) throw new TrainingError("Training bookings are temporarily unavailable. Please try again.", 503); return env.DB; }
function text(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "string") throw new TrainingError(`${label} is required.`);
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (cleaned.length < min || cleaned.length > max) throw new TrainingError(`Enter a valid ${label.toLowerCase()}.`);
  return cleaned;
}
async function body(request: Request) {
  const raw = await readRequestText(request, 8_000);
  let input: unknown;
  try { input = JSON.parse(raw); } catch { throw new TrainingError("Submit a valid training request."); }
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TrainingError("Submit a valid training request.");
  return input as Record<string, unknown>;
}

export async function submitTrainingBooking(request: Request, suppliedDb?: D1Database) {
  try {
    requireOfficerJson(request);
    const input = await body(request);
    if (typeof input.company === "string" && input.company.trim()) return response({ received: true }, 202);
    const course = trainingCourse(input.course);
    if (!course) throw new TrainingError("Choose a valid training course.");
    const preferredIntakeMonth = text(input.preferredIntakeMonth, "Preferred intake month", 7, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(preferredIntakeMonth) || preferredIntakeMonth < currentIntakeMonth() || Number(preferredIntakeMonth.slice(0, 4)) > new Date().getUTCFullYear() + 3) throw new TrainingError("Choose a current or future intake month within the next three years.");
    const fullName = text(input.fullName, "Full name", 3, 100);
    const digits = text(input.mobile, "Mobile number", 9, 24).replace(/\D/g, "");
    const mobile = /^0\d{9}$/.test(digits) ? "+27" + digits.slice(1) : /^27\d{9}$/.test(digits) ? "+" + digits : null;
    if (!mobile) throw new TrainingError("Enter a valid South African mobile number.");
    const email = text(input.email, "Email address", 5, 120).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new TrainingError("Enter a valid email address.");
    const idStatus = text(input.idStatus, "Identity document status", 3, 30);
    const psiraStatus = text(input.psiraStatus, "PSIRA status", 3, 30);
    if (!trainingIdStatuses.some(([id]) => id === idStatus)) throw new TrainingError("Choose a valid identity document status.");
    if (!trainingPsiraStatuses.some(([id]) => id === psiraStatus)) throw new TrainingError("Choose a valid PSIRA status.");
    if (input.consent !== true) throw new TrainingError("Consent is required to save and respond to your training request.");
    if (typeof input.requestKey !== "string" || !uuid.test(input.requestKey)) throw new TrainingError("Use a valid training request key.");
    const requestHash = await agreementHash("training-booking:" + input.requestKey.toLowerCase());
    const payloadHash = await agreementHash(JSON.stringify({ course: course.id, preferredIntakeMonth, fullName, mobile, email, idStatus, psiraStatus, consent: true, privacyVersion }));
    const db = suppliedDb ?? database();
    const receipt = async (reference: string) => {
      let delivery = { teamEmailSent: false, confirmationEmailSent: false };
      try { delivery = await deliverTrainingBookingEmails(db, env, reference); } catch { /* The committed request and queued notices remain available in Operations. */ }
      return response({ saved: true, reference, ...delivery }, 202);
    };
    const recover = async () => {
      const row = await db.prepare("SELECT id,payload_hash FROM training_bookings WHERE request_key_hash=?").bind(requestHash).first<{ id: string; payload_hash: string }>();
      if (!row) return null;
      if (row.payload_hash !== payloadHash) throw new TrainingError("This request key belongs to different details. Retry the original request or use a new request key for changes.", 409);
      return receipt(row.id);
    };
    const existing = await recover(); if (existing) return existing;
    const reference = "TRN-" + crypto.randomUUID().toUpperCase(), now = new Date(), stamp = now.toISOString();
    const retention = new Date(now); retention.setUTCFullYear(retention.getUTCFullYear() + 1);
    const writes = [
      db.prepare(`INSERT INTO training_bookings(id,request_key_hash,payload_hash,course,preferred_intake_month,full_name,mobile_normalized,email_normalized,id_status,psira_status,privacy_notice_version,consented_at,retention_review_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(reference, requestHash, payloadHash, course.id, preferredIntakeMonth, fullName, mobile, email, idStatus, psiraStatus, privacyVersion, stamp, retention.toISOString(), stamp),
      db.prepare("INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) VALUES(?,'applicant',?,'training_booking_requested','training_booking',?,?,?)").bind("AUD-" + crypto.randomUUID(), reference, reference, "Training request and privacy consent received. Intake dates and entry requirements require confirmation.", stamp),
      officerEmailStatement(db, { id: "training-team:" + reference, recipient: "training@lokd.co.za", subject: "New LOKD training booking request", text: `Training reference: ${reference}\nCourse: ${course.name}\nPreferred intake month: ${preferredIntakeMonth}\nApplicant: ${fullName}\nEmail: ${email}\nMobile: ${mobile}\nIdentity document status: ${idStatus}\nPSIRA status: ${psiraStatus}\n\nOpen the Operations Zone to review the request:\nhttps://operations.lokd.co.za/ops/training\n\nConfirm the entry requirements and intake dates with the applicant.` }),
      officerEmailStatement(db, { id: "training-confirmation:" + reference, recipient: email, subject: "Your LOKD training request", text: `Hello ${fullName},\n\nYour training request is with LOKD.\n\nTraining reference: ${reference}\nCourse: ${course.name}\nPreferred intake month: ${preferredIntakeMonth}\n\nOur training team will contact you to confirm entry requirements and available intake dates. Your booking is confirmed when the team confirms your course and intake.\n\nKeep this reference. Our training team will contact you using the details you provided.\n\nLOKD Security` }),
    ];
    try { await db.batch(writes); } catch (cause) { const recovered = await recover(); if (recovered) return recovered; throw cause; }
    return receipt(reference);
  } catch (cause) { return fail(cause); }
}
export async function POST(request: Request) { return submitTrainingBooking(request); }
export async function GET(request: Request) {
  try {
    officerApiActor(request, true);
    const raw = new URL(request.url).searchParams.get("offset") ?? "0";
    if (!/^\d{1,7}$/.test(raw) || Number(raw) > 1_000_000) throw new TrainingError("Choose a valid training booking page.");
    return response(await readTrainingBookings(database(), Number(raw)));
  } catch (cause) { return fail(cause); }
}
export async function PATCH(request: Request) {
  try {
    requireOfficerJson(request); officerApiActor(request, true);
    const input = await body(request), id = text(input.id, "Training reference", 40, 40);
    if (input.action !== "retry_emails" || !id.startsWith("TRN-") || !uuid.test(id.slice(4))) throw new TrainingError("Choose a valid training notification request.");
    const db = database();
    if (!await db.prepare("SELECT id FROM training_bookings WHERE id=?").bind(id).first()) throw new TrainingError("Training request not found.", 404);
    return response({ reference: id, ...await deliverTrainingBookingEmails(db, env, id) });
  } catch (cause) { return fail(cause); }
}
