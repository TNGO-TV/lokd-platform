import {env} from 'cloudflare:workers';
import {readRequestText,RequestBodyError} from '../../lib/request-body';
import {SignupError} from '../../lib/signup-server';
import {officerApiActor,requireOfficerJson,OfficerAccessError} from '../../lib/officer-api-access';
import {recoverApplicantIdentity,readApplicantIdentity,runApplicantIdentity} from '../../lib/applicant-identity';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'}});
const fail=(error:unknown)=>error instanceof SignupError||error instanceof RequestBodyError||error instanceof OfficerAccessError?reply({error:error.message},error.status):reply({error:'Identity checking is temporarily unavailable. Please refresh your saved result.'},503);
export async function GET(request:Request){try{
 const operations=new URL(request.url).searchParams.get('scope')==='operations',actor=officerApiActor(request,operations);
 if(!env.DB)throw new SignupError('Identity storage is unavailable.',503);
 const id=new URL(request.url).searchParams.get('caseId');if(!id||id.length>100)throw new SignupError('Choose your application.');
 let userId=actor.userId;
 if(operations){const record=await env.DB.prepare("SELECT owner_user_id FROM signup_cases WHERE kind='officer' AND source_id=?").bind(id).first<{owner_user_id:string|null}>();if(!record?.owner_user_id)throw new SignupError('No linked applicant.',404);userId=record.owner_user_id;}
 return reply(await readApplicantIdentity(env.DB,userId,id));
}catch(error){return fail(error);}}
export async function POST(request:Request){try{
 requireOfficerJson(request);const operations=new URL(request.url).searchParams.get('scope')==='operations',actor=officerApiActor(request,operations);
 const raw=await readRequestText(request,3000);let body;try{body=JSON.parse(raw);}catch{throw new SignupError('Submit a valid identity form.');}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new SignupError('Submit a valid identity form.');
 return reply(operations?await recoverApplicantIdentity(env,actor.userId,body):await runApplicantIdentity(env,actor.userId,body));
}catch(error){return fail(error);}}
