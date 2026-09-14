import {additionalSandboxOfficer} from './sandbox-additional-officer.mjs';
import {priceSpecialistFixture,prepareSpecialistFixture} from './sandbox-specialist.mjs';
import {sandboxReady} from './sandbox-completion.mjs';
import {applicant,maker,checker,assessor,decision,prepareReadinessPassport} from './production-identity-journey.mjs';
import {D1Adapter,signFixtureAgreements,seedEnvironment,seedOfficerSupport,moveCandidateToCheckInWindow} from './identity-activation-environment.mjs';
import {manageProductionEvidence} from '../../app/lib/production-evidence.ts';
import {operateSandboxWorkforce} from '../../app/lib/sandbox-workforce.ts';
import {manageProductionDocument,issueProductionEnvelope,signProductionEnvelope} from '../../app/lib/production-signing.ts';
import {declareProductionSchedule} from '../../app/lib/production-schedule.ts';
export async function sandboxConnected({model='direct_flex',serviceType='Unarmed',serviceCode=serviceType==='Armed'?'armed_static':'vip_unarmed',durationMinutes=720}={}){
 const x=await sandboxReady({serviceType}),database=x.db.sql;await seedEnvironment(database);
 if(model==='partner')database.exec("UPDATE workforce_employers SET employer_type='partner_company' WHERE id='EMP-1'");
 const fields={engagementId:'SANDBOX-CONNECTED-ENGAGEMENT',officerId:x.officerId,employerId:'EMP-1',model,termsVersion:'TERMS-v1',engagementReference:'sandbox:versioned-engagement',weeklyHourCap:model==='direct_flex'?'24':'48',payrollReference:'sandbox:payroll',benefitsReference:'sandbox:benefits'};
 const review=async(kind,fields)=>{const p=await manageProductionEvidence(x.db,maker,{action:'prepare_evidence',kind,fields,sourceDocumentsReviewed:true,expiresAt:new Date(Date.now()+86400000).toISOString()});await manageProductionEvidence(x.db,checker,{action:'decide_evidence',reviewId:p.reviewId,decision:'approve',evidenceIndependentlyChecked:true,reason:'Sandbox policy source inspection'});return p;};
 const engagement=await review('engagement',fields);
 if(model==='partner'){
  const company={userId:'sandbox-company-rep',email:'partner@example.test',operations:false,owner:false};
  const a=await operateSandboxWorkforce(x.runtime,checker,{action:'grant_company_authority',employerId:'EMP-1',userId:company.userId,mandateReference:'sandbox:mandate',mandateHash:'a'.repeat(64)});
  const version=database.prepare('SELECT version FROM workforce_engagements WHERE id=?').get(fields.engagementId).version;
  const p=await operateSandboxWorkforce(x.runtime,company,{action:'confirm_partner_responsibility',authorityId:a.authorityId,engagementId:fields.engagementId,expectedVersion:version,payrollAccepted:true,benefitsAccepted:true,payrollReference:'sandbox:payroll',payrollHash:'b'.repeat(64),benefitsReference:'sandbox:benefits',benefitsHash:'c'.repeat(64)});
  await operateSandboxWorkforce(x.runtime,checker,{action:'decide_partner_responsibility',responsibilityId:p.responsibilityId,decision:'approve',independentlyChecked:true,reason:'Independent fictional company responsibility inspection'});
 }
 seedOfficerSupport(database,x.officerId,fields.engagementId,'SANDBOX-INITIAL-TERMS');
 // Surrounding bank/account data is a simulator boundary, not an identity approval.
 database.prepare("UPDATE officers SET banking_status='verified',flex_available=1,external_work_acknowledged=1,rest_window_confirmed=1 WHERE id=?").run(x.officerId);
 if(serviceType!=='Unarmed'){
  priceSpecialistFixture(database,serviceType,serviceCode);
  for(const table of ['bookings','operational_sites','site_posts'])database.prepare('UPDATE '+table+' SET service_type=?').run(serviceType);
 }
 const p=await prepareReadinessPassport(x.db,assessor,x.passportInput);await decision(x.db,'passport',p.id);
 const times=await moveCandidateToCheckInWindow(database,x.officerId,serviceType,serviceType==='Unarmed'?undefined:serviceCode,durationMinutes);
 await declareProductionSchedule(x.db,applicant,{action:'declare_schedule',expectedVersion:1,availability:{startsAt:times.starts,endsAt:times.ends},outsideWork:[],allWorkDeclared:true,restConfirmed:true});
 await review('site',{siteId:'SITE-1',postId:'POST-1',riskReference:'sandbox:current-risk',postOrdersVersion:'POST-v1',ordersReference:'sandbox:orders',findings:'Versioned fictional site risk review'});
 await review('induction',{officerId:x.officerId,siteId:'SITE-1',inductionVersion:'sandbox-v1',inductionReference:'sandbox:induction',travelReference:'sandbox:travel',travelMinutes:'30'});
 const additional=[];
 if(serviceType==='VIP'&&serviceCode==='vip_team'){
  const headcount=database.prepare("SELECT headcount FROM bookings WHERE id='BK-1'").get().headcount;
  for(let index=1;index<headcount;index++)additional.push(await additionalSandboxOfficer({...x,database,fields,times},index,serviceType));
 }
 for(const [index,person] of additional.entries()){
  person.slotId='SLOT-TEAM-'+index;
  database.prepare("INSERT INTO roster_slots(id,site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,position_index,calendar_category,officer_offer_cents,environment,integrity_state,status) SELECT ?,site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,?,calendar_category,officer_offer_cents,environment,integrity_state,'scheduled' FROM roster_slots WHERE id='SLOT-1'").run(person.slotId,index+2);
  await review('induction',{officerId:person.officerId,siteId:'SITE-1',inductionVersion:'sandbox-team-v1',inductionReference:'sandbox:team-induction',travelReference:'sandbox:team-travel',travelMinutes:'30'});
 }
 if(serviceType!=='Unarmed')await prepareSpecialistFixture({...x,additional});
 await signFixtureAgreements(database);
 // Actual named private wording, independent approval and signature for every team member.
 for(const person of [{officerId:x.officerId,actor:applicant,fields,identity:x.identity,slotId:'SLOT-1'},...additional]){
 const drafted=await manageProductionDocument(x.db,maker,{action:'draft',documentCode:'OFFICER_EMPLOYMENT',documentVersion:'lokd-sandbox-completion-v1-'+person.officerId,entityId:person.fields.employerId,locale:'en-ZA',wording:'Fictional sandbox employment terms only. No actual employment or legal approval. The selected employer and engagement own the declared service interval.'});
 const doc=database.prepare('SELECT * FROM signing_document_bodies WHERE id=?').get(drafted.documentId);
 await manageProductionDocument(x.db,checker,{action:'approve',documentId:doc.id,contentHash:doc.content_hash,legalApprovalConfirmed:true,effectiveFrom:new Date(Date.now()-60000).toISOString()});
 await issueProductionEnvelope(x.db,maker,{documentId:doc.id,rosterSlotId:person.slotId,officerId:person.officerId,slotVersion:database.prepare('SELECT version FROM roster_slots WHERE id=?').get(person.slotId).version,identityEvidence:'sandbox-person:'+person.identity.outcomeId});
 const envelope=database.prepare('SELECT * FROM production_signing_envelopes WHERE document_id=?').get(doc.id);
 await signProductionEnvelope(x.db,person.actor,{action:'sign',envelopeId:envelope.id,affirmative:true,contentHash:envelope.content_hash,contextHash:envelope.context_hash});
 }
 return {...x,additional,database,activationDb:new D1Adapter(database),engagement,fields,passport:p,times};
}
