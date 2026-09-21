import test from 'node:test';import assert from 'node:assert/strict';
import {sandboxConnected} from './fixtures/sandbox-connected.mjs';
import {maker,checker,applicant} from './fixtures/production-identity-journey.mjs';
import {sandboxEngagement as run} from '../app/lib/sandbox-engagement.ts';
import {prepareRereviewDisposition,decideRereviewDisposition} from '../app/lib/production-rereview.ts';
import {manageProductionEvidence} from '../app/lib/production-evidence.ts';
import {activateAssignment,request} from './fixtures/identity-activation-environment.mjs';
const prepare=x=>({action:'prepare_transition',engagementId:x.fields.engagementId,expectedVersion:x.db.sql.prepare('SELECT version FROM workforce_engagements WHERE id=?').get(x.fields.engagementId).version,nextEngagementId:'NEXT-ENGAGEMENT',employerId:'EMP-SECOND',model:'managed',termsVersion:'sandbox:terms-v2',reference:'sandbox:changed-company'});
async function secondEmployer(x){const fields={employerId:'EMP-SECOND',legalName:'Fictional second employer',employerType:'lokd_employer',...Object.fromEntries(['psira','nbcpss','psspf','uif','coida','insurance','service_agreement'].map(k=>[k,'sandbox:'+k]))};const p=await manageProductionEvidence(x.db,maker,{action:'prepare_evidence',kind:'employer',fields,sourceDocumentsReviewed:true,expiresAt:new Date(Date.now()+2*86400000).toISOString()});await manageProductionEvidence(x.db,checker,{action:'decide_evidence',reviewId:p.reviewId,decision:'approve',evidenceIndependentlyChecked:true,reason:'Independent fictional employer sources'});}
test('multi-company transition keeps old employment history and requires new bound terms; independent atomic projection',async()=>{const x=await sandboxConnected();try{
 await secondEmployer(x);const original=x.db.sql.prepare('SELECT * FROM workforce_engagements WHERE id=?').get(x.fields.engagementId),p=await run(x.runtime,maker,prepare(x));
 await assert.rejects(run(x.runtime,applicant,{action:'decide_transition',transitionId:p.transitionId,decision:'approve',independentlyChecked:true,reason:'Self'}));await assert.rejects(run(x.runtime,{...maker,owner:true},{action:'decide_transition',transitionId:p.transitionId,decision:'approve',independentlyChecked:true,reason:'Self'}));
 await run(x.runtime,checker,{action:'decide_transition',transitionId:p.transitionId,decision:'approve',independentlyChecked:true,reason:'Versioned multi-company split'});
 const hold=x.db.sql.prepare('SELECT * FROM production_workforce_holds WHERE engagement_id=?').get(x.fields.engagementId);
 assert.ok(x.db.sql.prepare("SELECT audit_event_id FROM production_hold_provenance WHERE kind='workforce' AND hold_id=?").get(hold.id));
 const investigation=await prepareRereviewDisposition(x.db,maker,{kind:'workforce',holdId:hold.id,applicantVersion:2,evidenceReference:'sandbox:transition-investigation',evidenceHash:'a'.repeat(64),checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),actuallyInvestigated:true});
 const independent={userId:'transition-disposition-owner',email:'disposition@example.test',operations:true,owner:true};
 await decideRereviewDisposition(x.db,independent,{proposalId:investigation.id,decision:'allow_replacement',independentlyInvestigated:true,reason:'Independent fictional transition disposition'});
 const replacement=await manageProductionEvidence(x.db,maker,{action:'prepare_evidence',kind:'engagement',sourceDocumentsReviewed:true,expiresAt:new Date(Date.now()+86400000).toISOString(),fields:{...x.fields,engagementId:'NEXT-ENGAGEMENT',employerId:'EMP-SECOND',model:'managed',termsVersion:'sandbox:terms-v2',weeklyHourCap:'48'}});
 await manageProductionEvidence(x.db,checker,{action:'decide_evidence',reviewId:replacement.reviewId,decision:'approve',evidenceIndependentlyChecked:true,reason:'Fresh sources following the retained hold'});
 const old=x.db.sql.prepare('SELECT * FROM workforce_engagements WHERE id=?').get(x.fields.engagementId),next=x.db.sql.prepare("SELECT * FROM workforce_engagements WHERE id='NEXT-ENGAGEMENT'").get();assert.equal(old.status,'suspended');assert.equal(old.employer_id,original.employer_id);assert.equal(old.model,original.model);assert.equal(next.employer_id,'EMP-SECOND');assert.equal(next.model,'managed');assert.equal(next.active_key,x.officerId);
 assert.equal(x.db.sql.prepare("SELECT count(*) n FROM workforce_terms_acceptances WHERE workforce_engagement_id='NEXT-ENGAGEMENT'").get().n,0);
 assert.throws(()=>x.db.sql.exec('DELETE FROM sandbox_engagement_decisions'),/immutable/);await assert.rejects(run(x.runtime,checker,{action:'decide_transition',transitionId:p.transitionId,decision:'approve',independentlyChecked:true,reason:'Duplicate'}));
 }finally{x.close();}});
test('unresolved assignment and stale version block engagement replacement without rewriting employment',async()=>{const x=await sandboxConnected();try{
 await secondEmployer(x);const p=await run(x.runtime,maker,prepare(x));const version=x.db.sql.prepare("SELECT version FROM roster_slots WHERE id='SLOT-1'").get().version;
 // Refresh surrounding signatures after the employer evidence epoch changed.
 const {signFixtureAgreements}=await import('./fixtures/identity-activation-environment.mjs');await signFixtureAgreements(x.database);
 const a=await activateAssignment(x.activationDb,{...request('transition-block',x.officerId),expectedSlotVersion:version},'ops-fixture');assert.equal(a.state,'activated');
 await assert.rejects(run(x.runtime,checker,{action:'decide_transition',transitionId:p.transitionId,decision:'approve',independentlyChecked:true,reason:'Unfinished shift'}),/unresolved/);
 assert.equal(x.db.sql.prepare('SELECT status FROM workforce_engagements WHERE id=?').get(x.fields.engagementId).status,'active');
 }finally{x.close();}});
