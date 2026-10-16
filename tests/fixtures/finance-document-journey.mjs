import assert from 'node:assert/strict';
import fs from 'node:fs';
import {financeDocumentsResponse} from '../../app/lib/workspace-response-contracts.ts';
import {prepareFinanceDocument,decideFinanceDocument,readFinanceDocuments,renderFinanceDocument,financeDocumentReport} from '../../app/lib/finance-documents.ts';
export async function financeDocumentJourney({db,database,maker,finance,recipient,kind,sourceId,headers,addTestDestination,expectsHistoricalTestPayment=true}){
 const input={kind,sourceId,requestKey:'document-'+kind+'-'+sourceId,evidenceReviewed:true,note:'Independent fixture document source and payment review.'};
 database.exec('SAVEPOINT limited_document_sources');
 try{
  database.prepare("UPDATE operator_accounts SET approval_limit_cents=0 WHERE email=?").run(maker.email);
  const limited=await readFinanceDocuments(db,maker,headers);
  assert.ok(limited.sources.every(source=>source.amount_cents===0),'source discovery respects operator amount limits');
  assert.ok(!limited.sources.some(source=>source.kind===kind&&source.source_id===sourceId),'positive amount source stays private above limit');
 }finally{database.exec('ROLLBACK TO limited_document_sources; RELEASE limited_document_sources');}

 // Recreate the pre-0085 payment projection, issue a real immutable document,
 // then apply the source-only migration and prove the issued bytes survive.
 const legacyBatch=db.batch;
 db.batch=async statements=>{database.exec('SAVEPOINT legacy_document_issue');try{const result=statements.map(statement=>statement.runSync());database.exec('RELEASE legacy_document_issue');return result;}catch(error){database.exec('ROLLBACK TO legacy_document_issue; RELEASE legacy_document_issue');throw error;}};
 database.exec('SAVEPOINT legacy_finance_document');
 try{
  const oldSql=fs.readFileSync(new URL('../../drizzle/0067_finance_documents.sql',import.meta.url),'utf8');
  const paymentView=oldSql.split('--> statement-breakpoint').find(sql=>/CREATE VIEW [`]?finance_document_payment_rows/.test(sql));
  assert.ok(paymentView);database.exec('DROP VIEW finance_document_payment_rows;'+paymentView);
  const historical=await prepareFinanceDocument(db,maker,{...input,requestKey:input.requestKey+'-legacy'},headers);
  const row=database.prepare('SELECT * FROM finance_document_versions WHERE id=?').get(historical.documentId);
  assert.equal(JSON.parse(row.financial_json).some(payment=>payment.mode==='test'),expectsHistoricalTestPayment);
  if(!expectsHistoricalTestPayment)assert.deepEqual(JSON.parse(row.financial_json),[],'unpaid source has no historical payments');
  await decideFinanceDocument(db,finance,{documentId:row.id,payloadHash:row.payload_hash,decision:'approved',evidenceReviewed:true,note:'Historical independently issued source snapshot.'},headers);
  const snapshot=()=>JSON.stringify(['finance_document_versions','finance_document_decisions','finance_document_issues'].map(table=>database.prepare('SELECT * FROM '+table).all()));const before=snapshot();
  database.exec(fs.readFileSync(new URL('../../drizzle/0085_finance_document_live_sources.sql',import.meta.url),'utf8'));
  assert.equal(snapshot(),before,'migration preserves exact historical issued document, approval and issue rows');
  const document=(await readFinanceDocuments(db,recipient,headers,row.id)).documents[0];
  assert.ok(document.currentFinancial.every(payment=>payment.mode==='live'));
  if(expectsHistoricalTestPayment)assert.match(renderFinanceDocument(document),/historical snapshot contains test evidence/);
  else assert.doesNotMatch(renderFinanceDocument(document),/historical snapshot contains test evidence/);
 }finally{database.exec('ROLLBACK TO legacy_finance_document; RELEASE legacy_finance_document');db.batch=legacyBatch;}
 const p=await prepareFinanceDocument(db,maker,input,headers),v=database.prepare('SELECT * FROM finance_document_versions WHERE id=?').get(p.documentId);
 assert.equal((await prepareFinanceDocument(db,maker,input,headers)).alreadyPrepared,true);
 assert.equal((await readFinanceDocuments(db,recipient,headers)).documents.length,0,'drafts stay private to finance');
 const decision={documentId:v.id,payloadHash:v.payload_hash,decision:'approved',evidenceReviewed:true,note:'Independent final source and financial review.'};
 await assert.rejects(()=>decideFinanceDocument(db,maker,decision,headers),/maker|finance approver|independent/i);
 await assert.rejects(()=>decideFinanceDocument(db,finance,{...decision,payloadHash:'f'.repeat(64)},headers),/exact frozen/);
 const originalBatch=db.batch;
 db.batch=async statements=>{database.exec('SAVEPOINT document_review_batch');try{const results=statements.map(s=>s.runSync());database.exec('RELEASE document_review_batch');return results;}catch(error){database.exec('ROLLBACK TO document_review_batch; RELEASE document_review_batch');throw error;}};
 database.exec('SAVEPOINT document_authority_change');
 try{
  database.prepare("UPDATE operator_accounts SET status='suspended' WHERE id=?").run(v.operator_id);
  await assert.rejects(()=>decideFinanceDocument(db,finance,decision,headers),/current document approval/);
  assert.equal(database.prepare('SELECT count(*) AS n FROM finance_document_issues WHERE document_id=?').get(v.id).n,0);
  await decideFinanceDocument(db,finance,{...decision,decision:'rejected'},headers);
 }finally{database.exec('ROLLBACK TO document_authority_change; RELEASE document_authority_change');db.batch=originalBatch;}
 const results=await Promise.allSettled([decideFinanceDocument(db,finance,decision,headers),decideFinanceDocument(db,finance,decision,headers)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const read=()=>readFinanceDocuments(db,recipient,headers,v.id),document=(await read()).documents[0];
 assert.ok(document.currentFinancial.every(row=>row.mode==='live'));
 assert.ok(JSON.parse(v.financial_json).every(row=>row.mode==='live'),'new immutable snapshots exclude test payment evidence');
 if(addTestDestination){
  const originalVersion=JSON.stringify(database.prepare('SELECT * FROM finance_document_versions WHERE id=?').get(v.id));
  const testDestinationId=await addTestDestination();
  assert.equal(database.prepare('SELECT mode FROM partner_destination_reviews WHERE id=?').get(testDestinationId).mode,'test');
  assert.equal(database.prepare("SELECT recipient_user FROM finance_document_sources WHERE kind='remittance' AND source_id=?").get(sourceId).recipient_user,recipient.userId);
  assert.equal((await read()).documents[0].recipient_user,recipient.userId);
  await assert.rejects(()=>readFinanceDocuments(db,{...recipient,userId:'different-test-representative'},headers,v.id),e=>e.status===404);
  assert.equal(JSON.stringify(database.prepare('SELECT * FROM finance_document_versions WHERE id=?').get(v.id)),originalVersion);
 }
 assert.equal(financeDocumentsResponse(await read()),true,'actual issued document satisfies its consumer contract');
 assert.equal(document.kind,kind);assert.ok(document.number);assert.match(renderFinanceDocument(document),/Current payment state/);
 await assert.rejects(()=>readFinanceDocuments(db,{...recipient,userId:'different-document-recipient'},headers,v.id),/not found/);
 const {GET}=await import('../../app/api/finance-documents/route.ts'),{env}=await import('cloudflare:workers');const savedDb=env.DB;env.DB=db;
 try{
  const request=(user,download='')=>new Request('https://lokd.co.za/api/finance-documents?documentId='+encodeURIComponent(v.id)+download,{headers:{'x-lokd-verified-user-id':user,'x-lokd-verified-email':recipient.email}});
  const response=await GET(request(recipient.userId,'&download=document'));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('content-security-policy'),/sandbox/);
  const html=await response.text();assert.ok(!html.includes('1234567890'));assert.match(html,/Source digest/);
  const historyView=kind==='payslip'?'document_employee_payment_states':kind==='remittance'?'document_partner_payment_states':'document_invoice_payment_states';
  const testReferences=database.prepare("SELECT reference FROM "+historyView+" WHERE source_id=? AND mode='test'").all(sourceId);
  assert.equal(testReferences.length>0,expectsHistoricalTestPayment,'historical payments match the populated or unpaid fixture');
  for(const row of testReferences)assert.equal(html.includes(row.reference),false,'new production document does not include test payment details');
  assert.equal((await GET(request('different-test-representative','&download=document'))).status,404);
  assert.equal((await GET(request('other-private-user'))).status,404);
 }finally{env.DB=savedDb;}
 const before=JSON.stringify(database.prepare('SELECT * FROM finance_document_versions WHERE id=?').get(v.id));
 const correction=await prepareFinanceDocument(db,maker,{...input,requestKey:input.requestKey+'-correction',parentId:v.id,note:'Clarified issue findings; preserve all original amounts.'},headers);
 const next=database.prepare('SELECT * FROM finance_document_versions WHERE id=?').get(correction.documentId);
 assert.equal(next.version,2);assert.equal(next.source_json,v.source_json);
 await decideFinanceDocument(db,finance,{...decision,documentId:next.id,payloadHash:next.payload_hash},headers);
 assert.equal((await read()).documents[0].superseded,true);assert.equal(JSON.stringify(database.prepare('SELECT * FROM finance_document_versions WHERE id=?').get(v.id)),before);
 assert.match(financeDocumentReport(await readFinanceDocuments(db,recipient,headers)),/current_state/);
 for(const table of ['finance_document_versions','finance_document_decisions','finance_document_issues'])assert.throws(()=>database.exec('DELETE FROM '+table),/immutable/);
 return {documentId:v.id,read,original:before};
}
