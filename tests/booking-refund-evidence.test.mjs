import test from 'node:test';
import assert from 'node:assert/strict';
import {refundEvidence} from '../app/lib/booking-refund-evidence.ts';
const raw={id:12,integration:456,transaction:{id:99,domain:'live'},domain:'live',amount:12000,currency:'ZAR',status:'processed',merchant_note:'lokd-refund-fixture',fully_deducted:true,deducted_amount:12000,customer:{account_number:'NEVER-PERSIST'}};
test('refund evidence binds explicit mode, integer money and exact transaction without customer data',()=>{
 const e=refundEvidence(raw);assert.equal(e.transactionId,'99');assert.equal(e.amountMinor,12000);assert.equal(JSON.stringify(e).includes('NEVER-PERSIST'),false);
 for(const status of ['pending','processing','processed','failed','needs-attention'])assert.equal(refundEvidence({...raw,status}).status,status);
 assert.equal(refundEvidence({...raw,transaction:99}).transactionId,'99');
});
test('malformed mode, amount, identity, terminal status and bank deduction fail closed',()=>{
 for(const change of [{domain:'test'},{domain:undefined},{amount:0},{amount:12.2},{amount:'12000'},{id:0},{id:Number.MAX_SAFE_INTEGER+1},{transaction:null},{currency:'NGN'},{status:'success'},{merchant_note:undefined},{fully_deducted:'true'},{deducted_amount:12001},{deducted_amount:-1}])assert.equal(refundEvidence({...raw,...change}),null,JSON.stringify(change));
 for(const value of [null,[],12,'processed'])assert.equal(refundEvidence(value),null);
});
