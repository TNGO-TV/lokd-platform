import {SignupError} from './signup-server';
import {operationsAccess,requireOperationsRole} from './operations-access';
const text=(v:unknown,label:string)=>{if(typeof v!=='string'||v.trim().length<3||v.length>300)throw new SignupError('Provide '+label+'.');return v.trim();};
export async function operateEft(db:D1Database,headers:Headers,input:Record<string,unknown>) {
 const actor=await operationsAccess(db,headers),now=new Date().toISOString();
 if(input.action==='prepare_eft') {
  const amount=input.amountCents;
  if(typeof amount!=='number')throw new SignupError('Provide the cleared amount in cents.');
  requireOperationsRole(actor,['funding_reconciler'],amount);
  const bookingId=text(input.bookingId,'the booking'),reference=text(input.bankReference,'the unique bank statement reference'),artifactId=text(input.artifactId,'the verified bank statement');
  const at=typeof input.clearedAt==='string'?Date.parse(input.clearedAt):NaN;
  if(!Number.isFinite(at)||at>Date.now())throw new SignupError('Provide the bank clearing time.');
  const artifact=await db.prepare("SELECT content_hash FROM document_artifacts WHERE id=? AND environment='production' AND status='verified' AND access_class='finance'").bind(artifactId).first<{content_hash:string}>();
  if(!artifact)throw new SignupError('Upload and verify the bank statement as finance evidence first.',409);
  if(input.bankStatementReviewed!==true)throw new SignupError('Inspect the cleared bank transaction and confirm the booking reference.');
  const id=crypto.randomUUID();
  await db.batch([
   db.prepare('INSERT INTO production_eft_receipts VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,bookingId,reference,amount,artifactId,artifact.content_hash,new Date(at).toISOString(),actor.operatorId,actor.userId,text(input.note,'the reconciliation findings'),now),
   db.prepare("INSERT INTO audit_events VALUES(?,'operations',?,'production_eft_prepared','booking',?,?,?)").bind(crypto.randomUUID(),actor.userId,bookingId,JSON.stringify({receiptId:id,amountCents:amount}),now),
  ]);return {receiptId:id,status:'awaiting_approval'};
 }
 const receiptId=text(input.receiptId,'the receipt'),r=await db.prepare('SELECT * FROM production_eft_receipts WHERE id=?').bind(receiptId).first<{amount_cents:number;booking_id:string;prepared_by:string;prepared_user:string}>();
 if(!r)throw new SignupError('EFT receipt not found.',404);
 requireOperationsRole(actor,['finance_approver'],r.amount_cents);
 if(input.action==='apply_eft_funding'){
  const result=await db.batch([
   db.prepare("UPDATE bookings SET funding_status='paid_in_full',status='matching' WHERE id=? AND environment='production' AND funding_status='unfunded' AND status='draft' AND EXISTS(SELECT 1 FROM booking_funding_reconciliations f WHERE f.id=? AND f.active_key=bookings.id AND f.status='cleared_reconciled' AND f.evidence_expires_at>?)").bind(r.booking_id,'EFT-'+receiptId,now),
   db.prepare("INSERT INTO audit_events SELECT ?,'operations',?,'production_eft_applied','booking',?,?,? WHERE changes()=1").bind(crypto.randomUUID(),actor.userId,r.booking_id,receiptId,now),
  ]);
  if(!result[0].meta.changes)throw new SignupError('Current approved funding and a draft booking are required.',409);
  return {receiptId,status:'funding_applied'};
 }
 if(input.action!=='decide_eft'||!['approved','rejected'].includes(String(input.decision)))throw new SignupError('Choose approve or reject.');
 if(actor.operatorId===r.prepared_by||actor.userId===r.prepared_user)throw new SignupError('Another finance approver must decide this receipt.',403);
 if(input.bankStatementReviewed!==true)throw new SignupError('Independently inspect the bank statement.');
 await db.batch([
  db.prepare('INSERT INTO production_eft_decisions VALUES(?,?,?,?,?,?)').bind(receiptId,input.decision,actor.operatorId,actor.userId,text(input.note,'the independent findings'),now),
  db.prepare("INSERT INTO audit_events VALUES(?,'operations',?,'production_eft_decided','booking',?,?,?)").bind(crypto.randomUUID(),actor.userId,r.booking_id,JSON.stringify({receiptId,decision:input.decision}),now),
 ]);return {receiptId,status:input.decision};
}
export async function readEft(db:D1Database){return (await db.prepare('SELECT r.id,r.booking_id,r.bank_reference,r.amount_cents,r.artifact_id,r.cleared_at,r.prepared_by,d.decision,d.note,b.funding_status FROM production_eft_receipts r JOIN bookings b ON b.id=r.booking_id LEFT JOIN production_eft_decisions d ON d.receipt_id=r.id ORDER BY r.created_at DESC LIMIT 100').all()).results;}
