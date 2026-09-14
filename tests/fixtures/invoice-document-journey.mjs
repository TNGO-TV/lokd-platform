import assert from 'node:assert/strict';
import {prepareDocumentInvoice,prepareFinanceDocument,decideFinanceDocument} from '../../app/lib/finance-documents.ts';
import {operateProduction} from '../../app/lib/production-operations.ts';
import {financeDocumentJourney} from './finance-document-journey.mjs';
export async function invoiceDocumentJourney({database,db,reviewer,owner,applicant,headers,bookingId}){
 for(const [actor,role] of [[reviewer,'payroll_preparer'],[owner,'finance_approver']])await operateProduction(db,owner,{action:'grant_operator',email:actor.email,role,limitCents:100000000},headers);
 const b=database.prepare('SELECT * FROM bookings WHERE id=?').get(bookingId),now=new Date().toISOString();
 const input={bookingId,issuerProfileId:'DOC-ISSUER',clientProfileId:'DOC-CLIENT',taxCents:b.vat_cents,taxReference:'evidence:fixture:approved-tax',taxHash:'a'.repeat(64),dueDate:b.start_date,evidenceReviewed:true};
 await assert.rejects(()=>prepareDocumentInvoice(db,reviewer,input,headers),/billing profiles/);
 for(const [id,type,ownerId,name] of [['DOC-ISSUER','issuer',b.contracting_entity_id,'Synthetic issuer'],['DOC-CLIENT','client',b.client_id,'Synthetic client']])database.prepare("INSERT INTO billing_profiles(id,owner_type,owner_id,legal_name,tax_status,billing_address,billing_email,environment,integrity_state,active_key,created_at,updated_at) VALUES(?,?,?,?,'fixture_source_reviewed','Synthetic test address','billing@example.test','production','production_verified',?,?,?)").run(id,type,ownerId,name,id,now,now);
 await assert.rejects(()=>prepareDocumentInvoice(db,reviewer,{...input,taxCents:b.vat_cents+1},headers),/tax component/);
 const prepared=await prepareDocumentInvoice(db,reviewer,input,headers);assert.equal((await prepareDocumentInvoice(db,reviewer,input,headers)).alreadyPrepared,true);
 // A rejected first draft must not permanently prevent the first canonical invoice issue.
 const originalBatch=db.batch;
 database.exec('SAVEPOINT rejected_invoice_first_issue');
 db.batch=async statements=>{database.exec('SAVEPOINT rejected_invoice_batch');try{const results=statements.map(s=>s.runSync());database.exec('RELEASE rejected_invoice_batch');return results;}catch(error){database.exec('ROLLBACK TO rejected_invoice_batch; RELEASE rejected_invoice_batch');throw error;}};
 try{
  const draft={kind:'invoice',sourceId:prepared.invoiceId,requestKey:'rejected-invoice-root',note:'Initial fixture invoice findings.',evidenceReviewed:true};
  const first=await prepareFinanceDocument(db,reviewer,draft,headers);
  const firstRow=database.prepare('SELECT * FROM finance_document_versions WHERE id=?').get(first.documentId);
  await decideFinanceDocument(db,owner,{documentId:firstRow.id,payloadHash:firstRow.payload_hash,decision:'rejected',note:'Clarify the invoice findings.',evidenceReviewed:true},headers);
  const correction=await prepareFinanceDocument(db,reviewer,{...draft,parentId:firstRow.id,requestKey:'corrected-invoice-root',note:'Corrected reviewed invoice findings.'},headers);
  const corrected=database.prepare('SELECT * FROM finance_document_versions WHERE id=?').get(correction.documentId);
  await decideFinanceDocument(db,owner,{documentId:corrected.id,payloadHash:corrected.payload_hash,decision:'approved',note:'Independent corrected invoice acceptance.',evidenceReviewed:true},headers);
  const issued=database.prepare('SELECT number FROM finance_document_issues WHERE document_id=?').get(corrected.id);
  assert.deepEqual({...database.prepare('SELECT status,invoice_number FROM client_invoices WHERE id=?').get(prepared.invoiceId)},{status:'issued',invoice_number:issued.number});
  assert.equal(database.prepare('SELECT count(*) AS n FROM finance_document_issues WHERE document_id=?').get(firstRow.id).n,0);
  assert.throws(()=>database.prepare('UPDATE client_invoices SET invoice_number=? WHERE id=?').run('replacement-number',prepared.invoiceId),/frozen/);
 }finally{database.exec('ROLLBACK TO rejected_invoice_first_issue; RELEASE rejected_invoice_first_issue');db.batch=originalBatch;}
 const clone=(table,row)=>database.prepare('INSERT INTO '+table+'('+Object.keys(row).join(',')+') VALUES('+Object.keys(row).map(()=>'?').join(',')+')').run(...Object.values(row));
 const otherInvoice={...database.prepare('SELECT * FROM client_invoices WHERE id=?').get(prepared.invoiceId),id:'DOC-UNFROZEN-CREDIT-SOURCE',document_type:'credit_note'};
 clone('client_invoices',otherInvoice);
 const otherLine={...database.prepare('SELECT * FROM client_invoice_lines WHERE invoice_id=?').get(prepared.invoiceId),id:'DOC-UNFROZEN-LINE',invoice_id:otherInvoice.id};
 clone('client_invoice_lines',otherLine);
 const journey=await financeDocumentJourney({db,database,maker:reviewer,finance:owner,recipient:applicant,kind:'invoice',sourceId:prepared.invoiceId,headers});
 assert.equal((await journey.read()).documents[0].currentState,'unpaid');
 assert.equal(database.prepare('SELECT status FROM client_invoices WHERE id=?').get(prepared.invoiceId).status,'issued');assert.ok(database.prepare('SELECT invoice_number FROM client_invoices WHERE id=?').get(prepared.invoiceId).invoice_number);
 assert.throws(()=>database.prepare('UPDATE client_invoices SET total_cents=1 WHERE id=?').run(prepared.invoiceId),/frozen/);
 assert.throws(()=>database.prepare('DELETE FROM client_invoice_lines WHERE invoice_id=?').run(prepared.invoiceId),/frozen/);
 assert.throws(()=>database.prepare('UPDATE client_invoice_lines SET invoice_id=? WHERE id=?').run(prepared.invoiceId,otherLine.id),/frozen/);
 assert.equal(database.prepare('SELECT invoice_id FROM client_invoice_lines WHERE id=?').get(otherLine.id).invoice_id,otherInvoice.id);
 database.prepare('DELETE FROM client_invoice_lines WHERE id=?').run(otherLine.id);
 database.prepare('DELETE FROM client_invoices WHERE id=?').run(otherInvoice.id);
 return journey;
}
