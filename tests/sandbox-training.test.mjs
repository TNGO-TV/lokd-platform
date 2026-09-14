import test from 'node:test';import assert from 'node:assert/strict';
import {sandboxReady} from './fixtures/sandbox-completion.mjs';
import {maker,checker,assessor,applicant,independent} from './fixtures/production-identity-journey.mjs';
import {sandboxTraining as run} from '../app/lib/sandbox-training.ts';
import {prepareReadinessRule,decideReadiness,prepareReadinessReview} from '../app/lib/production-readiness.ts';
import {fixtureTrainingEntitlement} from './fixtures/sandbox-training-entitlement.mjs';
const financier={userId:'sandbox-finance-source',email:'finance@example.test',operations:true,owner:true};
test('training purchase is not qualification; score, current source and separate approval produce actual readiness',async()=>{
 const x=await sandboxReady();try{
 const rule=await prepareReadinessRule(x.db,maker,{code:'purpose_training_test',label:'Fictional qualification',category:'purpose',purposeCode:'training_test',requirements:['training:first-aid'],maxDays:90,evidenceReference:'lokd-sandbox-completion-v1',expiresAt:new Date(Date.now()+86400000).toISOString()});
 await decideReadiness(x.db,checker,{kind:'rule',id:rule.id,decision:'approve',independentlyInspected:true,reason:'Sandbox rule only'});
 const entitlement=await fixtureTrainingEntitlement(x.runtime,financier,{action:'entitle',officerId:x.officerId,course:'first-aid',courseVersion:'v1',commercialReference:'sandbox:finance-order'});assert.equal(entitlement.qualified,false);
 const input={action:'assess',entitlementId:entitlement.entitlementId,officerReviewId:x.bridgeId,ruleId:rule.id,scorePercent:79,evidenceInspected:true,assessmentReference:'sandbox:assessment'};
 await assert.rejects(run(x.runtime,applicant,input));await assert.rejects(run(x.runtime,financier,input));
 assert.equal((await run(x.runtime,assessor,input)).passed,false);
 const passed=await run(x.runtime,assessor,{...input,scorePercent:80});assert.equal(passed.qualified,false);
 await assert.rejects(decideReadiness(x.db,{...assessor,owner:true},{kind:'review',id:passed.id,decision:'approve',independentlyInspected:true,reason:'Self approval'}));
 await assert.rejects(decideReadiness(x.db,financier,{kind:'review',id:passed.id,decision:'approve',independentlyInspected:true,reason:'Source issuer approval'}));
 await decideReadiness(x.db,independent,{kind:'review',id:passed.id,decision:'approve',independentlyInspected:true,reason:'Independent inspected score and source'});
 assert.ok(x.db.sql.prepare('SELECT id FROM current_production_readiness_reviews WHERE id=?').get(passed.id));
 await run(x.runtime,financier,{action:'revoke',entitlementId:entitlement.entitlementId,reason:'Withdraw simulated commercial source'});
 assert.equal(x.db.sql.prepare('SELECT id FROM current_production_readiness_reviews WHERE id=?').get(passed.id),undefined);
 assert.equal(x.db.sql.prepare('SELECT count(*) n FROM sandbox_training_assessments').get().n,2);
 await assert.rejects(run(x.runtime,assessor,{...input,scorePercent:100}));
 assert.throws(()=>x.db.sql.exec('DELETE FROM sandbox_training_revocations'),/immutable/);
 assert.equal(x.runtime.DB.sql.prepare('SELECT count(*) n FROM production_readiness_reviews').get().n,0);
 }finally{x.close();}
});
test('a caller cannot replace training completion with a typed evidence claim',async()=>{const x=await sandboxReady();try{
 const rule=await prepareReadinessRule(x.db,maker,{code:'purpose_training_test',label:'Fictional qualification',category:'purpose',purposeCode:'training_test',requirements:['training:first-aid'],maxDays:90,evidenceReference:'lokd-sandbox-completion-v1',expiresAt:new Date(Date.now()+86400000).toISOString()});await decideReadiness(x.db,checker,{kind:'rule',id:rule.id,decision:'approve',independentlyInspected:true,reason:'Sandbox rule only'});
 await assert.rejects(prepareReadinessReview(x.db,assessor,{officerId:x.officerId,officerReviewId:x.bridgeId,ruleId:rule.id,sourcesActuallyInspected:true,evidence:[{requirement:'training:first-aid',ownerUserId:applicant.userId,reference:'fake source',sha256:'a'.repeat(64),checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString()}]}),/training/);
 }finally{x.close();}});

test('a separately installed stricter policy changes the same assessment outcome',async()=>{const x=await sandboxReady({policyOverrides:{trainingPassPercent:90}});try{
 const e=await fixtureTrainingEntitlement(x.runtime,financier,{action:'entitle',officerId:x.officerId,course:'first-aid',courseVersion:'v1',commercialReference:'sandbox:alternative-policy'});
 const result=await run(x.runtime,assessor,{action:'assess',entitlementId:e.entitlementId,scorePercent:80,evidenceInspected:true,assessmentReference:'sandbox:same-score'});assert.equal(result.passed,false);const source=JSON.parse(x.db.sql.prepare('SELECT source_json FROM sandbox_training_assessments WHERE id=?').get(result.assessmentId).source_json);assert.equal(source.passPercent,90);assert.equal(source.scorePercent,80);
 }finally{x.close();}});
