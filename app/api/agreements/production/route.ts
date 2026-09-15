import {readRequestText, RequestBodyError} from '../../../lib/request-body';
import {env} from 'cloudflare:workers';
import {SignupError} from '../../../lib/signup-server';
import {PilotAccessError,principalForEmail,principalHasRole,requirePilotApiRole,requireSameOriginJson} from '../../../lib/pilot-runtime';
import {workspaceRoleForHost} from '../../../lib/public-site';
import {manageProductionDocument,issueProductionEnvelope,readProductionSigning,signProductionEnvelope} from '../../../lib/production-signing';
import {prepareProductionEntity} from '../../../lib/production-intake';
import {AssignmentActivationError} from '../../../lib/assignment-activation-server';
export const dynamic='force-dynamic';
function actor(request:Request){const url=new URL(request.url),operations=url.searchParams.get('scope')==='operations',kind=url.searchParams.get('kind'),userId=request.headers.get('x-lokd-verified-user-id'),email=request.headers.get('x-lokd-verified-email');if(!userId||!email)throw new SignupError('Sign in to your account.',401);const host=workspaceRoleForHost(url.hostname);if(host&&host!==(operations?'operations':kind))throw new SignupError('Open the correct workspace.',403);const principal=principalForEmail(email);if(operations){if(!principalHasRole(principal,'operations'))throw new SignupError('Operations access required.',403);requirePilotApiRole(request,'operations');}return {userId,email,operations,owner:operations&&principal.owner};}
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'cache-control':'private, no-store','referrer-policy':'no-referrer'}});
const fail=(e:unknown)=>e instanceof SignupError||e instanceof RequestBodyError || e instanceof PilotAccessError||e instanceof AssignmentActivationError?reply({error:e.message},e.status):reply({error:'The document action could not be completed. Refresh and review the current record.'},409);
export async function GET(request:Request){try{const a=actor(request);if(!env.DB)throw new SignupError('Storage unavailable.',503);return reply(await readProductionSigning(env.DB,a));}catch(e){return fail(e);}}
export async function POST(request:Request){try{requireSameOriginJson(request);const a=actor(request);if(!env.DB)throw new SignupError('Storage unavailable.',503);const raw = await readRequestText(request, 110000);let body;try{body=JSON.parse(raw);}catch{throw new SignupError('Invalid request.');}if(!body||typeof body!=='object'||Array.isArray(body))throw new SignupError('Invalid action.');let result;
 if(['draft','approve','withdraw_document'].includes(body.action))result=await manageProductionDocument(env.DB,a,body);
 else if(body.action==='prepare_entity')result=await prepareProductionEntity(env.DB,a,body);
 else if(body.action==='issue')result=await issueProductionEnvelope(env.DB,a,body);
 else if(['sign','cancel'].includes(body.action))result=await signProductionEnvelope(env.DB,a,body);
 else throw new SignupError('Choose a supported document action.');
 return reply({result,...await readProductionSigning(env.DB,a)});
 }catch(e){return fail(e);}}
