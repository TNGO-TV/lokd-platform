import {collectionEvidenceDecision,collectionTransaction,type CollectionBinding,type CollectionTransaction} from './collection-evidence';
const id=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0?String(v):typeof v==='string'&&/^[1-9][0-9]{0,39}$/.test(v)?v:null;
const cents=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
export type SettlementEvidence={id:string;mode:string;currency:string;settledAt:string;processedMinor:number;feesMinor:number;bankMinor:number;transactionCount:number;transaction:CollectionTransaction;transactionFeeMinor:number};
export function settlementEvidence(b:CollectionBinding,providerId:string,raw:Record<string,unknown>,rows:Record<string,unknown>[],bankMinor:unknown):SettlementEvidence|null{
 const settlementId=id(raw.id),date=raw.settlement_date;
 if(!settlementId||raw.domain!==b.mode||raw.currency!==b.currency||raw.status!=='success'||typeof date!=='string'||!Number.isFinite(Date.parse(date))||Date.parse(date)>Date.now()||!cents(raw.total_processed)||!cents(raw.total_fees)||!cents(raw.total_amount)||!cents(raw.effective_amount)||raw.total_amount!==raw.effective_amount||raw.total_processed-raw.total_fees!==raw.effective_amount||raw.effective_amount!==bankMinor||raw.deductions!==null&&raw.deductions!==0||!rows.length)return null;
 const seen=new Set<string>();let gross=0,fees=0;
 for(const r of rows){const tid=id(r.id);if(!tid||seen.has(tid)||r.domain!==b.mode||r.currency!==b.currency||r.status!=='success'||!cents(r.amount)||!cents(r.fees)||r.fees>r.amount||r.fees_split!==null&&r.fees_split!==undefined)return null;seen.add(tid);gross+=r.amount;fees+=r.fees;}
 if(!Number.isSafeInteger(gross)||!Number.isSafeInteger(fees)||gross!==raw.total_processed||fees!==raw.total_fees)return null;
 const found=rows.filter(r=>id(r.id)===providerId&&r.reference===b.reference);if(found.length!==1)return null;
 const transaction=collectionTransaction(found[0]);
 if(!transaction||collectionEvidenceDecision(b,transaction,[{event:'charge.success',transaction}],providerId,true)==='review_required'||Date.parse(transaction.paidAt!)>Date.parse(date))return null;
 return {id:settlementId,mode:b.mode,currency:b.currency,settledAt:new Date(date).toISOString(),processedMinor:gross,feesMinor:fees,bankMinor:raw.effective_amount,transactionCount:rows.length,transaction,transactionFeeMinor:Number(found[0].fees)};
}
