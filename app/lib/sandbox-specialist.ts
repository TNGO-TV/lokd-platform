import {SignupError} from './signup-server';
import {requireSandboxCompletion,type SandboxRuntime} from './sandbox-completion-policy';
import type {SigningActor} from './production-signing';
import {applySpecialistAction,readSpecialistState} from './specialist-operations-server';
import {agreementHash} from './agreement-acceptance';
const codes=['S1_ARMED_SERVICE_AUTHORITY','S2_VIP_SERVICE_AUTHORITY','S3_SPECIALIST_INSURANCE','S4_SPECIALIST_BOARD_APPROVAL'];
export async function sandboxSpecialist(runtime:SandboxRuntime,actor:SigningActor,input:Record<string,unknown>,headers:Headers){
 const {db,policy}=await requireSandboxCompletion(runtime);if(!actor.operations)throw new SignupError('Operations specialist access required.',403);
 if(input.action==='prepare_authority'){
  if(!codes.includes(String(input.code))||typeof input.reference!=='string'||!input.reference.startsWith('sandbox:')||input.reference.length>300)throw new SignupError('Choose an explicit simulated specialist authority source.');
  const id=crypto.randomUUID(),source=JSON.stringify({code:input.code,reference:input.reference,policyVersion:policy.version,mode:'simulator'}),expiry=new Date(Date.now()+policy.evidenceHours*3600000).toISOString();
  await db.prepare('INSERT INTO sandbox_specialist_authorities VALUES(?,?,?,?,?,?,?)').bind(id,input.code,source,await agreementHash(source),actor.userId,new Date().toISOString(),expiry).run();return {authorityId:id,pendingIndependentApproval:true};
 }
 if(input.action==='decide_authority'){
  if(!actor.owner||input.independentlyChecked!==true||!['approve','reject'].includes(String(input.decision))||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>700)throw new SignupError('Independent owner specialist review required.',403);
  await db.prepare('INSERT INTO sandbox_specialist_decisions VALUES(?,?,?,?,?)').bind(input.authorityId,input.decision,actor.userId,input.reason,new Date().toISOString()).run();return {decision:input.decision,productionActivationGranted:false};
 }
 if(input.action==='read')return readSpecialistState(db,'production',actor.email);
 // The existing specialist engine validates roles, MFA, quote/currentness,
 // named specialists, complete evidence, independent approval and revocation.
 await applySpecialistAction(db,'production',actor.email,input as never,{actor,headers});
 return readSpecialistState(db,'production',actor.email);
}
