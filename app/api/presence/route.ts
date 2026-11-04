import {readRequestText, RequestBodyError} from '../../lib/request-body';
import {env} from 'cloudflare:workers';
import {publicPresence,writePresence} from '../../lib/officer-presence';
import {SignupError} from '../../lib/signup-server';
import {requireOfficerJson,officerApiActor,OfficerAccessError} from '../../lib/officer-api-access';
export const dynamic='force-dynamic';
const reply=(d:unknown,status=200)=>Response.json(d,{status,headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}});
const fail=(e:unknown)=>e instanceof SignupError||e instanceof RequestBodyError || e instanceof OfficerAccessError?reply({error:e.message},e.status):reply({error:'Presence is unavailable; locations cannot be confirmed.'},503);
export async function GET(){try{if(!env.DB)throw new SignupError('Presence storage unavailable.',503);return reply(await publicPresence(env.DB));}catch(e){return fail(e);}}
export async function POST(request:Request){try{
 requireOfficerJson(request);const {userId}=officerApiActor(request);
 if(!env.DB)throw new SignupError('Storage unavailable.',503);
 const raw=await readRequestText(request,1500);let body;try{body=JSON.parse(raw);}catch{throw new SignupError('Invalid request.');}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new SignupError('Invalid request.');
 const own=await env.DB.prepare("SELECT source_id FROM signup_cases WHERE kind='officer' AND owner_user_id=? AND status!='withdrawn' LIMIT 1").bind(userId).first();
 if(!own&&body.action!=='stop'&&body.action!=='state')throw new SignupError('Link your officer application before sharing presence.',403);
 return reply(await writePresence(env.DB,userId,null,body));
 }catch(e){return fail(e);}}
