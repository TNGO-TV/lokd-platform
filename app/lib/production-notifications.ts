import {configuredEmailProvider,providerJson,DeliveryError,emailValid,sendPlainEmail,type OperationalRuntime} from './operational-provider';
export type OperationsMailRuntime=OperationalRuntime;
type Notice={id:string;recipient:string;subject:string;body:string;first_attempt_at:string|null;from_address?:string|null;attempts?:number;state?:string};
const MAIL_NOT_CONFIGURED='Configure the email mailbox (LOKD_SMTP_HOST, LOKD_SMTP_USER, LOKD_SMTP_PASSWORD) or RESEND_API_KEY, and LOKD_EMAIL_FROM.';
function mailProvider(runtime:OperationsMailRuntime){try{return configuredEmailProvider(runtime);}catch{return null;}}
export async function sendOperationsEmail(runtime:OperationsMailRuntime,notice:Notice,transport:typeof fetch=fetch){
 if(!mailProvider(runtime))throw new DeliveryError(MAIL_NOT_CONFIGURED);
 if(!emailValid(runtime.LOKD_EMAIL_FROM)||!emailValid(notice.recipient))throw new DeliveryError('Configure LOKD_EMAIL_FROM with the sending mailbox address and check the recipient address.');
 try{
  const result=await sendPlainEmail(runtime,notice.id,{from:notice.from_address??runtime.LOKD_EMAIL_FROM,to:[notice.recipient],subject:notice.subject,text:notice.body},transport);
  return result.providerId;
 }catch(error){
  if(!(error instanceof DeliveryError))throw new DeliveryError('Email delivery could not be confirmed.','retry_wait');
  if(error.code==='email_acceptance_unknown')throw new DeliveryError('Resend did not confirm the email reference.','retry_wait');
  if(error.disposition==='uncertain')throw new DeliveryError('The mail server did not confirm this email. Check the sent mailbox before sending another copy.','uncertain');
  throw new DeliveryError(error.disposition==='failed'?'The mail server did not accept this email ('+error.code+').':error.message,error.disposition);
 }
}
export async function runOperationsNotifications(db:D1Database,runtime:OperationsMailRuntime,transport:typeof fetch=fetch){
 const now=new Date().toISOString();
 const rows=await db.prepare("SELECT id,recipient,subject,body,first_attempt_at,from_address,attempts,state FROM production_notifications WHERE state IN ('queued','retry_wait','sending') AND next_attempt_at<=? AND (lease_expires_at IS NULL OR lease_expires_at<?) ORDER BY created_at LIMIT 10").bind(now,now).all<Notice>();
 let sent=0;
 for(const row of rows.results){
  const provider=mailProvider(runtime);
  if(!provider||!emailValid(runtime.LOKD_EMAIL_FROM)){
   await db.prepare("UPDATE production_notifications SET state='blocked',last_error=?,updated_at=? WHERE id=? AND state IN ('queued','retry_wait','sending')").bind(MAIL_NOT_CONFIGURED,now,row.id).run();continue;
  }
  // SMTP has no idempotent replay: an interrupted SMTP submission may have been sent.
  if(provider==='smtp'&&row.state==='sending'&&(row.attempts??0)>0){await db.prepare("UPDATE production_notifications SET state='uncertain',last_error='Check the sent mailbox before sending another email.',lease_token=NULL,lease_expires_at=NULL,updated_at=? WHERE id=? AND state='sending' AND (lease_expires_at IS NULL OR lease_expires_at<?)").bind(now,row.id,now).run();continue;}
  if(row.first_attempt_at&&Date.now()-Date.parse(row.first_attempt_at)>23*3600000){await db.prepare("UPDATE production_notifications SET state='uncertain',last_error='Email acceptance must be checked before sending another email.',updated_at=? WHERE id=? AND state!='sent'").bind(now,row.id).run();continue;}
  const token=crypto.randomUUID();
  const claim=await db.prepare("UPDATE production_notifications SET state='sending',from_address=coalesce(from_address,?),lease_token=?,lease_expires_at=?,attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,?),updated_at=? WHERE id=? AND state IN ('queued','retry_wait','sending') AND (lease_expires_at IS NULL OR lease_expires_at<?)").bind(runtime.LOKD_EMAIL_FROM,token,new Date(Date.now()+60000).toISOString(),now,now,row.id,now).run();
  if(!claim.meta.changes)continue;
  try{const providerId=await sendOperationsEmail(runtime,row,transport);await db.prepare("UPDATE production_notifications SET state='sent',provider_id=?,last_error=NULL,lease_token=NULL,lease_expires_at=NULL,updated_at=? WHERE id=? AND lease_token=?").bind(providerId,new Date().toISOString(),row.id,token).run();sent++;}
  catch(e){const error=e instanceof DeliveryError?e:new DeliveryError('Email delivery could not be confirmed.','retry_wait');const state=error.disposition==='uncertain'?'uncertain':error.disposition==='retry_wait'?(provider==='smtp'?'uncertain':'retry_wait'):'blocked';await db.prepare("UPDATE production_notifications SET state=?,last_error=?,next_attempt_at=?,lease_token=NULL,lease_expires_at=NULL,updated_at=? WHERE id=? AND lease_token=?").bind(state,error.message,new Date(Date.now()+300000).toISOString(),new Date().toISOString(),row.id,token).run();}
 }
 return {sent};
}

export async function reconcileOperationsNotification(db:D1Database,runtime:OperationsMailRuntime,actorId:string,id:string,providerId:string,transport:typeof fetch=fetch){
 if(!runtime.RESEND_API_KEY)throw new DeliveryError('Delivery reconciliation by email ID needs the RESEND_API_KEY secret. For the SMTP mailbox, check its sent folder.');
 if(!/^[0-9a-f-]{36}$/i.test(providerId))throw new DeliveryError('Enter the email ID shown in Resend.');
 const notice=await db.prepare("SELECT id,recipient,subject,body,state FROM production_notifications WHERE id=? AND state='uncertain'").bind(id).first<Notice&{state:string}>();
 if(!notice)throw new DeliveryError('Choose a notification awaiting delivery reconciliation.');
 const receipt=await providerJson('https://api.resend.com/emails/'+encodeURIComponent(providerId),{method:'GET',headers:{authorization:'Bearer '+runtime.RESEND_API_KEY}},transport);
 if(receipt.id!==providerId||receipt.subject!==notice.subject||receipt.text!==notice.body||!Array.isArray(receipt.to)||receipt.to.length!==1||receipt.to[0]!==notice.recipient)throw new DeliveryError('The Resend record does not match this notification.');
 const now=new Date().toISOString();
 const results=await db.batch([
  db.prepare("UPDATE production_notifications SET state='sent',provider_id=?,last_error=NULL,updated_at=? WHERE id=? AND state='uncertain'").bind(providerId,now,id),
  db.prepare("INSERT INTO audit_events SELECT ?,'operations',?,'production_notification_reconciled','notification',?,?,? WHERE changes()=1").bind(crypto.randomUUID(),actorId,id,providerId,now),
 ]);
 if(!results[0].meta.changes)throw new DeliveryError('The notification changed. Refresh its delivery record.');
 return {notificationId:id,providerId,status:'sent'};
}
