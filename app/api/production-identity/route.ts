import {env} from 'cloudflare:workers';
import {SignupError,writeSignup} from '../../lib/signup-server';
import {PilotAccessError,principalForEmail,principalHasRole,requirePilotApiRole,requireSameOriginJson} from '../../lib/pilot-runtime';
import {workspaceRoleForHost} from '../../lib/public-site';
import * as identity from '../../lib/production-identity';
import * as officer from '../../lib/production-officer-review';
import * as readiness from '../../lib/production-readiness';
import * as rereview from '../../lib/production-rereview';

import * as reviewData from '../../lib/production-identity-review-data';
import * as delivery from '../../lib/production-passport-delivery';
import {prepareProductionEntity} from '../../lib/production-intake';

export const dynamic='force-dynamic';
function actor(request:Request){
 const url=new URL(request.url),operations=url.searchParams.get('scope')==='operations';
 const userId=request.headers.get('x-lokd-verified-user-id'),email=request.headers.get('x-lokd-verified-email');
 if(!userId||!email)throw new SignupError('Sign in to your account.',401);
 const host=workspaceRoleForHost(url.hostname);
 if(host&&host!==(operations?'operations':'officer'))throw new SignupError('Open the correct workspace.',403);
 const principal=principalForEmail(email);
 if(operations){if(!principalHasRole(principal,'operations'))throw new SignupError('Operations access required.',403);requirePilotApiRole(request,'operations');}
 return {userId,email,operations,owner:operations&&principal.owner};
}
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'}});
const fail=(error:unknown)=>error instanceof SignupError||error instanceof PilotAccessError?reply({error:error.message},error.status):reply({error:'The evidence or authority may have changed. Refresh the saved record before acting again. No approval was restored.'},409);
const reference=(value:unknown)=>{if(typeof value!=='string'||!value.trim()||value.length>300)throw new SignupError('Choose a valid record.');return value.trim();};
export async function GET(request:Request){
 try{
  const a=actor(request),url=new URL(request.url),kind=url.searchParams.get('kind');
  if(!env.DB)throw new SignupError('Storage unavailable.',503);
  if(kind==='cases')return reply(await reviewData.readIdentityCases(env.DB,a,url.searchParams.get('offset')));
  if(kind==='review_queue')return reply(await reviewData.readIdentityReviewQueue(env.DB,a,{recordType:url.searchParams.get('recordType'),state:url.searchParams.get('state'),offset:url.searchParams.get('offset')}));
  const id=reference(url.searchParams.get('id'));
  if(kind==='holds')return reply(await reviewData.readIdentityHolds(env.DB,a,id,url.searchParams.get('offset')));
  if(kind==='case')return reply(await reviewData.readIdentityCase(env.DB,a,id));
  if(kind==='review_detail')return reply(await reviewData.readIdentityReviewDetail(env.DB,a,url.searchParams.get('recordType'),id));
  if(kind==='deliveries')return reply(await delivery.readPassportDeliveries(env.DB,a,id));
  if(kind==='identity')return reply(await identity.readProductionIdentity(env.DB,a,id));
  if(kind==='officer')return reply(await officer.readOfficerReviews(env.DB,a,id));
  if(kind==='readiness')return reply(await readiness.readProductionReadiness(env.DB,a,id));
  if(kind==='rereview')return reply(await rereview.readRereviewStatus(env.DB,a,id));
  throw new SignupError('Choose a supported record type.');
 }catch(error){return fail(error);}
}
export async function POST(request:Request){
 try{
  requireSameOriginJson(request);const a=actor(request);
  const raw=await request.text();if(raw.length>64000)throw new SignupError('Request too large.',413);
  let body;try{body=JSON.parse(raw);}catch{throw new SignupError('Invalid request.');}
  if(!body||typeof body!=='object'||Array.isArray(body))throw new SignupError('Choose an action.');
  // Provider adapters, normalized outcomes and actor authority are never accepted from JSON.
  for(const key of ['actor','provider','operations','owner','userId','outcome','bindingHash','token','rawToken'])if(key in body)throw new SignupError('Server-owned identity fields are not accepted.');
  const participantActions=['start_identity','set_opt_in','correct_intake','withdraw_intake','request_passport_delivery'];
  if(!participantActions.includes(body.action)&&!a.operations)throw new SignupError('Operations access required.',403);
  if(!env.DB)throw new SignupError('Storage unavailable.',503);
  let result;
  switch(body.action){
   case 'request_passport_delivery': result=await delivery.requestPassportDelivery(env.DB,a,body);break;
   case 'correct_intake':
   case 'withdraw_intake':
    if(a.operations)throw new SignupError('Use your applicant workspace for corrections.',403);
    await writeSignup(env.DB,a,{action:body.action==='correct_intake'?'correct':'withdraw',kind:'officer',id:body.applicantId,expectedVersion:body.expectedVersion,changes:body.changes});result=await reviewData.readIdentityCase(env.DB,a,body.applicantId);break;
   case 'review_intake': await writeSignup(env.DB,a,{action:'review',kind:'officer',id:body.applicantId,expectedVersion:body.expectedVersion,status:body.status,note:body.note});result=await reviewData.readIdentityCase(env.DB,a,body.applicantId);break;
   case 'prepare_entity': result=await prepareProductionEntity(env.DB,a,{kind:'officer',caseId:body.applicantId,caseVersion:body.applicantVersion});break;
   case 'start_identity': result=await identity.startProductionIdentity(env.DB,a,{applicantId:body.applicantId,applicantVersion:body.applicantVersion,captureReference:body.captureReference,consentVersion:body.consentVersion});break;
   case 'recover_identity': result=await identity.recoverProductionIdentity(env.DB,a,reference(body.id),reference(body.expectedOutcomeId));break;
   case 'decide_identity': result=await identity.decideProductionIdentity(env.DB,a,body);break;
   case 'suspend_identity': result=await identity.suspendProductionIdentity(env.DB,a,reference(body.id),reference(body.reason));break;
   case 'prepare_officer': result=await officer.prepareOfficerReview(env.DB,a,body);break;
   case 'decide_officer': result=await officer.decideOfficerReview(env.DB,a,body);break;
   case 'suspend_officer': result=await officer.suspendOfficerApproval(env.DB,a,reference(body.officerId),reference(body.reason));break;
   case 'prepare_rule': result=await readiness.prepareReadinessRule(env.DB,a,body);break;
   case 'prepare_review': result=await readiness.prepareReadinessReview(env.DB,a,body);break;
   case 'decide_readiness': result=await readiness.decideReadiness(env.DB,a,body);break;
   case 'set_opt_in': result=await readiness.setReadinessOptIn(env.DB,a,body);break;
   case 'prepare_passport': reference(body.deliveryId);result=await readiness.prepareReadinessPassport(env.DB,a,body);break;
   case 'hold_readiness': result=await readiness.holdReadiness(env.DB,a,body);break;
   case 'request_information': result=await rereview.requestOfficerRereview(env.DB,a,body);break;
   case 'prepare_disposition': result=await rereview.prepareRereviewDisposition(env.DB,a,body);break;
   case 'decide_disposition': result=await rereview.decideRereviewDisposition(env.DB,a,body);break;
   case 'suspend_workforce': result=await rereview.suspendOfficerWorkforce(env.DB,a,body);break;
   default:throw new SignupError('Choose a supported action.');
  }
  return reply(result);
 }catch(error){return fail(error);}
}
