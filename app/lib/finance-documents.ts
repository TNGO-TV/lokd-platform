import {financeFieldLabel,financeFieldValue} from './finance-document-format';
import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {productionOperatorControl} from './production-operator-control';
import {operationsMfaRequired} from './operations-mfa-policy';
import type {SigningActor} from './production-signing';
export type DocumentKind='payslip'|'invoice'|'remittance';
export type FinancialRow={reference:string;mode:string;status:string;active:boolean|number;state:string;paidReceipts:number};
export function documentPaymentState(rows:FinancialRow[]):'unpaid'|'pending'|'paid'|'held'|'reversed'{
 const live=rows.filter(r=>r.mode==='live'),active=live.filter(r=>r.active||r.state==='paid'),current=active.length?active:live;
 if(current.some(r=>r.state==='held')||current.filter(r=>r.state==='paid').length>1)return 'held';
 if(current.some(r=>r.state==='paid'))return current.some(r=>r.state==='pending')?'held':'paid';
 if(current.some(r=>r.state==='pending'))return 'pending';
 if(current.some(r=>r.state==='reversed'))return 'reversed';
 return 'unpaid';
}
type Source={kind:DocumentKind;source_id:string;party_id:string;recipient_user:string;amount_cents:number;source_json:string;financial_json:string};
type Version=Source&{id:string;version:number;parent_id:string|null;payload_hash:string;operator_id:string;user_id:string;note:string;created_at:string};
const text=(v:unknown,label:string,max=1200)=>{if(typeof v!=='string'||v.trim().length<3||v.length>max)throw new SignupError(`Provide ${label}.`);return v.trim();};
const kind=(v:unknown):DocumentKind=>{if(v!=='payslip'&&v!=='invoice'&&v!=='remittance')throw new SignupError('Choose a finance document type.');return v;};
const auth=()=>operationsMfaRequired()?'mfa_verified':'owner_mfa_exception';
async function operator(db:D1Database,a:SigningActor,h:Headers,amount:number,approving=false,maker?:string){return productionOperatorControl(db,a,h,approving?'payroll.second_approve':'payroll.export',amount,maker);}
async function readAuthority(db:D1Database,a:SigningActor,h:Headers,amount:number){try{return await operator(db,a,h,amount,true);}catch(e){if(!(e instanceof SignupError)||e.status!==403)throw e;return operator(db,a,h,amount);}}
async function currentSource(db:D1Database,k:DocumentKind,id:string){return db.prepare('SELECT s.*,f.financial_json FROM finance_document_sources s JOIN finance_document_financial_snapshots f ON f.kind=s.kind AND f.source_id=s.source_id WHERE s.kind=? AND s.source_id=?').bind(k,id).first<Source>();}
async function canRead(db:D1Database,a:SigningActor,v:Source,h:Headers){
 if(a.operations){try{await readAuthority(db,a,h,v.amount_cents);return true;}catch(error){if(error instanceof SignupError&&error.status===403)return false;throw error;}}
 if(a.userId!==v.recipient_user)return false;
 if(v.kind==='remittance')return (await db.prepare("SELECT json_extract(r.payload_json,'$.representativeUserId') AS user FROM partner_destination_reviews r JOIN partner_destination_decisions d ON d.review_id=r.id AND d.decision IN('verified_live','confirmed_test') WHERE r.employer_id=? ORDER BY r.rowid DESC LIMIT 1").bind(v.party_id).first<{user:string}>())?.user===a.userId;
 return !!await db.prepare('SELECT entity_id FROM production_entity_links WHERE kind=? AND entity_id=? AND owner_user_id=?').bind(v.kind==='payslip'?'officer':'client',v.party_id,a.userId).first();
}
export async function prepareFinanceDocument(db:D1Database,a:SigningActor,input:Record<string,unknown>,h:Headers){
 const k=kind(input.kind),id=text(input.sourceId,'the approved source ID',200),note=text(input.note,'the issue or correction findings'),key=text(input.requestKey,'a stable document request key',200);
 if(input.evidenceReviewed!==true)throw new SignupError('Review the exact source calculation and current financial state.');
 const s=await currentSource(db,k,id);if(!s)throw new SignupError('An approved production source and private recipient binding are required.',409);
 const op=await operator(db,a,h,s.amount_cents);if(a.userId===s.recipient_user)throw new SignupError('Recipients cannot prepare their own document.',403);
 const prior=await db.prepare('SELECT * FROM finance_document_versions WHERE request_key=?').bind(key).first<Version>();
 const parentId=input.parentId===undefined?null:text(input.parentId,'the prior document version',200);
 if(prior){if(prior.kind!==k||prior.source_id!==id||prior.parent_id!==parentId||prior.note!==note)throw new SignupError('Request key belongs to a different document request.',409);return {documentId:prior.id,alreadyPrepared:true};}
 const parent=parentId?await db.prepare('SELECT version FROM finance_document_versions WHERE id=?').bind(parentId).first<{version:number}>():null;
 if(parentId&&!parent)throw new SignupError('Prior version not found.',404);
 const version=(parent?.version??0)+1,documentId='FD-'+crypto.randomUUID(),hash=await agreementHash(JSON.stringify({kind:k,sourceId:id,recipient:s.recipient_user,source:s.source_json,financial:s.financial_json,parentId,version,note}));
 await db.prepare('INSERT INTO finance_document_versions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(documentId,k,id,s.party_id,s.recipient_user,key,parentId,version,s.source_json,s.financial_json,hash,s.amount_cents,note,op.id,a.userId,auth(),new Date().toISOString()).run();return {documentId,issued:false};
}
export async function decideFinanceDocument(db:D1Database,a:SigningActor,input:Record<string,unknown>,h:Headers){
 const id=text(input.documentId,'the document ID',200),v=await db.prepare('SELECT * FROM finance_document_versions WHERE id=?').bind(id).first<Version>();if(!v)throw new SignupError('Document not found.',404);
 const op=await operator(db,a,h,v.amount_cents,true,v.operator_id);if(a.userId===v.user_id||a.userId===v.recipient_user)throw new SignupError('Independent document approval is required.',403);
 if(input.payloadHash!==v.payload_hash||input.evidenceReviewed!==true)throw new SignupError('Review the exact frozen source and financial evidence.',409);
 const decision=input.decision;if(decision!=='approved'&&decision!=='rejected')throw new SignupError('Choose approve or reject.');
 const now=new Date().toISOString(),statements=[db.prepare('INSERT INTO finance_document_decisions VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,decision,v.payload_hash,op.id,a.userId,text(input.note,'the independent findings'),auth(),now)];
 if(decision==='approved')statements.push(db.prepare('INSERT INTO finance_document_issues VALUES(?,?,?)').bind(id,'LOKD-'+v.kind.toUpperCase()+'-'+id.slice(3).toUpperCase()+'-V'+v.version,now));
 await db.batch(statements);return {documentId:id,issued:decision==='approved',communicationsSent:false};
}
export async function readFinanceDocuments(db:D1Database,a:SigningActor,h:Headers,documentId?:string){
 const raw=(await db.prepare(`SELECT v.*,d.decision,n.number,n.issued_at FROM finance_document_versions v LEFT JOIN finance_document_decisions d ON d.document_id=v.id LEFT JOIN finance_document_issues n ON n.document_id=v.id ${documentId?'WHERE v.id=?':a.operations?'':"WHERE n.document_id IS NOT NULL AND v.recipient_user=?"} ORDER BY v.rowid DESC LIMIT 200`).bind(...(documentId?[documentId]:a.operations?[]:[a.userId])).all<Version&{number:string|null;issued_at:string|null;decision:string|null}>()).results;
 const documents=[];
 for(const v of raw){if(!await canRead(db,a,v,h)||!a.operations&&!v.number)continue;
  const current=await currentSource(db,v.kind,v.source_id),financial=(await db.prepare('SELECT *,active_key IS NOT NULL AS active,paid_receipts AS paidReceipts FROM finance_document_payment_rows WHERE kind=? AND source_id=? ORDER BY reference').bind(v.kind,v.source_id).all<FinancialRow>()).results;
  documents.push({...v,source:JSON.parse(v.source_json),asIssuedState:documentPaymentState(JSON.parse(v.financial_json)),currentState:documentPaymentState(financial),currentFinancial:financial,sourceChanged:!current||current.source_json!==v.source_json,superseded:!!await db.prepare("SELECT v.id FROM finance_document_versions v JOIN finance_document_issues i ON i.document_id=v.id WHERE v.kind=? AND v.source_id=? AND v.version>?").bind(v.kind,v.source_id,v.version).first()});
 }
 if(documentId&&!documents.length)throw new SignupError('Private document not found for this account.',404);
 const sources:Source[]=[];
 if(a.operations){await readAuthority(db,a,h,0);const candidates=(await db.prepare('SELECT s.*,f.financial_json FROM finance_document_sources s JOIN finance_document_financial_snapshots f ON f.kind=s.kind AND f.source_id=s.source_id ORDER BY s.kind,s.source_id LIMIT 500').all<Source>()).results;for(const source of candidates){try{await readAuthority(db,a,h,source.amount_cents);sources.push(source);}catch(error){if(!(error instanceof SignupError)||error.status!==403)throw error;}}}
 return {documents,sources:sources.map(s=>({...s,currentState:documentPaymentState(JSON.parse(s.financial_json))})),calendar:'Africa/Johannesburg',communicationsSent:false};
}
const escape=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function sourceHtml(value:unknown):string{if(Array.isArray(value))return value.map((v,i)=>'<section><h3>Line '+(i+1)+'</h3>'+sourceHtml(v)+'</section>').join('');if(value&&typeof value==='object')return '<dl>'+Object.entries(value).map(([k,v])=>'<dt>'+escape(financeFieldLabel(k))+'</dt><dd>'+(v&&typeof v==='object'?sourceHtml(v):escape(financeFieldValue(k,v)))+'</dd>').join('')+'</dl>';return escape(value);}
export function renderFinanceDocument(document:Awaited<ReturnType<typeof readFinanceDocuments>>['documents'][number]){
 if(!document.number)throw new SignupError('Only independently issued documents can be downloaded.',409);
 return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>'+escape(document.number)+'</title><style>body{font:16px system-ui;max-width:850px;margin:32px auto;padding:16px}pre{white-space:pre-wrap;overflow-wrap:anywhere}dt{font-weight:bold}@media print{body{margin:0}}</style><h1>'+escape(document.kind.toUpperCase())+'</h1><p>'+escape(document.number)+' · version '+document.version+'</p><p>Issued '+escape(document.issued_at)+' · '+(document.superseded?'Superseded version; retained history.':'Current issued version.')+'</p><p>Payment state at issue: <strong>'+escape(document.asIssuedState)+'</strong>. Current payment state: <strong>'+escape(document.currentState)+'</strong>.</p><p>Provider success alone is not proof of payment. Current status is a separate projection; the issued amounts and history are retained.</p><section>'+sourceHtml(document.source)+'</section><h2>Payment references at issue</h2>'+sourceHtml(JSON.parse(document.financial_json))+'<h2>Current payment references</h2>'+sourceHtml(document.currentFinancial)+'<h2>Issue or correction findings</h2><p>'+escape(document.note)+'</p><p>Source digest: '+escape(document.payload_hash)+'</p></html>';
}
export function financeDocumentReport(data:Awaited<ReturnType<typeof readFinanceDocuments>>){
 const cell=(x:unknown)=>'"'+String(x).replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
 return [['document_number','kind','source_id','version','superseded','issued_at','amount_cents','currency','state_at_issue','current_state','source_changed','source_digest'],...data.documents.filter(d=>d.number).map(d=>[d.number,d.kind,d.source_id,d.version,d.superseded,d.issued_at,d.amount_cents,'ZAR',d.asIssuedState,d.currentState,d.sourceChanged,d.payload_hash])].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}

// Create an unissued invoice source from an existing order and already reviewed billing identities.
// No payment order, checkout, message or fund allocation is created.
export async function prepareDocumentInvoice(db:D1Database,a:SigningActor,input:Record<string,unknown>,h:Headers){
 const bookingId=text(input.bookingId,'the existing booking',200),op=await operator(db,a,h,0);
 const b=await db.prepare("SELECT b.*,p.quote_json,p.request_hash FROM bookings b JOIN production_order_setups p ON p.id=b.id WHERE b.id=? AND b.environment='production' AND b.integrity_state='production_verified'").bind(bookingId).first<{client_id:string;client_price_cents:number;pricing_version:string;vat_cents:number;contracting_entity_id:string;start_date:string;end_date:string;site_name:string;request_hash:string}>();if(!b)throw new SignupError('An existing production order is required.',409);
 await operator(db,a,h,b.client_price_cents);
 const issuer=await db.prepare("SELECT * FROM billing_profiles WHERE id=? AND owner_type='issuer' AND owner_id=? AND environment='production' AND integrity_state='production_verified' AND active_key IS NOT NULL").bind(text(input.issuerProfileId,'the approved issuer billing profile',200),b.contracting_entity_id).first<Record<string,string|number>>();
 const client=await db.prepare("SELECT * FROM billing_profiles WHERE id=? AND owner_type='client' AND owner_id=? AND environment='production' AND integrity_state='production_verified' AND active_key IS NOT NULL").bind(text(input.clientProfileId,'the approved client billing profile',200),b.client_id).first<Record<string,string|number>>();
 if(!issuer||!client||issuer.tax_status==='pending_configuration'||client.legal_name===''||input.evidenceReviewed!==true)throw new SignupError('Review current production billing profiles and approved tax sources.',409);
 const tax=input.taxCents;if(!Number.isSafeInteger(tax)||Number(tax)<0||Number(tax)>b.client_price_cents||tax!==b.vat_cents)throw new SignupError('Provide the reviewed tax component of the exact order total.');
 const taxReference=text(input.taxReference,'the approved tax evidence reference',200),taxHash=text(input.taxHash,'the approved tax evidence SHA-256',64);if(!/^[a-f0-9]{64}$/.test(taxHash))throw new SignupError('Use the exact tax evidence digest.');
 const due=text(input.dueDate,'the South African due date',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due))||new Date(due).toISOString().slice(0,10)!==due)throw new SignupError('Use a valid South African due date.');
 const id='INV-'+bookingId,now=new Date().toISOString(),snapshot=(p:Record<string,string|number>)=>JSON.stringify({id:p.id,version:p.version,legalName:p.legal_name,registrationNumber:p.registration_number,vatNumber:p.vat_number,address:p.billing_address,taxStatus:p.tax_status});
 const issuerSnapshot=snapshot(issuer),clientSnapshot=snapshot(client),source=JSON.stringify({requestHash:b.request_hash,taxReference,taxHash,preparedBy:op.id});
 const old=await db.prepare('SELECT id,subtotal_cents,tax_cents,issuer_snapshot,client_snapshot,due_at FROM client_invoices WHERE id=?').bind(id).first<Record<string,unknown>>();
 if(old){if(old.tax_cents!==tax||old.issuer_snapshot!==issuerSnapshot||old.client_snapshot!==clientSnapshot||old.due_at!==due)throw new SignupError('An invoice source already exists with different reviewed facts. Retain it for correction review.',409);return {invoiceId:id,alreadyPrepared:true};}
 await db.batch([
 db.prepare("INSERT INTO client_invoices(id,booking_id,client_id,issuer_billing_profile_id,client_billing_profile_id,document_type,currency,service_period_start,service_period_end,subtotal_cents,tax_cents,total_cents,balance_cents,tax_treatment,status,funding_status,pricing_version,issuer_snapshot,client_snapshot,issue_reference,due_at,environment,integrity_state,created_at,updated_at) SELECT ?,b.id,b.client_id,?,?,'invoice','ZAR',b.start_date,b.end_date,?,?,?,?,'source_reviewed','draft','not_started',b.pricing_version,?,?,?,?,'production','production_verified',?,? FROM bookings b WHERE b.id=? AND b.client_price_cents=?").bind(id,issuer.id,client.id,b.client_price_cents-Number(tax),tax,b.client_price_cents,b.client_price_cents,issuerSnapshot,clientSnapshot,source,due,now,now,bookingId,b.client_price_cents),
 db.prepare("INSERT INTO client_invoice_lines(id,invoice_id,booking_id,description,quantity,unit_price_cents,net_cents,tax_cents,gross_cents,tax_code,pricing_version,environment,integrity_state,created_at) SELECT ?,i.id,i.booking_id,?,1,i.subtotal_cents,i.subtotal_cents,i.tax_cents,i.total_cents,'source_reviewed',i.pricing_version,'production','production_verified',? FROM client_invoices i WHERE i.id=?").bind('LINE-'+id,'Approved service order: '+b.site_name,now,id)
 ]);return {invoiceId:id,issued:false};
}
