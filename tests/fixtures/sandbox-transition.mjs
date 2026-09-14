import {maker,checker} from './production-identity-journey.mjs';
import {sandboxEngagement} from '../../app/lib/sandbox-engagement.ts';
import {manageProductionEvidence} from '../../app/lib/production-evidence.ts';
import {prepareRereviewDisposition,decideRereviewDisposition} from '../../app/lib/production-rereview.ts';
export const dispositionOwner={userId:'transition-independent-owner',email:'transition-owner@example.test',operations:true,owner:true};
export async function replaceSandboxEngagement(x){
 const review=async(kind,fields)=>{const p=await manageProductionEvidence(x.db,maker,{action:'prepare_evidence',kind,fields,sourceDocumentsReviewed:true,expiresAt:new Date(Date.now()+20*3600000).toISOString()});await manageProductionEvidence(x.db,checker,{action:'decide_evidence',reviewId:p.reviewId,decision:'approve',evidenceIndependentlyChecked:true,reason:'Independent fictional current sources'});return p;};
 await review('employer',{employerId:'PERIOD-SECOND-EMPLOYER',legalName:'Fictional period second employer',employerType:'lokd_employer',...Object.fromEntries(['psira','nbcpss','psspf','uif','coida','insurance','service_agreement'].map(k=>[k,'sandbox:'+k]))});
 const p=await sandboxEngagement(x.runtime,maker,{action:'prepare_transition',engagementId:x.fields.engagementId,expectedVersion:x.database.prepare('SELECT version FROM workforce_engagements WHERE id=?').get(x.fields.engagementId).version,nextEngagementId:'PERIOD-SECOND-ENGAGEMENT',employerId:'PERIOD-SECOND-EMPLOYER',model:'managed',termsVersion:'PERIOD-v2',reference:'sandbox:period-change'});
 await sandboxEngagement(x.runtime,checker,{action:'decide_transition',transitionId:p.transitionId,decision:'approve',independentlyChecked:true,reason:'A fictional change of employer in one payroll period'});
 const holds=x.database.prepare("SELECT kind,hold_id FROM production_rereview_sources WHERE officer_id=? AND kind IN ('workforce','passport')").all(x.officerId);
 for(const h of holds){const investigation=await prepareRereviewDisposition(x.db,maker,{kind:h.kind,holdId:h.hold_id,applicantVersion:2,evidenceReference:'sandbox:period-investigation',evidenceHash:'c'.repeat(64),checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+20*3600000).toISOString(),actuallyInvestigated:true});await decideRereviewDisposition(x.db,dispositionOwner,{proposalId:investigation.id,decision:'allow_replacement',independentlyInvestigated:true,reason:'Independent investigation; original hold retained'});}
 const fields={...x.fields,engagementId:'PERIOD-SECOND-ENGAGEMENT',employerId:'PERIOD-SECOND-EMPLOYER',model:'managed',termsVersion:'PERIOD-v2',weeklyHourCap:'48'};await review('engagement',fields);return fields;
}
