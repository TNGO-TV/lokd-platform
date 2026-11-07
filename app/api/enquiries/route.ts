import {workspaceCommandReceipt} from '../../lib/workspace-command-receipt';
import {readRequestText, RequestBodyError} from '../../lib/request-body';
import { env } from "cloudflare:workers";
import { agreementHash } from "../../lib/agreement-acceptance";
import { operationsMfaStatus } from "../../lib/operations-mfa";
import { deliverEnquiryEmails } from "../../lib/signup-enquiry-delivery";
import { operationsEmailAllowed } from "../../lib/signup-access";
import { workspaceRoleForHost } from "../../lib/public-site";
import { BookingRequestError, publicBooking, validateBookingStart } from "../../lib/public-booking";
import type { OperationalRuntime } from "../../lib/operational-provider";

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
  const error = cause instanceof EnquiryError || cause instanceof RequestBodyError || cause instanceof BookingRequestError
    ? cause : new EnquiryError("We could not complete that enquiry request.", 500);
  if (cause instanceof Error && cause.message.includes('public_enquiry_rate_limited')) return reply({error:'Too many enquiries. Please wait an hour before sending another request.'},429);
  return reply({ error: error.message }, error.status);
}

function requireSameOriginJson(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new EnquiryError('Use application/json for this request.',415);
  const origin=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
  if (origin !== new URL(request.url).origin || site && !['same-origin','none'].includes(site)) throw new EnquiryError('Open this form on the LOKD website and try again.',403);
}
function requireSignedInOperations(request: Request) {
  const userId=request.headers.get('x-lokd-verified-user-id'),email=request.headers.get('x-lokd-verified-email');
  if (!userId || !email) throw new EnquiryError('Sign in to Operations to continue.',401);
  const runtime=env as unknown as Record<string,string|undefined>;
  const hostRole=workspaceRoleForHost(new URL(request.url).hostname);
  if (hostRole && hostRole !== 'operations') throw new EnquiryError('Open the Operations workspace to continue.',403);
  if (!operationsEmailAllowed(email,runtime)) throw new EnquiryError('Operations access is required.',403);
  if (!operationsMfaStatus(request.headers).fresh) throw new EnquiryError('Verify your Operations second factor at /ops/security.',403);
  return {userId,email};
}
function scheduleDetails(input:Record<string,unknown>) {
  // Existing integrations can submit an initial brief; website submissions include the full schedule.
  const keys=['siteAddress','startDate','endDate','startTime','endTime','officers','schedule'];
  if (!keys.some(key=>input[key]!==undefined)) return null;
  const siteAddress=clean(input.siteAddress,'Site address',5,200);
  const date=(value:unknown,label:string)=>{
    const text=clean(value,label,10,10),stamp=Date.parse(text+'T00:00:00Z');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==text)throw new EnquiryError(label+' is not a valid date.');
    return text;
  };
  const startDate=date(input.startDate,'Start date'),endDate=date(input.endDate,'End date');
  if(endDate<startDate)throw new EnquiryError('The end date must be on or after the start date.');
  const time=(value:unknown,label:string)=>{const text=clean(value,label,5,5);if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text))throw new EnquiryError(label+' is not valid.');return text;};
  const startTime=time(input.startTime,'Shift start'),endTime=time(input.endTime,'Shift end');
  const officers=input.officers;
  if(typeof officers!=='number'||!Number.isSafeInteger(officers)||officers<1||officers>100)throw new EnquiryError('Choose between 1 and 100 officers per shift.');
  const schedule=clean(input.schedule,'Schedule',3,60);
  if(!['Single shift','Every day in this period','Weekdays in this period','Selected days — described below'].includes(schedule))throw new EnquiryError('Choose a valid schedule.');
  return {siteAddress,startDate,endDate,startTime,endTime,officers,schedule};
}

