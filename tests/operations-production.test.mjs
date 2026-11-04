import test from 'node:test';
import assert from 'node:assert/strict';
import {env} from 'cloudflare:workers';
import {operationsDatabase,addOperator} from './fixtures/operations-db.mjs';
import {operationsAccess,requireOperationsRole,requireOperationsJson} from '../app/lib/operations-access.ts';
import {operationsMfaRequired} from '../app/lib/operations-mfa-policy.ts';
import {operatorControlDecision} from '../app/lib/operator-controls.ts';
import {runOperationsNotifications} from '../app/lib/production-notifications.ts';
import {operateEft} from '../app/lib/production-eft.ts';
import {dispatchAccounting} from '../app/lib/production-accounting.ts';
import {agreementHash} from '../app/lib/agreement-acceptance.ts';

test('production operator access requires a named account, live role and fresh MFA without a waiver',async()=>{
 const {sqlite,db}=operationsDatabase();try{
 const headers=addOperator(sqlite,'operator',['finance_approver'],2000);
 const actor=await operationsAccess(db,headers);assert.equal(actor.owner,false);requireOperationsRole(actor,['finance_approver'],2000);
 assert.throws(()=>requireOperationsRole(actor,['finance_approver'],2001),/approval limit/);
 assert.throws(()=>requireOperationsRole(actor,['compliance_reviewer']),/assigned role/);
 env.LOKD_OPERATIONS_MFA_REQUIRED='false';assert.equal(operationsMfaRequired(),true);
 const missing=new Headers(headers);missing.delete('x-lokd-verified-second-factor-at');await assert.rejects(operationsAccess(db,missing),/second factor/);
 assert.equal((await operationsAccess(db,missing,true)).operatorId,'operator');
 sqlite.prepare("UPDATE operator_role_assignments SET revoked_at=CURRENT_TIMESTAMP WHERE operator_id='operator'").run();await assert.rejects(operationsAccess(db,headers),/no active role/);
 sqlite.prepare("UPDATE operator_role_assignments SET status='revoked' WHERE operator_id='operator'").run();await assert.rejects(operationsAccess(db,headers),/no active role/);
 assert.equal(operatorControlDecision({actionCode:'payment.approve',actorId:'operator',roles:['finance_approver'],accountStatus:'active',mfaRequired:false,mfaStatus:'not_verified',mfaVerifiedAt:null,amountCents:1}).allowed,false);
 assert.throws(()=>requireOperationsJson(new Request('https://operations.lokd.co.za/api/operations',{method:'POST',headers:{origin:'https://attacker.invalid','content-type':'application/json'}})),/workspace/);
 }finally{delete env.LOKD_OPERATIONS_MFA_REQUIRED;sqlite.close();}
});
function seedBooking(sqlite){
 sqlite.prepare("INSERT INTO clients(id,organisation_name,contact_name,contact_email,approval_status,environment,integrity_state) VALUES('client','Fixture Client','Contact','client@example.test','approved','production','production_verified')").run();
 sqlite.prepare("INSERT INTO bookings(id,client_id,site_name,site_area,post_name,service_type,minimum_grade,contract_months,start_date,end_date,shift_start,shift_end,client_price_cents,officer_rate_cents,release_cadence,environment,integrity_state,status,funding_status) VALUES('booking','client','Fixture site','Johannesburg','Gate','Unarmed','Grade C',0,'2030-01-02','2030-01-03','06:00','18:00',10000,5000,'Weekly','production','production_verified','draft','unfunded')").run();
}
test('EFT requires exact cleared amount, verified evidence and an independent approver; replay cannot duplicate funding',async()=>{
 const {sqlite,db}=operationsDatabase();try{
 const maker=addOperator(sqlite,'maker',['funding_reconciler']),checker=addOperator(sqlite,'checker',['finance_approver']);seedBooking(sqlite);
 const hash='a'.repeat(64),now=new Date().toISOString();
 sqlite.prepare("INSERT INTO document_artifacts(id,kind,storage_reference,content_hash,mime_type,size_bytes,retention_class,access_class,status,environment,integrity_state,created_at,verified_at) VALUES('ART-bank','bank_statement','BUCKET:operations/v1/bank',?,'application/pdf',100,'financial_7y','finance','verified','production','production_verified',?,?)").run(hash,now,now);
 const input={action:'prepare_eft',bookingId:'booking',bankReference:'BANK-001',amountCents:10000,artifactId:'ART-bank',clearedAt:new Date(Date.now()-1000).toISOString(),bankStatementReviewed:true,note:'Reviewed cleared bank credit'};
 await assert.rejects(operateEft(db,maker,{...input,amountCents:9000}),/EFT booking/);
 const saved=await operateEft(db,maker,input);
 await assert.rejects(operateEft(db,maker,{action:'decide_eft',receiptId:saved.receiptId,decision:'approved',note:'Reviewed',bankStatementReviewed:true}),/assigned role/);
 await operateEft(db,checker,{action:'decide_eft',receiptId:saved.receiptId,decision:'approved',note:'Independently matched bank statement',bankStatementReviewed:true});
 const funding=sqlite.prepare("SELECT * FROM booking_funding_reconciliations WHERE provider='eft'").all();assert.equal(funding.length,1);assert.equal(funding[0].cleared_amount_cents,10000);
 await assert.rejects(operateEft(db,checker,{action:'decide_eft',receiptId:saved.receiptId,decision:'approved',note:'Repeat',bankStatementReviewed:true}));
 assert.throws(()=>sqlite.prepare('UPDATE production_eft_receipts SET amount_cents=1').run(),/immutable/);
 assert.equal(sqlite.prepare("SELECT count(*) n FROM booking_funding_reconciliations WHERE provider='eft'").get().n,1);
 }finally{sqlite.close();}
});
test('email delivery reports missing configuration and retries Resend with one stable idempotency key',async()=>{
 const {sqlite,db}=operationsDatabase();try{
 const now=new Date().toISOString();sqlite.prepare("INSERT INTO production_notifications(id,recipient,subject,body,next_attempt_at,created_at,updated_at) VALUES('notice:1','officer@example.test','LOKD application update','Sign in to your account.',?,?,?)").run(now,now,now);
 let calls=0;const transport=async(url,init)=>{calls++;assert.equal(url,'https://api.resend.com/emails');assert.equal(init.headers['idempotency-key'],'notice:1');return Response.json({id:'email-1'});};
 await runOperationsNotifications(db,{},transport);assert.equal(calls,0);assert.equal(sqlite.prepare('SELECT state FROM production_notifications').get().state,'blocked');assert.equal(sqlite.prepare('SELECT first_attempt_at FROM production_notifications').get().first_attempt_at,null);
 sqlite.prepare("UPDATE production_notifications SET state='queued'").run();await runOperationsNotifications(db,{RESEND_API_KEY:'local-fixture',LOKD_EMAIL_FROM:'service@example.test'},transport);assert.equal(calls,1);
 await runOperationsNotifications(db,{RESEND_API_KEY:'local-fixture',LOKD_EMAIL_FROM:'service@example.test'},transport);assert.equal(calls,1);assert.equal(sqlite.prepare('SELECT state FROM production_notifications').get().state,'sent');
 }finally{sqlite.close();}
});
test('accounting company 4 retry reconciles an uncertain create and never creates a duplicate invoice',async()=>{
 const {sqlite,db}=operationsDatabase();try{
 const headers=addOperator(sqlite,'finance',['finance_approver']);seedBooking(sqlite);
 const now=new Date().toISOString(),payload=JSON.stringify({invoiceId:'invoice',clientId:'client',partnerId:9,number:'INV-1',subtotal:10000,tax:0,total:10000,date:'2026-11-04',description:'Security services'});
 sqlite.prepare("INSERT INTO integration_provider_configs(key,capability,provider,environment,integrity_state) VALUES('odoo-company-4','accounting','odoo','production','production_verified')").run();
 sqlite.prepare("INSERT INTO integration_operations(id,provider_key,capability,operation_type,entity_type,entity_id,idempotency_key,request_hash,state,environment,integrity_state,created_at,updated_at,request_json) VALUES('job','odoo-company-4','accounting','invoice','booking','booking','invoice:invoice',?,'pending','production','production_verified',?,?,?)").run(await agreementHash(payload),now,now,payload);
 const runtime={ODOO_API_KEY:'local-fixture',LOKD_ODOO_JSON2_ORIGIN:'https://accounting.example.test',LOKD_ODOO_DATABASE:'fixture',LOKD_ODOO_SALES_JOURNAL_ID:'1',LOKD_ODOO_REVENUE_ACCOUNT_ID:'2'};
 let creates=0,found=false,posted=false;const transport=async(url,init)=>{const body=JSON.parse(init.body);assert.deepEqual(body.context.allowed_company_ids,[4]);if(url.endsWith('/account.move/search_read'))return Response.json(found?[{id:12,company_id:[4,'LOKD'],state:posted?'posted':'draft',amount_total:100,currency_id:[1,'ZAR'],partner_id:[9,'Fixture'],move_type:'out_invoice'}]:[]);if(url.endsWith('/res.partner/search_read'))return Response.json([{id:9}]);if(url.endsWith('/create')){creates++;found=true;throw Error('response lost after create');}if(url.endsWith('/action_post')){posted=true;return Response.json(true);}if(url.endsWith('/read'))return Response.json([{state:'posted',company_id:[4,'LOKD'],amount_total:100,currency_id:[1,'ZAR'],partner_id:[9,'Fixture'],move_type:'out_invoice'}]);throw Error('Unexpected provider request');};
 await assert.rejects(dispatchAccounting(db,headers,{},'job',transport),/ODOO_API_KEY/);assert.equal(creates,0);
 await assert.rejects(dispatchAccounting(db,headers,runtime,'job',async url=>{assert.ok(url.endsWith('/account.move/search_read'),'A foreign-company move must never be posted.');return Response.json([{id:99,company_id:[5,'Other'],state:'draft',amount_total:100,currency_id:[1,'ZAR'],partner_id:[9,'Fixture'],move_type:'out_invoice'}]);}),/invoice company/);
 await assert.rejects(dispatchAccounting(db,headers,runtime,'job',transport),/did not confirm/);assert.equal(creates,1);
 assert.equal((await dispatchAccounting(db,headers,runtime,'job',transport)).status,'succeeded');assert.equal(creates,1);assert.equal(posted,true);
 assert.equal((await dispatchAccounting(db,headers,runtime,'job',transport)).status,'succeeded');assert.equal(creates,1);
 }finally{sqlite.close();}
});

