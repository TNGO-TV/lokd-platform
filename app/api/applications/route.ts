import {agreementHash} from '../../lib/agreement-acceptance';
import {officerApiActor,requireOfficerJson,OfficerAccessError} from '../../lib/officer-api-access';
import {officerEmailStatement,deliverOfficerEmail} from '../../lib/officer-email';
import {SignupError,writeSignup} from '../../lib/signup-server';
import {readRequestText, RequestBodyError} from '../../lib/request-body';
import { applicationPsiraDeclaration, officerAvailability, renewalStatuses, psiraIntakeStatus } from '../../lib/psira-pathway';
import { psiraNumber as validatePsiraNumber } from '../../lib/psira-verification';
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
  requestKey?: unknown;
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
  entryPath?: unknown;
  availability?: unknown;
  renewalStatus?: unknown;
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
  const error = cause instanceof ApplicationError || cause instanceof RequestBodyError || cause instanceof OfficerAccessError || cause instanceof SignupError
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

export async function GET(request:Request){
 try{
  officerApiActor(request,true);
  const db=getDb();
  const result=await db.prepare(`SELECT a.id,a.pathway,a.full_name AS fullName,a.mobile_normalized AS mobile,
   a.email_normalized AS email,a.city,a.province,a.psira_status AS psiraStatus,a.psira_number AS psiraNumber,
   a.psira_grade AS psiraGrade,a.service_interests AS services,a.purpose_interests AS purposes,
   a.training_interests AS training,a.identity_verification_status AS identityStatus,
   coalesce(c.status,a.status) AS status,coalesce(c.version,0) AS version,a.source,a.created_at AS createdAt,
   a.updated_at AS updatedAt,coalesce(p.availability,'[]') AS availability,p.renewal_status AS renewalStatus,
   CASE WHEN er.id IS NOT NULL THEN 'requested' ELSE NULL END AS enrolmentStatus,er.created_at AS enrolmentRequestedAt,n.state AS confirmationEmailStatus,n.last_error AS confirmationEmailError
   FROM officer_applications a LEFT JOIN signup_cases c ON c.kind='officer' AND c.source_id=a.id
   LEFT JOIN officer_application_preferences p ON p.application_id=a.id
   LEFT JOIN officer_email_outbox n ON n.id='application-confirmation:'||a.id
   LEFT JOIN officer_work_notifications er ON er.id='enrolment:'||a.id||':'||c.version||':'||c.owner_user_id AND er.kind='enrolment_request'
   WHERE a.environment='production' AND a.integrity_state='user_submitted'
   ORDER BY a.created_at DESC LIMIT 100`).all<{pathway:string;psiraStatus:string;services:string;purposes:string;training:string;availability:string}>();
  return response({applications:result.results.map(item=>({...item,availability:JSON.parse(item.availability),services:JSON.parse(item.services),purposes:JSON.parse(item.purposes),training:JSON.parse(item.training),psiraVerificationRequired:applicationPsiraDeclaration(item.pathway,item.psiraStatus)==='registered'}))});
 }catch(error){return responseError(error);}
}
export async function PATCH(request:Request){
 try{
  requireOfficerJson(request);const actor=officerApiActor(request,true),db=getDb();
  let input;try{input=JSON.parse(await readRequestText(request,4000));}catch{throw new ApplicationError('Submit a valid application action.');}
  if(!input||typeof input!=='object'||Array.isArray(input))throw new ApplicationError('Choose an application.');
  const id=cleanText(input.id,'Application reference',8,100);
  if(input.action==='retry_confirmation'){
   const source=await db.prepare("SELECT id FROM officer_applications WHERE id=? AND environment='production' AND integrity_state='user_submitted'").bind(id).first();
   if(!source)throw new ApplicationError('Application not found.',404);
   const delivery=await deliverOfficerEmail(db,env,'application-confirmation:'+id);
   return response(delivery,delivery.sent?200:503);
  }
  if(input.action!=='review')throw new ApplicationError('Choose a valid application review action.');
  await writeSignup(db,actor,{kind:'officer',id,action:'review',expectedVersion:input.expectedVersion,status:input.status,note:input.note});
  return response({saved:true,id});
 }catch(error){return responseError(error);}
}

