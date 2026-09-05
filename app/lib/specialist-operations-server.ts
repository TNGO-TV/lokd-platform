import { ensureDemoOperator } from "./integration-server";
import { SPECIALIST_PRICING_VERSION, specialistProfiles, type SpecialistServiceCode } from "./specialist-pricing";
import { SPECIALIST_TERMS_VERSION, evaluateSpecialistPack, quoteFingerprint, requiredSpecialistChecks, runSpecialistRehearsals, specialistProductionBlockers } from "./specialist-operations-core";
import type { SpecialistAction, SpecialistBooking, SpecialistCommercialReview, SpecialistEnvironment, SpecialistOperationsState, SpecialistPack, SpecialistPackContent, SpecialistPartner, SpecialistScenarioResult } from "./specialist-operations-types";

export class SpecialistWorkflowError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status=status; }
}
type PackRow = Omit<SpecialistPack,"content"|"blockers"> & {content:string};
type PartnerRow = Omit<SpecialistPartner,"serviceCodes"> & {serviceCodes:string};
const stamp=()=>new Date().toISOString().replace(/\.\d{3}Z$/,".000Z");
const id=(prefix:string)=>`${prefix}-${crypto.randomUUID()}`;
const integrity=(environment:SpecialistEnvironment)=>environment==="demo"?"synthetic":"recorded";
function text(value:unknown,label:string,max=1000) {
  if(typeof value!=="string" || !value.trim() || value.trim().length>max) throw new SpecialistWorkflowError(`${label} is required (maximum ${max} characters).`);
  return value.trim();
}
function version(value:unknown) {
  if(!Number.isSafeInteger(value) || Number(value)<0) throw new SpecialistWorkflowError("Refresh the record before saving.",409);
  return Number(value);
}
function date(value:unknown,label:string) {
  const result=text(value,label,40); if(!Number.isFinite(Date.parse(result))) throw new SpecialistWorkflowError(`${label} must be a valid date.`);
  return new Date(result).toISOString();
}
function evidenceRef(value:unknown,environment:SpecialistEnvironment) {
  const result=text(value,"Evidence reference",500);
  if(environment==="production" && /demo:|synthetic|\.invalid\b|\.example\b/i.test(result)) throw new SpecialistWorkflowError("Synthetic evidence cannot support a production record.");
  return result;
}
async function rows<T>(db:D1Database,sql:string,...values:unknown[]) { return (await db.prepare(sql).bind(...values).all<T>()).results ?? []; }
async function mutate(statement:D1PreparedStatement) {
  const r=await statement.run(); if(r.meta.changes!==1) throw new SpecialistWorkflowError("This record changed or is no longer in the required state. Refresh before trying again.",409);
}

export async function readSpecialistBookings(db:D1Database,environment:SpecialistEnvironment) {
  return rows<SpecialistBooking>(db,`SELECT b.id,b.client_id AS clientId,b.site_name AS siteName,b.specialist_service_code AS serviceCode,
    b.specialist_configuration AS configuration,b.pricing_version AS pricingVersion,b.quote_subtotal_cents AS subtotalCents,
    b.vat_cents AS vatCents,b.client_price_cents AS totalCents,b.cost_floor_cents AS costFloorCents,b.margin_basis_points AS marginBasisPoints,
    b.headcount,b.environment,b.pricing_status AS pricingStatus,COALESCE(p.valid,0) AS pricingValid,
    COALESCE(c.assignment_plan_current,0) AS planCurrent,COALESCE(c.specialist_authority_current,0) AS authorityCurrent,
    COALESCE(c.funding_current,0) AS fundingCurrent,
    (SELECT MIN(starts_at) FROM roster_slots WHERE booking_id=b.id) AS startsAt,
    (SELECT MAX(ends_at) FROM roster_slots WHERE booking_id=b.id) AS endsAt
    FROM bookings b LEFT JOIN specialist_pricing_validation_v33 p ON p.id=b.id
    LEFT JOIN specialist_booking_control_validation_v33 c ON c.id=b.id
    WHERE b.environment=? AND b.specialist_service_code<>'standard_unarmed' ORDER BY b.rowid DESC LIMIT 200`,environment);
}

