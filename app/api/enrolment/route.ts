import {env} from 'cloudflare:workers';
import {readRequestText,RequestBodyError} from '../../lib/request-body';
import {SignupError} from '../../lib/signup-server';
import {officerApiActor,requireOfficerJson,OfficerAccessError} from '../../lib/officer-api-access';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','referrer-policy':'no-referrer'}});
const fail=(error:unknown)=>error instanceof SignupError||error instanceof RequestBodyError||error instanceof OfficerAccessError?reply({error:error.message},error.status):reply({error:'Enrolment could not be saved. Try again.'},503);
async function ownApplication(userId:string,id:unknown){
 if(!env.DB)throw new SignupError('Enrolment storage unavailable.',503);
 if(typeof id!=='string'||id.length>100)throw new SignupError('Choose your application.');
 const source=await env.DB.prepare("SELECT c.source_id,c.version FROM signup_cases c JOIN officer_applications a ON a.id=c.source_id WHERE c.kind='officer' AND c.source_id=? AND c.owner_user_id=? AND c.status!='withdrawn' AND a.environment='prelaunch' AND a.integrity_state='user_submitted'").bind(id,userId).first<{source_id:string;version:number}>();
 if(!source)throw new SignupError('Application not found.',404);
 return source;
}
export async function GET(request:Request){try{
 const a=officerApiActor(request),source=await ownApplication(a.userId,new URL(request.url).searchParams.get('caseId'));
 const enrolment=await env.DB!.prepare('SELECT id,status,created_at AS createdAt FROM officer_enrolment_requests WHERE application_id=? AND owner_user_id=? AND application_version=?').bind(source.source_id,a.userId,source.version).first();
 return reply({caseId:source.source_id,caseVersion:source.version,enrolment});
}catch(error){return fail(error);}}
export async function POST(request:Request){try{
 requireOfficerJson(request);const a=officerApiActor(request);let input;try{input=JSON.parse(await readRequestText(request,2000));}catch{throw new SignupError('Submit a valid enrolment request.');}
 if(!input||input.action!=='request_enrolment'||input.consent!==true)throw new SignupError('Confirm you would like LOKD to contact you about enrolment.');
 const source=await ownApplication(a.userId,input.caseId);
 if(source.version!==input.caseVersion)throw new SignupError('Your application changed. Refresh and try again.',409);
 const id=crypto.randomUUID(),now=new Date().toISOString();
 await env.DB!.batch([
  env.DB!.prepare("INSERT OR IGNORE INTO officer_enrolment_requests(id,application_id,owner_user_id,application_version,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM signup_cases WHERE kind='officer' AND source_id=? AND owner_user_id=? AND version=? AND status!='withdrawn')").bind(id,source.source_id,a.userId,source.version,now,source.source_id,a.userId,source.version),
  env.DB!.prepare("INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT ?,'officer',?,'officer_enrolment_requested','officer_application',application_id,'Requested enrolment contact.',? FROM officer_enrolment_requests WHERE id=?").bind(crypto.randomUUID(),a.userId,now,id),
 ]);
 const enrolment=await env.DB!.prepare('SELECT id,status,created_at AS createdAt FROM officer_enrolment_requests WHERE application_id=? AND owner_user_id=? AND application_version=?').bind(source.source_id,a.userId,source.version).first();
 if(!enrolment)throw new SignupError('Your application changed. Refresh and try again.',409);
 return reply({saved:true,enrolment});
}catch(error){return fail(error);}}
