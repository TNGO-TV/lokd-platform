import assert from 'node:assert/strict';
import test from 'node:test';
import {employeeTransfer,transferMatches} from '../app/lib/employee-transfer-evidence.ts';
const raw={id:987,transfer_code:'TRF_fixture001',reference:'lokd-pay-12345678-1234-1234-1234-123456789012',domain:'live',amount:60000,currency:'ZAR',source:'balance',recipient:123,integration:456,status:'success'};
const b={reference:raw.reference,mode:'live',amount:60000,currency:'ZAR',recipientId:'123',integration:'456'};
const t=employeeTransfer(raw);
test('employee transfer evidence validates provider identity currency amount and recipient shapes',()=>{
 assert.ok(t);for(const patch of [{id:NaN},{recipient:0},{integration:'invalid'},{transfer_code:'bad'},{reference:'../transfer'},{domain:'unknown'},{domain:'test'},{amount:1.5},{amount:0},{currency:'NGN'},{source:'other'},{status:'unknown'}])assert.equal(employeeTransfer({...raw,...patch}),null,JSON.stringify(patch));
 assert.ok(employeeTransfer({...raw,recipient:{id:123,integration:456,domain:'live',currency:'ZAR',type:'basa',details:{account_number:'PRIVATE'}}}));assert.equal(JSON.stringify(employeeTransfer(raw)).includes('PRIVATE'),false);
 assert.equal(employeeTransfer({...raw,recipient:{id:123,integration:456,domain:'test',currency:'ZAR',type:'basa'}}),null);
});
test('transfer bindings match only the exact live reference amount recipient and integration',()=>{
 assert.equal(transferMatches(b,t),true);assert.equal(transferMatches(b,null),false);
 for(const patch of [{amount:1},{mode:'test'},{recipientId:'999'},{integration:'999'},{reference:'different'},{currency:'NGN'}])assert.equal(transferMatches(b,{...t,...patch}),false,JSON.stringify(patch));
});
test('retired company transfers never enter employee reconciliation',()=>{
 const external={...raw,reference:raw.reference.replace('lokd-pay-','lokd-partner-pay-')};
 assert.equal(employeeTransfer(external),null);assert.equal(employeeTransfer(raw,'partner'),null);assert.equal(employeeTransfer(external,'partner'),null);
});
