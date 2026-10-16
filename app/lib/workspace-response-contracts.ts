import {workspaceContracts,automaticWorkspaceContracts} from './workspace-contracts-generated';

export type Contract={kind:string;value?:unknown;items?:Contract[];item?:Contract;fields?:Record<string,{optional:boolean;schema:Contract}>;values?:Contract};
const record=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
export function matchesWorkspaceContract(value:unknown,contract:Contract):boolean{
 switch(contract.kind){
  case 'unknown':return true;
  case 'undefined':return value===undefined;
  case 'literal':return value===contract.value;
  case 'string':return typeof value==='string';
  case 'number':return typeof value==='number'&&Number.isFinite(value);
  case 'boolean':return typeof value==='boolean';
  case 'union':return contract.items!.some(item=>matchesWorkspaceContract(value,item));
  case 'intersection':return contract.items!.every(item=>matchesWorkspaceContract(value,item));
  case 'array':return Array.isArray(value)&&value.every(item=>matchesWorkspaceContract(item,contract.item!));
  case 'object':return record(value)&&Object.entries(contract.fields!).every(([key,field])=>field.optional&&value[key]===undefined||matchesWorkspaceContract(value[key],field.schema))&&(!contract.values||Object.values(value).every(item=>matchesWorkspaceContract(item,contract.values!)));
  default:return false;
 }
}
function savedJson(value:unknown):boolean{
 if(Array.isArray(value))return value.every(savedJson);
 if(!record(value))return true;
 return Object.entries(value).every(([key,item])=>{
  if(key.endsWith('_json')&&typeof item==='string'){
   try{const parsed:unknown=JSON.parse(item);return Boolean(parsed)&&typeof parsed==='object';}catch{return false;}
  }
  return savedJson(item);
 });
}
function jsonMatches(value:unknown,contract:Contract){try{return typeof value==='string'&&matchesWorkspaceContract(JSON.parse(value),contract);}catch{return false;}}
function jsonObject(value:unknown):Record<string,unknown>|null{try{const parsed=typeof value==='string'?JSON.parse(value):null;return record(parsed)?parsed:null;}catch{return null;}}
function jsonFields(value:unknown,strings:string[]=[],numbers:string[]=[]){const parsed=jsonObject(value);return Boolean(parsed)&&strings.every(key=>typeof parsed![key]==='string')&&numbers.every(key=>typeof parsed![key]==='number'&&Number.isFinite(parsed![key]));}
function rows(value:Record<string,unknown>,key:string){return value[key] as Record<string,unknown>[];}
export const workspaceAutoContract=(key:string)=>(value:unknown)=>{
 const contract=(automaticWorkspaceContracts as Record<string,Contract>)[key];
 if(!contract||!matchesWorkspaceContract(value,contract)||!savedJson(value)||!record(value))return false;
 if(key.startsWith('identity-panel.tsx/'))return rows(value,'history').every(row=>jsonFields(row.snapshot,['state'],['attempts']));
 if(key.startsWith('test-enrolment-panel.tsx/'))return rows(value,'events').every(row=>jsonFields(row.snapshot,['state']));
 return true;
};
export function productionOperationsResponse(value:unknown){
 try{
 if(!matchesWorkspaceContract(value,workspaceContracts.operations)||!record(value)||!savedJson(value))return false;
 for(const [key,contract] of [['employeePayments',workspaceContracts.employeeSnapshot],['employeePaymentCandidates',workspaceContracts.employeeSnapshot],['partnerPayments',workspaceContracts.partnerSnapshot],['partnerPaymentCandidates',workspaceContracts.partnerSnapshot]] as const){
  if(!rows(value,key).every(row=>row.mode==='live'&&jsonMatches(row.source_json,contract)))return false;
 }
 for(const [key,contract] of [['destinationReviews',workspaceContracts.employeeDestination],['partnerDestinationReviews',workspaceContracts.partnerDestination]] as const){
  if(!rows(value,key).every(row=>row.mode==='live'&&jsonMatches(row.payload_json,contract)&&record(JSON.parse(JSON.parse(String(row.payload_json)).sourceJson))))return false;
 }
 if(!rows(value,'collections').every(row=>row.mode==='live')||!rows(value,'settlementReviews').every(row=>row.mode==='live'))return false;
 for(const row of rows(value,'destinationCandidates'))if(!jsonFields(row.source_json,['employerId','engagementId','profileId'],['profileVersion']))return false;
 for(const row of rows(value,'partnerDestinationCandidates'))if(!jsonFields(row.source_json,['employerName','employerId'],['employerVersion']))return false;
 for(const row of rows(value,'destinationReviews'))if(!jsonFields(JSON.parse(String(row.payload_json)).sourceJson,['employerId','engagementId','profileId'],['profileVersion']))return false;
 for(const row of rows(value,'partnerDestinationReviews'))if(!jsonFields(JSON.parse(String(row.payload_json)).sourceJson,['employerName','employerId'],['employerVersion']))return false;
 for(const row of [...rows(value,'partnerPayableCandidates'),...rows(value,'partnerPayableReviews')])if(!jsonFields(row.source_json,['employerName','employerId','serviceDate','officerId','timesheetId','agreementEvidence'],['payableMinutes']))return false;
 for(const row of rows(value,'partnerPayableReviews'))if(!jsonFields(row.payload_json,['invoiceNumber','invoiceLine','invoiceDate','dueDate','invoiceReference','invoiceHash','agreementVersion','agreementReference','agreementHash','taxEvidenceReference','note'],['netCents','taxCents']))return false;
 for(const row of rows(value,'payrollPolicies'))if(!jsonFields(row.rules_json,['version']))return false;
 for(const row of rows(value,'payrollItems'))if(!jsonObject(row.calculation_json))return false;
 for(const row of rows(value,'clientReviews'))if(!jsonObject(row.snapshot_json)||!jsonObject(row.evidence_json))return false;
 for(const row of rows(value,'evidenceReviews'))if(!jsonObject(row.payload_json))return false;
 if(!rows(value,'payrollRuns').every(row=>jsonMatches(row.payload_json,workspaceContracts.payrollSnapshot)))return false;
 return rows(value,'serviceOrders').every(row=>{const quote=JSON.parse(String(row.quote_json));return typeof quote.clientPriceCents==='number'&&Number.isFinite(quote.clientPriceCents)&&Number.isSafeInteger(quote.shiftCount)&&quote.shiftCount>=0;});
 }catch{return false;}
}
export const productionSigningResponse=(value:unknown)=>matchesWorkspaceContract(value,workspaceContracts.signing)&&savedJson(value);
export const psiraResponse=(value:unknown)=>matchesWorkspaceContract(value,workspaceContracts.psira)&&savedJson(value)&&record(value)&&rows(value,'cases').every(row=>(row.events as Record<string,unknown>[]).every(event=>{const evidence=jsonObject(event.evidence_json);return Boolean(evidence)&&['checkedAt','returnedName','grade','employmentStatus','certificateExpiry','excerpt','reason','identityEvidence','source'].every(key=>evidence![key]===undefined||typeof evidence![key]==='string');}));
export const deliveryResponse=(value:unknown)=>matchesWorkspaceContract(value,workspaceContracts.delivery);
export const booksLinksResponse=(value:unknown)=>matchesWorkspaceContract(value,workspaceContracts.booksLinks);
export const creditNotesResponse=(value:unknown)=>matchesWorkspaceContract(value,workspaceContracts.creditNotes)&&savedJson(value);
export const paymentFinanceResponse=(value:unknown)=>matchesWorkspaceContract(value,workspaceContracts.paymentFinance)&&savedJson(value);
export function financeDocumentsResponse(value:unknown){
 if(!matchesWorkspaceContract(value,workspaceContracts.financeDocuments)||!record(value)||!savedJson(value)||value.calendar!=='Africa/Johannesburg')return false;
 return [...rows(value,'documents'),...rows(value,'sources')].every(row=>jsonMatches(row.financial_json,workspaceContracts.financialHistory)&&['payslip','invoice','remittance'].includes(String(row.kind))&&['unpaid','pending','paid','held','reversed'].includes(String(row.currentState)));
}
export function clientQuotesResponse(value:unknown){
 if(!matchesWorkspaceContract(value,workspaceContracts.quotes)||!record(value)||!savedJson(value))return false;
 if(!rows(value,'quotes').every(row=>row.receipt_json===null||jsonFields(row.receipt_json,['acceptedAt'])))return false;
 return [...rows(value,'quotes'),...rows(value,'orders')].every(row=>{
  const source=JSON.parse(String(row.source_json));
  return record(source)&&['contactName','address','siteArea','serviceType','purposeLabel','postName','instructions','startDate','endDate','shiftStart','shiftEnd','minimumGrade','riskBand','specialistConfiguration'].every(key=>source[key]===null||source[key]===undefined||typeof source[key]==='string')&&['headcount','creditTermsDays'].every(key=>typeof source[key]==='number'&&Number.isFinite(source[key]))&&['clientName','siteName','rosterPattern','fundingModel'].every(key=>typeof source[key]==='string')&&['subtotalCents','vatCents','totalCents','shiftCount'].every(key=>typeof source[key]==='number'&&Number.isFinite(source[key]));
 });
}