export async function readSpecialistState(db:D1Database,environment:SpecialistEnvironment,actorEmail:string):Promise<SpecialistOperationsState> {
  const [bookings,packRows,partnerRows,reviewRows,rehearsals,officers]=await Promise.all([
    readSpecialistBookings(db,environment),
    rows<PackRow>(db,`SELECT id,booking_id AS bookingId,status,version,content,quote_snapshot AS quoteSnapshot,prepared_by AS preparedBy,
      approved_by AS approvedBy,approved_at AS approvedAt,updated_at AS updatedAt FROM specialist_deployment_packs WHERE environment=? ORDER BY updated_at DESC LIMIT 200`,environment),
    rows<PartnerRow>(db,`SELECT id,name,service_codes AS serviceCodes,evidence_reference AS evidenceReference,valid_from AS validFrom,expires_at AS expiresAt,
      status,version,prepared_by AS preparedBy,approved_by AS approvedBy FROM specialist_partners WHERE environment=? ORDER BY name LIMIT 200`,environment),
    rows<SpecialistCommercialReview>(db,`SELECT id,status,version,evidence_reference AS evidenceReference,expires_at AS expiresAt,prepared_by AS preparedBy,approved_by AS approvedBy
      FROM specialist_commercial_reviews WHERE environment=? AND pricing_version=? AND terms_version=?`,environment,SPECIALIST_PRICING_VERSION,SPECIALIST_TERMS_VERSION),
    rows<{id:string;createdAt:string;runBy:string;scenarios:string}>(db,`SELECT id,created_at AS createdAt,run_by AS runBy,scenarios FROM specialist_rehearsal_runs WHERE environment=? ORDER BY created_at DESC LIMIT 5`,environment),
    rows<{id:string;name:string}>(db,`SELECT DISTINCT o.id,o.full_name AS name FROM officers o JOIN workforce_engagements w ON w.officer_id=o.id WHERE w.environment=? ORDER BY o.full_name LIMIT 300`,environment),
  ]);
  const partners=partnerRows.map(p=>({...p,serviceCodes:JSON.parse(p.serviceCodes) as SpecialistServiceCode[]}));
  const commercialReview=reviewRows[0]??null;
  const packs=packRows.map(p=>{
    const content=JSON.parse(p.content) as SpecialistPackContent;
    const booking=bookings.find(b=>b.id===p.bookingId);
    const blockers=booking?evaluateSpecialistPack(booking,content,{
      commercialCurrent:commercialReview?.status==="approved" && Date.parse(commercialReview.expiresAt)>Math.max(Date.now(),Date.parse(booking.endsAt??"")),
      partner:partners.find(x=>x.id===content.partnerId),quoteSnapshot:p.quoteSnapshot,
    }).blockers:["Linked booking is unavailable."];
    return {...p,content,blockers};
  });
  // The database is authoritative for snapshot versions and revoked approvals too.
  const validations=await rows<{id:string;valid:number}>(db,`SELECT id,valid FROM specialist_pack_validation_v34 WHERE environment=?`,environment);
  for(const pack of packs) if(!validations.some(v=>v.id===pack.id&&v.valid===1) && !pack.blockers.length) pack.blockers.push("An approval, supplier version, officer readiness or roster changed. Save and review this pack again.");
  return {environment,actorEmail,bookings,packs,partners,officers,commercialReview,
    rehearsals:rehearsals.map(r=>({...r,scenarios:JSON.parse(r.scenarios) as SpecialistScenarioResult[]})),productionBlockers:[...specialistProductionBlockers]};
}

async function requireActor(db:D1Database,actorEmail:string,environment:SpecialistEnvironment,review:boolean,amount=0) {
  const email=actorEmail.trim().toLowerCase();
  if(environment==="demo") await ensureDemoOperator(db,email);
  const actor=await db.prepare(`SELECT id,mfa_verified_at AS mfaAt,approval_limit_cents AS limitCents FROM operator_accounts
    WHERE lower(email)=? AND environment=? AND status='active' AND mfa_status='verified'`).bind(email,environment)
    .first<{id:string;mfaAt:string;limitCents:number}>();
  if(!actor) throw new SpecialistWorkflowError("An active named Operations account with verified MFA is required.",403);
  const assigned=await rows<{role:string}>(db,`SELECT role FROM operator_role_assignments WHERE operator_id=? AND environment=? AND status='active' AND revoked_at IS NULL`,actor.id,environment);
  const allowed=review?["operations_owner","compliance_reviewer"]:["operations_owner","operations_controller"];
  if(!assigned.some(r=>allowed.includes(r.role))) throw new SpecialistWorkflowError("Your Operations role cannot perform this action.",403);
  if(environment==="production") {
    const age=Date.now()-Date.parse(actor.mfaAt);
    if(!Number.isFinite(age)||age<0||age>15*60000) throw new SpecialistWorkflowError("Refresh Operations MFA within 15 minutes before this action.",403);
    if(review && actor.limitCents<amount) throw new SpecialistWorkflowError("This quote exceeds your approval limit.",403);
  }
  return email;
}

