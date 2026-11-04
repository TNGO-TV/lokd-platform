import assert from 'node:assert/strict';
import {operatePaymentRecovery as recover} from '../../app/lib/payment-recovery.ts';
import {operatePaymentExecution as execute,receiveLiveTransferWebhook} from '../../app/lib/payment-execution.ts';
import {operateEmployeePayment} from '../../app/lib/employee-payments.ts';
import {operatePartnerPayment} from '../../app/lib/partner-payments.ts';

// Extends an approved live employee / partner instruction. The live claim is
// made inside a savepoint with injected transports and rolled back at the end;
// no checkout, destination or real transfer is created.
export async function paymentRecoveryJourney({kind,database,db,maker,finance,officer,headers,runtime,reference,input,recipient}){
 const operate=kind==='employee'?operateEmployeePayment:operatePartnerPayment;
 const current=()=>database.prepare(`SELECT * FROM ${kind}_payment_instructions WHERE reference=?`).get(reference);
 const approved={...current()};assert.equal(approved.mode,'live');assert.equal(approved.status,'approved');
 const transfer={id:1987,transfer_code:'TRF_fixture001',reference,domain:'live',amount:approved.amount_cents,currency:'ZAR',source:'balance',recipient:123,integration:456,status:'pending'};
 let status='failed',posts=0,timeout=true,funding=0;
 const transport=async(url,options)=>{
  if(url.includes('/transferrecipient/'))return Response.json({status:true,data:recipient});
  if(url.endsWith('/balance'))return Response.json({status:true,data:[{currency:'ZAR',balance:approved.amount_cents+500}]});
  if(options.method==='POST'){posts++;if(timeout)throw Error('timeout after provider accepted');throw Error('No further provider POST allowed in recovery tests');}
  assert.equal(url,'https://api.paystack.co/transfer/verify/'+reference);
  return Response.json({status:true,data:{...transfer,status}});
 };
 const exec=(actor,action,patch,run=runtime,network=transport)=>execute(db,actor,{kind,action,evidenceReviewed:true,note:'Isolated recovery fixture finance review.',...patch},headers,run,network);
 async function dispatchLive(ref,network){
  const i=database.prepare(`SELECT * FROM ${kind}_payment_instructions WHERE reference=?`).get(ref),base={reference:ref,sourceHash:i.source_hash};funding++;
  const reserve=await exec(maker,'prepare_payment_reserve',{requestKey:`recovery-reserve-${kind}-${funding}`,integrationId:'456',amountCents:i.amount_cents+500,fundingReference:`bank:recovery-allocation-${kind}-${funding}`,fundingHash:funding.toString(16).padStart(64,'0'),capabilityReference:'fixture:provider-capability',capabilityHash:'c'.repeat(64)});
  const r=database.prepare('SELECT * FROM payment_live_reserves WHERE id=?').get(reserve.reserveId);
  await exec(finance,'approve_payment_reserve',{reserveId:r.id,payloadHash:r.payload_hash});
  const release=await exec(maker,'prepare_live_release',{...base,requestKey:`recovery-release-${kind}-${funding}`,reserveId:r.id,feeCeilingCents:500,mandateHash:'b'.repeat(64),acceptanceReference:'fixture:independent-release'});
  const l=database.prepare('SELECT * FROM payment_live_releases WHERE id=?').get(release.releaseId);
  await exec(finance,'approve_live_release',{...base,releaseId:l.id,payloadHash:l.payload_hash});
  database.prepare('UPDATE payment_live_control SET enabled=1 WHERE id=1').run();
  try{return await exec(finance,'dispatch_live_payment',{...base,releaseId:l.id,version:i.version},{...runtime,LOKD_LIVE_PAYMENTS_ENABLED:'true'},network);}
  finally{database.prepare('UPDATE payment_live_control SET enabled=0 WHERE id=1').run();}
 }
 const originalBatch=db.batch;
 db.batch=async statements=>{database.exec('SAVEPOINT recovery_batch');try{const results=statements.map(s=>s.runSync());database.exec('RELEASE recovery_batch');return results;}catch(e){database.exec('ROLLBACK TO recovery_batch; RELEASE recovery_batch');throw e;}};
 database.exec('SAVEPOINT recovery_journey');
 try{
 await assert.rejects(()=>dispatchLive(reference,transport),/uncertain/);timeout=false;
 assert.equal(current().status,'dispatch_claimed');assert.equal(posts,1);
 const original={...current()};
 const verify=(network=transport)=>exec(finance,'verify_live_payment',{reference,sourceHash:original.source_hash},runtime,network);
 const signed=async(s,patch={})=>{
  const body=JSON.stringify({event:'transfer.'+s,data:{...transfer,status:s,...patch}});
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(runtime.PAYSTACK_LIVE_SECRET_KEY),{name:'HMAC',hash:'SHA-512'},false,['sign']);
  const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body))).toString('hex');
  return receiveLiveTransferWebhook(new Request('https://fixture',{method:'POST',headers:{'x-paystack-signature':signature},body}),db,runtime);
 };
 const command=(action,patch={})=>({kind,action,reference,version:current().version,sourceHash:original.source_hash,evidenceReviewed:true,note:'Reviewed exact signed terminal event and fresh API result.',...patch});
 const terminal=()=>database.prepare(`SELECT * FROM ${kind}_recovery_terminal WHERE reference=?`).get(reference);
 const proposal=()=>recover(db,maker,command('propose_live_disposition',{evidenceId:terminal()?.evidence_id,disposition:status}),headers);
 const approvalInput=p=>command('approve_live_disposition',{proposalId:p.proposalId,evidenceId:terminal()?.evidence_id,disposition:status});
 const approve=p=>recover(db,finance,approvalInput(p),headers);
 const replace=(a,key='recovery-replacement')=>operate(db,maker,{...input,requestKey:key,replacesReference:reference,recoveryApprovalId:a.approvalId},headers);
 async function scenario(name,fn){database.exec('SAVEPOINT recovery_case');try{await fn();}catch(e){e.message=kind+' '+name+': '+e.message;throw e;}finally{db.afterRead=null;database.exec('ROLLBACK TO recovery_case; RELEASE recovery_case');status='failed';}}
 await scenario('uncertainty / 404 / missing events',async()=>{
  assert.equal(terminal(),undefined);
  await assert.rejects(proposal,/Hold this transfer/);
  await assert.rejects(()=>verify(async()=>Response.json({status:false},{status:404})),/unavailable/);
  await verify();assert.equal(terminal(),undefined);await assert.rejects(proposal,/Hold/);
  await assert.rejects(()=>replace({approvalId:'invented'}),/approval changed/);
  assert.equal(current().active_key,original.active_key);
 });
 for(const final of ['failed','reversed'])await scenario(final+' replacement lifecycle',async()=>{
  if(final==='reversed'){status='success';await signed('success');await verify();}
  status=final;await signed(final);await verify();assert.equal(terminal().disposition,final);
  const count=database.prepare(`SELECT count(*) n FROM ${kind}_transfer_observations`).get().n;
  await signed(final);assert.equal(database.prepare(`SELECT count(*) n FROM ${kind}_transfer_observations`).get().n,count,'signed replay deduplicates');
  const p=await proposal();
  await assert.rejects(()=>recover(db,maker,approvalInput(p),headers),/maker|Independent/);
  await assert.rejects(()=>recover(db,officer,approvalInput(p),headers),/Operations/);
  await assert.rejects(()=>recover(db,{...finance,userId:officer.userId},approvalInput(p),headers),/participant/);
  const a=await approve(p);
  await assert.rejects(()=>approve(p),/UNIQUE/);
  assert.equal(current().active_key,original.active_key,'approval alone never releases a claim');
  const result=await replace(a),child=database.prepare(`SELECT * FROM ${kind}_payment_instructions WHERE reference=?`).get(result.reference);
  assert.notEqual(child.reference,reference);assert.equal(child.source_json,original.source_json);assert.equal(child.destination_id,original.destination_id);assert.equal(child.status,'prepared');
  assert.equal(current().status,'dispatch_claimed');assert.equal(current().version,original.version+1);assert.equal(current().active_key,null);
  assert.equal(database.prepare(`SELECT count(*) n FROM ${kind}_payment_commands WHERE reference=? AND action='dispatch_live'`).get(reference).n,1);
  assert.equal((await replace(a)).reference,child.reference,'request retry returns same child');
  await assert.rejects(()=>replace(a,'second-replacement'),/approval changed|UNIQUE/);
  await assert.rejects(()=>operate(db,maker,{...input,requestKey:'unlinked-replacement'},headers),/explicit recovery chain/);
  const childCommand=(action)=>({action,reference:child.reference,version:1,sourceHash:child.source_hash,note:'Independent replacement instruction review',instructionReviewed:true});
  await operate(db,finance,childCommand(`approve_${kind}_payment`),headers);
  await assert.rejects(()=>exec(finance,'dispatch_live_payment',{reference:child.reference,sourceHash:child.source_hash,version:2,releaseId:'none'}),e=>e.status===423);
  await assert.rejects(()=>operate(db,finance,{action:`cancel_${kind}_payment`,reference,version:current().version,sourceHash:original.source_hash,note:'No cancellation after claim.'},headers),/cannot be repeated/);
  // A late contradictory original event blocks the child claim, even with a fresh exact recipient.
  await signed(final==='failed'?'success':'failed');
  assert.ok(database.prepare(`SELECT * FROM ${kind}_recovery_chain_holds WHERE reference=?`).get(child.reference));
  const destination=database.prepare(`SELECT payload_json FROM ${kind==='employee'?'payment':'partner'}_destination_reviews WHERE id=?`).get(child.destination_id);
  assert.throws(()=>database.prepare(`INSERT INTO ${kind}_payment_commands VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run('forged-child-dispatch',child.reference,2,'dispatch_live',current().approved_by,finance.userId,child.source_hash,JSON.parse(destination.payload_json).providerHash,'Claim after late evidence','owner_mfa_exception',new Date().toISOString()),/ancestor evidence|durable independently authorized claim/);
  await verify();assert.equal(terminal(),undefined,'verification cannot erase contradictory history');
  assert.throws(()=>database.exec(`DELETE FROM ${kind}_transfer_observations`),/immutable/);
  for(const table of ['proposals','approvals','replacements']){
   assert.throws(()=>database.exec(`DELETE FROM ${kind}_recovery_${table}`),/immutable/);
   assert.throws(()=>database.exec(`UPDATE ${kind}_recovery_${table} SET created_at=created_at`),/immutable/);
  }
 });
 await scenario('replacement dispatch, second generation and ancestor hold',async()=>{
  await signed('failed');await verify();const first=await replace(await approve(await proposal()),'first-generation');
  const child=database.prepare(`SELECT * FROM ${kind}_payment_instructions WHERE reference=?`).get(first.reference);
  const childCommand=action=>({action,reference:child.reference,version:database.prepare(`SELECT version FROM ${kind}_payment_instructions WHERE reference=?`).get(child.reference).version,sourceHash:child.source_hash,instructionReviewed:true,note:'Independent successor review.'});
  await operate(db,finance,childCommand(`approve_${kind}_payment`),headers);
  const childTransport=async(url,options)=>{
   if(url.includes('/transferrecipient/'))return Response.json({status:true,data:recipient});
   if(url.endsWith('/balance'))return Response.json({status:true,data:[{currency:'ZAR',balance:child.amount_cents+500}]});
   if(options.method==='POST'){posts++;const body=JSON.parse(options.body);assert.equal(body.reference,child.reference);return Response.json({status:true,data:{...transfer,reference:child.reference,status:'failed'}});}
   assert.equal(url,'https://api.paystack.co/transfer/verify/'+child.reference);return Response.json({status:true,data:{...transfer,reference:child.reference,status:'failed'}});
  };
  await dispatchLive(child.reference,childTransport);
  await assert.rejects(()=>operate(db,finance,{...childCommand(`cancel_${kind}_payment`),note:'No cancellation after claim.'},headers),/cannot be repeated/);
  await signed('failed',{reference:child.reference});await exec(finance,'verify_live_payment',{reference:child.reference,sourceHash:child.source_hash},runtime,childTransport);
  const t=database.prepare(`SELECT * FROM ${kind}_recovery_terminal WHERE reference=?`).get(child.reference);
  const recovery={...childCommand('propose_live_disposition'),kind,evidenceId:t.evidence_id,disposition:'failed',evidenceReviewed:true};
  database.exec('SAVEPOINT ancestor_contradiction');
  try{await signed('reversed');await assert.rejects(()=>recover(db,maker,recovery,headers),/evidence.*changed/);}finally{database.exec('ROLLBACK TO ancestor_contradiction; RELEASE ancestor_contradiction');}
  const p=await recover(db,maker,recovery,headers);
  const a=await recover(db,finance,{...recovery,action:'approve_live_disposition',proposalId:p.proposalId},headers);
  const second=await operate(db,maker,{...input,requestKey:'second-generation',replacesReference:child.reference,recoveryApprovalId:a.approvalId},headers);
  assert.equal(database.prepare(`SELECT count(*) n FROM ${kind}_recovery_replacements`).get().n,2);
  await signed('reversed');
  assert.ok(database.prepare(`SELECT * FROM ${kind}_recovery_chain_holds WHERE reference=?`).get(second.reference));
  const grandchild=database.prepare(`SELECT * FROM ${kind}_payment_instructions WHERE reference=?`).get(second.reference);
  await assert.rejects(()=>operate(db,finance,{action:`approve_${kind}_payment`,reference:grandchild.reference,version:1,sourceHash:grandchild.source_hash,instructionReviewed:true,note:'Must remain held on original conflict.'},headers),/ancestor evidence/);
 });
 await scenario('cancelled unsent successor keeps the complete claim chain',async()=>{
  await signed('failed');await verify();const a=await approve(await proposal()),first=await replace(a,'cancelled-successor-root');
  const child=database.prepare(`SELECT * FROM ${kind}_payment_instructions WHERE reference=?`).get(first.reference);
  await operate(db,finance,{action:`cancel_${kind}_payment`,reference:child.reference,version:child.version,sourceHash:child.source_hash,note:'Cancel only the never-submitted successor.'},headers);
  const nextInput={...input,requestKey:'cancelled-successor-new',replacesCancelledReference:child.reference};
  const races=await Promise.allSettled([operate(db,maker,nextInput,headers),operate(db,maker,{...nextInput,requestKey:'cancelled-successor-race'},headers)]);
  assert.equal(races.filter(r=>r.status==='fulfilled').length,1);
  const next=races.find(r=>r.status==='fulfilled').value.reference;
  assert.equal(database.prepare('SELECT predecessor FROM payment_unsent_replacements WHERE kind=? AND reference=?').get(kind,next).predecessor,child.reference);
  const newest=database.prepare(`SELECT * FROM ${kind}_payment_instructions WHERE reference=?`).get(next);
  assert.equal(newest.source_hash,original.source_hash);
  await signed('success');assert.ok(database.prepare(`SELECT * FROM ${kind}_recovery_chain_holds WHERE reference=?`).get(next));
  await assert.rejects(()=>operate(db,finance,{action:`approve_${kind}_payment`,reference:next,version:1,sourceHash:newest.source_hash,instructionReviewed:true,note:'Cannot ignore contradictory original evidence.'},headers),/ancestor evidence/);
  assert.throws(()=>database.exec('DELETE FROM payment_unsent_replacements'),/immutable/);
 });
 await scenario('stale evidence and evidence race',async()=>{
  await signed('failed');await verify();const p=await proposal();
  // Fresh GET is a new observation and invalidates the proposal snapshot.
  await verify();await assert.rejects(()=>approve(p),/evidence|Refresh/);
  const next=await proposal();let raced=false;
  db.afterRead=async({sql})=>{if(!raced&&sql.startsWith(`SELECT * FROM ${kind}_recovery_proposals`)){raced=true;await signed('success');}};
  await assert.rejects(()=>approve(next),/evidence.*changed/);db.afterRead=null;
  assert.equal(current().active_key,original.active_key);
 });
 await scenario('approval versus role revocation',async()=>{
  await signed('failed');await verify();const p=await proposal();let raced=false;
  db.afterRead=async({sql})=>{if(!raced&&sql.startsWith(`SELECT * FROM ${kind}_recovery_proposals`)){raced=true;database.prepare("UPDATE operator_accounts SET status='suspended' WHERE email=?").run(finance.email);}};
  await assert.rejects(()=>approve(p),/authority changed/);assert.equal(current().active_key,original.active_key);
 });
 await scenario('replacement versus finance revocation',async()=>{
  await signed('failed');await verify();const a=await approve(await proposal());
  database.prepare("UPDATE operator_role_assignments SET status='revoked' WHERE operator_id=(SELECT id FROM operator_accounts WHERE email=?)").run(finance.email);
  await assert.rejects(()=>replace(a),/approval changed|exact current independently/);assert.equal(current().active_key,original.active_key);
 });
 await scenario('replacement commit races revoked authority',async()=>{
  await signed('failed');await verify();const a=await approve(await proposal());let raced=false;
  db.afterRead=async({sql})=>{if(!raced&&sql.startsWith(`SELECT * FROM ${kind}_payment_sources`)){raced=true;database.prepare("UPDATE operator_accounts SET status='suspended' WHERE email=?").run(finance.email);}};
  await assert.rejects(()=>replace(a),/approval changed/);
  assert.equal(current().active_key,original.active_key);
  assert.equal(database.prepare(`SELECT count(*) n FROM ${kind}_recovery_replacements`).get().n,0);
 });
 await scenario('replacement source mutation rolls back the released slot',async()=>{
  await signed('failed');await verify();const a=await approve(await proposal());
  // Exercise the DB boundary with a forged child amount, after a valid reservation.
  const child={...original,reference:original.reference+'x',amount_cents:original.amount_cents+1,request_key:'wrong-replacement-amount',status:'prepared',version:1,approved_by:null};
  database.exec('SAVEPOINT invalid_source');
  try{
   database.prepare(`INSERT INTO ${kind}_recovery_replacements VALUES(?,?,?,?)`).run(child.reference,reference,a.approvalId,new Date().toISOString());
   assert.throws(()=>database.prepare(`INSERT INTO ${kind}_payment_instructions(`+Object.keys(child).join(',')+') VALUES('+Object.keys(child).map(()=>'?').join(',')+')').run(...Object.values(child)),/exact original|source or authority/);
   assert.equal(current().active_key,original.active_key);
  }finally{database.exec('ROLLBACK TO invalid_source; RELEASE invalid_source');}
 });
 await scenario('concurrent approvals and replacements',async()=>{
  await signed('failed');await verify();const p=await proposal();
  const decisions=await Promise.allSettled([approve(p),approve(p)]);assert.equal(decisions.filter(r=>r.status==='fulfilled').length,1);
  const a=decisions.find(r=>r.status==='fulfilled').value;
  const replacements=await Promise.allSettled([replace(a,'concurrent-one'),replace(a,'concurrent-two')]);assert.equal(replacements.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(database.prepare(`SELECT count(*) n FROM ${kind}_recovery_replacements WHERE predecessor=?`).get(reference).n,1);
 });
 await scenario('wrong identity and contradiction',async()=>{
  await signed('failed',{id:988});await verify();assert.equal(terminal(),undefined);
 });
 await scenario('success cannot become failed',async()=>{
  await signed('success');await signed('failed');await verify();assert.equal(terminal(),undefined);
 });
 await scenario('event during verification GET',async()=>{
  await signed('failed');
  await assert.rejects(()=>verify(async(...args)=>{const r=await transport(...args);await signed('reversed');return r;}),/webhook evidence changed/);
 });
 await scenario('expired final observation',async()=>{
  await signed('failed');
  const raw={id:String(transfer.id),code:transfer.transfer_code,reference,mode:'live',amount:transfer.amount,currency:'ZAR',recipientId:'123',integration:'456',status:'failed'};
  database.prepare(`INSERT INTO ${kind}_transfer_observations VALUES(?,?,'verify','transfer.verify',?,?,1,?)`).run('expired-proof',reference,'expired-proof',JSON.stringify(raw),new Date(Date.now()-3600000).toISOString());
  assert.equal(terminal(),undefined);await assert.rejects(proposal,/Hold/);
 });
 assert.equal(posts,2);assert.deepEqual({...current()},original,'all isolated recovery cases roll back');
 }finally{database.exec('ROLLBACK TO recovery_journey; RELEASE recovery_journey');db.batch=originalBatch;}
 assert.deepEqual({...current()},approved,'the live claim made for recovery coverage rolls back');
}