test('bank statements are stored privately, independently verified and downloadable only with finance access',async()=>{
 const {POST,GET,PATCH}=await import('../app/api/evidence/route.ts');
 const {sqlite,db}=operationsDatabase(),previousDb=env.DB,previousBucket=env.BUCKET;
 const objects=new Map();env.DB=db;env.BUCKET={put:async(key,bytes,options)=>{objects.set(key,{bytes,options});},get:async key=>objects.has(key)?{body:objects.get(key).bytes}:null,head:async key=>objects.has(key)?{size:objects.get(key).bytes.length,customMetadata:objects.get(key).options.customMetadata}:null,delete:async key=>{objects.delete(key);}};
 try{
  const maker=addOperator(sqlite,'upload-maker',['funding_reconciler']),reviewer=addOperator(sqlite,'upload-reviewer',['finance_approver']),other=addOperator(sqlite,'controller',['operations_controller']);
  const request=(method,headers,body,path='')=>{headers=new Headers(headers);headers.set('origin','https://operations.lokd.co.za');headers.set('content-type','application/json');return new Request('https://operations.lokd.co.za/api/evidence'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});};
  const uploaded=await POST(request('POST',maker,{kind:'bank_statement',mimeType:'text/csv',retentionClass:'financial_7y',accessClass:'finance',contentBase64:btoa('date,credit,reference\n2026-11-04,100,BANK-1')}));
  assert.equal(uploaded.status,201);const {artifact}=await uploaded.json();assert.equal(objects.size,1);
  const verify={artifactId:artifact.id,expectedHash:artifact.contentHash};
  assert.equal((await PATCH(request('PATCH',maker,verify))).status,409);
  assert.equal((await PATCH(request('PATCH',reviewer,{...verify,expectedHash:'0'.repeat(64)}))).status,409);
  assert.equal((await PATCH(request('PATCH',reviewer,verify))).status,200);
  const listing=await GET(request('GET',reviewer,null,'?kind=bank_statement'));assert.equal(listing.status,200);assert.equal((await listing.json()).artifacts[0].status,'verified');
  assert.equal((await GET(request('GET',other,null,'?id='+artifact.id+'&download=1'))).status,403);
  const download=await GET(request('GET',reviewer,null,'?id='+artifact.id+'&download=1'));assert.equal(download.status,200);assert.match(await download.text(),/BANK-1/);
  assert.equal(sqlite.prepare("SELECT count(*) n FROM audit_events WHERE event_type='evidence_verified'").get().n,1);
 }finally{if(previousDb===undefined)delete env.DB;else env.DB=previousDb;if(previousBucket===undefined)delete env.BUCKET;else env.BUCKET=previousBucket;sqlite.close();}
});