function normaliseContent(value:SpecialistPackContent,booking:SpecialistBooking,environment:SpecialistEnvironment):SpecialistPackContent {
  if(!value || typeof value!=="object" || !Array.isArray(value.officerIds)||!Array.isArray(value.checks)) throw new SpecialistWorkflowError("The deployment pack is incomplete.");
  if(value.officerIds.length>100 || value.checks.length>1000) throw new SpecialistWorkflowError("The deployment pack is too large.");
  const officerIds=[...new Set(value.officerIds.map(x=>text(x,"Officer",100)))];
  const content={commandOwner:typeof value.commandOwner==="string"?value.commandOwner.trim().slice(0,200):"",clientBrief:typeof value.clientBrief==="string"?value.clientBrief.trim().slice(0,4000):"",officerBrief:typeof value.officerBrief==="string"?value.officerBrief.trim().slice(0,8000):"",officerIds,partnerId:typeof value.partnerId==="string"?value.partnerId.trim().slice(0,100):"",checks:[] as SpecialistPackContent["checks"]};
  const allowed=new Set(requiredSpecialistChecks(booking,officerIds).map(x=>x.code));
  for(const check of value.checks) {
    if(!check||!allowed.has(check.code)||!check.reference) continue;
    if(content.checks.some(x=>x.code===check.code)) throw new SpecialistWorkflowError("Duplicate evidence entry.");
    content.checks.push({code:check.code,reference:evidenceRef(check.reference,environment),validFrom:check.validFrom?date(check.validFrom,"Evidence start"):"",expiresAt:check.expiresAt?date(check.expiresAt,"Evidence expiry"):""});
  }
  return content;
}

