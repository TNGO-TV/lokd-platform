import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import test from 'node:test';
import {env} from 'cloudflare:workers';
import {requireLiveFinanceCommand} from '../app/lib/production-finance-boundary.ts';
import {operateProduction} from '../app/lib/production-operations.ts';
import {collectionKey} from '../app/lib/booking-collections.ts';
import {POST as refund} from '../app/api/booking-refunds/route.ts';
import {POST as recovery} from '../app/api/payment-recovery/route.ts';
const actor={userId:'fixture-owner',email:'owner@example.test',operations:true,owner:true};
function fixture(){
 const sql=new DatabaseSync(':memory:');
 const tables=['booking_collection_requests','booking_settlement_reviews','payment_destination_reviews','partner_destination_reviews','employee_payment_instructions','partner_payment_instructions'];
 for(const table of tables){sql.exec(`CREATE TABLE ${table}(id TEXT,reference TEXT,mode TEXT)`);for(const mode of ['test','live'])sql.prepare(`INSERT INTO ${table} VALUES(?,?,?)`).run(mode+'-record',mode+'-record',mode);}
 const db={prepare(query){assert.match(query,/^SELECT mode FROM /);return {bind(value){return {first:async()=>sql.prepare(query).get(value)??null};}};}};
 return {sql,db,tables};
}
test('production entry rejects test preparation and dispatch before any provider, approval or storage work',async()=>{
 const db={prepare(){throw Error('unexpected storage access');}};
 for(const action of ['prepare_collection','prepare_destination','prepare_partner_destination','dispatch_employee_test','verify_employee_test','dispatch_partner_test','verify_partner_test'])await assert.rejects(()=>operateProduction(db,actor,{action,mode:'test'},new Headers()),e=>e.status===423);
 assert.throws(()=>collectionKey({PAYSTACK_LIVE_SECRET_KEY:'sk_live_fixture'},'live'),e=>e.status===423,'live provider acceptance stays locked');
});
test('saved test-mode records cannot be relabeled through production mutations or replacement references',async()=>{
 const {sql,db,tables}=fixture();try{
  const actions=['approve_collection','initialize_collection','verify_collection','prepare_settlement','approve_settlement','reject_settlement','hold_collection','apply_booking_funding','approve_destination','reject_destination','hold_destination','recheck_destination','prepare_employee_payment','approve_employee_payment','cancel_employee_payment','prepare_partner_payment','approve_partner_payment','cancel_partner_payment','approve_partner_destination','reject_partner_destination','hold_partner_destination','recheck_partner_destination'];
  for(const action of actions){
   const input={action,mode:'live',reference:'test-record',reviewId:'test-record',destinationId:'test-record'};
   await assert.rejects(()=>operateProduction(db,actor,input,new Headers()),e=>e.status===423,action);
   await requireLiveFinanceCommand(db,{...input,reference:'live-record',reviewId:'live-record',destinationId:'live-record'});
  }
  for(const kind of ['employee','partner'])for(const key of ['replacesReference','replacesCancelledReference'])await assert.rejects(()=>requireLiveFinanceCommand(db,{action:`prepare_${kind}_payment`,destinationId:'live-record',[key]:'test-record'}),e=>e.status===423);
  for(const table of tables)assert.equal(sql.prepare(`SELECT count(*) n FROM ${table}`).get().n,2,'history retained');
 }finally{sql.close();}
});
test('the separate production recovery endpoint refuses test actions and forged live aliases',async()=>{
 const {sql,db}=fixture(),saved={...env};Object.assign(env,{DB:db,LOKD_APP_STAGE:'production',LOKD_PILOT_ACCESS_JSON:JSON.stringify({owners:[actor.email]}),LOKD_OPERATIONS_MFA_REQUIRED:'false'});
 try{
  for(const action of ['propose_test_disposition','approve_test_disposition','propose_live_disposition','approve_live_disposition']){
   const response=await recovery(new Request('https://operations.lokd.co.za/api/payment-recovery',{method:'POST',headers:{origin:'https://operations.lokd.co.za','content-type':'application/json','x-lokd-verified-email':actor.email,'x-lokd-verified-user-id':actor.userId},body:JSON.stringify({action,kind:'employee',reference:'test-record'})}));
   assert.equal(response.status,423,await response.text());
  }
 }finally{for(const key of Object.keys(env))delete env[key];Object.assign(env,saved);sql.close();}
});

test('production refund endpoint rejects a saved test collection before any refund workflow or provider call',async()=>{
 const {sql,db}=fixture(),saved={...env};Object.assign(env,{DB:db,LOKD_APP_STAGE:'production',LOKD_PILOT_ACCESS_JSON:JSON.stringify({owners:[actor.email]}),LOKD_OPERATIONS_MFA_REQUIRED:'false'});
 try{for(const action of ['prepare','approve','claim','dispatch','observe','reconcile']){
  const response=await refund(new Request('https://operations.lokd.co.za/api/booking-refunds',{method:'POST',headers:{origin:'https://operations.lokd.co.za','content-type':'application/json','x-lokd-verified-email':actor.email,'x-lokd-verified-user-id':actor.userId},body:JSON.stringify({action,reference:'test-record'})}));
  assert.equal(response.status,423,await response.text());
 }}finally{for(const key of Object.keys(env))delete env[key];Object.assign(env,saved);sql.close();}
});
