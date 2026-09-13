export type EmployeeTransferBinding={reference:string;mode:'test'|'live';amount:number;currency:'ZAR';recipientId:string;integration:string};
export type EmployeeTransfer={id:string;code:string;reference:string;mode:string;amount:number;currency:string;recipientId:string;integration:string;status:string};
const id=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0?String(v):typeof v==='string'&&/^[1-9][0-9]{0,19}$/.test(v)?v:null;
export function employeeTransfer(raw:unknown):EmployeeTransfer|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;const r=raw as Record<string,unknown>,recipient=r.recipient&&typeof r.recipient==='object'?r.recipient as Record<string,unknown>:null;
 const providerId=id(r.id),integration=id(r.integration),recipientId=id(recipient?.id??r.recipient);
 if(!providerId||!integration||!recipientId||typeof r.transfer_code!=='string'||!/^TRF_[a-zA-Z0-9]{6,60}$/.test(r.transfer_code)||typeof r.reference!=='string'||!/^lokd-pay-[a-z0-9-]{16,41}$/.test(r.reference)||!['test','live'].includes(String(r.domain))||r.currency!=='ZAR'||!Number.isSafeInteger(r.amount)||Number(r.amount)<1||r.source!=='balance'||!['pending','otp','success','failed','reversed','abandoned','blocked','rejected','received'].includes(String(r.status)))return null;
 if(recipient&&(id(recipient.integration)!==integration||recipient.domain!==r.domain||recipient.currency!==r.currency||recipient.type!=='basa'))return null;
 return {id:providerId,code:r.transfer_code,reference:r.reference,mode:String(r.domain),amount:Number(r.amount),currency:r.currency,recipientId,integration,status:String(r.status)};
}
export function transferMatches(b:EmployeeTransferBinding,t:EmployeeTransfer|null){return !!t&&t.reference===b.reference&&t.mode===b.mode&&t.amount===b.amount&&t.currency===b.currency&&t.recipientId===b.recipientId&&t.integration===b.integration;}
export type TransferObservation={source:string;event:string;transfer:EmployeeTransfer|null;webhookCount:number|null};
export function employeeTransferOutcome(b:EmployeeTransferBinding,observations:TransferObservation[]){
 if(!observations.length)return 'unverified';
 if(observations.some(o=>o.source==='operations'||!transferMatches(b,o.transfer)))return 'review_required';
 const identity=new Set(observations.map(o=>o.transfer!.id+':'+o.transfer!.code));if(identity.size!==1)return 'review_required';
 const signed=observations.filter(o=>o.source==='webhook');
 if(signed.some(o=>!['transfer.success','transfer.failed','transfer.reversed'].includes(o.event)||o.event!==`transfer.${o.transfer!.status}`))return 'review_required';
 if(observations.some(o=>o.transfer!.status==='reversed'))return 'reversed_test';
 if(observations.some(o=>['failed','abandoned','blocked','rejected'].includes(o.transfer!.status)))return 'failed_test';
 const api=observations.filter(o=>o.source==='verify').at(-1);
 if(!api||api.webhookCount!==signed.length)return 'verification_required';
 if(api.transfer!.status==='success')return signed.some(o=>o.event==='transfer.success')?'confirmed_test':'awaiting_signed_confirmation';
 return api.transfer!.status==='otp'?'provider_authorization_required':'pending_test';
}
