// Paystack evidence is deliberately separate from cleared funding and settlement.
// These decisions never activate a booking or authorise a payroll payment.
export type CollectionBinding = {
 reference:string; orderId:string; clientId:string; applicantId:string;
 caseId:string; caseVersion:number; sourceHash:string; amountMinor:number;
 currency:'ZAR'; mode:'test'|'live';
};
export type CollectionTransaction = {
 id:string; reference:string; domain:string; status:string; amount:number;
 currency:string; paidAt:string|null; metadata:Record<string,unknown>;
};
export function collectionMetadata(b:CollectionBinding){
 return {purpose:'booking_collection',order_id:b.orderId,client_id:b.clientId,
  applicant_id:b.applicantId,application_id:b.caseId,application_version:b.caseVersion,
  source_hash:b.sourceHash,mode:b.mode};
}
export function collectionTransaction(value:unknown):CollectionTransaction|null {
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const d=value as Record<string,unknown>;
 const id=typeof d.id==='number'&&Number.isSafeInteger(d.id)&&d.id>0?String(d.id):typeof d.id==='string'&&/^[1-9][0-9]{0,39}$/.test(d.id)?d.id:null;
 let metadata=d.metadata;if(typeof metadata==='string'){try{metadata=JSON.parse(metadata);}catch{return null;}}
 if(!id||typeof d.reference!=='string'||d.reference.length>200||!['test','live'].includes(String(d.domain))||typeof d.status!=='string'||d.status.length>80||!Number.isSafeInteger(d.amount)||Number(d.amount)<0||typeof d.currency!=='string'||d.currency.length!==3||!metadata||typeof metadata!=='object'||Array.isArray(metadata))return null;
 const paid=d.paid_at;
 if(paid!==undefined&&paid!==null&&(typeof paid!=='string'||!Number.isFinite(Date.parse(paid))))return null;
 // Retain only binding fields; card, bank and customer data are not needed here.
 const clean:Record<string,unknown>={};for(const k of ['purpose','order_id','client_id','applicant_id','application_id','application_version','source_hash','mode']){
  const v=(metadata as Record<string,unknown>)[k];if(typeof v==='string'&&v.length<=200||typeof v==='number'&&Number.isSafeInteger(v))clean[k]=v;
 }
 return {id,reference:d.reference,domain:String(d.domain),status:d.status,amount:Number(d.amount),currency:d.currency,paidAt:typeof paid==='string'?new Date(paid).toISOString():null,metadata:clean};
}
export function collectionEvidenceDecision(b:CollectionBinding,api:CollectionTransaction|null,events:{event:string;transaction:CollectionTransaction|null}[],boundProviderId:string|null,current:boolean){
 const matches=(t:CollectionTransaction|null)=>Boolean(t&&t.reference===b.reference&&t.domain===b.mode&&t.amount===b.amountMinor&&t.currency===b.currency&&(!boundProviderId||t.id===boundProviderId)&&Object.entries(collectionMetadata(b)).every(([k,v])=>t.metadata[k]===v));
 if(!current||!matches(api))return 'review_required';
 if(events.some(e=>!matches(e.transaction)||e.transaction!.id!==api!.id||e.event!=='charge.success'||e.transaction!.status!=='success'))return 'review_required';
 if(api!.status==='reversed')return 'reversed';
 if(['failed','abandoned'].includes(api!.status))return events.length?'review_required':api!.status;
 if(api!.status!=='success')return events.length?'review_required':'pending';
 if(!api!.paidAt||Date.parse(api!.paidAt)>Date.now())return 'review_required';
 if(!events.length)return 'awaiting_webhook';
 if(events.some(e=>e.transaction!.paidAt!==api!.paidAt))return 'review_required';
 return b.mode==='test'?'matched_test':'matched_live_unsettled';
}
