// Test-only preview data. This module is reachable only from the separate frontend fixture entry.
const later=new Date(Date.now()+7*86400000).toISOString(),earlier=new Date(Date.now()-86400000).toISOString();
export const readinessFixtures={
 identity:{id:'ID-PREVIEW',applicantId:'APP-PREVIEW',applicantVersion:3,outcome:'manual_review',outcomeId:'OUTCOME-PREVIEW',identityVerified:false,workEligible:false},
 officer:{officerId:'OFF-PREVIEW',reviews:[{id:'REVIEW-PREVIEW',preparedAt:earlier,decision:null,current:0,expiresAt:later}]},
 readiness:{officerId:'OFF-PREVIEW',reviews:[{id:'CORE-PREVIEW',code:'core_ready',label:'Core readiness assessment',category:'core',serviceType:null,purposeCode:null,expiresAt:later},{id:'SERVICE-PREVIEW',code:'service_unarmed',label:'Unarmed service assessment',category:'service',serviceType:'Unarmed',purposeCode:null,expiresAt:later},{id:'PURPOSE-PREVIEW',code:'purpose_commercial',label:'Commercial site assessment',category:'purpose',serviceType:null,purposeCode:'commercial',expiresAt:later}],optins:[{serviceType:'Unarmed',revision:2,optedIn:1}],passport:null,latestSequence:2,workEligible:false},
 deliveries:{officerId:'OFF-PREVIEW',deliveries:[],workEligible:false},
 rereview:{applicantId:'APP-PREVIEW',applicantVersion:3,intakeStatus:'reviewed',holds:[{kind:'workforce',holdId:'HOLD-PREVIEW',heldAt:earlier,replacementAuthorizedUntil:null},{kind:'passport',holdId:'PASSPORT-HOLD-PREVIEW',heldAt:earlier,replacementAuthorizedUntil:later}],restoresApproval:false,workEligible:false},
};
const record=(kind:string)=>({id:kind==='officer'?'APP-PREVIEW':'ENQ-PREVIEW',kind,email:'synthetic@example.test',createdAt:earlier,updatedAt:earlier,accountLinked:true,version:3,status:'needs_information',note:'Please confirm the corrected location and supporting information.',details:kind==='client'?{organisationName:'Synthetic Client Company',contactName:'Preview Contact',mobile:'0820000000',siteArea:'Johannesburg',message:'Local preview only.'}:{fullName:'Synthetic Officer',mobile:'0820000000',city:'Johannesburg',province:'Gauteng',pathway:'qualified',psiraStatus:'active',psiraNumber:'0000000',psiraGrade:'Grade C'},events:[]});
const serviceKeys=['rosters','approvals','shifts','operators','collections','collectionRecoveries','settlementReviews','clientReviews','reviewClients','employeePaymentCandidates','employeePayments','partnerDestinationCandidates','partnerDestinationReviews','partnerPayableCandidates','partnerPayableReviews','partnerPaymentCandidates','partnerPayments','destinationCandidates','destinationReviews','evidenceReviews','serviceOrders','payrollCandidates','payrollItems','payrollPolicies','payrollRuns','availability','outsideWork','scheduleDeclarations','serviceEvents','timesheets'];
export function installPreviewData(){
 const records:Record<string,ReturnType<typeof record>>={client:record('client'),officer:record('officer')};
 window.fetch=async(input,options)=>{
  const url=new URL(typeof input==='string'?input:input instanceof Request?input.url:input.toString(),location.origin);
  if(url.origin!==location.origin)return Response.json({error:'External requests are disabled in this local preview.'},{status:503});
  const post=options?.method==='POST';
  const scenario=new URLSearchParams(location.search).get('scenario');
  if(scenario==='unavailable')return Response.json({error:'Synthetic unavailable service; no request was sent.'},{status:503});
  if(post&&scenario==='conflict')return Response.json({error:'Synthetic version conflict. Draft retained.'},{status:409});
  if(url.pathname==='/api/production-identity'){
   if(post){const body=JSON.parse(String(options?.body??'{}'));if(body.action==='prepare_passport')return Response.json({error:'Private delivery is not available.'},{status:423});if(body.action==='set_opt_in'){const opt=readinessFixtures.readiness.optins.find(o=>o.serviceType===body.serviceType);if(opt){opt.optedIn=body.optedIn?1:0;opt.revision++;}else readinessFixtures.readiness.optins.push({serviceType:body.serviceType,optedIn:body.optedIn?1:0,revision:1});}return Response.json({id:'SYNTHETIC-RECEIPT',workEligible:false,restoresApproval:false});}
   return Response.json(readinessFixtures[url.searchParams.get('kind') as keyof typeof readinessFixtures]??{});
  }
  if(url.pathname==='/api/signup'){const kind=url.searchParams.get('kind')??url.searchParams.get('scope')??'officer';const rec=records[kind]??records.officer;if(post){const body=JSON.parse(String(options?.body??'{}'));if(body.changes){rec.details={...rec.details,...body.changes};rec.status='submitted';rec.version++;}}return Response.json({records:[rec],email:'synthetic@example.test',hasMore:false});}
  if(url.pathname==='/api/production-operations')return Response.json({...Object.fromEntries(serviceKeys.map(k=>[k,[]])),owner:false});
  if(url.pathname==='/api/agreements/production')return Response.json({documents:[],envelopes:[],entities:[],owner:false});
  if(url.pathname==='/api/payment-execution')return Response.json({liveDispatchEnabled:false,reserves:[],releases:[],reconciliations:[]});
  if(url.pathname==='/api/psira')return Response.json({cases:[]});
  if(url.pathname==='/api/test-cycle')return Response.json({cycles:[]});
  if(url.pathname==='/api/identity')return Response.json({caseVersion:3,nextStep:'training_options',checks:[],history:[]});
  if(url.pathname==='/api/enrolment')return Response.json({canInitialize:false,package:{version:'synthetic'},order:null,history:[],events:[]});
  return Response.json({error:'This action is outside the local preview. No request was sent.'},{status:423});
 };
}
