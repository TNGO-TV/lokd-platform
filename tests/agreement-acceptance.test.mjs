import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { agreementHash, canonicalAgreementContext, prepareAgreementReceipt, storeAgreementReceipt } from '../app/lib/agreement-acceptance.ts';
async function fixture(purpose='client_service') {
 const wording='Synthetic test fixture for acceptance mechanics. No real contract.';
 const context={subjectId:'CL-TEST',transactionId:'BK-TEST',transactionVersion:'1',scope:{priceCents:120000,currency:'ZAR',riskPlanVersion:'3',employerId:'EMP-TEST'}};
 const contentHash=await agreementHash(wording);
 return {document:{id:'DOC-TEST',version:'1',purpose,entityId:'ENTITY-TEST',locale:'en-ZA',status:'approved',approvedBy:'legal-fixture',approvedAt:'2026-09-01T00:00:00Z',effectiveFrom:'2026-09-01T00:00:00Z',effectiveTo:null,wording,contentHash},context,
 presentedContentHash:contentHash,presentedContextHash:await agreementHash(canonicalAgreementContext(context)),expectedPurpose:purpose,expectedEntityId:'ENTITY-TEST',expectedLocale:'en-ZA',actorUserId:'user_fixture',identityEvidence:'fixture-only identity',authorityEvidence:'fixture-only mandate',action:purpose==='privacy_acknowledgement'?'acknowledge':'agree',affirmative:true,now:Date.parse('2026-09-09T12:00:00Z')};
}
test('drafts, unfinished wording, wrong entity/purpose/locale and missing signer proof cannot be accepted',async()=>{
 const input=await fixture();
 for(const patch of [{status:'draft'},{status:'withdrawn'},{wording:'[[entity]]'},{approvedBy:null},{effectiveFrom:'2099-01-01'},{effectiveTo:'2026-09-08'},{entityId:'other'},{purpose:'marketing_consent'},{locale:'en-US'}])
  await assert.rejects(()=>prepareAgreementReceipt({...input,document:{...input.document,...patch}}));
 for(const patch of [{affirmative:false},{actorUserId:''},{identityEvidence:''},{authorityEvidence:''},{action:'acknowledge'}])await assert.rejects(()=>prepareAgreementReceipt({...input,...patch}));
});
test('a changed order or wording requires fresh presentation and old receipts retain their exact copy',async()=>{
 const input=await fixture();const original=await prepareAgreementReceipt(input);
 input.context.scope.priceCents++;
 await assert.rejects(()=>prepareAgreementReceipt(input),/changed/);
 input.document.wording+=' Amended.';
 input.presentedContextHash=await agreementHash(canonicalAgreementContext(input.context));
 await assert.rejects(()=>prepareAgreementReceipt(input),/changed/);
 const preserved=JSON.parse(original.receiptJson);
 assert.equal(preserved.context.scope.priceCents,120000);assert.equal(preserved.documentVersion,'1');
 assert.equal(preserved.grantsWorkEligibility,false);assert.equal(preserved.grantsPaymentAuthority,false);
});
test('privacy acknowledgement cannot substitute for identity or marketing consent, or a bank instruction for deductions',async()=>{
 for(const purpose of ['privacy_acknowledgement','bank_instruction']){
  const input=await fixture(purpose);const receipt=JSON.parse((await prepareAgreementReceipt(input)).receiptJson);
  assert.equal(receipt.purpose,purpose);
  for(const expectedPurpose of ['identity_consent','marketing_consent','deduction_authorisation'])await assert.rejects(()=>prepareAgreementReceipt({...input,expectedPurpose}),/purpose/);
 }
});
test('database receipts are immutable and retries cannot overwrite a prior accepted version',async()=>{
 const sql=new DatabaseSync(':memory:');
 for(const f of fs.readdirSync(new URL('../drizzle',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync(new URL(`../drizzle/${f}`,import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));
 const db = { prepare(query) {
   return { bind(...args) {
     return {
       async run() { sql.prepare(query).run(...args); },
       async first() { return sql.prepare(query).get(...args) ?? null; },
     };
   }};
 }};
 const input=await fixture();const receipt=await prepareAgreementReceipt(input);
 await storeAgreementReceipt(db,'acceptance:test',receipt);await storeAgreementReceipt(db,'acceptance:test',receipt);
 input.now+=1000;
 const changed=await prepareAgreementReceipt(input);
 await assert.rejects(()=>storeAgreementReceipt(db,'acceptance:test',changed),/different evidence/);
 assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM agreement_acceptance_receipts').get().n,1);
 assert.throws(()=>sql.exec("UPDATE agreement_acceptance_receipts SET receipt_json='{}'"),/append-only/);
 assert.throws(()=>sql.exec('DELETE FROM agreement_acceptance_receipts'),/append-only/);
 sql.close();
});
