import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {complete,applicant,maker,checker,assessor,decision,prepareReadinessPassport} from './fixtures/production-identity-journey.mjs';
import {D1Adapter,seedEnvironment,seedOfficerSupport,moveCandidateToCheckInWindow,passDueScheduledCheckpoints,request,activateAssignment,revalidateAssignment} from './fixtures/identity-activation-environment.mjs';
import {manageProductionEvidence} from '../app/lib/production-evidence.ts';

async function connected({clockFix=true}={}){
 const x=await complete(),database=x.db.sql;
 if(!clockFix){
  const original=fs.readFileSync('drizzle/0008_wild_ultimatum.sql','utf8').split('--> statement-breakpoint').find(sql=>sql.includes('CREATE TRIGGER `activation_command_final_hardening_v2`'));
  assert.ok(original,'Historical trigger remains available for regression');
  database.exec('DROP TRIGGER activation_command_final_hardening_v2;'+original);
 }
 await seedEnvironment(database);
 const fields={engagementId:'CONNECTED-ENGAGEMENT',officerId:x.officerId,employerId:'EMP-1',model:'direct_flex',termsVersion:'TERMS-v1',engagementReference:'private:isolated-engagement',weeklyHourCap:'24',payrollReference:'private:isolated-payroll',benefitsReference:'private:isolated-benefits'};
 const engagement=await manageProductionEvidence(x.db,maker,{action:'prepare_evidence',kind:'engagement',fields,sourceDocumentsReviewed:true,expiresAt:new Date(Date.now()+86400000).toISOString()});
 await manageProductionEvidence(x.db,checker,{action:'decide_evidence',reviewId:engagement.reviewId,decision:'approve',evidenceIndependentlyChecked:true,reason:'Independently inspected synthetic employment sources'});
 seedOfficerSupport(database,x.officerId,fields.engagementId,'CONNECTED-TERMS');
 // Banking and scheduling are surrounding fixtures, not identity/readiness approval.
 database.prepare("UPDATE officers SET banking_status='verified',flex_available=1,external_work_acknowledged=1,rest_window_confirmed=1 WHERE id=?").run(x.officerId);
 const p=await prepareReadinessPassport(x.db,assessor,x.passportInput);await decision(x.db,'passport',p.id);
 await moveCandidateToCheckInWindow(database,x.officerId);
 return {...x,database,db:new D1Adapter(database),engagement,passport:p};
}

test('new linked identity, PSiRA, readiness and reviewed workforce reach activation and check-in',async()=>{
 const x=await connected();
 const activated=await activateAssignment(x.db,request('connected:positive',x.officerId),'ops-fixture');
 assert.equal(activated.state,'activated',JSON.stringify(activated));await passDueScheduledCheckpoints(x.db);
 const checked=await revalidateAssignment(x.db,activated.shiftId,'check_in',applicant.userId,true);
 assert.equal(checked.ready,true,JSON.stringify(checked.blockers));
 assert.equal(x.database.prepare('SELECT status FROM shifts WHERE id=?').get(activated.shiftId).status,'on_post');x.database.close();
});

import {suspendProductionIdentity} from '../app/lib/production-identity.ts';
import {suspendOfficerWorkforce} from '../app/lib/production-rereview.ts';
import {writeSignup} from '../app/lib/signup-server.ts';
import {recordProductionService,readProductionService} from '../app/lib/production-service.ts';
import {operateProduction} from '../app/lib/production-operations.ts';
import {installFixtureClock} from './fixtures/fixture-clock.mjs';
import {consumeConnectedPayroll,freshHeaders} from './fixtures/connected-payroll-consumption.mjs';

const mutations={
 identity:x=>suspendProductionIdentity(x.db,maker,x.identity.id,'Isolated source withdrawn during activation'),
 intake:x=>writeSignup(x.db,applicant,{action:'correct',kind:'officer',id:x.caseId,expectedVersion:2,changes:{city:'Sandton'}}),
 workforce:x=>suspendOfficerWorkforce(x.db,maker,{reviewId:x.engagement.reviewId,reason:'Isolated employer evidence withdrawn'})
};
for(const [cause,mutate] of Object.entries(mutations))test(`${cause} change racing activation rolls back all final records`,async()=>{
 const x=await connected();x.db.beforeBatch=()=>mutate(x);
 await assert.rejects(activateAssignment(x.db,request('connected:race:'+cause,x.officerId),'ops-fixture'),/rolled back|changed|evidence/i);
 for(const table of ['roster_assignments','assignment_activation_snapshots','assignment_workforce_snapshots','workforce_hour_reservations'])assert.equal(x.database.prepare(`SELECT count(*) AS n FROM ${table} WHERE officer_id=?`).get(x.officerId).n,0,table);
 assert.equal(x.database.prepare('SELECT count(*) AS n FROM shifts WHERE officer_id=?').get(x.officerId).n,0);x.database.close();
});

for(const [cause,mutate] of Object.entries(mutations))test(`${cause} change after activation prevents check-in`,async()=>{
 const x=await connected(),activated=await activateAssignment(x.db,request('connected:checkin:'+cause,x.officerId),'ops-fixture');await passDueScheduledCheckpoints(x.db);
 await mutate(x);
 const result=await revalidateAssignment(x.db,activated.shiftId,'check_in',applicant.userId,true);assert.equal(result.ready,false);
 assert.notEqual(x.database.prepare('SELECT status FROM shifts WHERE id=?').get(activated.shiftId).status,'on_post');x.database.close();
});

