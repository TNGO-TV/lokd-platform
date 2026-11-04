import {env} from 'cloudflare:workers';
import {operationsRequest,requireOperationsJson,requireOperationsRole} from '../../lib/operations-access';
import {readEft,operateEft} from '../../lib/production-eft';
import {queueAccountingInvoice,dispatchAccounting,type AccountingRuntime} from '../../lib/production-accounting';
import {runOperationsNotifications,reconcileOperationsNotification,type OperationsMailRuntime} from '../../lib/production-notifications';
import {DeliveryError,emailValid} from '../../lib/operational-provider';
import {SignupError} from '../../lib/signup-server';
import {readRequestText,RequestBodyError} from '../../lib/request-body';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
const failure=(e:unknown)=>reply({error:e instanceof SignupError||e instanceof RequestBodyError||e instanceof DeliveryError?e.message:'The finance record changed or could not be saved. Refresh and inspect the original record before retrying.'},e instanceof SignupError||e instanceof RequestBodyError?e.status:409);
export async function GET(request:Request){try{
 if(!env.DB)throw new SignupError('Finance storage is unavailable.',503);
 const a=await operationsRequest(env.DB,request);requireOperationsRole(a,['finance_approver','funding_reconciler','payroll_preparer','payroll_reviewer']);
 const [receipts,accounting,notifications,invoices]=await Promise.all([readEft(env.DB),env.DB.prepare("SELECT id,entity_id,state,attempts,last_error_detail,provider_reference,created_at FROM integration_operations WHERE provider_key='odoo-company-4' AND environment='production' ORDER BY created_at DESC LIMIT 100").all(),env.DB.prepare('SELECT id,subject,state,attempts,last_error,created_at FROM production_notifications ORDER BY created_at DESC LIMIT 100').all(),env.DB.prepare("SELECT id,invoice_number,total_cents,status,booking_id FROM client_invoices WHERE environment='production' ORDER BY created_at DESC LIMIT 100").all()]);
 const mail=env as OperationsMailRuntime,ledger=env as AccountingRuntime;
 const configurationWarnings=[];
 if(!mail.RESEND_API_KEY||!emailValid(mail.LOKD_EMAIL_FROM))configurationWarnings.push('Email delivery requires the RESEND_API_KEY secret and a verified LOKD_EMAIL_FROM sender. Notifications are retained until delivery can be confirmed.');
 if(!ledger.ODOO_API_KEY||!ledger.LOKD_ODOO_JSON2_ORIGIN||!ledger.LOKD_ODOO_DATABASE||!ledger.LOKD_ODOO_SALES_JOURNAL_ID||!ledger.LOKD_ODOO_REVENUE_ACCOUNT_ID)configurationWarnings.push('Odoo posting requires ODOO_API_KEY, LOKD_ODOO_JSON2_ORIGIN, LOKD_ODOO_DATABASE, LOKD_ODOO_SALES_JOURNAL_ID and LOKD_ODOO_REVENUE_ACCOUNT_ID. Configure company 4 before posting.');
 return reply({receipts,accounting:accounting.results,notifications:notifications.results,invoices:invoices.results,configurationWarnings});
}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 requireOperationsJson(request);if(!env.DB)throw new SignupError('Finance storage is unavailable.',503);
 const a=await operationsRequest(env.DB,request);let input;
 try{input=JSON.parse(await readRequestText(request,24000));}catch(e){if(e instanceof RequestBodyError)throw e;throw new SignupError('Send valid JSON.');}
 if(!input||typeof input!=='object'||Array.isArray(input))throw new SignupError('Choose a finance action.');
 if(['prepare_eft','decide_eft','apply_eft_funding'].includes(input.action))return reply({result:await operateEft(env.DB,request.headers,input)});
 if(input.action==='queue_accounting')return reply({result:await queueAccountingInvoice(env.DB,request.headers,input)});
 if(input.action==='retry_accounting'){
  if(typeof input.operationId!=='string'||input.operationId.length>200)throw new SignupError('Choose an accounting operation.');
  return reply({result:await dispatchAccounting(env.DB,request.headers,env as AccountingRuntime,input.operationId)});
 }
 if(input.action==='reconcile_notification'){
  requireOperationsRole(a,['operations_owner','finance_approver']);
  if(typeof input.notificationId!=='string'||input.notificationId.length>200||typeof input.providerId!=='string')throw new SignupError('Choose a notification and its Resend email ID.');
  return reply({result:await reconcileOperationsNotification(env.DB,env as OperationsMailRuntime,a.userId,input.notificationId,input.providerId)});
 }
 if(input.action==='retry_notification'){
  requireOperationsRole(a,['operations_owner','finance_approver']);
  if(typeof input.notificationId!=='string'||input.notificationId.length>200)throw new SignupError('Choose a notification.');
  const now=new Date().toISOString();const result=await env.DB.batch([
   env.DB.prepare("UPDATE production_notifications SET state='queued',next_attempt_at=?,updated_at=? WHERE id=? AND state='blocked' AND (first_attempt_at IS NULL OR first_attempt_at>?)").bind(now,now,input.notificationId,new Date(Date.now()-23*3600000).toISOString()),
   env.DB.prepare("INSERT INTO audit_events SELECT ?,'operations',?,'production_notification_retry','notification',?,'Retry requested after configuration review.',? WHERE changes()=1").bind(crypto.randomUUID(),a.userId,input.notificationId,now),
  ]);
  if(!result[0].meta.changes)throw new SignupError('Only a blocked notification within its safe retry period can be retried.',409);
  return reply({result:await runOperationsNotifications(env.DB,env as OperationsMailRuntime)});
 }
 throw new SignupError('Choose a supported finance action.');
}catch(e){return failure(e);}}
