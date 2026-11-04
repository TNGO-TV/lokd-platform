import {providerJson,emailValid} from './operational-provider';
export type OfficerEmailRuntime={RESEND_API_KEY?:string;LOKD_EMAIL_FROM?:string};
export type OfficerEmail={id:string;applicationId?:string;recipient:string;subject:string;text:string};
export function officerEmailStatement(db:D1Database,input:OfficerEmail){
 if(!emailValid(input.recipient)||!input.subject||input.subject.length>200||input.text.length>20000)throw Error('Invalid officer notification.');
 const now=new Date().toISOString();
 return db.prepare('INSERT OR IGNORE INTO officer_email_outbox(id,application_id,recipient,subject,message,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(input.id,input.applicationId??null,input.recipient,input.subject,input.text,now,now);
}
export async function enqueueOfficerEmail(db:D1Database,input:OfficerEmail){await officerEmailStatement(db,input).run();}
export async function deliverOfficerEmail(db:D1Database,runtime:OfficerEmailRuntime,id:string,transport:typeof fetch=fetch){
 const row=await db.prepare('SELECT * FROM officer_email_outbox WHERE id=?').bind(id).first<{id:string;recipient:string;subject:string;message:string;state:string;created_at:string;updated_at:string;attempts:number;from_address:string|null}>();
 if(!row)return {sent:false,error:'Notification not found.'};
 if(row.state==='sent')return {sent:true};
 if(!runtime.RESEND_API_KEY||!emailValid(runtime.LOKD_EMAIL_FROM)){
  await db.prepare("UPDATE officer_email_outbox SET state='failed',last_error='Configure RESEND_API_KEY and LOKD_EMAIL_FROM in Cloudflare.',updated_at=? WHERE id=? AND state IN ('queued','failed')").bind(new Date().toISOString(),id).run();
  return {sent:false,error:'Configure RESEND_API_KEY and LOKD_EMAIL_FROM in Cloudflare.'};
 }
 // Resend retains idempotency keys for 24 hours. Never replay an uncertain
 // submission beyond that window; an operator must inspect the saved provider record.
 const elapsed=Date.now()-Date.parse(row.created_at);
 if((row.state==='sending'||row.state==='uncertain')&&elapsed>=23*60*60*1000)return {sent:false,error:'Review this notification in Resend before sending another copy.'};
 if(row.state==='sending'&&Date.now()-Date.parse(row.updated_at)<60000)return {sent:false,error:'Notification delivery is in progress.'};
 const stamp=new Date().toISOString(),sender=row.from_address??runtime.LOKD_EMAIL_FROM;
 const claim=await db.prepare("UPDATE officer_email_outbox SET state='sending',attempts=attempts+1,from_address=coalesce(from_address,?),updated_at=? WHERE id=? AND state=? AND updated_at=?").bind(sender,stamp,id,row.state,row.updated_at).run();
 if(!claim.meta.changes)return {sent:false,error:'Notification delivery changed. Refresh its status.'};
 try{
  const result=await providerJson('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${runtime.RESEND_API_KEY}`,'content-type':'application/json','idempotency-key':id},body:JSON.stringify({from:sender,to:[row.recipient],subject:row.subject,text:row.message})},transport);
  if(typeof result.id!=='string'||!result.id)throw Error('Missing delivery receipt.');
  await db.batch([
   db.prepare("UPDATE officer_email_outbox SET state='sent',provider_id=?,last_error=NULL,updated_at=? WHERE id=? AND state='sending'").bind(result.id,new Date().toISOString(),id),
   db.prepare("INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) VALUES(?,'system','officer-email','officer_email_sent','officer_notification',?,?,?)").bind(crypto.randomUUID(),id,JSON.stringify({provider:'resend',providerId:result.id}),new Date().toISOString()),
  ]);
  return {sent:true};
 }catch{
  await db.prepare("UPDATE officer_email_outbox SET state='uncertain',last_error='Email delivery could not be confirmed. Retry the original notification.',updated_at=? WHERE id=? AND state='sending'").bind(new Date().toISOString(),id).run();
  return {sent:false,error:'Email delivery could not be confirmed. Retry the original notification.'};
 }
}
