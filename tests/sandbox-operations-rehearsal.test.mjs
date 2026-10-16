import test from 'node:test';import assert from 'node:assert/strict';
import {sandboxConnected} from './fixtures/sandbox-connected.mjs';
import {activateAssignment,request,passDueScheduledCheckpoints,revalidateAssignment} from './fixtures/identity-activation-environment.mjs';
import {applicant,checker,maker} from './fixtures/production-identity-journey.mjs';
import {recordProductionService,readProductionService} from '../app/lib/production-service.ts';
import {operateProduction} from '../app/lib/production-operations.ts';
import {installFixtureClock} from './fixtures/fixture-clock.mjs';
import {consumeConnectedPayroll,freshHeaders} from './fixtures/connected-payroll-consumption.mjs';
import {sandboxEngagement} from '../app/lib/sandbox-engagement.ts';

import {sandboxIncident} from '../app/lib/sandbox-service.ts';
import {writePresence,publicPresence} from '../app/lib/officer-presence.ts';
import {suspendOfficerWorkforce,prepareRereviewDisposition,decideRereviewDisposition} from '../app/lib/production-rereview.ts';
import {readPublicPassport} from '../app/lib/passport-server.ts';
import {performance} from 'node:perf_hooks';
test('coherent synthetic operations incident contains workforce then independently permits replacement without rewriting consumed service/payroll/payment history',async context=>{
 const model='direct_flex',serviceType='Unarmed',start=performance.now(),steps=[];const mark=(step,actor)=>steps.push({step,actor,elapsedMs:Math.round(performance.now()-start),scenarioAt:new Date().toISOString()});
 const x=await sandboxConnected({model,serviceType,durationMinutes:60});try{
 const clock=installFixtureClock(context,x.database),slot=x.database.prepare("SELECT version FROM roster_slots WHERE id='SLOT-1'").get();
 const activated=await activateAssignment(x.activationDb,{...request('sandbox:'+model+':'+serviceType,x.officerId),expectedSlotVersion:slot.version},'ops-fixture');assert.equal(activated.state,'activated',JSON.stringify(activated));await passDueScheduledCheckpoints(x.activationDb);
 assert.equal((await revalidateAssignment(x.activationDb,activated.shiftId,'check_in',applicant.userId,true)).ready,true);
 const team=[];for(const person of x.additional){const version=x.database.prepare('SELECT version FROM roster_slots WHERE id=?').get(person.slotId).version;const a=await activateAssignment(x.activationDb,{...request('team:'+person.officerId,person.officerId),rosterSlotId:person.slotId,expectedSlotVersion:version},'ops-fixture');assert.equal(a.state,'activated',JSON.stringify(a));await passDueScheduledCheckpoints(x.activationDb);assert.equal((await revalidateAssignment(x.activationDb,a.shiftId,'check_in',person.actor.userId,true)).ready,true);team.push({...person,shiftId:a.shiftId});}
 clock.set(Date.parse(x.times.starts)+1000);
 const presenceSession=await writePresence(x.db,applicant.userId,null,{action:'start',mode:'live',consent:true,expectedRevision:0});
 const shared=await writePresence(x.db,applicant.userId,null,{...presenceSession,action:'share',mode:'live',consent:true,latitude:-26.10,longitude:28.10});assert.equal(shared.sharing,true);
 const presence=await publicPresence(x.db);assert.ok(Array.isArray(presence.areas));await writePresence(x.db,applicant.userId,null,{action:'stop',mode:'live'});assert.equal((await publicPresence(x.db)).areas.length,0);
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

 mark('Actual captured identity through paid consumed service',applicant.userId);
 const tables=['shift_timesheets','payroll_items','production_payroll_snapshots','pay_item_sources','employee_payment_instructions'];const original=Object.fromEntries(tables.map(table=>[table,JSON.stringify(x.database.prepare('SELECT * FROM '+table+' ORDER BY rowid').all())]));
 const incident=await sandboxIncident(x.runtime,applicant,{requestKey:'report-1',action:'report',shiftId:activated.shiftId,severity:'high',category:'sandbox',summary:'Synthetic access concern',detail:'Deterministic scenario with no actual incident or person.'});
 await assert.rejects(sandboxIncident(x.runtime,checker,{requestKey:'out-of-order',action:'resolve',incidentId:incident.incidentId,expectedVersion:1,reason:'Premature resolution'}));
 let ir=await sandboxIncident(x.runtime,maker,{requestKey:'ack-1',action:'acknowledge',incidentId:incident.incidentId,expectedVersion:1,reason:'Accept simulated response ownership'});
 ir=await sandboxIncident(x.runtime,maker,{requestKey:'investigate-1',action:'investigate',incidentId:ir.incidentId,expectedVersion:ir.version,reason:'Inspect scenario evidence'});


 mark('Incident reported, acknowledged and investigated',maker.userId);
 const engagementReview=x.database.prepare("SELECT id FROM production_evidence_reviews WHERE kind='engagement' AND state='approved' AND json_extract(payload_json,'$.engagementId')=? ORDER BY rowid DESC LIMIT 1").get(x.fields.engagementId);
 await suspendOfficerWorkforce(x.db,maker,{reviewId:engagementReview.id,reason:'Sandbox incident '+incident.incidentId+' requires prospective workforce containment'});
 assert.equal((await readPublicPassport(x.db,x.passport.token)).status,'suspended');await assert.rejects(revalidateAssignment(x.activationDb,activated.shiftId,'check_in',applicant.userId,true),/not in a check-in eligible state/);
 mark('Workforce held and prior passport invalidated',maker.userId);
 const hold=x.database.prepare('SELECT * FROM production_workforce_holds WHERE engagement_id=?').get(x.fields.engagementId);assert.ok(hold);
 const proposal=await prepareRereviewDisposition(x.db,checker,{kind:'workforce',holdId:hold.id,applicantVersion:2,evidenceReference:'sandbox:incident-recovery:'+incident.incidentId,evidenceHash:'a'.repeat(64),checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),actuallyInvestigated:true});
 const disposition={proposalId:proposal.id,decision:'allow_replacement',independentlyInvestigated:true,reason:'Independent synthetic recovery review; old history remains held'};
 await assert.rejects(decideRereviewDisposition(x.db,checker,disposition));
 const independent={userId:'operations-rehearsal-independent-owner',email:'rehearsal-owner@example.test',operations:true,owner:true};
 await decideRereviewDisposition(x.db,independent,disposition);assert.ok(x.database.prepare('SELECT id FROM production_rereview_authorizations WHERE id=?').get(proposal.id));
 assert.equal(x.database.prepare('SELECT status FROM workforce_engagements WHERE id=?').get(x.fields.engagementId).status,'suspended');assert.equal((await readPublicPassport(x.db,x.passport.token)).status,'suspended');
 mark('Separate disposition authorizes fresh replacement only',independent.userId);
 ir=await sandboxIncident(x.runtime,checker,{requestKey:'resolve-1',action:'resolve',incidentId:ir.incidentId,expectedVersion:ir.version,reason:'Separate incident resolution after verified prospective containment'});
 await sandboxIncident(x.runtime,checker,{requestKey:'close-rehearsal',action:'close',incidentId:ir.incidentId,expectedVersion:ir.version,reason:'Closed synthetic rehearsal; no original approval restored'});
 for(const table of tables)assert.equal(JSON.stringify(x.database.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()),original[table],table);
 assert.equal(x.database.prepare('SELECT count(*) n FROM incident_events WHERE incident_id=?').get(incident.incidentId).n,5);
 assert.ok(x.database.prepare("SELECT audit_event_id FROM production_hold_provenance WHERE kind='workforce' AND hold_id=?").get(hold.id));
 mark('Incident closed; five consumed ledgers byte-for-byte unchanged',checker.userId);
 console.log('OPERATIONS_REHEARSAL '+JSON.stringify({mode:'simulator',policyVersion:'lokd-sandbox-completion-v1',elapsedMs:Math.round(performance.now()-start),steps,unchangedTables:tables,backupRestore:'separate test',restoresApproval:false,notificationsSent:0}));
 }finally{x.close();}
});
