import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {productionOperatorControl} from './production-operator-control';
import {operationsMfaRequired} from './operations-mfa-policy';
import type {SigningActor} from './production-signing';
const text=(v:unknown,label:string,max=1200)=>{if(typeof v!=='string'||v.trim().length<3||v.length>max)throw new SignupError(`Provide ${label}.`);return v.trim();};
const digest=(v:unknown)=>{if(typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))throw new SignupError('Provide the reviewed SHA-256 evidence digest.');return v;};
type Source={invoice_id:string;booking_id:string;client_id:string;recipient_user:string;total_cents:number;source_json:string};
type Credit={id:string;invoice_id:string;payload_json:string;payload_hash:string;operator_id:string;user_id:string;source_json:string};
async function authority(db:D1Database,a:SigningActor,h:Headers,s:Source,maker?:string){if(a.userId===s.recipient_user)throw new SignupError('Recipients cannot approve their own credit.',403);return productionOperatorControl(db,a,h,'payroll.second_approve',s.total_cents,maker);}
export async function operateCreditNote(db:D1Database,a:SigningActor,input:Record<string,unknown>,h:Headers){
 const s=await db.prepare('SELECT * FROM credit_note_sources WHERE invoice_id=?').bind(text(input.invoiceId,'the original issued invoice',200)).first<Source>();if(!s)throw new SignupError('An original privately issued invoice is required.',409);
 const op=await authority(db,a,h,s),now=new Date().toISOString();
 if(input.action==='prepare_credit_note'){
  if(input.evidenceReviewed!==true||input.liabilitiesReviewed!==true)throw new SignupError('Review approved credit/tax policy and downstream liabilities.');
  const net=input.netCents,tax=input.taxCents;if(!Number.isSafeInteger(net)||!Number.isSafeInteger(tax)||Number(net)<0||Number(tax)<0||!Number.isSafeInteger(Number(net)+Number(tax))||Number(net)+Number(tax)<=0)throw new SignupError('Use exact nonnegative minor-unit amounts.');
  const reverses=input.reversesId===undefined?null:text(input.reversesId,'the original credit to reverse',200),key=text(input.requestKey,'the stable credit request key',200);
  const request={sourceHash:await agreementHash(s.source_json),invoiceId:s.invoice_id,netCents:net,taxCents:tax,reversesId:reverses,policyReference:text(input.policyReference,'the approved policy reference',200),policyHash:digest(input.policyHash),taxReference:text(input.taxReference,'the approved tax evidence',200),taxHash:digest(input.taxHash),liabilityPlan:text(input.liabilityPlan,'the service and liability disposition'),note:text(input.note,'the credit reason')};
  const payload=JSON.stringify(request),hash=await agreementHash(payload),old=await db.prepare('SELECT * FROM credit_notes WHERE request_key=?').bind(key).first<Credit>();if(old){if(old.payload_hash!==hash)throw new SignupError('Credit request key has different facts.',409);return {creditId:old.id,alreadyPrepared:true};}
  const id=crypto.randomUUID();await db.prepare('INSERT INTO credit_notes VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,key,s.invoice_id,reverses,reverses?-1:1,net,tax,s.source_json,payload,hash,op.id,a.userId,now).run();return {creditId:id,moneyMoved:false};
 }
 const c=await db.prepare('SELECT * FROM credit_notes WHERE id=? AND invoice_id=?').bind(text(input.creditId,'the credit ID',200),s.invoice_id).first<Credit>();if(!c)throw new SignupError('Credit not found.',404);
 await authority(db,a,h,s,c.operator_id);if(a.userId===c.user_id)throw new SignupError('Independent user approval required.',403);
 if(input.payloadHash!==c.payload_hash||await agreementHash(c.payload_json)!==c.payload_hash||input.evidenceReviewed!==true)throw new SignupError('Review the exact credit digest.',409);
 if(input.action!=='approve_credit_note'&&input.action!=='reject_credit_note')throw new SignupError('Choose a supported credit action.');
 const decision=input.action==='approve_credit_note'?'approved':'rejected',statements=[db.prepare('INSERT INTO credit_note_decisions VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),c.id,decision,c.payload_hash,op.id,a.userId,text(input.note,'the independent credit findings'),operationsMfaRequired()?'mfa_verified':'owner_mfa_exception',now)];
 if(decision==='approved')statements.push(db.prepare('INSERT INTO credit_note_issues VALUES(?,?,?)').bind(c.id,'LOKD-CN-'+c.id.toUpperCase(),now));
 await db.batch(statements);return {creditId:c.id,decision,moneyMoved:false,liabilitiesCancelled:false};
}
export async function readCreditNotes(db:D1Database,a:SigningActor,h:Headers,invoiceId:string){
 const s=await db.prepare('SELECT * FROM credit_note_balances WHERE invoice_id=?').bind(invoiceId).first<Source&{credited_cents:number}>();if(!s)throw new SignupError('Private invoice not found.',404);
 if(a.operations)await authority(db,a,h,s);else if(a.userId!==s.recipient_user||!await db.prepare("SELECT entity_id FROM production_entity_links WHERE kind='client' AND entity_id=? AND owner_user_id=?").bind(s.client_id,a.userId).first())throw new SignupError('Private invoice not found.',404);
 const notes=(await db.prepare(`SELECT c.*,d.decision,n.number,n.issued_at FROM credit_notes c LEFT JOIN credit_note_decisions d ON d.credit_id=c.id LEFT JOIN credit_note_issues n ON n.credit_id=c.id WHERE c.invoice_id=? ${a.operations?'':'AND n.credit_id IS NOT NULL'} ORDER BY c.rowid`).bind(invoiceId).all()).results;
 return {invoice:s,creditNotes:notes,moneyMoved:false,liabilitiesCancelled:false};
}
