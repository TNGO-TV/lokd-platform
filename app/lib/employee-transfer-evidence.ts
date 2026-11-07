export type EmployeeTransferBinding={reference:string;mode:'live';amount:number;currency:'ZAR';recipientId:string;integration:string};
export type EmployeeTransfer={id:string;code:string;reference:string;mode:string;amount:number;currency:string;recipientId:string;integration:string;status:string};
const id=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0?String(v):typeof v==='string'&&/^[1-9][0-9]{0,19}$/.test(v)?v:null;
export function employeeTransfer(raw:unknown,kind:'employee'='employee'):EmployeeTransfer|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;const r=raw as Record<string,unknown>,recipient=r.recipient&&typeof r.recipient==='object'?r.recipient as Record<string,unknown>:null;
 const providerId=id(r.id),integration=id(r.integration),recipientId=id(recipient?.id??r.recipient);
 if(!providerId||!integration||!recipientId||typeof r.transfer_code!=='string'||!/^TRF_[a-zA-Z0-9]{6,60}$/.test(r.transfer_code)||typeof r.reference!=='string'||!(kind==='employee'&&/^lokd-pay-[a-z0-9-]{16,41}$/.test(r.reference))||r.domain!=='live'||r.currency!=='ZAR'||!Number.isSafeInteger(r.amount)||Number(r.amount)<1||r.source!=='balance'||!['pending','otp','success','failed','reversed','abandoned','blocked','rejected','received'].includes(String(r.status)))return null;
 if(recipient&&(id(recipient.integration)!==integration||recipient.domain!==r.domain||recipient.currency!==r.currency||recipient.type!=='basa'))return null;
 return {id:providerId,code:r.transfer_code,reference:r.reference,mode:String(r.domain),amount:Number(r.amount),currency:r.currency,recipientId,integration,status:String(r.status)};
}
export function transferMatches(b:EmployeeTransferBinding,t:EmployeeTransfer|null){return !!t&&t.reference===b.reference&&t.mode===b.mode&&t.amount===b.amount&&t.currency===b.currency&&t.recipientId===b.recipientId&&t.integration===b.integration;}
export type TransferObservation={source:string;event:string;transfer:EmployeeTransfer|null;webhookCount:number|null};
