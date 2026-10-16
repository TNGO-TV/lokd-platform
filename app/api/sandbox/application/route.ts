import {blockedTestSurface} from '../../../lib/test-surface-runtime';
import {executeSandboxCommand} from '../../../lib/sandbox-command';
import {readSandboxPassport} from '../../../lib/sandbox-discovery';
import {readFinanceBody} from '../../../lib/finance-workflow-request';
import {env} from 'cloudflare:workers';
import {SignupError} from '../../../lib/signup-server';
import {PilotAccessError,requireSameOriginJson,requirePilotApiRole,principalForEmail,principalHasRole} from '../../../lib/pilot-runtime';
import {requireSandboxCompletion,type SandboxRuntime} from '../../../lib/sandbox-completion-policy';
import {executeSandboxApplication} from '../../../lib/sandbox-application';
import {submitOfficerApplication} from '../../applications/route';
import {submitClientEnquiry} from '../../enquiries/route';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'cache-control':'private, no-store','referrer-policy':'no-referrer'}});
export async function POST(request:Request){
 const blockedTest = await blockedTestSurface(request); if (blockedTest) return blockedTest;
try{
 requireSameOriginJson(request);const runtime=env as unknown as SandboxRuntime,{policy,policyHash}=await requireSandboxCompletion(runtime);
 const userId=request.headers.get('x-lokd-verified-user-id'),email=request.headers.get('x-lokd-verified-email');if(!userId||!email)throw new SignupError('Sign in.',401);
 const principal=principalForEmail(email),operations=principalHasRole(principal,'operations');if(operations)requirePilotApiRole(request,'operations');const actor={userId,email,operations,owner:operations&&principal.owner};
 const raw=await readFinanceBody(request,64000);let body;try{body=JSON.parse(raw);}catch{throw new SignupError('Invalid JSON.');}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['service','input','requestKey'].includes(k))||!body.input||typeof body.input!=='object'||Array.isArray(body.input))throw new SignupError('Use service and input.');
 for(const k of ['actor','provider','environment','owner','operations'])if(k in body.input)throw new SignupError('Server fields are not accepted.');
 let data;
 if(['officer_application','client_enquiry'].includes(body.service)){
  const synthetic=body.input;if(synthetic.email!==actor.email||!(/\+clerk_test[^@]*@example\.com$/.test(actor.email)||/@example\.test$/.test(actor.email)))throw new SignupError('Use the signed-in designated synthetic test account.',403);
  const command=await executeSandboxCommand(runtime,actor,body.service,body.requestKey,synthetic,async(_runtime,database)=>{const nested=new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(synthetic)});const result=await (body.service==='officer_application'?submitOfficerApplication(nested,database):submitClientEnquiry(nested,database));const value=await result.json() as {error?:string};if(!result.ok)throw new SignupError(value.error??'Invalid intake.',result.status);return value;});
  if(command.status==='failed')throw new SignupError('Original request was rejected before any source write. Review corrected details using a new request.',command.failure.status);if(!command.recorded)return reply({mode:'sandbox',policyVersion:policy.version,policyHash,productionWorkEligible:false,productionIdentityVerified:false,requestKey:body.requestKey,commandStatus:command.status,data:null},202);data=command.result;
 }else if(body.service==='training'&&body.input.action==='import_finance'){const command=await executeSandboxCommand(runtime,actor,'import_finance',body.requestKey,body.input,r=>executeSandboxApplication(r,actor,body.service,body.input,request.headers));if(command.status==='failed')throw new SignupError('Original request was rejected before any source write. Review corrected details using a new request.',command.failure.status);if(!command.recorded)return reply({mode:'sandbox',policyVersion:policy.version,policyHash,productionWorkEligible:false,productionIdentityVerified:false,requestKey:body.requestKey,commandStatus:command.status,data:null},202);data=command.result;}
 else if(body.service==='passport_read')data=await readSandboxPassport(runtime,actor,body.input);
 else data=await executeSandboxApplication(runtime,actor,body.service,body.input,request.headers);
 return reply({requestKey:body.requestKey,commandStatus:body.requestKey?'completed':undefined,mode:'sandbox',policyVersion:policy.version,policyHash,productionWorkEligible:false,data});
 }catch(e){return e instanceof SignupError||e instanceof PilotAccessError?reply({error:e.message},e.status):reply({error:'Sandbox sources or authority changed. Refresh.'},409);}}
