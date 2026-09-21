import assert from 'node:assert/strict';
import test from 'node:test';
import {assessPaymentEvidence as assess,paymentEvidenceSnapshotHash as hash,PAYMENT_REVIEW_FRESHNESS_MS} from '../app/lib/payment-reconciliation-evidence.ts';
const at='2026-09-13T18:00:00.000Z',now=new Date('2026-09-13T18:01:00.000Z');
function fixture(kind='employee',mode='live',status='success'){
 const reference=(kind==='employee'?'lokd-pay-':'lokd-partner-pay-')+'12345678-1234-1234-1234-123456789012';
 const binding={kind,mode,reference,liabilityId:kind+'-liability',sourceHash:'a'.repeat(64),amount:60000,currency:'ZAR',recipientId:'123',integration:'456'};
 const claim={commandId:'claim-one',reference,mode,sourceHash:binding.sourceHash,claimedAt:at};
 const transfer={reference,mode,id:'987',code:'TRF_fixture001',amount:60000,currency:'ZAR',recipientId:'123',integration:'456',status};
 const event=(sequence,source,value=status)=>({id:'event-'+sequence,sequence,source,event:source==='webhook'?'transfer.'+value:source==='verify'?'transfer.verify':'transfer.initiate',transfer:{...transfer,status:value},webhookCount:source==='verify'?1:null,observedAt:at});
 return {binding,claim,observations:[event(1,'initiate','pending'),event(2,'webhook'),event(3,'verify')],event};
}
for(const kind of ['employee','partner'])for(const mode of ['test','live'])test(`${kind} ${mode}: exact final evidence yields a review snapshot, never payment or replacement authority`,async()=>{
 for(const status of ['success','failed','reversed']){
  const f=fixture(kind,mode,status),decision=assess(f,now);
  assert.equal(decision.state,'provider_'+status);assert.equal(decision.canMarkPaid,false);assert.equal(decision.canReplace,false);
  assert.equal(decision.reviewableFor,status==='success'?(mode==='test'?'test_confirmation':'live_reconciliation'):'terminal_disposition');
  const first=await hash(decision.snapshot);assert.match(first,/^[a-f0-9]{64}$/);assert.equal(await hash(assess(f,new Date(now.getTime()+1000)).snapshot),first);
  const copy=structuredClone({binding:f.binding,claim:f.claim,observations:f.observations});copy.observations.at(-1).id='another-verify';assert.notEqual(await hash(assess(copy,now).snapshot),first);
 }
});
test('unknown, missing claim, missing signed events and stale verification remain unreviewable',()=>{
 const f=fixture();assert.equal(assess({...f,claim:null,observations:[]},now).state,'not_submitted');
 assert.equal(assess({...f,observations:[]},now).state,'unknown');assert.equal(assess({...f,claim:null},now).state,'held');
 const api=f.event(1,'verify');api.webhookCount=0;assert.deepEqual(assess({...f,observations:[api]},now).reasons,['signed_confirmation_required']);
 assert.deepEqual(assess({...f,observations:f.observations.slice(0,2)},now).reasons,['verification_required']);
 assert.deepEqual(assess(f,new Date(Date.parse(at)+PAYMENT_REVIEW_FRESHNESS_MS+1)).reasons,['verification_stale']);
});
test('all reference, mode, amount, integration, recipient and transfer identity mutations hold',()=>{
 for(const patch of [{reference:'lokd-pay-aaaaaaaa-1234-1234-1234-123456789012'},{mode:'test'},{amount:60001},{currency:'NGN'},{integration:'457'},{recipientId:'124'},{id:'988'},{code:'TRF_other0001'},{status:'not-a-status'}, {id:''}, {amount:null}]){
  const f=fixture();Object.assign(f.observations.at(-1).transfer,patch);assert.equal(assess(f,now).state,'held',JSON.stringify(patch));assert.equal(assess(f,now).snapshot,null);
 }
 for(const patch of [{kind:'partner'},{mode:'fake'},{sourceHash:'invalid'},{amount:NaN},{amount:0},{liabilityId:''}]){const f=fixture();Object.assign(f.binding,patch);assert.equal(assess(f,now).state,'held');}
});
test('reversal preserves success chronology but failure/success mixtures and late regressions hold',()=>{
 const f=fixture();f.observations.push(f.event(4,'webhook','reversed'),{...f.event(5,'verify','reversed'),webhookCount:2});assert.equal(assess(f,now).state,'provider_reversed');
 for(const history of [['failed','success'],['success','failed'],['reversed','success'],['success','pending'],['failed','reversed']]){
  const x=fixture();x.observations=[x.event(1,'webhook',history[0]),{...x.event(2,'verify',history[1]),webhookCount:1}];assert.equal(assess(x,now).state,'held',history.join(','));
 }
});
test('watermarks, duplicate or reordered rows, operations holds and future observations cannot be approved',()=>{
 const cases=[f=>{f.observations.at(-1).webhookCount=0;},f=>{f.observations[1].sequence=1;},f=>{f.observations[1].id=f.observations[0].id;},f=>{f.observations[1].source='operations';},f=>{f.observations[1].observedAt='2026-09-14T00:00:00.000Z';},f=>{f.observations[1].event='transfer.failed';},f=>{f.claim.reference='other';},f=>{f.claim.sourceHash='b'.repeat(64);},f=>{f.claim.mode='test';}];
 for(const mutate of cases){const f=fixture();mutate(f);assert.equal(assess(f,now).state,'held');}
 const f=fixture();assert.deepEqual(assess({...f,observations:Array(501).fill(f.observations[0])},now).reasons,['evidence_limit']);
});
test('snapshots exclude extra credentials and full account data and are detached from mutable inputs',()=>{
 const f=fixture();f.binding.secret='NEVER_EXPORT';f.claim.secret='NEVER_EXPORT';f.observations[1].account_number='NEVER_EXPORT';f.observations[2].transfer.secret='NEVER_EXPORT';
 const d=assess(f,now);assert.equal(JSON.stringify(d.snapshot).includes('NEVER_EXPORT'),false);f.observations[2].transfer.amount=1;assert.equal(d.snapshot.transfer.amount,60000);
});
