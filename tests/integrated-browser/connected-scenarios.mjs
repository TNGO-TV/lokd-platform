// Local-only scenario preparation. Original identity and training/payment approvals
// are produced by real services; no raw approved applicant/payroll rows are seeded.
import {mock} from 'node:test';
import {sandboxReady} from '../fixtures/sandbox-completion.mjs';
import {sandboxConnected} from '../fixtures/sandbox-connected.mjs';
import {sandboxClient} from '../fixtures/sandbox-client.mjs';
import {applicant,maker,checker,assessor,independent} from '../fixtures/production-identity-journey.mjs';
import {setup as financeSetup,workspace} from '../fixtures/finance-workflow-db.mjs';
import {prepareReadinessRule,decideReadiness} from '../../app/lib/production-readiness.ts';
import {signFixtureAgreements,activateAssignment,request,passDueScheduledCheckpoints,revalidateAssignment} from '../fixtures/identity-activation-environment.mjs';
import {installFixtureClock} from '../fixtures/fixture-clock.mjs';
import {operateProduction} from '../../app/lib/production-operations.ts';
import {freshHeaders} from '../fixtures/connected-payroll-consumption.mjs';
export async function prepareConnectedScenario(kind){
 if(kind==='period'){const cleanup=[];const {prepareBrowserPeriod}=await import('./connected-period-source.mjs');const p=await prepareBrowserPeriod({mock,after:fn=>cleanup.push(fn)});return {database:p.x.database,primaryDatabase:p.x.runtime.DB.sql,runtime:p.x.runtime,roles:{officer:applicant,maker,checker,assessor,independent,client:p.client,other:{userId:'unrelated-browser',email:'other@example.test',operations:false}},meta:{kind,caseId:p.x.caseId,officerId:p.x.officerId,workspace,orderId:'period-order',sources:[p.first,p.second],period:p.period},close(){for(const fn of cleanup)fn();p.x.close();}};}

 if(!['training','service','partner','specialist','presence'].includes(kind))throw Error('Unknown bounded connected scenario.');
 const x=kind==='training'?await sandboxReady():await sandboxConnected({model:kind==='partner'?'partner':'direct_flex',serviceType:kind==='specialist'?'Armed':'Unarmed',durationMinutes:60});
 const db=x.db.sql,cleanup=[];let clock;
 const roles={officer:applicant,maker,checker,assessor,independent,company:{userId:'sandbox-company-rep',email:'partner@example.test',operations:false},other:{userId:'unrelated-browser',email:'other@example.test',operations:false}};
 const meta={kind,caseId:x.caseId,officerId:x.officerId,bridgeId:x.bridgeId,policyVersion:'lokd-sandbox-completion-v1',setupBoundary:'Real identity/capture/readiness services. Connected workforce fixture supplies explicit fictional surrounding site/roster/funding/account data; target browser transitions are not preapproved.'};
 if(kind==='training'){
  roles.client={userId:'training-client',email:'training-client@example.test',operations:false};
  const f=await financeSetup({db:x.db,database:db,seed:false,actors:{maker:{...maker,owner:true},reviewer:checker,officer:applicant,client:roles.client}});
  await f.run({action:'publish_package',id:'browser-course',title:'Fictional first aid',provider:'Fictional academy',price:60000,terms:'sandbox-browser-terms-v1'});
  await f.run({action:'order_training',id:'browser-course-order',applicationId:x.caseId,packageId:'browser-course',acceptedTerms:'sandbox-browser-terms-v1'},applicant);
  await f.run({action:'prepare_collection',id:'browser-course-payment',orderId:'browser-course-order',amount:60000});await f.settle('browser-course-payment');
  await f.run({action:'issue_entitlement',orderId:'browser-course-order'});
  await f.run({action:'record_completion',id:'browser-completion',entitlementId:'entitlement:browser-course-order',provider:'Fictional academy',reference:'sandbox:independently-reviewed-course-completion'});
  const rule=await prepareReadinessRule(x.db,maker,{code:'purpose_browser_training',label:'Fictional browser training assessment',category:'purpose',purposeCode:'browser_training',requirements:['training:browser-course'],maxDays:90,evidenceReference:'lokd-sandbox-completion-v1',expiresAt:new Date(Date.now()+86400000).toISOString()});
  await decideReadiness(x.db,checker,{kind:'rule',id:rule.id,decision:'approve',independentlyInspected:true,reason:'Independent fictional rule inspection'});
  Object.assign(meta,{workspace,financeEntitlementId:'entitlement:browser-course-order',completionId:'browser-completion',ruleId:rule.id});
 }else{
  const client=await sandboxClient(x);roles.client=client.actor;
  // Rebind surrounding booking/site to the client created through actual intake,
  // entity and independent review; never insert a replacement approved client link.
  db.prepare("UPDATE bookings SET client_id=? WHERE id='BK-1'").run(client.clientId);
  db.prepare("UPDATE operational_sites SET client_id=? WHERE id='SITE-1'").run(client.clientId);
  await signFixtureAgreements(db);
  if(kind==='specialist'){const {sandboxSpecialist}=await import('../../app/lib/sandbox-specialist.ts');const run=(actor,input)=>sandboxSpecialist(x.runtime,actor,input,freshHeaders(actor));let saved=await run(maker,{action:'read'});let pack=saved.packs.find(p=>p.bookingId==='BK-1');saved=await run(maker,{action:'save_pack',bookingId:'BK-1',version:pack.version,content:pack.content});pack=saved.packs.find(p=>p.bookingId==='BK-1');saved=await run(maker,{action:'submit_pack',id:pack.id,version:pack.version});pack=saved.packs.find(p=>p.bookingId==='BK-1');await run(checker,{action:'approve_pack',id:pack.id,version:pack.version});}

  clock=installFixtureClock({mock,after:fn=>cleanup.push(fn)},db);
  await operateProduction(x.db,checker,{action:'grant_operator',email:checker.email,role:'payroll_reviewer',limitCents:1000000},freshHeaders(checker));
  for(const [actor,role] of [[maker,'operations_controller'],[checker,'operations_owner']])await operateProduction(x.db,checker,{action:'grant_operator',email:actor.email,role,limitCents:100000000},freshHeaders(checker));
  Object.assign(meta,{clientId:client.clientId,engagementId:x.fields.engagementId,employerId:x.fields.employerId,engagementVersion:db.prepare('SELECT version FROM workforce_engagements WHERE id=?').get(x.fields.engagementId).version,slotId:'SLOT-1',slotVersion:db.prepare("SELECT version FROM roster_slots WHERE id='SLOT-1'").get().version,startsAt:x.times.starts,endsAt:x.times.ends});
  if(kind==='service'||kind==='presence'){
   const a=await activateAssignment(x.activationDb,{...request('browser-service-source',x.officerId),expectedSlotVersion:meta.slotVersion},'ops-fixture');
   if(a.state!=='activated')throw Error(JSON.stringify(a));await passDueScheduledCheckpoints(x.activationDb);
   if(!(await revalidateAssignment(x.activationDb,a.shiftId,'check_in',applicant.userId,true)).ready)throw Error('Original assignment did not pass check in');
   clock.set(Date.parse(kind==='presence'?x.times.starts:x.times.ends)+1000);meta.shiftId=a.shiftId;
  }
 }
 return {database:db,primaryDatabase:x.runtime.DB.sql,runtime:x.runtime,roles,meta,advance(ms){if(!clock)throw Error('No scenario clock');clock.advance(ms);},close(){for(const fn of cleanup)fn();x.close();}};
}
