import { readPsiraCases } from './psira-server';
import type { SignupKind, SignupRecord, SignupStatus } from './signup-types';
import { applicationPsiraDeclaration } from './psira-pathway';
import { psiraNumber } from './psira-verification';
export class SignupError extends Error { status:number; constructor(message: string, status=400) { super(message); this.status=status; } }
export type SignupActor = { userId: string; email: string; operations: boolean };
type Row = { id: string; email: string; createdAt: string; updatedAt: string; owner: string | null; version: number | null; status: SignupStatus | null; note: string | null; corrections: string | null; details: string };
const config = {
  officer: {table:'officer_applications', fields:"json_object('fullName',s.full_name,'mobile',s.mobile_normalized,'city',s.city,'province',s.province,'pathway',s.pathway,'psiraStatus',s.psira_status,'psiraNumber',coalesce(s.psira_number,''),'psiraGrade',coalesce(s.psira_grade,''),'services',s.service_interests,'purposes',s.purpose_interests,'training',s.training_interests)"},
  client: {table:'client_enquiries',fields:"json_object('organisationName',s.organisation_name,'contactName',s.contact_name,'mobile',coalesce(s.mobile_normalized,''),'siteArea',s.site_area,'siteType',s.site_type,'requiredStart',s.required_start,'serviceType',s.service_type,'message',s.message)"},
} as const;
function kindOf(value: unknown): SignupKind {
  if(value !== 'client' && value !== 'officer') throw new SignupError('Choose the Client or Officer intake.');
  return value;
}
function select(kind: SignupKind) {
  const c=config[kind];
  return `SELECT s.id,s.email_normalized AS email,s.created_at AS createdAt,coalesce(c.updated_at,s.updated_at) AS updatedAt,c.owner_user_id AS owner,c.version,c.status,c.public_note AS note,c.corrections_json AS corrections,${c.fields} AS details
    FROM ${c.table} s LEFT JOIN signup_cases c ON c.source_id=s.id AND c.kind='${kind}'
    WHERE s.environment='prelaunch' AND s.integrity_state='user_submitted'`;
}
function visibility(actor: SignupActor) {
  return actor.operations ? {sql:'',values:[]} : {
    sql:' AND (c.owner_user_id = ? OR (c.owner_user_id IS NULL AND lower(s.email_normalized) = ?))',
    values:[actor.userId,actor.email.toLowerCase()],
  };
}
async function rowFor(db:D1Database, actor:SignupActor, kind:SignupKind, id:string) {
  const v=visibility(actor);
  const row=await db.prepare(select(kind)+' AND s.id = ?'+v.sql).bind(id,...v.values).first<Row>();
  if(!row) throw new SignupError('Submission not found for this account.',404);
  return row;
}
async function present(db:D1Database,row:Row,kind:SignupKind):Promise<SignupRecord> {
  const events=await db.prepare('SELECT action,public_note AS note,recorded_at AS recordedAt FROM signup_events WHERE kind=? AND source_id=? ORDER BY version DESC LIMIT 20').bind(kind,row.id).all<{action:string;note:string;recordedAt:string}>();
  const details={...JSON.parse(row.details),...JSON.parse(row.corrections??'{}')};
  const psira=kind==='officer'&&row.owner?(await readPsiraCases(db,{userId:row.owner,email:row.email,operations:false}))[0]:null;
  const matching=psira?.psira_number===details.psiraNumber&&psira?.declaration==='registered';
  const event=matching?psira?.events[0]:null;
  return {verification:kind==='officer'?{verified:!!matching&&psira?.verified===true,registrationStatus:event?.registration_status??'pending_review',identityMatch:event?.identity_match??'unchecked',checkedAt:event?.recorded_at??null,recheckAt:event?.recheck_at??null}:undefined,id:row.id,kind,email:row.email,createdAt:row.createdAt,updatedAt:row.updatedAt,accountLinked:!!row.owner,version:row.version??0,status:row.status??'received',note:row.note??'',details,events:events.results};
}
export async function readSignupRecords(db:D1Database,actor:SignupActor,kind:SignupKind,offset=0) {
  const v=visibility(actor);
  const rows=await db.prepare(select(kind)+v.sql+' ORDER BY s.created_at DESC,s.id DESC LIMIT 51 OFFSET ?').bind(...v.values,offset).all<Row>();
  return {records:await Promise.all(rows.results.slice(0,50).map(row=>present(db,row,kind))),hasMore:rows.results.length>50};
}
export async function hasSignupSubmission(db:D1Database,actor:SignupActor,kind:SignupKind) {
  const v=visibility({...actor,operations:false});
  return !!await db.prepare(select(kind)+v.sql+' LIMIT 1').bind(...v.values).first();
}
function text(value:unknown,label:string,min:number,max:number) {
  if(typeof value!=='string') throw new SignupError(`${label} is required.`);
  const s=value.trim();if(s.length<min||s.length>max)throw new SignupError(`${label} must contain ${min}–${max} characters.`);return s;
}
function validateChanges(kind:SignupKind,input:unknown,current:Record<string,string>) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new SignupError('Enter the corrected details.');
  const fields=kind==='officer'?['fullName','mobile','city','province','pathway','psiraStatus','psiraNumber','psiraGrade']:['organisationName','contactName','mobile','siteArea','message'];
  const changes:Record<string,string>={};
  for(const [key,value] of Object.entries(input)) {
    if(!fields.includes(key))throw new SignupError('That field cannot be changed here. Account email and access roles are managed separately.');
    const minimum=key==='message'?20:['fullName','contactName'].includes(key)?3:key==='mobile'||key.startsWith('psira')?0:2;
    changes[key]=text(value,key,minimum,key==='message'?2000:['fullName','contactName'].includes(key)?100:key==='city'?80:120);
  }
  if(!Object.keys(changes).length)throw new SignupError('Enter a correction before resubmitting.');
  const merged={...current,...changes};
  if('mobile' in changes){const n=changes.mobile.replace(/\D/g,'');if(n && !/^(0\d{9}|27\d{9})$/.test(n))throw new SignupError('Enter a valid South African mobile number.');if(kind==='officer'&&!n)throw new SignupError('Mobile number is required.');changes.mobile=n.startsWith('0')?`+27${n.slice(1)}`:n?`+${n}`:'';}
  if(kind==='officer') {
    if(!['qualified','training'].includes(merged.pathway))throw new SignupError('Choose a valid application pathway.');
    if(!['active','expired','in_training','not_registered'].includes(merged.psiraStatus))throw new SignupError('Choose a valid PSiRA position.');
    if(!['Gauteng','Western Cape','Free State','KwaZulu-Natal','Eastern Cape','Mpumalanga','Limpopo','North West','Northern Cape'].includes(merged.province))throw new SignupError('Choose a valid province.');
    if(applicationPsiraDeclaration(merged.pathway,merged.psiraStatus)==='registered') {
      try { changes.psiraNumber=psiraNumber(merged.psiraNumber); } catch {throw new SignupError('Registered applicants must provide a numeric PSiRA number.');}
      if(merged.psiraGrade&&!['Grade A','Grade B','Grade C','Grade D','Grade E'].includes(merged.psiraGrade))throw new SignupError('Choose a valid PSiRA grade.');
    } else {changes.psiraNumber='';changes.psiraGrade='';}
  }
  return changes;
}
export async function writeSignup(db:D1Database,actor:SignupActor,body:Record<string,unknown>) {
  const kind=kindOf(body.kind);const id=text(body.id,'Reference',3,100);
  const current=await rowFor(db,actor,kind,id);
  if(body.expectedVersion!==(current.version??0))throw new SignupError('This submission changed. Refresh and review the latest details.',409);
  const action=body.action;let owner=current.owner;let status:SignupStatus=current.status??'awaiting_review';let note='';
  let corrections:Record<string,string>=JSON.parse(current.corrections??'{}');
  if(action==='link') {
    if(actor.operations)throw new SignupError('Use your applicant workspace to link your own submission.',403);
    if(current.owner && current.owner!==actor.userId)throw new SignupError('Submission not found for this account.',404);
    if(current.owner===actor.userId)return;
    owner=actor.userId;note='Linked to your verified sign-in account. Identity and work eligibility remain unverified.';
  } else if(action==='correct'||action==='withdraw') {
    if(current.owner!==actor.userId)throw new SignupError('Link your own submission before making changes.',403);
    if(current.status==='withdrawn')throw new SignupError('This submission is withdrawn. No further changes are accepted.',409);
    if(action==='correct') {corrections={...corrections,...validateChanges(kind,body.changes,{...JSON.parse(current.details),...corrections})};status='awaiting_review';note='Corrections submitted. Operations must review the updated details.';}
    else {status='withdrawn';note='Withdrawn by the applicant. No service or work approval was granted.';}
  } else if(action==='review') {
    if(!actor.operations)throw new SignupError('Only Operations can review intake.',403);
    if(current.owner===actor.userId || current.email.toLowerCase()===actor.email.toLowerCase())throw new SignupError('Another Operations reviewer must review your own submission.',403);
    if(current.status==='withdrawn')throw new SignupError('This submission was withdrawn.',409);
    if(!['needs_information','reviewed'].includes(String(body.status)))throw new SignupError('Choose an intake review outcome.');
    status=body.status as SignupStatus;note=text(body.note,'Message to applicant',10,1200);
  } else throw new SignupError('Choose a valid intake action.');
  const caseNote=action==='link'&&current.note?current.note:note;
  const now=new Date().toISOString(),version=(current.version??0)+1,event=crypto.randomUUID();
  const mutation=current.version
    ? db.prepare('UPDATE signup_cases SET owner_user_id=?,status=?,public_note=?,corrections_json=?,version=?,latest_event_id=?,updated_at=? WHERE kind=? AND source_id=? AND version=?').bind(owner,status,caseNote,JSON.stringify(corrections),version,event,now,kind,id,current.version)
    : db.prepare('INSERT OR IGNORE INTO signup_cases (kind,source_id,owner_user_id,status,public_note,corrections_json,version,latest_event_id,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(kind,id,owner,status,caseNote,JSON.stringify(corrections),version,event,now);
  const results=await db.batch([mutation,db.prepare(`INSERT INTO signup_events (id,kind,source_id,version,action,actor_user_id,public_note,details_json,recorded_at)
    SELECT ?,kind,source_id,version,?,?,?,?,? FROM signup_cases WHERE kind=? AND source_id=? AND latest_event_id=?`)
    .bind(event,String(action),actor.userId,note,JSON.stringify(corrections),now,kind,id,event)]);
  if(!results[0].meta.changes||!results[1].meta.changes)throw new SignupError('This submission changed. Refresh before retrying.',409);
}

export async function hasLinkedOfficerSignup(db:D1Database,userId:string) {
  return !!await db.prepare("SELECT source_id FROM signup_cases WHERE owner_user_id=? AND kind='officer' AND status!='withdrawn' LIMIT 1").bind(userId).first();
}
