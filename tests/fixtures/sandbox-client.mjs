import assert from 'node:assert/strict';
import {submitClientEnquiry} from '../../app/api/enquiries/route.ts';
import {writeSignup} from '../../app/lib/signup-server.ts';
import {prepareProductionEntity} from '../../app/lib/production-intake.ts';
import {reviewProductionClient} from '../../app/lib/production-client-review.ts';
import {maker,checker} from './production-identity-journey.mjs';
export async function sandboxClient(x){
 const actor={userId:'sandbox-current-client',email:'sandbox-client@example.test',operations:false,owner:false};
 const r=await submitClientEnquiry(new Request('http://localhost/api/enquiries',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify({organisationName:'Fictional Sandbox Client',contactName:'Fictional Representative',email:actor.email,siteArea:'Sandton',siteType:'commercial_property',requiredStart:'planning',message:'Isolated fictional sandbox service, no actual person or contract.',advanceFundingAcknowledged:true,privacyConsent:true})}),x.db);assert.equal(r.status,202);const caseId=(await r.json()).reference;
 await writeSignup(x.db,actor,{action:'link',kind:'client',id:caseId,expectedVersion:0});await writeSignup(x.db,maker,{action:'review',kind:'client',id:caseId,expectedVersion:1,status:'reviewed',note:'Independent fictional intake review'});
 const c=await prepareProductionEntity(x.db,maker,{kind:'client',caseId,caseVersion:2});const p=await reviewProductionClient(x.db,maker,{action:'prepare_client_review',clientId:c.entityId,caseVersion:2,documentsActuallyReviewed:true,checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),identityReference:'sandbox:representative',companyReference:'sandbox:company',authorityReference:'sandbox:mandate',note:'Policy-bound simulator client sources only'});await reviewProductionClient(x.db,checker,{action:'decide_client_review',reviewId:p.reviewId,decision:'approve',evidenceIndependentlyChecked:true,reason:'Independent fictional client-source review'});return {actor,clientId:c.entityId,caseId,caseVersion:2};
}
