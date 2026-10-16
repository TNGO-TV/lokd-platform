import {blockedTestSurface,rehearsalEnv as env} from '../../lib/test-surface-runtime';
import {readRequestText, RequestBodyError} from '../../lib/request-body';

import {SignupError} from '../../lib/signup-server';
import {principalForEmail,principalHasRole,requirePilotApiRole,requireSameOriginJson,PilotAccessError} from '../../lib/pilot-runtime';
import {workspaceRoleForHost} from '../../lib/public-site';
import {readTestCycles,writeTestCycle} from '../../lib/test-operating-cycle';
export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'cache-control':'private, no-store','referrer-policy':'no-referrer'}});
function actor(request:Request){const url=new URL(request.url),kind=url.searchParams.get('kind'),operations=url.searchParams.get('scope')==='operations',userId=request.headers.get('x-lokd-verified-user-id'),email=request.headers.get('x-lokd-verified-email');
 if(!userId||!email)throw new SignupError('Sign in to your account.',401);
 if(kind!=='client'&&kind!=='officer')throw new SignupError('Choose Client or Officer.');
 const host=workspaceRoleForHost(url.hostname);if(host&&host!==(operations?'operations':kind))throw new SignupError('Open the correct workspace.',403);
 if(operations){if(!principalHasRole(principalForEmail(email),'operations'))throw new SignupError('Operations access required.',403);requirePilotApiRole(request,'operations');}
 return {userId,email,operations};
}
const fail=(e:unknown)=>e instanceof SignupError||e instanceof RequestBodyError || e instanceof PilotAccessError?reply({error:e.message},e.status):reply({error:'Test cycle unavailable. No service or payment authorised.'},503);
export async function GET(request:Request){
 const blockedTest = await blockedTestSurface(request); if (blockedTest) return blockedTest;
try{const a=actor(request);if(!env.DB)throw new SignupError('Storage unavailable.',503);return reply(await readTestCycles(env.DB,a));}catch(e){return fail(e);}}
export async function POST(request:Request){
 const blockedTest = await blockedTestSurface(request); if (blockedTest) return blockedTest;
try{requireSameOriginJson(request);const a=actor(request);if(!env.DB)throw new SignupError('Storage unavailable.',503);const raw = await readRequestText(request, 4000);let input;try{input=JSON.parse(raw);}catch{throw new SignupError('Invalid request.');}if(!input||typeof input!=='object'||Array.isArray(input))throw new SignupError('Invalid document action.');return reply(await writeTestCycle(env.DB,a,{...input,kind:new URL(request.url).searchParams.get('kind')}));}catch(e){return fail(e);}}