export async function submitClientEnquiry(request: Request,database?:D1Database,options:{runtime?:OperationalRuntime;transport?:typeof fetch}={}) {
  try {
    requireSameOriginJson(request);
    const raw = await readRequestText(request, 14_000);
    let input: Record<string, unknown>;
    try { input = JSON.parse(raw) as Record<string, unknown>; }
    catch { throw new EnquiryError("The enquiry body is not valid JSON."); }
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new EnquiryError("The enquiry body must be an object.");
    if (typeof input.company === "string" && input.company.trim()) return reply({ received: true }, 202);

    const organisationName = clean(input.organisationName, "Organisation name", 2, 120);
    const contactName = clean(input.contactName, "Contact name", 3, 100);
    const emailNormalized = email(input.email);
    const mobileNormalized = mobile(input.mobile);
    const siteArea = clean(input.siteArea, "Site area", 2, 100);
    const siteType = clean(input.siteType, "Site type", 3, 40);
    if (!siteTypes.has(siteType)) throw new EnquiryError("Choose a valid site type.");
    const submittedAt = new Date();
    const booking = publicBooking(input, submittedAt);
    const daysUntilStart = booking ? (Date.parse(booking.startsAt) - submittedAt.getTime()) / 86_400_000 : 0;
    const requiredStart = booking ? daysUntilStart <= 30 ? "within_30_days" : daysUntilStart <= 90 ? "one_to_three_months" : daysUntilStart <= 180 ? "three_to_six_months" : "planning" : clean(input.requiredStart, "Required start", 3, 40);
    if (!startWindows.has(requiredStart)) throw new EnquiryError("Choose a valid planning window.");
    const serviceType = typeof input.serviceType === "string" && input.serviceType
      ? clean(input.serviceType, "Security service", 3, 60)
      : "scheduled_unarmed_fixed_site";
    if (!serviceTypes.has(serviceType)) throw new EnquiryError("Choose a valid security service.");
    const schedule = booking?.schedule ?? scheduleDetails(input);
    const message = booking
      ? clean(`Booking request: LOKD ${booking.engagementModel === "fixed" ? "Fixed" : "Flex"}. Site address: ${booking.schedule.siteAddress}. Dates: ${booking.schedule.startDate} to ${booking.schedule.endDate}. Shift: ${booking.schedule.startTime} to ${booking.schedule.endTime} SAST (12 hours). Officers: ${booking.intent.officers}. Schedule: ${booking.schedule.schedule}. ${typeof input.message === "string" ? input.message : ""}`, "Site brief", 20, 2_000)
      : clean(input.message, "Site brief", 20, 2_000);
    if(schedule&&!mobileNormalized)throw new EnquiryError("A contact phone number is required.");
    if (input.advanceFundingAcknowledged !== true) throw new EnquiryError("Confirm that you understand submitting an enquiry does not confirm service until Operations reviews fit and commercial terms.");
    if (input.privacyConsent !== true) throw new EnquiryError("Consent is required to save and respond to this enquiry.");

    const db = database??getDb();
    const runtime=options.runtime??env as unknown as OperationalRuntime;
    const saved=async(id:string)=>{
      const delivery=await deliverEnquiryEmails(db,runtime,id,options.transport).catch(()=>({notificationStatus:'pending' as const,confirmationEmailSent:false,opsEmailSent:false}));
      return reply({saved:true,reference:id,...delivery},202);
    };
    // Contact details are not an ownership credential or an idempotency key.
    // Only possession of the random submission key can recover this exact receipt.
    const requestKey = input.requestKey;
    if(schedule&&requestKey===undefined)throw new EnquiryError("A submission key is required. Reload the form and try again.");
    if (requestKey !== undefined && (typeof requestKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey))) throw new EnquiryError('Use a valid enquiry submission key.');
    const keyHash = typeof requestKey === 'string' ? await agreementHash('client-enquiry:' + requestKey.toLowerCase()) : null;
    const payloadHash = await agreementHash(JSON.stringify({organisationName,contactName,emailNormalized,mobileNormalized,siteArea,siteType,requiredStart:booking?"booking":requiredStart,serviceType,message,privacyNoticeVersion,advanceFundingAcknowledged:true,privacyConsent:true,...(schedule?{schedule}: {}),...(booking?{booking:booking.intent}: {})}));
    const recover = async () => {
      if (!keyHash) return null;
      const receipt = await db.prepare('SELECT payload_hash,enquiry_id FROM client_enquiry_receipts WHERE request_key_hash=?').bind(keyHash).first<{payload_hash:string;enquiry_id:string}>();
      if (!receipt) return null;
      if (receipt.payload_hash !== payloadHash) throw new EnquiryError('This submission key was used with different enquiry details. Keep the original request and submit changed details with a new key.',409);
      return saved(receipt.enquiry_id);
    };
    const recovered = await recover();
    if (recovered) return recovered;
    if (booking) validateBookingStart(booking, submittedAt);
    if (schedule && schedule.startDate < new Date(Date.now() + 7200000).toISOString().slice(0,10)) throw new EnquiryError('Choose a start date from today onwards.');

    const now = new Date();
    const nowIso = now.toISOString();
    const retention = new Date(now);
    retention.setUTCFullYear(retention.getUTCFullYear() + 1);
    const id = `ENQ-${crypto.randomUUID().toUpperCase()}`;
    const ip=request.headers.get('cf-connecting-ip');
    const rateKeys=[{type:'public_enquiry_rate_email',value:emailNormalized},...(ip?[{type:'public_enquiry_rate_ip',value:ip}]:[])];
    const writes=[];
    for(const key of rateKeys){
      const hash=await agreementHash('public-enquiry-rate:'+key.type+':'+key.value);
      writes.push(db.prepare("INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) VALUES(?,'public',?,?,'client_enquiry',?,'Public enquiry admission',?)").bind('AUD-'+crypto.randomUUID(),hash,key.type,id,nowIso));
    }
    writes.push(
      db.prepare(`INSERT INTO client_enquiries
        (id, organisation_name, contact_name, email_normalized, mobile_normalized, site_area,
         site_type, required_start, message, service_type, funding_model, credit_terms_days,
         privacy_notice_version, privacy_acknowledged_at, status, owner_id, resolution,
         environment, integrity_state, retention_review_at, created_at, updated_at, version,site_address,start_date,end_date,start_time,end_time,officer_count,schedule,
         engagement_model,notice_window,calendar_type,risk_band,booking_details,internal_draft_price,booking_model,booking_model_version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'advance_only', 0,
         ?, ?, 'new', NULL, NULL, 'production', 'user_submitted', ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, organisationName, contactName, emailNormalized, mobileNormalized, siteArea,
          siteType, requiredStart, message, serviceType, privacyNoticeVersion, nowIso, retention.toISOString(), nowIso, nowIso,schedule?.siteAddress??null,schedule?.startDate??null,schedule?.endDate??null,schedule?.startTime??null,schedule?.endTime??null,schedule?.officers??null,schedule?.schedule??null,
          booking?(booking.engagementModel==='fixed'?'fixed':'flex'):null,booking?.noticeWindow??null,booking?.calendarType??null,booking?.riskBand??null,booking?JSON.stringify(booking.intent):null,booking?JSON.stringify(booking.draftPrice):null,booking?.engagementModel??null,booking?.modelVersion??null),
      db.prepare(`INSERT INTO audit_events
        (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
        VALUES (?, 'client_enquiry', ?, 'public_client_enquiry_submitted', 'client_enquiry', ?,
         'A public service enquiry was received. No quotation, booking, credit or deployment was created.', ?)`)
        .bind(`AUD-${crypto.randomUUID()}`, id, id, nowIso),
    );
    if (keyHash) writes.push(db.prepare('INSERT INTO client_enquiry_receipts(request_key_hash,payload_hash,enquiry_id,created_at) VALUES(?,?,?,?)').bind(keyHash,payloadHash,id,nowIso));
    try { await db.batch(writes); }
    catch (cause) {
      // D1 batch is atomic: a concurrent key winner rolls back this whole copy,
      // including its audit event. Return only an exact matching stored receipt.
      const concurrent = await recover();
      if (concurrent) return concurrent;
      throw cause;
    }
    return saved(id);
  } catch (cause) { return failure(cause); }
}

export async function POST(request:Request){return submitClientEnquiry(request);}

export async function GET(request: Request) {
  try {
    requireSignedInOperations(request);
    const selectedId = new URL(request.url).searchParams.get("id");
    const enquiryId = selectedId === null ? null : clean(selectedId, "Enquiry reference", 5, 80);
    const query = getDb().prepare(`SELECT id, organisation_name AS organisationName,
      contact_name AS contactName, email_normalized AS email, mobile_normalized AS mobile,
      site_area AS siteArea, site_type AS siteType, required_start AS requiredStart,
      service_type AS serviceType, message, status, owner_id AS ownerId, resolution, created_at AS createdAt,
      updated_at AS updatedAt, version,site_address AS siteAddress,start_date AS startDate,end_date AS endDate,
      start_time AS startTime,end_time AS endTime,officer_count AS officers,schedule,
      COALESCE(booking_model,engagement_model) AS engagementModel,notice_window AS noticeWindow,calendar_type AS calendarType,risk_band AS riskBand,
      booking_details AS bookingDetails,internal_draft_price AS internalDraftPrice,
      (SELECT state FROM operational_delivery_jobs j WHERE j.kind='enquiry_email' AND j.source_id=client_enquiries.id) AS emailStatus,
      (SELECT last_error FROM operational_delivery_jobs j WHERE j.kind='enquiry_email' AND j.source_id=client_enquiries.id) AS emailError
      FROM client_enquiries
      WHERE environment = 'production' AND integrity_state = 'user_submitted'
      ${enquiryId ? "AND id=?" : ""}
      ORDER BY CASE status WHEN 'new' THEN 1 WHEN 'triaged' THEN 2 ELSE 3 END, created_at DESC LIMIT 100`);
    const result = await (enquiryId ? query.bind(enquiryId) : query).all<Record<string, unknown>>();
    return reply({ enquiries: result.results ?? [] });
  } catch (cause) { return failure(cause); }
}

export async function PATCH(request: Request) {
  try {
    requireSameOriginJson(request);
    const actor = requireSignedInOperations(request);
    const raw = await readRequestText(request, 4_000);
    let input: Record<string, unknown>;
    try { input = JSON.parse(raw) as Record<string, unknown>; }
    catch { throw new EnquiryError("The update body is not valid JSON."); }
    const id = clean(input.id, "Enquiry reference", 5, 80);
    const action = clean(input.action, "Action", 4, 20);
    if(action==='retry_email'){
      const delivery=await deliverEnquiryEmails(getDb(),env as unknown as OperationalRuntime,id);
      await getDb().prepare("INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) VALUES(?,'operations',?,'enquiry_email_retry','client_enquiry',?,?,?)").bind('AUD-'+crypto.randomUUID(),actor.email,id,delivery.notificationStatus,new Date().toISOString()).run();
      return reply({ok:true,...delivery,commandReceipt:await workspaceCommandReceipt('client-enquiries',input)});
    }
    const version = typeof input.version === "number" && Number.isSafeInteger(input.version) ? input.version : 0;
    if (version < 1) throw new EnquiryError("Refresh the enquiry before updating it.", 409);
    const current = await getDb().prepare(`SELECT updated_at AS updatedAt FROM client_enquiries
      WHERE id=? AND version=? AND environment='production' AND integrity_state='user_submitted'`)
      .bind(id, version).first<{ updatedAt: string }>();
    if (!current) throw new EnquiryError("That enquiry changed. Refresh before trying again.", 409);
    // Consecutive valid reviews may share a clock millisecond. Preserve the
    // database's strictly increasing audit timestamp without asking for a retry.
    const now = new Date(Math.max(Date.now(), Date.parse(current.updatedAt) + 1)).toISOString();
    let update: D1PreparedStatement;
    if (action === "triage") {
      update = getDb().prepare(`UPDATE client_enquiries SET status='triaged', owner_id=?,
        updated_at=?, version=version+1 WHERE id=? AND status='new' AND version=?
        AND environment='production' AND integrity_state='user_submitted'`)
        .bind(actor.email, now, id, version);
    } else if (action === "close") {
      const resolution = clean(input.resolution, "Resolution", 3, 600);
      update = getDb().prepare(`UPDATE client_enquiries SET status='closed', owner_id=?,
        resolution=?, updated_at=?, version=version+1 WHERE id=? AND status IN ('new','triaged') AND version=?
        AND environment='production' AND integrity_state='user_submitted'`)
        .bind(actor.email, resolution, now, id, version);
    } else throw new EnquiryError("Choose a valid enquiry action.");
    const results=await getDb().batch([update,getDb().prepare(`INSERT INTO audit_events
      (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
      SELECT ?, 'operations', ?, 'client_enquiry_reviewed', 'client_enquiry', ?, ?, ? WHERE changes()=1`)
      .bind(`AUD-${crypto.randomUUID()}`, actor.email, id, `Enquiry ${action} recorded by Operations.`, now)]);
    if (!results[0].meta.changes) throw new EnquiryError("That enquiry changed. Refresh before trying again.", 409);
    return reply({ok:true,commandReceipt:await workspaceCommandReceipt('client-enquiries',input)});
  } catch (cause) { return failure(cause); }
}
