import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {productionOperatorControl} from './production-operator-control';
import {operationsMfaRequired} from './operations-mfa-policy';
import type {SigningActor} from './production-signing';
const text=(v:unknown,label:string,max=200)=>{if(typeof v!=='string'||v.trim().length<2||v.length>max)throw new SignupError(`Provide ${label}.`);return v.trim();};
const digest=(v:unknown)=>{if(typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))throw new SignupError('Provide the SHA-256 digest of the exact source document.');return v;};
const secure=(v:unknown,label:string)=>{const s=text(v,label);if(!/^(vault|document|evidence):[A-Za-z0-9_./:-]{3,180}$/.test(s))throw new SignupError('Use a secure source reference, not bank details or a public link.');return s;};
const date=(v:unknown)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw new SignupError('Use a valid calendar date.');return v;};
const cents=(v:unknown)=>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0||v>25000000)throw new SignupError('Use whole ZAR cents within the approval limit.');return v;};
type Source={timesheet_id:string;employer_id:string;source_json:string};
type Review={id:string;timesheet_id:string;employer_id:string;amount_cents:number;source_json:string;payload_json:string;payload_hash:string;request_hash:string;prepared_by:string;prepared_user:string;status:string;decision:string|null;exported_at:string|null};
const participant=(json:string,user:string)=>{const s=JSON.parse(json);return [s.officerUser,s.clientUser].includes(user);};
export async function readPartnerPayables(db:D1Database,actor:SigningActor){
 const allowed=actor.operations&&!!await db.prepare("SELECT a.id FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE lower(a.email)=? AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role IN ('operations_controller','finance_approver') LIMIT 1").bind(actor.email.toLowerCase()).first();
 if(!allowed)return {partnerPayableAccess:false,partnerPayableReviews:[],partnerPayableCandidates:[]};
 return {partnerPayableAccess:true,partnerPayableReviews:(await db.prepare('SELECT * FROM production_partner_payable_current ORDER BY prepared_at DESC LIMIT 100').all()).results,partnerPayableCandidates:(await db.prepare('SELECT s.* FROM production_partner_payable_sources s WHERE NOT EXISTS(SELECT 1 FROM partner_payables p WHERE p.timesheet_id=s.timesheet_id) ORDER BY s.timesheet_id LIMIT 500').all()).results};
}
export async function operatePartnerPayable(db:D1Database,actor:SigningActor,input:Record<string,unknown>,headers:Headers){
 const action=String(input.action),now=new Date().toISOString();
 if(action==='prepare_partner_payable'){
  const op=await productionOperatorControl(db,actor,headers,'partner.prepare',0),requestKey=text(input.requestKey,'a unique payable request reference');
  if(input.sourcesReviewed!==true)throw new SignupError('Review the actual partner service agreement, invoice line, tax treatment and completed service.');
  const timesheetId=text(input.timesheetId,'the partner service record'),invoiceNumber=text(input.invoiceNumber,'the invoice number').toUpperCase(),invoiceLine=text(input.invoiceLine,'the invoice line reference').toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9._/-]{1,99}$/.test(invoiceNumber)||! /^[A-Z0-9][A-Z0-9._/-]{1,99}$/.test(invoiceLine))throw new SignupError('Use an invoice number and line reference of 2–100 letters, digits, dots, slashes or dashes.');
  const netCents=cents(input.netCents),taxCents=cents(input.taxCents),totalCents=netCents+taxCents;if(netCents<1||totalCents>25000000)throw new SignupError('A positive invoice line within the approval limit is required.');
  const invoiceDate=date(input.invoiceDate),dueDate=date(input.dueDate);if(invoiceDate>now.slice(0,10)||dueDate<invoiceDate)throw new SignupError('Use the actual issued invoice date and a due date on or after it.');
  const payload={invoiceNumber,invoiceLine,invoiceDate,dueDate,netCents,taxCents,totalCents,invoiceReference:secure(input.invoiceReference,'the invoice source'),invoiceHash:digest(input.invoiceHash),agreementReference:secure(input.agreementReference,'the signed service agreement'),agreementHash:digest(input.agreementHash),agreementVersion:text(input.agreementVersion,'the signed agreement version'),taxEvidenceReference:secure(input.taxEvidenceReference,'the reviewed invoice tax treatment'),note:text(input.note,'the invoice and service review findings',1200)};
  const expiry=typeof input.expiresAt==='string'?Date.parse(input.expiresAt):NaN;if(!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+30*86400000)throw new SignupError('Use an evidence review expiry within 30 days.');
  const requestHash=await agreementHash(JSON.stringify({timesheetId,payload,expiry}));await productionOperatorControl(db,actor,headers,'partner.prepare',totalCents);
  const prior=await db.prepare('SELECT id,request_hash FROM production_partner_payable_reviews WHERE request_key=?').bind(requestKey).first<Review>();if(prior){if(prior.request_hash!==requestHash)throw new SignupError('This request reference belongs to different invoice evidence.',409);return {reviewId:prior.id,alreadyPrepared:true,paymentReleased:false};}
  const source=await db.prepare('SELECT * FROM production_partner_payable_sources WHERE timesheet_id=?').bind(timesheetId).first<Source>();if(!source||participant(source.source_json,actor.userId))throw new SignupError('Choose independently reviewed completed partner-company service.',409);
  if(expiry>Date.parse(JSON.parse(source.source_json).expiresAt))throw new SignupError('The review cannot outlive employer, engagement or agreement evidence.',409);
  const id='PPR-'+crypto.randomUUID(),json=JSON.stringify(payload),hash=await agreementHash(JSON.stringify({source:source.source_json,payload:json}));
  await db.prepare('INSERT INTO production_partner_payable_reviews VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,timesheetId,source.employer_id,requestKey,requestHash,source.source_json,json,hash,totalCents,op.id,actor.userId,now,new Date(expiry).toISOString()).run();return {reviewId:id,paymentReleased:false};
 }
 if(!['approve_partner_payable','reject_partner_payable','hold_partner_payable','export_partner_payable'].includes(action))throw new SignupError('Choose a supported partner payable action.');
 if(!actor.operations)throw new SignupError('Operations access required.',403);
 const r=await db.prepare('SELECT * FROM production_partner_payable_current WHERE id=?').bind(text(input.reviewId,'the payable review')).first<Review>();if(!r)throw new SignupError('Partner payable review not found.',404);
 const deciding=['approve_partner_payable','reject_partner_payable'].includes(action),op=await productionOperatorControl(db,actor,headers,action==='export_partner_payable'?'partner.export':'partner.approve',r.amount_cents,deciding?r.prepared_by:undefined);
 if(participant(r.source_json,actor.userId)||deciding&&r.prepared_user===actor.userId)throw new SignupError('Independent partner finance review is required.',403);
 if(input.payloadHash!==r.payload_hash||await agreementHash(JSON.stringify({source:r.source_json,payload:r.payload_json}))!==r.payload_hash)throw new SignupError('Refresh and review the exact invoice and service evidence.',409);
 if(action==='hold_partner_payable'){await db.prepare('INSERT OR IGNORE INTO production_partner_payable_holds VALUES(?,?,?,?,?)').bind(r.id,op.id,actor.userId,text(input.note,'the suspension findings',1200),now).run();return {held:true,paymentReleased:false};}
 if(action==='export_partner_payable'){
  if(r.status!=='approved')throw new SignupError('A current approved, unsuspended partner payable is required.',409);
  await db.prepare('INSERT OR IGNORE INTO production_partner_payable_exports VALUES(?,?,?,?,?)').bind(r.id,op.id,actor.userId,r.payload_hash,now).run();return {exportReady:true,paymentReleased:false};
 }
 const approving=action==='approve_partner_payable',decision=approving?'approved':'rejected';if(r.decision){if(r.decision!==decision)throw new SignupError('The decision is final. Prepare new evidence for a rejected review.',409);return {alreadyDecided:true,status:r.status,paymentReleased:false};}
 if(approving&&(r.status!=='pending'||input.sourcesReviewed!==true))throw new SignupError('Independently review current company, invoice, agreement, tax and service evidence.',409);
 const note=text(input.note,'the independent finance findings',1200),statements=[db.prepare('INSERT INTO production_partner_payable_decisions VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),r.id,decision,op.id,actor.userId,r.payload_hash,note,operationsMfaRequired()?'mfa_verified':'owner_mfa_exception',now)];
 if(approving)statements.push(db.prepare("INSERT INTO partner_payables VALUES(?,?,?,?,?,'ZAR','approved_unpaid',NULL,'production','production_verified',?,?)").bind('PP-'+r.id,r.timesheet_id,r.employer_id,JSON.parse(r.payload_json).agreementVersion,r.amount_cents,now,now));
 await db.batch(statements);return {decision,paymentReleased:false};
}
export async function exportPartnerPayableCsv(db:D1Database,actor:SigningActor,reviewId:string,headers:Headers){
 if(!actor.operations)throw new SignupError('Operations access required.',403);
 const r=await db.prepare("SELECT * FROM production_partner_payable_current WHERE id=? AND status='approved' AND exported_at IS NOT NULL").bind(reviewId).first<Review>();if(!r)throw new SignupError('Approve and export current, unsuspended partner evidence first.',409);
 await productionOperatorControl(db,actor,headers,'partner.export',r.amount_cents);if(participant(r.source_json,actor.userId))throw new SignupError('Independent finance access required.',403);
 if(await agreementHash(JSON.stringify({source:r.source_json,payload:r.payload_json}))!==r.payload_hash)throw new SignupError('Payable integrity check failed.',409);
 const s=JSON.parse(r.source_json),p=JSON.parse(r.payload_json),cell=(v:unknown)=>'"'+String(v).replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
 return [['payable_id','employer_id','employer_legal_name','timesheet_id','service_date','invoice_number','invoice_line','invoice_date','due_date','currency','net_cents','invoice_tax_cents','total_cents','payment_status','review_hash'],['PP-'+r.id,r.employer_id,s.employerName,r.timesheet_id,s.serviceDate,p.invoiceNumber,p.invoiceLine,p.invoiceDate,p.dueDate,'ZAR',p.netCents,p.taxCents,r.amount_cents,'NOT_PAID',r.payload_hash]].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
