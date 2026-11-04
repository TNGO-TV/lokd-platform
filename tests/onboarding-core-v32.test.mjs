import assert from 'node:assert/strict';
import test from 'node:test';
import {officerOnboardingChecklist,onboardingSummary} from '../app/lib/onboarding-core.ts';
const pending={accountLinked:false,intakeReviewed:false,identityVerified:false,psiraVerified:false,agreementSigned:false,officerApproved:false,passportIssued:false};
test('officer checklist reports each real requirement independently',()=>{
 const checks=officerOnboardingChecklist({...pending,accountLinked:true,intakeReviewed:true},'APP-1');
 assert.equal(checks.length,7);assert.equal(checks.filter(c=>c.status==='complete').length,2);
 for(const id of ['identity','psira','agreement','approval','passport'])assert.equal(checks.find(c=>c.id===id).status,'required');
 assert.equal(checks.find(c=>c.id==='identity').href,'/officer/identity?caseId=APP-1');
});
test('passport alone never marks other requirements complete',()=>{
 const checks=officerOnboardingChecklist({...pending,passportIssued:true},'APP-2');
 const state=onboardingSummary([{id:'APP-2',displayName:'Officer',status:'reviewed',checklist:checks}],'2026-11-04T00:00:00Z');
 assert.equal(state.summary.completedCases,0);assert.equal(state.summary.passedChecks,1);assert.equal(state.summary.requiredChecks,7);
 assert.deepEqual(onboardingSummary([]).summary,{completedCases:0,totalCases:0,passedChecks:0,requiredChecks:0});
});

test('missing grade sends the applicant to their saved correction form',()=>{const check=officerOnboardingChecklist({...pending,psiraVerified:true,psiraGradeMissing:true},'APP-3').find(check=>check.id==='psira');assert.equal(check.status,'required');assert.equal(check.label,'Add your PSiRA grade');assert.equal(check.href,'/signup?kind=officer');});
