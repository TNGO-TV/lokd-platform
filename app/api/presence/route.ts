import {blockedTestSurface,rehearsalEnv} from '../../lib/test-surface-runtime';
import {readRequestText, RequestBodyError} from '../../lib/request-body';
import {env} from 'cloudflare:workers';
import {publicPresence,writePresence} from '../../lib/officer-presence';
import {SignupError} from '../../lib/signup-server';
import {requireSameOriginJson,PilotAccessError} from '../../lib/pilot-runtime';
import {workspaceRoleForHost} from '../../lib/public-site';
export const dynamic='force-dynamic';
const reply=(d:unknown,status=200)=>Response.json(d,{status,headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}});
const fail=(e:unknown)=>e instanceof SignupError||e instanceof RequestBodyError || e instanceof PilotAccessError?reply({error:e.message},e.status):reply({error:'Presence is unavailable; locations cannot be confirmed.'},503);
export async function GET(){try{if(!env.DB)throw new SignupError('Presence storage unavailable.',503);return reply(await publicPresence(env.DB));}catch(e){return fail(e);}}
export async function POST(request:Request){try{requireSameOriginJson(request);const user=request.headers.get('x-lokd-verified-user-id'),email=request.headers.get('x-lokd-verified-email'),role=workspaceRoleForHost(new URL(request.url).hostname);if(!user||!email)throw new SignupError('Sign in to your officer account.',401);if(role&&role!=='officer')throw new SignupError('Use the Officer workspace.',403);if(!env.DB)throw new SignupError('Storage unavailable.',503);
 const raw = await readRequestText(request, 1500);let body;try{body=JSON.parse(raw);}catch{throw new SignupError('Invalid request.');}if(!body||typeof body!=='object'||Array.isArray(body))throw new SignupError('Invalid request.');
 if(body.mode==='test'){const blocked=await blockedTestSurface(request);if(blocked)return blocked;}
 const db=body.mode==='test'?rehearsalEnv.DB:env.DB;if(!db)throw new SignupError('Storage unavailable.',503);
 const own=await db.prepare("SELECT source_id FROM signup_cases WHERE kind='officer' AND owner_user_id=? AND status!='withdrawn' LIMIT 1").bind(user).first();if(!own&&body.action!=='stop')throw new SignupError('Link your officer application before sharing presence.',403);
 return reply(await writePresence(db,user,null,body));}catch(e){return fail(e);}}
