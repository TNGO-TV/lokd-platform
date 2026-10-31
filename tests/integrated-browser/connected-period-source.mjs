import {fixtureScope} from '../fixtures/fixture-scope.mjs';
import {setup as financeSetup} from '../fixtures/finance-workflow-db.mjs';
import {prepareReadinessReview} from '../../app/lib/production-readiness.ts';
import {sandboxClient} from '../fixtures/sandbox-client.mjs';
import assert from 'node:assert/strict';
import {sandboxConnected} from '../fixtures/sandbox-connected.mjs';
import {replaceSandboxEngagement} from '../fixtures/sandbox-transition.mjs';
import {applicant,maker,checker,assessor,decision,prepareReadinessPassport} from '../fixtures/production-identity-journey.mjs';
import {activateAssignment,request,passDueScheduledCheckpoints,revalidateAssignment,signFixtureAgreements} from '../fixtures/identity-activation-environment.mjs';
import {installFixtureClock} from '../fixtures/fixture-clock.mjs';
import {recordProductionService,readProductionService} from '../../app/lib/production-service.ts';
import {operateProduction} from '../../app/lib/production-operations.ts';
import {freshHeaders} from '../fixtures/connected-payroll-consumption.mjs';
import {declareProductionSchedule} from '../../app/lib/production-schedule.ts';
import {manageProductionDocument,issueProductionEnvelope,signProductionEnvelope} from '../../app/lib/production-signing.ts';
import {officerShiftEconomicsForRoster} from '../../app/lib/pilot-pricing.ts';
import {sandboxEngagement} from '../../app/lib/sandbox-engagement.ts';
// One booking has one immutable calendar price. Start this synthetic period at
// 06:00 SAST, before creating evidence, so both one-hour duties plus eight-hour
// rest fit in its service day. Explicit raw times remain available to rejection
// tests; production activation still rejects cross-category booking reuse.
export function periodFixtureStart(now=Date.now()){
 if(!Number.isFinite(now))throw Error('A finite fixture start is required');
 const day=new Date(now+2*3600000).toISOString().slice(0,10);
 return Date.parse(day+'T04:00:00.000Z');
}
// Reuses the real two-company service fixture; browser performs payroll preparation/review.
export async function prepareBrowserPeriod(context,{now=periodFixtureStart(),configureDatabase}={}){
 const scope=fixtureScope();context.after(()=>scope.close());let clock;
 try{
 // Test-policy duty is one hour inside the unchanged 12-hour commercial block;
 // actual elapsed duty drives service inputs. No fictitious twelve-hour attendance.
 const x=await sandboxConnected({durationMinutes:60,configureDatabase:db=>{clock=installFixtureClock({mock:context.mock,after:fn=>scope.after(fn)},db.sql,now);configureDatabase?.(db);}});
 scope.after(()=>x.close());
 const c=await sandboxClient(x),client=c.actor;x.database.prepare("UPDATE bookings SET client_id=? WHERE id='BK-1'").run(c.clientId);x.database.prepare("UPDATE operational_sites SET client_id=? WHERE id='SITE-1'").run(c.clientId);await signFixtureAgreements(x.database);
 await operateProduction(x.db,checker,{action:'grant_operator',email:checker.email,role:'payroll_reviewer',limitCents:1000000},freshHeaders(checker));
 const service=async(slotId,end,key)=>{clock.set(Date.parse(x.database.prepare('SELECT starts_at FROM roster_slots WHERE id=?').get(slotId).starts_at)-1);const version=x.database.prepare('SELECT version FROM roster_slots WHERE id=?').get(slotId).version;const a=await activateAssignment(x.activationDb,{...request(key,x.officerId),rosterSlotId:slotId,expectedSlotVersion:version},'ops-fixture');assert.equal(a.state,'activated',JSON.stringify(a));await passDueScheduledCheckpoints(x.activationDb);assert.equal((await revalidateAssignment(x.activationDb,a.shiftId,'check_in',applicant.userId,true)).ready,true);clock.set(Date.parse(end)+1);await recordProductionService(x.db,applicant,{action:'complete_service',shiftId:a.shiftId,note:'One hour fictional duty completed'});let t=(await readProductionService(x.db,checker)).timesheets.find(t=>t.shift_id===a.shiftId);await recordProductionService(x.db,client,{action:'client_signoff',shiftId:a.shiftId,version:t.version,serviceEvidenceReviewed:true,note:'Fictional client confirmed recorded duty'});t=(await readProductionService(x.db,checker)).timesheets.find(t=>t.shift_id===a.shiftId);await recordProductionService(x.db,checker,{action:'review_service_pay',shiftId:a.shiftId,version:t.version,payableMinutes:t.recorded_minutes,grossCents:x.database.prepare('SELECT officer_offer_cents FROM roster_slots WHERE id=?').get(slotId).officer_offer_cents,payEvidenceReviewed:true,note:'Fixed sandbox commercial block; recorded duty preserved'},freshHeaders(checker));return x.database.prepare('SELECT * FROM shift_timesheets WHERE shift_id=?').get(a.shiftId);};
 const first=await service('SLOT-1',x.times.ends,'first-company');const next=await replaceSandboxEngagement(x);
 const renewed=[];for(const source of [x.core,x.service,x.purpose]){const r=await prepareReadinessReview(x.db,assessor,{...source.input,evidence:source.input.evidence.map(e=>({...e,reference:'sandbox:renewed-after-disposition',checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+20*3600000).toISOString()}))});await decision(x.db,'review',r.id);renewed.push(r.id);}
 const p=await prepareReadinessPassport(x.db,assessor,{...x.passportInput,reviewIds:renewed,expectedSequence:1});await decision(x.db,'passport',p.id);
 const starts=new Date(Math.ceil((Date.now()+8*3600000+60000)/60000)*60000).toISOString(),ends=new Date(Date.parse(starts)+3600000).toISOString();
 const economics=officerShiftEconomicsForRoster({serviceType:'Unarmed',riskBand:'Standard',engagementModel:'flex',startsAt:starts,serviceDate:new Date(Date.parse(starts)+7200000).toISOString().slice(0,10)});
 x.database.prepare("INSERT INTO roster_slots(id,site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,position_index,calendar_category,officer_offer_cents,environment,integrity_state,status) VALUES('SLOT-2','SITE-1','POST-1','BK-1',?,?,?,?,?,2,?,?,'production','production_verified','scheduled')").run(economics.serviceDate,starts,ends,starts,starts,economics.calendarCategory,economics.officerOfferCents);
 const version=x.database.prepare('SELECT max(version) v FROM officer_schedule_declarations WHERE officer_id=?').get(x.officerId).v;await declareProductionSchedule(x.db,applicant,{action:'declare_schedule',expectedVersion:version,availability:{startsAt:starts,endsAt:ends},outsideWork:[],allWorkDeclared:true,restConfirmed:true});
 await signFixtureAgreements(x.database);
 const d=await manageProductionDocument(x.db,maker,{action:'draft',documentCode:'OFFICER_EMPLOYMENT',documentVersion:'sandbox-period-v2',entityId:next.employerId,locale:'en-ZA',wording:'Fictional second-company terms for the new engagement only; earlier duty retains its original employer.'});const doc=x.database.prepare('SELECT * FROM signing_document_bodies WHERE id=?').get(d.documentId);await manageProductionDocument(x.db,checker,{action:'approve',documentId:doc.id,contentHash:doc.content_hash,legalApprovalConfirmed:true,effectiveFrom:new Date(Date.now()-1000).toISOString()});
 await issueProductionEnvelope(x.db,maker,{documentId:doc.id,rosterSlotId:'SLOT-2',officerId:x.officerId,slotVersion:1,identityEvidence:'sandbox:current-person'});const envelope=x.database.prepare('SELECT * FROM production_signing_envelopes WHERE document_id=?').get(doc.id);await signProductionEnvelope(x.db,applicant,{action:'sign',envelopeId:envelope.id,affirmative:true,contentHash:envelope.content_hash,contextHash:envelope.context_hash});
 // Move into the valid arrival window, preserving the eight-hour rest interval.
 clock.set(Date.parse(starts)-60000);const second=await service('SLOT-2',ends,'second-company');assert.equal(first.workforce_engagement_id,x.fields.engagementId);assert.equal(second.workforce_engagement_id,next.engagementId);assert.notEqual(first.employer_id,second.employer_id);assert.deepEqual(x.database.prepare('SELECT * FROM shift_timesheets WHERE id=?').get(first.id),first);
 const period=await sandboxEngagement(x.runtime,checker,{action:'period_inputs',officerId:x.officerId,periodStart:first.service_date,periodEnd:second.service_date});assert.equal(period.groups.length,2);assert.equal(period.groups.reduce((n,g)=>n+g.grossCents,0),first.gross_wage_cents+second.gross_wage_cents);assert.equal(period.groups.reduce((n,g)=>n+g.sources.length,0),2);assert.equal(period.groups.reduce((n,g)=>n+g.payableMinutes,0),first.payable_minutes+second.payable_minutes);
 const finance=await financeSetup({db:x.db,database:x.database,seed:false,actors:{maker:{...maker,owner:true},reviewer:checker,officer:applicant,client}});
 await finance.run({action:'open_order',id:'period-order',bookingId:first.booking_id,clientUser:client.userId});
 return {x,client,first,second,period,finance,close:()=>scope.close()};
 }catch(error){scope.fail(error);}
}
