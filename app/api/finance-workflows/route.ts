import {workspaceCommandReceipt} from '../../lib/workspace-command-receipt';
import {blockedTestSurface} from '../../lib/test-surface-runtime';
import {readFinanceWorkspaces,readFinanceCapabilities,readFinanceReviewQueue,readFinanceOperationEvidence} from '../../lib/finance-workflow-discovery';
import {readFinanceBody,financeSandboxDatabase} from '../../lib/finance-workflow-request';
import {env} from 'cloudflare:workers';
import {SignupError} from '../../lib/signup-server';
import {PilotAccessError,principalForEmail,principalHasRole,requirePilotApiRole,requireSameOriginJson} from '../../lib/pilot-runtime';
import {workspaceRoleForHost} from '../../lib/public-site';
import {prepareFinanceCommand,readFinanceJourney,readTrainingCatalogue,financeReadiness,FINANCE_SANDBOX_POLICY} from '../../lib/finance-workflows';
import {createFinanceWorkspace,applyFinanceCommand,readFinanceCommand,object,str,sandbox,type FinanceRuntime,type Member} from '../../lib/finance-workflow-store';
import {dispatchFinanceOperation,attestFinanceBank,DeterministicFinanceProvider,type Evidence} from '../../lib/finance-workflow-provider';
export const dynamic='force-dynamic';
const headers={'cache-control':'private, no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
export async function POST(request:Request){const blocked=await blockedTestSurface(request);if(blocked)return blocked;try{
 if(request.method!=='GET')requireSameOriginJson(request);const userId=request.headers.get('x-lokd-verified-user-id'),email=request.headers.get('x-lokd-verified-email');if(!userId||!email)throw new SignupError('Sign in to your account.',401);
 const p=principalForEmail(email),operations=principalHasRole(p,'operations'),host=workspaceRoleForHost(new URL(request.url).hostname);if(operations){if(host&&host!=='operations')throw new SignupError('Use the Operations workspace.',403);requirePilotApiRole(request,'operations');}
 const db=await financeSandboxDatabase(env);const runtime=env as unknown as FinanceRuntime,a={userId,email,operations,owner:p.owner},url=new URL(request.url),workspace=url.searchParams.get('workspace')??'';sandbox(runtime);
 if(request.method==='GET')return Response.json(url.searchParams.has('workspaces')?await readFinanceWorkspaces(db,a,runtime):url.searchParams.has('capabilities')?await readFinanceCapabilities(db,a,runtime,workspace):url.searchParams.has('commands')?await readFinanceReviewQueue(db,a,runtime,workspace,url.searchParams.get('afterCommand')??undefined):url.searchParams.has('operationId')?await readFinanceOperationEvidence(db,a,runtime,workspace,url.searchParams.get('operationId')!,Number(url.searchParams.get('afterEvidence')??0)):url.searchParams.get('catalogue')==='training'?await readTrainingCatalogue(db,a,runtime,workspace):url.searchParams.has('commandId')?await readFinanceCommand(db,a,runtime,workspace,url.searchParams.get('commandId')!):url.searchParams.has('applicationId')?await financeReadiness(db,a,runtime,workspace,url.searchParams.get('applicationId')!):await readFinanceJourney(db,a,runtime,workspace,url.searchParams.get('id')??undefined,Number(url.searchParams.get('after')??0),url.searchParams.get('current')==='true'),{headers});
 const raw=await readFinanceBody(request,30000);const input=object(JSON.parse(raw));let result;
 if(input.action==='create_workspace')result=await createFinanceWorkspace(db,a,runtime,str(input,'id'),FINANCE_SANDBOX_POLICY,input.members as unknown as {userId:string;role:Member['role'];limit:number}[]);
 else if(input.action==='decide')result=await applyFinanceCommand(db,a,runtime,workspace,str(input,'commandId'),str(input,'digest'),str(input,'decision') as 'approved'|'rejected',str(input,'findings'));
 else if(input.action==='dispatch'||input.action==='recover'){if(!runtime.FINANCE_SIMULATOR_KEY)throw new SignupError('Provider simulator is disabled.',423);const provider=new DeterministicFinanceProvider();if(input.scenario!==undefined){if(!['success','failed','reversed','pending','needs_attention','timeout'].includes(String(input.scenario)))throw new SignupError('Unknown simulator scenario.');provider.timeout=input.scenario==='timeout';provider.status=provider.timeout?'success':input.scenario as Evidence['status'];}result=await dispatchFinanceOperation(db,a,runtime,workspace,str(input,'operationId'),provider,input.action==='recover');}
 else if(input.action==='bank_evidence')result=await attestFinanceBank(db,a,runtime,workspace,str(input,'operationId'),str(input,'eventId'),input.evidence as unknown as Evidence);
 else result=await prepareFinanceCommand(db,a,runtime,workspace,object(input.command),str(input,'requestKey'),typeof input.policyVersion==='string'?input.policyVersion:undefined);
 return Response.json({...result,commandReceipt:await workspaceCommandReceipt('finance-workflows',{workspace,...input})},{headers});
 }catch(e){return Response.json({error:e instanceof SignupError||e instanceof PilotAccessError?e.message:'Finance state changed or input is invalid. Refresh and review.'},{status:e instanceof SignupError||e instanceof PilotAccessError?e.status:409,headers});}}
export const GET=POST;
