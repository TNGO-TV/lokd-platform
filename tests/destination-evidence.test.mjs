import assert from 'node:assert/strict';
import test from 'node:test';
import {recipientEvidence,fetchRecipient,destinationKey,accountFingerprint} from '../app/lib/destination-evidence.ts';
const key='sk_test_fixture';
const raw={id:123,integration:456,recipient_code:'RCP_fixture001',domain:'test',type:'basa',currency:'ZAR',active:true,is_deleted:false,name:'Private Name',updatedAt:'2026-01-01T00:00:00Z',details:{account_number:'1234567890',bank_code:'632005',bank_name:'Fixture',account_name:null}};
test('recipient evidence refuses inactive deleted wrong-mode wrong-country and malformed provider data',async()=>{
 assert.ok(await recipientEvidence(raw,raw.recipient_code,'test',key));
 for(const change of [{id:NaN},{integration:undefined},{recipient_code:'RCP_other000'},{domain:'live'},{type:'nuban'},{currency:'NGN'},{active:false},{is_deleted:true},{is_deleted:undefined},{updatedAt:'bad'},{updatedAt:'2099-01-01'},{details:null},{details:{...raw.details,account_number:'1234xxxx90'}},{details:{...raw.details,bank_code:'bad'}}])assert.equal(await recipientEvidence({...raw,...change},raw.recipient_code,'test',key),null,JSON.stringify(change));
});
test('recipient snapshots retain masked evidence and detect account name bank integration and revision changes',async()=>{
 const evidence=await recipientEvidence(raw,raw.recipient_code,'test',key),json=JSON.stringify(evidence);assert.equal(json.includes('Private Name'),false);assert.equal(json.includes('1234567890'),false);assert.equal(evidence.last4,'7890');
 for(const change of [{name:'Changed'},{integration:789},{updatedAt:'2026-02-01T00:00:00Z'},{details:{...raw.details,account_number:'1234567891'}},{details:{...raw.details,account_name:'Another owner'}},{details:{...raw.details,bank_code:'250655'}}])assert.notEqual(JSON.stringify(await recipientEvidence({...raw,...change},raw.recipient_code,'test',key)),json);
 assert.notEqual(await accountFingerprint(key,'632005','1234567890'),await accountFingerprint('sk_live_other','632005','1234567890'));
});
test('recipient transport is read-only mode-specific and sanitizes provider errors',async()=>{
 assert.throws(()=>destinationKey({PAYSTACK_TEST_SECRET_KEY:'sk_live_wrong'},'test'),/not configured/);
 let calls=0;const transport=async(url,init)=>{calls++;assert.equal(url,'https://api.paystack.co/transferrecipient/RCP_fixture001');assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Bearer '+key);return Response.json({status:true,data:raw});};
 assert.ok(await fetchRecipient(key,raw.recipient_code,'test',transport));assert.equal(calls,1);
 await assert.rejects(()=>fetchRecipient(key,'../transfer','test',transport),/existing/);assert.equal(calls,1);
 await assert.rejects(()=>fetchRecipient(key,raw.recipient_code,'test',async()=>{throw Error('secret or account');}),e=>!e.message.includes('secret or account')&&e.status===503);
});