export function identityReviewResponse(value:unknown,query:URLSearchParams){
 if(!record(value)||value.contract!=='lokd.identity-workspace.v1'||value.workEligible!==false)return false;
 const kind=query.get('kind');
 if(kind==='holds')return matchesWorkspaceContract(value,workspaceContracts.reviewHolds)&&value.applicantId===query.get('id');
 if(value.recordType!==query.get('recordType'))return false;
 if(kind==='review_queue')return matchesWorkspaceContract(value,workspaceContracts.reviewQueue)&&(value.nextOffset===null||Number.isSafeInteger(value.nextOffset)&&Number(value.nextOffset)>Number(query.get('offset')??0));
 return kind==='review_detail'&&matchesWorkspaceContract(value,workspaceContracts.reviewDetail)&&record(value.record)&&value.record.id===query.get('id');
}
export function readinessRecordResponse(value:unknown,key:string,id:string,sandbox=false){
 if(sandbox){if(!sandboxEnvelope(value))return false;value=value.data;}
 if(!record(value))return false;
 const contracts:Record<string,Contract>={identity:workspaceContracts.readinessIdentity,officer:workspaceContracts.readinessOfficer,readiness:workspaceContracts.readinessRecord,holds:workspaceContracts.readinessHolds};
 const field=key==='identity'?'id':key==='holds'?'applicantId':'officerId';
 return Boolean(contracts[key])&&matchesWorkspaceContract(value,contracts[key])&&value[field]===id;
}

