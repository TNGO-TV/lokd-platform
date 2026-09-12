import test from 'node:test';
import assert from 'node:assert/strict';
import {settlementEvidence} from '../app/lib/settlement-evidence.ts';
import {collectionMetadata} from '../app/lib/collection-evidence.ts';
const b={reference:'booking-fixture',orderId:'order',clientId:'client',applicantId:'applicant',caseId:'case',caseVersion:2,sourceHash:'exact-source',amountMinor:10000,currency:'ZAR',mode:'live'};
const tx={id:10,reference:b.reference,domain:'live',status:'success',currency:'ZAR',amount:10000,fees:150,fees_split:null,paid_at:'2026-01-01T01:00:00Z',metadata:collectionMetadata(b)};
const settlement={id:100,domain:'live',currency:'ZAR',status:'success',total_processed:10000,total_fees:150,total_amount:9850,effective_amount:9850,deductions:null,settlement_date:'2026-01-02T00:00:00Z'};
test('settlement binds full gross, fees, bank net and exact collection transaction',()=>{
 const e=settlementEvidence(b,'10',settlement,[tx],9850);assert.equal(e.transactionFeeMinor,150);assert.equal(e.bankMinor,9850);assert.equal(e.processedMinor,10000);
 for(const patch of [{domain:'test'},{currency:'USD'},{status:'pending'},{effective_amount:10000},{total_fees:0},{deductions:1},{settlement_date:'2999-01-01'},{id:Number.MAX_SAFE_INTEGER+1}])assert.equal(settlementEvidence(b,'10',{...settlement,...patch},[tx],9850),null);
 assert.equal(settlementEvidence(b,'10',settlement,[tx],9851),null);
});
test('settlement refuses partial lists, duplicate IDs, wrong binding and unsupported fee splits',()=>{
 for(const rows of [[],[tx,tx],[{...tx,reference:'other'}],[{...tx,fees:149}],[{...tx,fees_split:{subaccount:10}}],[{...tx,metadata:{...tx.metadata,source_hash:'changed'}}],[{...tx,paid_at:'2026-01-03'}]])assert.equal(settlementEvidence(b,'10',settlement,rows,9850),null);
 const other={...tx,id:11,reference:'other',amount:2000,fees:50};
 const total={...settlement,total_processed:12000,total_fees:200,total_amount:11800,effective_amount:11800};
 assert.equal(settlementEvidence(b,'10',total,[tx,other],11800).transactionCount,2);
 assert.equal(settlementEvidence(b,'10',total,[tx],11800),null);
});