export async function applySpecialistAction(db:D1Database,environment:SpecialistEnvironment,actorEmail:string,action:SpecialistAction) {
  if(!action||typeof action!=="object"||typeof action.action!=="string") throw new SpecialistWorkflowError("Choose a specialist action.");
  const state=await readSpecialistState(db,environment,actorEmail);
  const review=action.action.startsWith("approve_") || action.action.startsWith("revoke_");
  const pack="id" in action?state.packs.find(p=>p.id===action.id):undefined;
  const booking=state.bookings.find(b=>b.id===("bookingId" in action?action.bookingId:pack?.bookingId));
  const actor=await requireActor(db,actorEmail,environment,review,booking?.totalCents??0);
  const now=stamp();
  if(action.action==="save_pack") {
    if(!booking) throw new SpecialistWorkflowError("Select an existing specialist booking in this environment.",404);
    const content=normaliseContent(action.content,booking,environment);
    if(content.officerIds.some(officer=>!state.officers.some(x=>x.id===officer))) throw new SpecialistWorkflowError("Every officer must have an engagement in this environment.");
    const partner=state.partners.find(p=>p.id===content.partnerId);
    if(content.partnerId&&!partner) throw new SpecialistWorkflowError("Select a partner from this environment.");
    const existing=state.packs.find(p=>p.bookingId===booking.id);
    if(existing) {
      await mutate(db.prepare(`UPDATE specialist_deployment_packs SET content=?,quote_snapshot=?,status='draft',version=version+1,
        prepared_by=?,approved_by=NULL,approved_at=NULL,commercial_review_id=?,commercial_review_version=?,partner_id=?,partner_version=?,updated_at=?
        WHERE id=? AND environment=? AND version=?`).bind(JSON.stringify(content),quoteFingerprint(booking),actor,state.commercialReview?.id??null,state.commercialReview?.version??0,partner?.id??null,partner?.version??0,now,existing.id,environment,version(action.version)));
    } else {
      if(version(action.version)!==0) throw new SpecialistWorkflowError("Refresh this booking before creating its pack.",409);
      await db.prepare(`INSERT INTO specialist_deployment_packs (id,booking_id,environment,integrity_state,status,version,content,quote_snapshot,commercial_review_id,commercial_review_version,partner_id,partner_version,prepared_by,updated_at)
        VALUES (?,?,?,?,'draft',1,?,?,?,?,?,?,?,?)`).bind(id("SP"),booking.id,environment,integrity(environment),JSON.stringify(content),quoteFingerprint(booking),state.commercialReview?.id??null,state.commercialReview?.version??0,partner?.id??null,partner?.version??0,actor,now).run();
    }
  } else if(action.action==="submit_pack" || action.action==="approve_pack" || action.action==="revoke_pack") {
    if(!pack||!booking) throw new SpecialistWorkflowError("Deployment pack not found.",404);
    const approving=action.action==="approve_pack";
    if(action.action!=="revoke_pack" && pack.blockers.length) throw new SpecialistWorkflowError(pack.blockers[0],409);
    if(approving && pack.preparedBy===actor) throw new SpecialistWorkflowError("A different named operator must review the pack.",403);
    const next=approving?"approved":action.action==="submit_pack"?"review":"revoked";
    await mutate(db.prepare(`UPDATE specialist_deployment_packs SET status=?,version=version+1,approved_by=?,approved_at=?,updated_at=?
      WHERE id=? AND environment=? AND version=? AND status=?`).bind(next,approving?actor:null,approving?now:null,now,pack.id,environment,version(action.version),approving?"review":next==="review"?"draft":pack.status));
  } else if(action.action==="submit_commercial") {
    const reference=evidenceRef(action.evidenceReference,environment); const expiresAt=date(action.expiresAt,"Review expiry");
    if(Date.parse(expiresAt)<=Date.now()) throw new SpecialistWorkflowError("Commercial approval must have a future expiry.");
    const current=state.commercialReview;
    if(current) await mutate(db.prepare(`UPDATE specialist_commercial_reviews SET status='review',version=version+1,evidence_reference=?,expires_at=?,prepared_by=?,approved_by=NULL,approved_at=NULL,updated_at=?
      WHERE id=? AND environment=? AND version=?`).bind(reference,expiresAt,actor,now,current.id,environment,version(action.version)));
    else {
      if(version(action.version)!==0) throw new SpecialistWorkflowError("Refresh the commercial review.",409);
      await db.prepare(`INSERT INTO specialist_commercial_reviews (id,environment,integrity_state,pricing_version,terms_version,status,version,evidence_reference,expires_at,prepared_by,updated_at)
        VALUES (?,?,?,?,?,'review',1,?,?,?,?)`).bind(id("SC"),environment,integrity(environment),SPECIALIST_PRICING_VERSION,SPECIALIST_TERMS_VERSION,reference,expiresAt,actor,now).run();
    }
  } else if(action.action==="approve_commercial" || action.action==="revoke_commercial") {
    const current=state.commercialReview; if(!current||current.id!==action.id) throw new SpecialistWorkflowError("Commercial review not found.",404);
    const approving=action.action==="approve_commercial";
    if(approving && current.preparedBy===actor) throw new SpecialistWorkflowError("A different named operator must approve the rate card and terms.",403);
    if(approving && Date.parse(current.expiresAt)<=Date.now()) throw new SpecialistWorkflowError("The review has expired.",409);
    await mutate(db.prepare(`UPDATE specialist_commercial_reviews SET status=?,version=version+1,approved_by=?,approved_at=?,updated_at=?
      WHERE id=? AND environment=? AND version=? AND status=?`).bind(approving?"approved":"revoked",approving?actor:null,approving?now:null,now,current.id,environment,version(action.version),approving?"review":current.status));
  } else if(action.action==="add_partner") {
    if(!Array.isArray(action.serviceCodes)||!action.serviceCodes.length||action.serviceCodes.some(c=>!Object.hasOwn(specialistProfiles,c)||c==="standard_unarmed")) throw new SpecialistWorkflowError("Select supported specialist services.");
    const from=date(action.validFrom,"Partner evidence start"),until=date(action.expiresAt,"Partner evidence expiry");
    if(Date.parse(from)>Date.now()||Date.parse(until)<=Date.now()) throw new SpecialistWorkflowError("Partner evidence must be current.");
    await db.prepare(`INSERT INTO specialist_partners (id,name,service_codes,environment,integrity_state,evidence_reference,valid_from,expires_at,status,version,prepared_by,updated_at)
      VALUES (?,?,?,?,?,?,?,?,'review',1,?,?)`).bind(id("SUP"),text(action.name,"Partner name",200),JSON.stringify([...new Set(action.serviceCodes)]),environment,integrity(environment),evidenceRef(action.evidenceReference,environment),from,until,actor,now).run();
  } else if(action.action==="approve_partner" || action.action==="revoke_partner") {
    const current=state.partners.find(p=>p.id===action.id); if(!current) throw new SpecialistWorkflowError("Partner not found.",404);
    const approving=action.action==="approve_partner";
    if(approving && current.preparedBy===actor) throw new SpecialistWorkflowError("A different named operator must verify the partner.",403);
    if(approving && Date.parse(current.expiresAt)<=Date.now()) throw new SpecialistWorkflowError("Partner evidence has expired.",409);
    await mutate(db.prepare(`UPDATE specialist_partners SET status=?,version=version+1,approved_by=?,approved_at=?,updated_at=?
      WHERE id=? AND environment=? AND version=? AND status=?`).bind(approving?"approved":"revoked",approving?actor:null,approving?now:null,now,current.id,environment,version(action.version),approving?"review":current.status));
  } else if(action.action==="run_rehearsals") {
    if(environment!=="demo") throw new SpecialistWorkflowError("Run synthetic rehearsals only in the demo environment.",423);
    const scenarios=runSpecialistRehearsals();
    await db.prepare(`INSERT INTO specialist_rehearsal_runs (id,environment,integrity_state,scenarios,run_by,created_at) VALUES (?,'demo','synthetic',?,?,?)`)
      .bind(id("SR"),JSON.stringify(scenarios),actor,now).run();
  } else throw new SpecialistWorkflowError("Choose a supported specialist action.");
  await db.prepare(`INSERT INTO audit_events (id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at)
    VALUES (?,'operations',?,'specialist_workflow_action','specialist_workflow',?,?,?)`)
    .bind(id("SA"),actor,"id" in action?action.id:"bookingId" in action?action.bookingId:environment,JSON.stringify({action:action.action,environment}),now).run();
}

