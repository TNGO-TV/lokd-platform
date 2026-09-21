import assert from 'node:assert/strict';
import {preparePayrollCorrectionReview as prepare,decidePayrollCorrectionReview as decide,readPayrollCorrectionReviews as read} from '../../app/lib/payroll-correction-reviews.ts';
export async function payrollCorrectionReviewJourney({db,database,itemId,maker,finance,applicant,headers}){
 const originalTables=['payroll_runs','payroll_items','production_payroll_snapshots','production_payroll_decisions','pay_item_sources','finance_document_versions','finance_document_decisions','finance_document_issues','employee_payment_instructions'];
 const original=()=>Object.fromEntries(originalTables.map(t=>[t,database.prepare('SELECT * FROM '+t+' ORDER BY rowid').all()]));const before=original();
 const input={itemId,requestKey:'correction-connected',originalReviewed:true,findings:'An exported payslip needs its source facts checked.',requestedCorrection:'Compare the recorded deductions with the supplied source. No new amounts approved.',evidenceReference:'fixture-source-reference',evidenceHash:'a'.repeat(64)};
 await assert.rejects(()=>prepare(db,applicant,input,headers(applicant)),/Operations|own correction/);
 const first=await prepare(db,maker,input,headers(maker));assert.equal(first.payChanged,false);assert.equal(first.calculationStatus,'awaiting_company_rules');
 assert.equal((await prepare(db,maker,input,headers(maker))).reviewId,first.reviewId);
 await assert.rejects(()=>prepare(db,maker,{...input,findings:'Different facts with the same key'},headers(maker)),/different correction/);
 const saved=()=>database.prepare('SELECT * FROM payroll_correction_reviews WHERE id=?').get(first.reviewId),row=saved();
 const command={reviewId:row.id,payloadHash:row.payload_hash,decision:'evidence_reviewed',originalReviewed:true,findings:'Original records checked; payment rules still required.'};
 await assert.rejects(()=>decide(db,maker,command,headers(maker)),/maker|finance approver|different person/i);
 await assert.rejects(()=>decide(db,finance,{...command,decision:'approved'},headers(finance)),/cannot approve changed pay/);
 await assert.rejects(()=>decide(db,finance,{...command,payloadHash:'f'.repeat(64)},headers(finance)),/exact original/);
 database.exec('SAVEPOINT correction_authority');try{database.prepare("UPDATE operator_accounts SET status='suspended' WHERE id=?").run(row.operator_id);await assert.rejects(()=>decide(db,finance,command,headers(finance)),/current payroll evidence/);}finally{database.exec('ROLLBACK TO correction_authority; RELEASE correction_authority');}
 const results=await Promise.allSettled([decide(db,finance,command,headers(finance)),decide(db,finance,command,headers(finance))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const next=await prepare(db,maker,{...input,parentId:row.id,requestKey:'correction-connected-next',findings:'New evidence is attached to a new immutable review.'},headers(maker));assert.notEqual(next.reviewId,row.id);
 const page=await read(db,maker,headers(maker),itemId,0,1);assert.equal(page.reviews.length,1);assert.equal(page.reviews[0].reviewer_user_id,finance.userId);assert.ok(page.nextAfter>0);assert.equal((await read(db,maker,headers(maker),itemId,page.nextAfter,1)).reviews[0].id,next.reviewId);
 await assert.rejects(()=>read(db,applicant,headers(applicant),itemId),/own correction|Operations/);
 for(const table of ['payroll_correction_reviews','payroll_correction_decisions']){
  assert.throws(()=>database.exec('DELETE FROM '+table),/immutable/);
  assert.throws(()=>database.exec('UPDATE '+table+' SET payload_hash=payload_hash'),/immutable/);
  assert.throws(()=>database.exec('INSERT OR REPLACE INTO '+table+' SELECT * FROM '+table+' LIMIT 1'),/immutable/);
 }
 assert.deepEqual(original(),before);assert.deepEqual(saved(),row);
 return {reviewId:next.reviewId};
}
