import test from 'node:test';import assert from 'node:assert/strict';
import {sandboxConnected} from './fixtures/sandbox-connected.mjs';
import {activateAssignment,request,passDueScheduledCheckpoints,revalidateAssignment} from './fixtures/identity-activation-environment.mjs';
import {applicant,checker,maker} from './fixtures/production-identity-journey.mjs';
import {recordProductionService,readProductionService} from '../app/lib/production-service.ts';
import {operateProduction} from '../app/lib/production-operations.ts';
import {installFixtureClock} from './fixtures/fixture-clock.mjs';
import {consumeConnectedPayroll,freshHeaders} from './fixtures/connected-payroll-consumption.mjs';
import {sandboxEngagement} from '../app/lib/sandbox-engagement.ts';
import {withdrawSandboxCapture} from '../app/lib/sandbox-identity.ts';
import {sandboxIncident} from '../app/lib/sandbox-service.ts';
import {writePresence,publicPresence} from '../app/lib/officer-presence.ts';
for(const [model,serviceType,serviceCode] of [['direct_flex','Unarmed'],['managed','Unarmed'],['partner','Unarmed'],['direct_flex','Armed'],['managed','VIP'],['managed','Armed','armed_movement'],['managed','VIP','vip_armed'],['managed','VIP','vip_protective_driver'],['managed','VIP','vip_team']])test(`sandbox ${model}/${serviceType}/${serviceCode??'default'}: captured person through signed workforce, assignment and application-produced service input`,async context=>{
 const x=await sandboxConnected({model,serviceType,...(serviceCode?{serviceCode}:{})});try{
 const clock=installFixtureClock(context,x.database),slot=x.database.prepare("SELECT version FROM roster_slots WHERE id='SLOT-1'").get();
 const activated=await activateAssignment(x.activationDb,{...request('sandbox:'+model+':'+serviceType,x.officerId),expectedSlotVersion:slot.version},'ops-fixture');assert.equal(activated.state,'activated',JSON.stringify(activated));await passDueScheduledCheckpoints(x.activationDb);
 assert.equal((await revalidateAssignment(x.activationDb,activated.shiftId,'check_in',applicant.userId,true)).ready,true);
 const team=[];for(const person of x.additional){const version=x.database.prepare('SELECT version FROM roster_slots WHERE id=?').get(person.slotId).version;const a=await activateAssignment(x.activationDb,{...request('team:'+person.officerId,person.officerId),rosterSlotId:person.slotId,expectedSlotVersion:version},'ops-fixture');assert.equal(a.state,'activated',JSON.stringify(a));await passDueScheduledCheckpoints(x.activationDb);assert.equal((await revalidateAssignment(x.activationDb,a.shiftId,'check_in',person.actor.userId,true)).ready,true);team.push({...person,shiftId:a.shiftId});}
 clock.set(Date.parse(x.times.starts)+1000);
 const shared=await writePresence(x.db,applicant.userId,null,{action:'share',mode:'live',consent:true,latitude:-26.10,longitude:28.10});assert.equal(shared.sharing,true);
 const presence=await publicPresence(x.db);assert.ok(Array.isArray(presence.areas));await writePresence(x.db,applicant.userId,null,{action:'stop',mode:'live'});assert.equal((await publicPresence(x.db)).areas.length,0);
 const incident=await sandboxIncident(x.runtime,applicant,{requestKey:'report-1',action:'report',shiftId:activated.shiftId,severity:'high',category:'sandbox',summary:'Synthetic access concern',detail:'Deterministic scenario with no actual incident or person.'});
 await assert.rejects(sandboxIncident(x.runtime,checker,{requestKey:'out-of-order',action:'resolve',incidentId:incident.incidentId,expectedVersion:1,reason:'Premature resolution'}));
 let ir=await sandboxIncident(x.runtime,maker,{requestKey:'ack-1',action:'acknowledge',incidentId:incident.incidentId,expectedVersion:1,reason:'Accept simulated response ownership'});
 ir=await sandboxIncident(x.runtime,maker,{requestKey:'investigate-1',action:'investigate',incidentId:ir.incidentId,expectedVersion:ir.version,reason:'Inspect scenario evidence'});
 await sandboxIncident(x.runtime,checker,{requestKey:'resolve-1',action:'resolve',incidentId:ir.incidentId,expectedVersion:ir.version,reason:'Independent resolution of simulated concern'});
 clock.set(Date.parse(x.times.ends)+1000);
 await recordProductionService(x.db,applicant,{action:'complete_service',shiftId:activated.shiftId,note:'Synthetic service completed after assigned end'});
 const client={userId:'sandbox-client',email:'client@example.test',operations:false,owner:false};
 x.database.prepare("INSERT INTO production_entity_links VALUES('client','sandbox-client-case',1,?,'CL-1','fixture',?)").run(client.userId,new Date().toISOString());
 let t=(await readProductionService(x.db,client)).timesheets[0];
 await recordProductionService(x.db,client,{action:'client_dispute',shiftId:activated.shiftId,version:t.version,serviceEvidenceReviewed:true,note:'Synthetic duration disputed'});
 t=(await readProductionService(x.db,checker)).timesheets[0];await recordProductionService(x.db,checker,{action:'resolve_service_dispute',shiftId:activated.shiftId,version:t.version,outcome:'confirmed',note:'Independent attendance resolution'});
 await operateProduction(x.db,checker,{action:'grant_operator',email:checker.email,role:'payroll_reviewer',limitCents:1000000},freshHeaders(checker));
 t=(await readProductionService(x.db,checker)).timesheets[0];await recordProductionService(x.db,checker,{action:'review_service_pay',shiftId:activated.shiftId,version:t.version,payableMinutes:t.recorded_minutes,grossCents:80000,payEvidenceReviewed:true,note:'Versioned sandbox contractual service-pay input'},freshHeaders(checker));
 const saved=x.database.prepare('SELECT * FROM shift_timesheets WHERE shift_id=?').get(activated.shiftId);assert.equal(saved.operations_status,'approved_for_backend');assert.equal(saved.workforce_model,model);assert.equal(saved.workforce_engagement_id,x.fields.engagementId);assert.equal(saved.gross_wage_cents,80000);assert.equal(x.runtime.DB.sql.prepare('SELECT count(*) n FROM shift_timesheets').get().n,0);
 for(const person of team){await recordProductionService(x.db,person.actor,{action:'complete_service',shiftId:person.shiftId,note:'Fictional team service completed'});let t=x.database.prepare('SELECT * FROM shift_timesheets WHERE shift_id=?').get(person.shiftId);await recordProductionService(x.db,client,{action:'client_signoff',shiftId:person.shiftId,version:t.version,serviceEvidenceReviewed:true,note:'Fictional team service confirmed'});t=x.database.prepare('SELECT * FROM shift_timesheets WHERE shift_id=?').get(person.shiftId);await recordProductionService(x.db,checker,{action:'review_service_pay',shiftId:person.shiftId,version:t.version,payableMinutes:t.recorded_minutes,grossCents:80000,payEvidenceReviewed:true,note:'Independent fictional team service pay'},freshHeaders(checker));}
 assert.equal(x.database.prepare('SELECT count(*) n FROM shift_timesheets').get().n,1+team.length);
 const period=await sandboxEngagement(x.runtime,checker,{action:'period_inputs',officerId:x.officerId,periodStart:saved.service_date,periodEnd:saved.service_date});assert.equal(period.groups[0].sources[0].id,saved.id);assert.equal(period.groups[0].grossCents,80000);assert.equal(period.groups[0].payableMinutes,saved.payable_minutes);
 const {settleActualModelSources}=await import('./fixtures/sandbox-model-settlement.mjs');await settleActualModelSources({x,client,people:[{actor:applicant,shiftId:activated.shiftId},...team],maker,checker});
 if(model==='direct_flex'&&serviceType==='Unarmed')await consumeConnectedPayroll({db:x.activationDb,database:x.database,officerId:x.officerId,shiftId:activated.shiftId,maker,checker,applicant,client});
 const capture=x.database.prepare('SELECT id FROM sandbox_identity_captures WHERE owner_user_id=?').get(applicant.userId);await withdrawSandboxCapture(x.runtime,applicant,capture.id);
 assert.deepEqual(x.database.prepare('SELECT * FROM shift_timesheets WHERE id=?').get(saved.id),saved);
 assert.equal(x.database.prepare('SELECT count(*) n FROM site_incidents').get().n,1);
 const retained=await sandboxEngagement(x.runtime,checker,{action:'period_inputs',officerId:x.officerId,periodStart:saved.service_date,periodEnd:saved.service_date});assert.equal(retained.sourceHash,period.sourceHash);

 }finally{x.close();}
});
