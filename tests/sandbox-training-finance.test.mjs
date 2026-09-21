import test from 'node:test';import assert from 'node:assert/strict';
import {sandboxReady} from './fixtures/sandbox-completion.mjs';
import {setup as financeSetup,workspace} from './fixtures/finance-workflow-db.mjs';
import {maker,checker,applicant,assessor,independent} from './fixtures/production-identity-journey.mjs';
import {sandboxTraining} from '../app/lib/sandbox-training.ts';
import {prepareReadinessRule,decideReadiness} from '../app/lib/production-readiness.ts';
async function fixture(){const x=await sandboxReady();const f=await financeSetup({db:x.db,database:x.db.sql,seed:false,actors:{maker:{...maker,owner:true},reviewer:checker,officer:applicant,client:{userId:'fixture-client',email:'client@example.test',operations:false}}});
 await f.run({action:'publish_package',id:'first-aid',title:'Fictional first aid',provider:'Fictional training provider',price:60000,terms:'sandbox-terms-v1'});
 await f.run({action:'order_training',id:'course-order',applicationId:x.caseId,packageId:'first-aid',acceptedTerms:'sandbox-terms-v1'},applicant);
 const input={action:'import_finance',workspace,applicationId:x.caseId,financeEntitlementId:'entitlement:course-order',completionId:'course-completion'};
 return {x,f,input};}
for(const change of ['revoke','payment_evidence'])test('authenticated finance completion produces separately assessed readiness; '+change+' atomically holds it',async()=>{const {x,f,input}=await fixture();try{
 await assert.rejects(sandboxTraining(x.runtime,applicant,input));
 await f.run({action:'prepare_collection',id:'course-payment',orderId:'course-order',amount:60000});await f.settle('course-payment');await f.run({action:'issue_entitlement',orderId:'course-order'});
 await assert.rejects(sandboxTraining(x.runtime,applicant,input)); // Buying is not completing.
 await f.run({action:'record_completion',id:'course-completion',entitlementId:'entitlement:course-order',provider:'Fictional training provider',reference:'sandbox:actual-reviewed-completion'});
 await assert.rejects(sandboxTraining(x.runtime,checker,input),/Private/);
 const imported=await sandboxTraining(x.runtime,applicant,input);assert.equal(imported.qualified,false);assert.equal(imported.courseVersion,'1');
 await assert.rejects(sandboxTraining(x.runtime,applicant,input),/UNIQUE/);
 const rule=await prepareReadinessRule(x.db,maker,{code:'purpose_finance_training',label:'Fictional training bridge',category:'purpose',purposeCode:'finance_training',requirements:['training:first-aid'],maxDays:90,evidenceReference:'lokd-sandbox-completion-v1',expiresAt:new Date(Date.now()+86400000).toISOString()});await decideReadiness(x.db,checker,{kind:'rule',id:rule.id,decision:'approve',independentlyInspected:true,reason:'Versioned fixture policy'});
 const assessment={action:'assess',entitlementId:imported.entitlementId,officerReviewId:x.bridgeId,ruleId:rule.id,scorePercent:80,evidenceInspected:true,assessmentReference:'sandbox:practical-assessment'};
 await assert.rejects(sandboxTraining(x.runtime,checker,assessment),/independent/);
 const prepared=await sandboxTraining(x.runtime,assessor,assessment);await decideReadiness(x.db,independent,{kind:'review',id:prepared.id,decision:'approve',independentlyInspected:true,reason:'Inspected paid completion plus actual assessment'});
 assert.ok(x.db.sql.prepare('SELECT id FROM current_production_readiness_reviews WHERE id=?').get(prepared.id));
 if(change==='revoke')await f.run({action:'revoke_entitlement',entitlementId:'entitlement:course-order',reason:'Fictional refund investigation'});else await f.evidence('course-payment','reversed',{recover:true});
 assert.equal(x.db.sql.prepare('SELECT id FROM current_production_readiness_reviews WHERE id=?').get(prepared.id),undefined);
 assert.ok(x.db.sql.prepare('SELECT * FROM production_readiness_holds WHERE target_id=?').get(prepared.id));
 await assert.rejects(sandboxTraining(x.runtime,assessor,assessment));assert.equal(f.database.prepare('SELECT sum(balance) n FROM finance_balances').get().n,0);
 assert.equal(x.runtime.DB.sql.prepare('SELECT count(*) n FROM finance_records').get().n,0);
 }finally{x.close();}});
