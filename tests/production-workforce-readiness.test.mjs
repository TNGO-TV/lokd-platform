import assert from 'node:assert/strict';
import test from 'node:test';
import {complete,maker,checker} from './fixtures/production-identity-journey.mjs';
import {manageProductionEvidence} from '../app/lib/production-evidence.ts';

test('independent production evidence approval records partner payroll and benefits confirmation',async()=>{
  const x=await complete();
  try {
    const expires=new Date(Date.now()+86400000).toISOString();
    x.db.sql.prepare("INSERT INTO workforce_employers(id,legal_name,employer_type,environment,status,review_due_at) VALUES('PARTNER-READINESS','Partner Security','partner_company','production','current',?)").run(expires);
    const fields={engagementId:'PARTNER-ENGAGEMENT',officerId:x.officerId,employerId:'PARTNER-READINESS',model:'partner',termsVersion:'PARTNER-TERMS-v1',engagementReference:'evidence:partner-engagement',weeklyHourCap:'48',payrollReference:'evidence:partner-payroll-confirmation',benefitsReference:'evidence:partner-benefits-confirmation'};
    const prepared=await manageProductionEvidence(x.db,maker,{action:'prepare_evidence',kind:'engagement',fields,sourceDocumentsReviewed:true,expiresAt:expires});
    assert.equal(x.db.sql.prepare('SELECT COUNT(*) AS count FROM workforce_engagements WHERE id=?').get(fields.engagementId).count,0);
    await assert.rejects(()=>manageProductionEvidence(x.db,{...maker,owner:true},{action:'decide_evidence',reviewId:prepared.reviewId,decision:'approve',evidenceIndependentlyChecked:true,reason:'Own review must be rejected'}),/preparer/);
    await manageProductionEvidence(x.db,checker,{action:'decide_evidence',reviewId:prepared.reviewId,decision:'approve',evidenceIndependentlyChecked:true,reason:'Independently inspected partner statutory responsibilities'});
    assert.deepEqual({...x.db.sql.prepare('SELECT model,payroll_status,benefits_status FROM workforce_engagements WHERE id=?').get(fields.engagementId)},{model:'partner',payroll_status:'partner_confirmed',benefits_status:'partner_confirmed'});
  } finally {x.db.sql.close();}
});
