import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {readRequestText} from './request-body';
import {fetchWithoutRedirect} from './provider-fetch';
import {operationsAccess,requireOperationsRole} from './operations-access';
export type AccountingRuntime={ODOO_API_KEY?:string;LOKD_ODOO_JSON2_ORIGIN?:string;LOKD_ODOO_DATABASE?:string;LOKD_ODOO_SALES_JOURNAL_ID?:string;LOKD_ODOO_REVENUE_ACCOUNT_ID?:string;LOKD_ODOO_SALES_TAX_ID?:string};
type Payload={invoiceId:string;clientId:string;partnerId:number;number:string;subtotal:number;tax:number;total:number;date:string;description:string};
type Job={id:string;state:string;request_json:string;request_hash:string;last_error_code:string|null;attempts:number;provider_reference:string|null};
const positive=(v:unknown,label:string)=>{const n=typeof v==='string'&&/^\d+$/.test(v)?Number(v):v;if(typeof n!=='number'||!Number.isSafeInteger(n)||n<1)throw new SignupError('Configure '+label+' as a positive numeric Odoo ID.',503);return n;};
function configuration(runtime:AccountingRuntime){
 if(!runtime.ODOO_API_KEY)throw new SignupError('Set the ODOO_API_KEY Cloudflare secret to connect accounting.',503);
 if(!runtime.LOKD_ODOO_JSON2_ORIGIN||!runtime.LOKD_ODOO_DATABASE)throw new SignupError('Configure LOKD_ODOO_JSON2_ORIGIN and LOKD_ODOO_DATABASE for accounting.',503);
 let origin:URL;try{origin=new URL(runtime.LOKD_ODOO_JSON2_ORIGIN);}catch{throw new SignupError('The Odoo origin is invalid.',503);}
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new SignupError('Use the HTTPS Odoo origin without a path or credentials.',503);
 return {origin:origin.origin,key:runtime.ODOO_API_KEY,database:runtime.LOKD_ODOO_DATABASE,journal:positive(runtime.LOKD_ODOO_SALES_JOURNAL_ID,'LOKD_ODOO_SALES_JOURNAL_ID'),account:positive(runtime.LOKD_ODOO_REVENUE_ACCOUNT_ID,'LOKD_ODOO_REVENUE_ACCOUNT_ID')};
}
class AccountingRequestError extends SignupError { readonly rejected:boolean; constructor(message:string,rejected:boolean){super(message,503);this.rejected=rejected;} }
async function call(runtime:AccountingRuntime,model:string,method:string,body:Record<string,unknown>,transport:typeof fetch){
 const cfg=configuration(runtime);
 let response:Response;
 try{response=await fetchWithoutRedirect(transport,cfg.origin+'/json/2/'+model+'/'+method,{method:'POST',headers:{'Authorization':'Bearer '+cfg.key,'X-Odoo-Database':cfg.database,'content-type':'application/json'},body:JSON.stringify({...body,context:{allowed_company_ids:[4],force_company:4}}),signal:AbortSignal.timeout(20000)});}catch{throw new SignupError('Odoo did not confirm the request. Retry reconciliation of the saved accounting operation.',503);}
 if(!response.ok){await response.body?.cancel();throw new AccountingRequestError('Odoo returned HTTP '+response.status+'. Check company 4 access and accounting configuration.',response.status>=400&&response.status<500&&response.status!==408);}
 try{return JSON.parse(await readRequestText(response,262144));}catch{throw new SignupError('Odoo returned an unreadable response. Reconcile the saved operation.',503);}
}
export async function queueAccountingInvoice(db:D1Database,headers:Headers,input:Record<string,unknown>){
 const actor=await operationsAccess(db,headers);
 if(typeof input.invoiceId!=='string'||input.invoiceId.length>200)throw new SignupError('Choose an issued invoice.');
 const invoice=await db.prepare(`SELECT i.id,i.client_id,i.booking_id,i.invoice_number,i.subtotal_cents,i.tax_cents,i.total_cents,i.issued_at,b.site_name
 FROM client_invoices i JOIN bookings b ON b.id=i.booking_id WHERE i.id=? AND i.environment='production' AND i.integrity_state='production_verified' AND i.status='issued' AND i.invoice_number IS NOT NULL
 AND EXISTS(SELECT 1 FROM finance_document_versions v JOIN finance_document_issues n ON n.document_id=v.id WHERE v.kind='invoice' AND v.source_id=i.id)`)
 .bind(input.invoiceId).first<{id:string;client_id:string;booking_id:string;invoice_number:string;subtotal_cents:number;tax_cents:number;total_cents:number;issued_at:string;site_name:string}>();
 if(!invoice)throw new SignupError('Issue and approve the invoice before sending it to accounting.',409);
 requireOperationsRole(actor,['finance_approver'],invoice.total_cents);
 if(!Number.isSafeInteger(invoice.total_cents)||invoice.subtotal_cents+invoice.tax_cents!==invoice.total_cents)throw new SignupError('The invoice totals do not balance.',409);
 const payload:Payload={invoiceId:invoice.id,clientId:invoice.client_id,partnerId:positive(input.partnerId,'the client partner'),number:invoice.invoice_number,subtotal:invoice.subtotal_cents,tax:invoice.tax_cents,total:invoice.total_cents,date:invoice.issued_at.slice(0,10),description:invoice.site_name};
 const json=JSON.stringify(payload),hash=await agreementHash(json),key='invoice:'+invoice.id,now=new Date().toISOString();
 const prior=await db.prepare("SELECT id,request_hash FROM integration_operations WHERE provider_key='odoo-company-4' AND environment='production' AND idempotency_key=?").bind(key).first<{id:string;request_hash:string}>();
 if(prior){if(prior.request_hash!==hash)throw new SignupError('This invoice already has a different accounting request. Review its original operation.',409);return {operationId:prior.id};}
 const id=crypto.randomUUID();await db.batch([
 db.prepare("INSERT OR IGNORE INTO integration_provider_configs(key,capability,provider,mode,status,required_for_pilot,configuration_version,environment,integrity_state) VALUES('odoo-company-4','accounting','odoo','live','not_connected',1,'company-4-v1','production','production_verified')"),
 db.prepare("INSERT INTO integration_operations(id,provider_key,capability,operation_type,entity_type,entity_id,idempotency_key,request_hash,state,environment,integrity_state,created_at,updated_at,request_json) VALUES(?,'odoo-company-4','accounting','invoice','booking',?,?,?,'pending','production','production_verified',?,?,?)").bind(id,invoice.booking_id,key,hash,now,now,json),
 db.prepare("INSERT INTO audit_events VALUES(?,'operations',?,'production_accounting_queued','invoice',?,?,?)").bind(crypto.randomUUID(),actor.userId,invoice.id,id,now),
 ]);return {operationId:id};
}
export async function dispatchAccounting(db:D1Database,headers:Headers,runtime:AccountingRuntime,id:string,transport:typeof fetch=fetch){
 const actor=await operationsAccess(db,headers),job=await db.prepare("SELECT * FROM integration_operations WHERE id=? AND provider_key='odoo-company-4' AND environment='production'").bind(id).first<Job>();
 if(!job)throw new SignupError('Accounting operation not found.',404);
 const payload=JSON.parse(job.request_json) as Payload;
 requireOperationsRole(actor,['finance_approver'],payload.total);
 if(await agreementHash(job.request_json)!==job.request_hash)throw new SignupError('Accounting payload integrity check failed.',409);
 if(job.state==='succeeded')return {operationId:id,status:'succeeded',providerReference:job.provider_reference};
 const cfg=configuration(runtime),token=crypto.randomUUID(),now=new Date().toISOString(),lease=new Date(Date.now()+180000).toISOString();
 const claim=await db.prepare("UPDATE integration_operations SET state='dispatching',lease_token=?,lease_expires_at=?,attempts=attempts+1,updated_at=? WHERE id=? AND state IN ('pending','retryable_failed','dispatching') AND (lease_expires_at IS NULL OR lease_expires_at<?)").bind(token,lease,now,id,now).run();
 if(!claim.meta.changes)throw new SignupError('An accounting request is already running. Refresh its saved status.',409);
 let uncertain=job.last_error_code==='odoo_write_uncertain',creating=false;
 try{
  const ref='LOKD:'+payload.invoiceId;
  const matches=await call(runtime,'account.move','search_read',{domain:[['company_id','=',4],['ref','=',ref]],fields:['id','state','amount_total','currency_id','partner_id','move_type','company_id'],limit:2},transport);
  if(!Array.isArray(matches)||matches.length>1)throw new SignupError('Accounting has conflicting invoice references. Resolve them in Odoo before retrying.',409);
  let move=matches[0];
  if(!move){
   if(uncertain)throw new SignupError('The earlier Odoo write is unconfirmed. Locate the saved LOKD reference in Odoo before resubmission.',409);
   const partners=await call(runtime,'res.partner','search_read',{domain:[['id','=',payload.partnerId],['ref','=', 'LOKD:'+payload.clientId],['company_id','=',4]],fields:['id'],limit:1},transport);
   if(!Array.isArray(partners)||partners.length!==1)throw new SignupError('Map the company 4 customer in Odoo using reference LOKD:'+payload.clientId+'.',409);
   const taxes=payload.tax?[positive(runtime.LOKD_ODOO_SALES_TAX_ID,'LOKD_ODOO_SALES_TAX_ID')]:[];
   // Persist uncertain delivery before the first write. A lost response never permits a second create.
   await db.prepare("UPDATE integration_operations SET last_error_code='odoo_write_uncertain' WHERE id=? AND lease_token=?").bind(id,token).run();uncertain=true;
   creating=true;
   const created=await call(runtime,'account.move','create',{vals_list:[{company_id:4,journal_id:cfg.journal,move_type:'out_invoice',partner_id:payload.partnerId,ref,invoice_date:payload.date,invoice_line_ids:[[0,0,{name:payload.description,account_id:cfg.account,quantity:1,price_unit:payload.subtotal/100,tax_ids:[[6,0,taxes]]}]]}]},transport);
   creating=false;
   const moveId=positive(Array.isArray(created)?created[0]:created,'the returned accounting record');
   const rows=await call(runtime,'account.move','read',{ids:[moveId],fields:['id','state','amount_total','currency_id','partner_id','move_type','company_id']},transport);move=Array.isArray(rows)?rows[0]:null;
  }
  if(!move||move.company_id?.[0]!==4||!Number.isSafeInteger(move.id)||Math.round(Number(move.amount_total)*100)!==payload.total||move.currency_id?.[1]!=='ZAR'||move.partner_id?.[0]!==payload.partnerId||move.move_type!=='out_invoice')throw new SignupError('The Odoo invoice company, totals, currency or customer differ from LOKD. Review the draft in Odoo.',409);
  if(move.state==='draft')await call(runtime,'account.move','action_post',{ids:[move.id]},transport);
  else if(move.state!=='posted')throw new SignupError('The accounting invoice cannot be posted from its current state.',409);
  const posted=await call(runtime,'account.move','read',{ids:[move.id],fields:['state','amount_total','currency_id','partner_id','move_type','company_id']},transport);
  if(!Array.isArray(posted)||posted[0]?.state!=='posted'||posted[0].company_id?.[0]!==4||Math.round(Number(posted[0].amount_total)*100)!==payload.total||posted[0].currency_id?.[1]!=='ZAR'||posted[0].partner_id?.[0]!==payload.partnerId||posted[0].move_type!=='out_invoice')throw new SignupError('Odoo has not confirmed the posted invoice and its exact totals.',503);
  await db.batch([
   db.prepare("UPDATE integration_operations SET state='succeeded',provider_reference=?,last_error_code=NULL,last_error_detail=NULL,lease_token=NULL,lease_expires_at=NULL,completed_at=?,updated_at=? WHERE id=? AND lease_token=?").bind(String(move.id),now,now,id,token),
   db.prepare("INSERT INTO audit_events VALUES(?,'operations',?,'production_accounting_posted','invoice',?,?,?)").bind(crypto.randomUUID(),actor.userId,payload.invoiceId,JSON.stringify({operationId:id,companyId:4,moveId:move.id}),now),
  ]);return {operationId:id,status:'succeeded',providerReference:String(move.id)};
 }catch(error){
  if(creating&&error instanceof AccountingRequestError&&error.rejected)uncertain=false;
  const message=error instanceof SignupError?error.message:'Accounting could not confirm the operation. Retry its saved reference.';
  await db.prepare("UPDATE integration_operations SET state='retryable_failed',last_error_code=?,last_error_detail=?,lease_token=NULL,lease_expires_at=NULL,updated_at=? WHERE id=? AND lease_token=?").bind(uncertain?'odoo_write_uncertain':'odoo_request_failed',message,new Date().toISOString(),id,token).run();
  throw new SignupError(message,error instanceof SignupError?error.status:503);
 }
}