export async function submitOfficerApplication(request: Request, database?:D1Database) {
  try {
    requireOfficerJson(request);
    const raw = await readRequestText(request, 16_000);
    let input: ApplicationInput;
    try { input = JSON.parse(raw) as ApplicationInput; }
    catch { throw new ApplicationError("The application body is not valid JSON."); }
    if(!input||typeof input!=='object'||Array.isArray(input))throw new ApplicationError("The application body must be an object.");
    if (typeof input.company === "string" && input.company.trim()) return response({ received:true },202);

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
    const entryPath = input.entryPath;
    if (entryPath !== undefined && entryPath !== 'registered' && entryPath !== 'new') throw new ApplicationError('Choose a valid application route.');
    if (entryPath === 'registered' && (pathway !== 'qualified' || !['active','expired'].includes(psiraStatus)) || entryPath === 'new' && (pathway !== 'training' || !['not_registered','in_training'].includes(psiraStatus))) throw new ApplicationError('Choose the registration status that matches your application route.');
    const declaration = applicationPsiraDeclaration(pathway, psiraStatus);
    const psiraRequired = declaration === 'registered';
    let psiraNumber: string | null = null;
    if (psiraRequired) {
      try { psiraNumber = validatePsiraNumber(input.psiraNumber); }
      catch { throw new ApplicationError('Enter your numeric PSiRA number. Verification is mandatory for registered-officer applications.'); }
    }
    const requestedGrade = typeof input.psiraGrade === 'string' ? input.psiraGrade.trim() : '';
    const psiraGrade = psiraRequired && grades.has(requestedGrade) ? requestedGrade : null;
    if (entryPath === 'registered' && !psiraGrade) throw new ApplicationError('Choose your highest PSIRA grade, A to E.');
    const hasPreferences = entryPath !== undefined || input.availability !== undefined || input.renewalStatus !== undefined;
    const availability = input.availability === undefined || Array.isArray(input.availability) && input.availability.length === 0 ? [] : allowedList(input.availability, new Set<string>(officerAvailability), 'Availability', officerAvailability.length);
    if (Array.isArray(input.availability) && input.availability.some(value => typeof value !== 'string' || !officerAvailability.includes(value as typeof officerAvailability[number]))) throw new ApplicationError('Choose a valid availability option.');
    if (entryPath === 'registered' && !availability.length) throw new ApplicationError('Choose at least one availability option.');
    const renewalStatus = psiraStatus === 'expired' && typeof input.renewalStatus === 'string' ? input.renewalStatus : null;
    if (renewalStatus && !renewalStatuses.some(([status]) => status === renewalStatus) || entryPath === 'registered' && psiraStatus === 'expired' && !renewalStatus) throw new ApplicationError('Choose your renewal status.');
    const services = allowedList(input.services, serviceOptions, "Work category", 3);
    const purposes = allowedList(input.purposes, purposeOptions, "Work environment", 7);
    const training = pathway === "training" ? allowedList(input.training, trainingOptions, "Training area", 5) : [];
    if (input.over18Confirmed !== true) throw new ApplicationError("You must confirm that you are at least 18 years old.");
    if (input.eligibilityAcknowledged !== true) throw new ApplicationError("Confirm that you understand the PSiRA eligibility requirements.");
    if (input.contactConsent !== true) throw new ApplicationError("Consent is required to save and respond to this application.");

    const db = database??getDb();
    const requestKey=input.requestKey;
    if(requestKey!==undefined&&(typeof requestKey!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey)))throw new ApplicationError('Use a valid application submission key.');
    const keyHash=typeof requestKey==='string'?await agreementHash('officer-application:'+requestKey.toLowerCase()):null;
    const payloadHash=await agreementHash(JSON.stringify({pathway,fullName,mobile,email,city,province,psiraStatus,psiraNumber,psiraGrade,services,purposes,training,over18Confirmed:true,eligibilityAcknowledged:true,contactConsent:true,privacyNoticeVersion,...(hasPreferences?{entryPath,availability,renewalStatus}:{})}));
    const savedReceipt=(reference:string)=>response({saved:true,reference,psiraVerificationRequired:psiraRequired,pathwayStatus:psiraIntakeStatus(declaration)},202);
    const recover=async()=>{
      if(!keyHash)return null;
      const receipt=await db.prepare('SELECT payload_hash,application_id FROM officer_application_receipts WHERE request_key_hash=?').bind(keyHash).first<{payload_hash:string;application_id:string}>();
      if(!receipt)return null;
      if(receipt.payload_hash!==payloadHash)throw new ApplicationError('This submission key already binds different application details. Keep the original request; changed details require a new key.',409);
      return savedReceipt(receipt.application_id);
    };
    const recovered=await recover();if(recovered){const receipt=await db.prepare('SELECT application_id FROM officer_application_receipts WHERE request_key_hash=?').bind(keyHash).first<{application_id:string}>();if(receipt)await deliverOfficerEmail(db,env,'application-confirmation:'+receipt.application_id);return recovered;}
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
       'production', 'user_submitted', ?, 'homepage', ?, ?, ?)`)
      .bind(id, pathway, fullName, mobile, email, city, province, psiraStatus, psiraNumber, psiraGrade,
        JSON.stringify(services), JSON.stringify(purposes), JSON.stringify(training), privacyNoticeVersion, nowIso,
        psiraIntakeStatus(declaration), retentionReview.toISOString(), nowIso, nowIso);

    const audit = db.prepare(`INSERT INTO audit_events
      (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
      VALUES (?, 'applicant', ?, 'officer_interest_submitted', 'officer_application', ?, ?, ?)`)
      .bind(`AUD-${crypto.randomUUID()}`, id, id, "Homepage work, purpose and training interests received; identity and credentials remain unverified.", nowIso);
    // D1 batches are atomic: never acknowledge an unaudited or partially saved intake.
    const confirmationId='application-confirmation:'+id;
    const writes=[application,audit,officerEmailStatement(db,{id:confirmationId,applicationId:id,recipient:email,
      subject:'We received your LOKD application',
      text:`Hello ${fullName},\n\nThank you for applying to LOKD. Your application reference is ${id}.\n\nOpen the Officer Zone with this email address to follow your application, complete your identity check and submit your PSIRA details:\nhttps://officers.lokd.co.za/officer\n\n${psiraStatus==='expired'?'LOKD can help with PSIRA renewal and refresher training. Your registration must be current and all required checks complete before work is offered.':'Our team will review your application and contact you about the next step.'}\n\nLOKD Security`})];
    if(hasPreferences)writes.push(db.prepare('INSERT INTO officer_application_preferences(application_id,availability,renewal_status,created_at) VALUES(?,?,?,?)').bind(id,JSON.stringify(availability),renewalStatus,nowIso));
    if(keyHash)writes.push(db.prepare('INSERT INTO officer_application_receipts(request_key_hash,payload_hash,application_id,created_at) VALUES(?,?,?,?)').bind(keyHash,payloadHash,id,nowIso));
    try{await db.batch(writes);}catch(cause){const concurrent=await recover();if(concurrent)return concurrent;throw cause;}
    await deliverOfficerEmail(db,env,confirmationId);
    return savedReceipt(id);
  } catch (cause) {
    return responseError(cause);
  }
}

export async function POST(request:Request){return submitOfficerApplication(request);}
