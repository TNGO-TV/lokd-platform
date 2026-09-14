import {SignupError} from './signup-server';
import type {SigningActor} from './production-signing';
import {requireSandboxCompletion,type SandboxRuntime} from './sandbox-completion-policy';
import {agreementHash} from './agreement-acceptance';
// Finance-owned external settlement is simulated here, without changing the
// source reconciliation's integrity label or asserting bank/provider acceptance.
export async function sandboxFundingBoundary(runtime:SandboxRuntime,actor:SigningActor,input:Record<string,unknown>){
 const {db,policy}=await requireSandboxCompletion(runtime);if(!actor.operations)throw new SignupError('Operations sandbox boundary review required.',403);
 if(input.action==='prepare'){
  const source=await db.prepare('SELECT f.id,f.version,f.booking_id,f.provider_reference,f.expected_amount_cents,f.cleared_amount_cents,b.client_price_cents FROM booking_funding_reconciliations f JOIN bookings b ON b.id=f.booking_id WHERE f.id=? AND f.active_key=b.id').bind(input.reconciliationId).first<Record<string,unknown>>();
  if(!source||source.version!==input.expectedVersion||source.expected_amount_cents!==source.client_price_cents||source.cleared_amount_cents!==source.client_price_cents)throw new SignupError('Exact current full-value test reconciliation required.',409);
  const id=crypto.randomUUID(),json=JSON.stringify({...source,mode:'simulator',policyVersion:policy.version}),expiry=new Date(Date.now()+policy.evidenceHours*3600000).toISOString();
  await db.prepare('INSERT INTO sandbox_funding_acceptances VALUES(?,?,?,?,?,?,?)').bind(id,source.id,source.version,json,await agreementHash(json),actor.userId,expiry).run();return {acceptanceId:id,pendingIndependentApproval:true,externalSettlementAccepted:false};
 }
 if(input.action==='decide'){
  if(!actor.owner||input.independentlyChecked!==true||!['approve','reject'].includes(String(input.decision))||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>700)throw new SignupError('Separate owner must inspect the simulated settlement boundary.',403);
  await db.prepare('INSERT INTO sandbox_funding_decisions VALUES(?,?,?,?,?)').bind(input.acceptanceId,input.decision,actor.userId,input.reason,new Date().toISOString()).run();return {decision:input.decision,externalSettlementAccepted:false};
 }
 throw new SignupError('Unsupported simulated funding-boundary action.');
}
