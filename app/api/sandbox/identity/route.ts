import {blockedTestSurface} from '../../../lib/test-surface-runtime';
import {executeSandboxCommand} from '../../../lib/sandbox-command';
import {readFinanceBody} from '../../../lib/finance-workflow-request';
import {env} from 'cloudflare:workers';
import {SignupError,writeSignup} from '../../../lib/signup-server';
import {PilotAccessError,requireSameOriginJson,requirePilotApiRole,principalForEmail,principalHasRole} from '../../../lib/pilot-runtime';
import {requireSandboxCompletion,type SandboxRuntime} from '../../../lib/sandbox-completion-policy';
import {createSandboxCapture,withdrawSandboxCapture,sandboxIdentityProvider} from '../../../lib/sandbox-identity';
import {grantSandboxEvidence,revokeSandboxEvidence,sandboxEvidenceReader} from '../../../lib/sandbox-identity-store';
import {readPrivateIdentityEvidence} from '../../../lib/production-identity-evidence-reader';
import * as identity from '../../../lib/production-identity';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'cache-control':'private, no-store','referrer-policy':'no-referrer'}});
export async function POST(request:Request){
 const blockedTest = await blockedTestSurface(request); if (blockedTest) return blockedTest;
try{
 requireSameOriginJson(request);const runtime=env as unknown as SandboxRuntime,{db,policy,policyHash}=await requireSandboxCompletion(runtime);
 const userId=request.headers.get('x-lokd-verified-user-id'),email=request.headers.get('x-lokd-verified-email');if(!userId||!email)throw new SignupError('Sign in.',401);
 const principal=principalForEmail(email),operations=principalHasRole(principal,'operations');if(operations)requirePilotApiRole(request,'operations');
 const actor={userId,email,operations,owner:operations&&principal.owner};
 const raw=await readFinanceBody(request,16000);let body;try{body=JSON.parse(raw);}catch{throw new SignupError('Invalid JSON.');}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['action','input','requestKey'].includes(k))||!body.input||typeof body.input!=='object'||Array.isArray(body.input))throw new SignupError('Use action and input.');
 for(const k of ['actor','provider','environment','bindingHash','owner','operations','userId'])if(k in body.input)throw new SignupError('Server fields are not accepted.');
 let data;const i=body.input;
 switch(body.action){
 case 'capture':{const command=await executeSandboxCommand(runtime,actor,'capture',body.requestKey,i,r=>createSandboxCapture(r,actor,i));if(command.status==='failed')throw new SignupError('Original request was rejected before any source write. Review corrected details using a new request.',command.failure.status);if(!command.recorded)return reply({mode:'simulator',policyVersion:policy.version,policyHash,productionWorkEligible:false,productionIdentityVerified:false,requestKey:body.requestKey,commandStatus:command.status,data:null},202);data=command.result;break;}
 case 'withdraw_capture':data=await withdrawSandboxCapture(runtime,actor,i.captureReference);break;
 case 'start':data=await identity.startProductionIdentity(db,actor,i,await sandboxIdentityProvider(runtime));break;
 case 'recover':data=await identity.recoverProductionIdentity(db,actor,i.id,i.expectedOutcomeId,await sandboxIdentityProvider(runtime));break;
 case 'read':data=await identity.readProductionIdentity(db,actor,i.id);break;
 case 'decide':data=await identity.decideProductionIdentity(db,actor,i);break;
 case 'suspend':data=await identity.suspendProductionIdentity(db,actor,i.id,i.reason);break;
 case 'correct':data=await writeSignup(db,actor,{...i,action:'correct',kind:'officer'});break;
 case 'grant_evidence':data=await grantSandboxEvidence(runtime,actor,i);break;
 case 'revoke_evidence':data=await revokeSandboxEvidence(runtime,actor,i.grantId);break;
 case 'download':{const r=await readPrivateIdentityEvidence(db,actor,i.id,await sandboxEvidenceReader(runtime));r.headers.set('x-lokd-evidence-mode','simulator');return r;}
 default:throw new SignupError('Unsupported sandbox identity action.');
 }
 return reply({requestKey:body.requestKey,commandStatus:body.requestKey?'completed':undefined,mode:'simulator',policyVersion:policy.version,policyHash,productionIdentityVerified:false,productionWorkEligible:false,data});
 }catch(e){return e instanceof SignupError||e instanceof PilotAccessError?reply({error:e.message},e.status):reply({error:'Sandbox evidence or authority changed. Refresh before retrying.'},409);}}
