import {blockedTestSurface,rehearsalEnv as env} from '../../lib/test-surface-runtime';

import {SignupError} from '../../lib/signup-server';
import {PilotAccessError,principalForEmail,principalHasRole,requirePilotApiRole,requireSameOriginJson} from '../../lib/pilot-runtime';
import {readRequestText,RequestBodyError} from '../../lib/request-body';
import {initializeProviderTest,readProviderTests,reconcileProviderTest} from '../../lib/provider-acceptance-test';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'cache-control':'private, no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'}});
function actor(request:Request){
 const userId=request.headers.get('x-lokd-verified-user-id'),email=request.headers.get('x-lokd-verified-email');
 if(!userId||!email)throw new SignupError('Sign in to your Operations owner account.',401);
 const principal=principalForEmail(email);
 if(!principal.owner||!principalHasRole(principal,'operations'))throw new SignupError('Operations owner access required.',403);
 requirePilotApiRole(request,'operations');
 return {userId,email,owner:true};
}
const fail=(e:unknown)=>e instanceof SignupError||e instanceof PilotAccessError||e instanceof RequestBodyError?reply({error:e.message},e.status):reply({error:'The provider check could not be completed. Keep the saved reference and retry the check.'},503);
export async function GET(request:Request){
 const blockedTest = await blockedTestSurface(request); if (blockedTest) return blockedTest;
try{return reply(await readProviderTests(env,actor(request)));}catch(e){return fail(e);}}
export async function POST(request:Request){
 const blockedTest = await blockedTestSurface(request); if (blockedTest) return blockedTest;
try{
 requireSameOriginJson(request);const a=actor(request);
 let input;try{input=JSON.parse(await readRequestText(request,1500));}catch(e){if(e instanceof RequestBodyError)throw e;throw new SignupError('Invalid request.');}
 if(!input||typeof input!=='object'||Array.isArray(input))throw new SignupError('Invalid request.');
 if(input.action==='initialize')return reply(await initializeProviderTest(env,a,input));
 if(input.action==='reconcile')return reply(await reconcileProviderTest(env,a,input));
 throw new SignupError('Choose a supported TEST action.');
 }catch(e){return fail(e);}}