test('operations workspace returns an empty consented presence feed and paginates production audit records',async()=>{
 const {readOperationsWorkspace}=await import('../app/lib/operations-workspace.ts');
 const {sqlite,db}=operationsDatabase();try{
 const actor=await operationsAccess(db,addOperator(sqlite,'controller',['operations_controller']));
 for(let i=0;i<102;i++)sqlite.prepare("INSERT INTO audit_events VALUES(?,'operations','controller','production_operator_command','operation','fixture','{}','2026-11-01T10:00:00.000Z')").run('prod-audit-'+String(i).padStart(3,'0'));
 sqlite.prepare("INSERT INTO audit_events VALUES('old-audit','operations','controller','specialist_workflow_action','specialist','fixture',?,'2026-11-02T10:00:00.000Z')").run(JSON.stringify({environment:'demo'}));
 const first=await readOperationsWorkspace(db,actor);assert.deepEqual(first.presence.areas,[]);assert.equal(first.audit.length,100);assert.ok(first.auditNext);assert.equal(first.audit.some(a=>a.id==='old-audit'),false);
 const next=await readOperationsWorkspace(db,actor,first.auditNext);assert.equal(next.audit.length,2);assert.equal(next.auditNext,null);assert.equal(new Set([...first.audit,...next.audit].map(a=>a.id)).size,102);
 await assert.rejects(readOperationsWorkspace(db,actor,'invalid'),/cursor/);
 }finally{sqlite.close();}
});