test('completed linked service is consumed by independently approved payroll and preserves history after workforce suspension',async(context)=>{
 const x=await connected(),clock=installFixtureClock(context,x.database);
 const activated=await activateAssignment(x.db,request('connected:service',x.officerId),'ops-fixture');await passDueScheduledCheckpoints(x.db);
 assert.equal((await revalidateAssignment(x.db,activated.shiftId,'check_in',applicant.userId,true)).ready,true);
 const client={userId:'connected-client',email:'connected-client@example.test',operations:false,owner:false};
 // Surrounding client authorization fixture; officer linkage existed before activation.
 x.database.prepare("INSERT INTO production_entity_links VALUES('client','connected-client-case',1,?,'CL-1','fixture',?)").run(client.userId,new Date().toISOString());
 clock.set(Date.parse(x.database.prepare("SELECT ends_at FROM roster_slots WHERE id='SLOT-1'").get().ends_at)+1000);
 const completion={action:'complete_service',shiftId:activated.shiftId,note:'Isolated officer records completed attendance after scheduled end'};
 await assert.rejects(recordProductionService(x.db,client,completion),/assigned officer/);
 await recordProductionService(x.db,applicant,completion);assert.equal((await recordProductionService(x.db,applicant,completion)).alreadyRecorded,true);
 let timesheet=(await readProductionService(x.db,client)).timesheets[0];
 await recordProductionService(x.db,client,{action:'client_signoff',shiftId:activated.shiftId,version:timesheet.version,serviceEvidenceReviewed:true,note:'Isolated client confirms recorded service'});
 const headers=freshHeaders(checker);
 await operateProduction(x.db,checker,{action:'grant_operator',email:checker.email,role:'payroll_reviewer',limitCents:1000000},headers);
 timesheet=(await readProductionService(x.db,checker)).timesheets[0];
 await recordProductionService(x.db,checker,{action:'review_service_pay',shiftId:activated.shiftId,version:timesheet.version,payableMinutes:timesheet.recorded_minutes,grossCents:80000,payEvidenceReviewed:true,note:'Isolated independent review of completed attendance and contractual pay'},headers);
 const {financeWorkflowConnected}=await import('./fixtures/finance-workflow-connected.mjs');
 await financeWorkflowConnected({...x,shiftId:activated.shiftId,maker,checker,applicant,client});
 const consumed=await consumeConnectedPayroll({...x,shiftId:activated.shiftId,maker,checker,applicant,client});
 const tables=['assignment_activation_snapshots','assignment_workforce_snapshots','shift_timesheets','production_service_events','payroll_runs','payroll_items','pay_item_sources','production_payroll_snapshots','production_payroll_decisions','finance_document_versions','finance_document_decisions','finance_document_issues'];
 const history=()=>Object.fromEntries(tables.map(t=>[t,x.database.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()]));const before=history();
 await mutations.workforce(x);assert.deepEqual(history(),before);assert.equal((await consumed.document.read()).documents[0].currentState,'unpaid');
 const w=x.database.prepare("SELECT status FROM workforce_engagements WHERE id='CONNECTED-ENGAGEMENT'").get();assert.equal(w.status,'suspended');
 assert.equal(x.database.prepare('SELECT operations_status FROM shift_timesheets WHERE shift_id=?').get(activated.shiftId).operations_status,'approved_for_backend');
 assert.equal(x.database.prepare('SELECT count(*) AS n FROM payroll_runs').get().n,1);
 assert.equal(x.database.prepare("SELECT status FROM payroll_runs").get().status,'exported');
 x.database.close();
});


test('fractional approval clock reproduces legacy rejection and additive migration preserves future denial',async()=>{
 const x=await connected({clockFix:false});
 // Hold the seconds-only clock at this approval's second to make the timing
 // boundary deterministic. SQLite fractional 'now' continues to run normally.
 const reviewed=x.database.prepare('SELECT last_reviewed_at FROM officer_passports WHERE officer_id=?').get(x.officerId).last_reviewed_at;
 x.database.function('current_timestamp',()=>reviewed.slice(0,19).replace('T',' '));
 // Exact millisecond zero is also made strictly after the seconds clock by one
 // preceding second; no stored source timestamp or evidence record is changed.
 if(reviewed.endsWith('.000Z'))x.database.function('current_timestamp',()=>new Date(Date.parse(reviewed)-1000).toISOString().slice(0,19).replace('T',' '));
 await assert.rejects(activateAssignment(x.db,request('connected:clock-old',x.officerId),'ops-fixture'),/production_officer_evidence_invalid/);
 const before=x.database.prepare("SELECT sql FROM sqlite_master WHERE name='activation_command_final_hardening_v2'").get().sql;
 x.database.exec(fs.readFileSync('drizzle/0066_id_integration_activation_clock.sql','utf8'));
 const after=x.database.prepare("SELECT sql FROM sqlite_master WHERE name='activation_command_final_hardening_v2'").get().sql;
 assert.equal(after,before.replaceAll('julianday(CURRENT_TIMESTAMP)',"julianday('now')"));
 const activated=await activateAssignment(x.db,request('connected:clock-fixed',x.officerId),'ops-fixture');assert.equal(activated.state,'activated');
 // The replacement clock grants no future tolerance.
 const clocks=x.database.prepare("SELECT julianday(strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 second'))<=julianday('now') AS future_allowed").get();assert.equal(clocks.future_allowed,0);
 x.database.close();
});
