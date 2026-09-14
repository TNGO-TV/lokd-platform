const id=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0?String(v):typeof v==='string'&&/^[1-9][0-9]{0,39}$/.test(v)?v:null;
const cents=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:null;
export type RefundEvidence={id:string;integrationId:string;transactionId:string;mode:'test'|'live';amountMinor:number;currency:'ZAR';status:string;merchantNote:string;fullyDeducted:boolean;deductedAmount:number};
// Strict whitelist: never persist customer account details from provider envelopes.
export function refundEvidence(raw:unknown):RefundEvidence|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const r=raw as Record<string,unknown>,tx=r.transaction&&typeof r.transaction==='object'?r.transaction as Record<string,unknown>:null;
 const refundId=id(r.id),transactionId=id(tx?.id??r.transaction),amount=cents(r.amount),deducted=cents(r.deducted_amount);
 if(!refundId||!id(r.integration)||!transactionId||!['test','live'].includes(String(r.domain))||tx?.domain!==undefined&&tx.domain!==r.domain||amount===null||amount===0||deducted===null||deducted>amount||r.currency!=='ZAR'||typeof r.status!=='string'||!['pending','processing','processed','failed','needs-attention'].includes(r.status)||typeof r.merchant_note!=='string'||r.merchant_note.length>200||![true,false,0,1].includes(r.fully_deducted as boolean|number))return null;
 return {id:refundId,integrationId:id(r.integration)!,transactionId,mode:r.domain as 'test'|'live',amountMinor:amount,currency:'ZAR',status:r.status,merchantNote:r.merchant_note,fullyDeducted:r.fully_deducted===true||r.fully_deducted===1,deductedAmount:deducted};
}
// Documented sparse webhook shape. A transaction reference is not a refund ID.
export function refundWebhookEvidence(raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const r=raw as Record<string,unknown>,amount=typeof r.amount==='string'&&/^[0-9]+$/.test(r.amount)?Number(r.amount):r.amount;
 if(typeof r.transaction_reference!=='string'||r.transaction_reference.length>200||!id(r.integration)||!['test','live'].includes(String(r.domain))||!Number.isSafeInteger(amount)||Number(amount)<=0||r.currency!=='ZAR'||!['pending','processing','processed','failed','needs-attention'].includes(String(r.status)))return null;
 return {transactionReference:r.transaction_reference,integrationId:id(r.integration),mode:r.domain,amountMinor:amount,currency:'ZAR',status:r.status};
}