export function financePrivateResponse(value:unknown,query:URLSearchParams){
 if(!record(value)||value.environment!=='sandbox'||!savedJson(value))return false;
 if(query.has('commands'))return matchesWorkspaceContract(value,workspaceContracts.financeCommandQueue);
 if(query.has('commandId'))return matchesWorkspaceContract(value,workspaceContracts.financeCommandDetail)&&record(value.command)&&value.command.id===query.get('commandId');
 if(query.has('operationId'))return matchesWorkspaceContract(value,workspaceContracts.financeOperationEvidence)&&record(value.operation)&&value.operation.id===query.get('operationId');
 if(query.get('catalogue')==='training')return matchesWorkspaceContract(value,workspaceContracts.financeTraining);
 if(query.has('applicationId'))return matchesWorkspaceContract(value,workspaceContracts.financeEnrolment)&&value.applicationId===query.get('applicationId');
 return matchesWorkspaceContract(value,workspaceContracts.financeData)&&(!query.has('id')||rows(value,'records').every(row=>row.id===query.get('id')));
}
export function sandboxServiceResponse(value:unknown,service:string){
 if(!record(value)||value.mode!=='sandbox'||value.policyVersion!=='lokd-sandbox-completion-v1'||value.productionWorkEligible!==false)return false;
 const contracts:Record<string,Contract>={schedule_read:workspaceContracts.sandboxSchedule,service_read:workspaceContracts.sandboxService,orders_read:workspaceContracts.sandboxOrders,operations_read:workspaceContracts.sandboxOperations};
 return contracts[service]?matchesWorkspaceContract(value.data,contracts[service])&&savedJson(value.data):record(value.data);
}

function sandboxEnvelope(value:unknown,mode='simulator'):value is Record<string,unknown>{return record(value)&&value.mode===mode&&value.policyVersion==='lokd-sandbox-completion-v1'&&value.productionWorkEligible===false&&record(value.data);}
export function passportDeliveryResponse(value:unknown,officerId:string,sandbox=false,write=false){
 if(sandbox){if(!sandboxEnvelope(value,write?'sandbox':'simulator'))return false;value=value.data;}
 if(!record(value)||value.officerId!==officerId)return false;
 if(write)return matchesWorkspaceContract(value,workspaceContracts.deliveryReceipt);
 return matchesWorkspaceContract(value,workspaceContracts.deliveryRecords)&&(sandbox||value.workEligible===false)&&rows(value,'deliveries').every(row=>row.officerId===officerId);
}
export function sandboxReviewResponse(value:unknown,query:URLSearchParams){
 if(!sandboxEnvelope(value))return false;
 const q=new URLSearchParams(query);q.set('kind',q.get('kind')==='queue'?'review_queue':q.get('kind')==='detail'?'review_detail':'holds');
 return identityReviewResponse(value.data,q);
}

export function readinessChoicesResponse(value:unknown,query:URLSearchParams){
 if(!sandboxEnvelope(value)||!record(value.data))return false;
 const data=value.data;
 if(query.get('view')==='review')return sandboxReviewResponse(value,query);
 if(query.get('view')==='officer')return passportDeliveryResponse(value,query.get('officerId')??'',true);
 return query.get('view')==='record'&&query.get('kind')==='case'&&record(data.case)&&data.case.applicantId===query.get('id')&&Array.isArray(data.psira)&&data.psira.every(row=>record(row)&&(row.latestEventId===null||typeof row.latestEventId==='string'));
}

export function signupResponse(value:unknown,kind:string){return matchesWorkspaceContract(value,workspaceContracts.signup)&&record(value)&&rows(value,'records').every(row=>row.kind===kind&&Number.isSafeInteger(row.version)&&Number(row.version)>=0);}
export function publicPassportResponse(value:unknown){return matchesWorkspaceContract(value,workspaceContracts.publicPassport)&&record(value)&&record(value.passport)&&value.passport.productionAuthorized===false;}

export function clientEnquiriesResponse(value:unknown){return matchesWorkspaceContract(value,workspaceContracts.clientEnquiries)&&record(value)&&rows(value,'enquiries').every(row=>Number.isSafeInteger(row.version)&&Number(row.version)>0&&Number.isFinite(Date.parse(String(row.createdAt)))&&Number.isFinite(Date.parse(String(row.updatedAt))));}
