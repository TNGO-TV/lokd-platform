import assert from 'node:assert/strict';
import test from 'node:test';
import {employeeTransfer,employeeTransferOutcome as outcome} from '../app/lib/employee-transfer-evidence.ts';
const raw={id:987,transfer_code:'TRF_fixture001',reference:'lokd-pay-12345678-1234-1234-1234-123456789012',domain:'test',amount:60000,currency:'ZAR',source:'balance',recipient:123,integration:456,status:'success'};
const b={reference:raw.reference,mode:'test',amount:60000,currency:'ZAR',recipientId:'123',integration:'456'};
const t=employeeTransfer(raw),api={source:'verify',event:'transfer.verify',transfer:t,webhookCount:1},signed={source:'webhook',event:'transfer.success',transfer:t,webhookCount:null};
test('employee transfer evidence validates provider identity currency amount and recipient shapes',()=>{
 assert.ok(t);for(const patch of [{id:NaN},{recipient:0},{integration:'invalid'},{transfer_code:'bad'},{reference:'../transfer'},{domain:'unknown'},{amount:1.5},{amount:0},{currency:'NGN'},{source:'other'},{status:'unknown'}])assert.equal(employeeTransfer({...raw,...patch}),null,JSON.stringify(patch));
 assert.ok(employeeTransfer({...raw,recipient:{id:123,integration:456,domain:'test',currency:'ZAR',type:'basa',details:{account_number:'PRIVATE'}}}));assert.equal(JSON.stringify(employeeTransfer(raw)).includes('PRIVATE'),false);
 assert.equal(employeeTransfer({...raw,recipient:{id:123,integration:456,domain:'live',currency:'ZAR',type:'basa'}}),null);
});
test('employee transfer outcome requires current signed and API agreement and never retries reversed or conflicting evidence',()=>{
 assert.equal(outcome(b,[]),'unverified');assert.equal(outcome(b,[{...api,webhookCount:0}]),'awaiting_signed_confirmation');assert.equal(outcome(b,[signed]),'verification_required');assert.equal(outcome(b,[signed,api]),'confirmed_test');
 for(const patch of [{amount:1},{mode:'live'},{recipientId:'999'},{integration:'999'},{reference:'different'},{currency:'NGN'}])assert.equal(outcome(b,[signed,{...api,transfer:{...t,...patch}}]),'review_required');
 assert.equal(outcome(b,[signed,api,{...signed,event:'transfer.reversed',transfer:{...t,status:'reversed'}}]),'reversed_test');
 assert.equal(outcome(b,[signed,api,{...api,transfer:{...t,id:'998'}}]),'review_required');
 assert.equal(outcome(b,[signed,{...api,webhookCount:0}]),'verification_required');assert.equal(outcome(b,[{...signed,event:'transfer.failed'},api]),'review_required');
 assert.equal(outcome(b,[signed,{...api,transfer:{...t,status:'failed'}}]),'failed_test');assert.equal(outcome(b,[{...api,webhookCount:0,transfer:{...t,status:'otp'}}]),'provider_authorization_required');
});
test('company transfers require their own reference namespace and preserve exact reconciliation bindings',()=>{
 const partner={...raw,reference:raw.reference.replace('lokd-pay-','lokd-partner-pay-')};
 assert.equal(employeeTransfer(partner),null);assert.equal(employeeTransfer(raw,'partner'),null);
 const normalized=employeeTransfer(partner,'partner');assert.ok(normalized);
 const evidence=[{...signed,transfer:normalized},{...api,transfer:normalized}];
 assert.equal(outcome({...b,reference:partner.reference},evidence),'confirmed_test');
 assert.equal(outcome(b,evidence),'review_required');
});