export function specialistDocument(state:SpecialistOperationsState,pack:SpecialistPack,scope:"operations"|"client"|"officer") {
  const b=state.bookings.find(x=>x.id===pack.bookingId); if(!b) throw new SpecialistWorkflowError("Booking unavailable.",404);
  const current=pack.status==="approved" && pack.blockers.length===0;
  const banner=state.environment==="demo"?"SIMULATION ONLY — NOT A CONTRACT OR DEPLOYMENT AUTHORITY":current?"APPROVED PACK — SEPARATE ACTIVATION REQUIRED":"DRAFT — NOT AUTHORISED FOR DEPLOYMENT";
  const common={banner,packId:pack.id,revision:pack.version,service:specialistProfiles[b.serviceCode].label,site:b.siteName,startsAt:b.startsAt,endsAt:b.endsAt,commandOwner:pack.content.commandOwner,status:current?"approved":"blocked",productionActivationGranted:false};
  if(scope==="officer") return {...common,instructions:pack.content.officerBrief};
  const client={...common,scope:pack.content.clientBrief,subtotalCents:b.subtotalCents,vatCents:b.vatCents,totalCents:b.totalCents,currency:"ZAR",termsVersion:SPECIALIST_TERMS_VERSION,creditTermsDays:0,fundingModel:"advance_only"};
  if(scope==="client") return client;
  return {...client,officerInstructions:pack.content.officerBrief,officers:pack.content.officerIds,evidence:pack.content.checks,internalCostFloorCents:b.costFloorCents,internalMarginBasisPoints:b.marginBasisPoints,preparedBy:pack.preparedBy,approvedBy:pack.approvedBy,approvedAt:pack.approvedAt,blockers:pack.blockers};
}
