import {SignupError} from './signup-server';
import {currentQuote,acceptedOrderQuote} from './quote-acceptance';
import {inspectBooksDocument} from './zoho-books';
import type {OperationalRuntime} from './operational-provider';
import type {SigningActor} from './production-signing';

export async function linkQuoteBooks(db:D1Database,runtime:OperationalRuntime,actor:SigningActor,input:Record<string,unknown>,transport:typeof fetch=fetch){
 if(!actor.operations||!actor.owner)throw new SignupError('The Operations owner must verify accounting links.',403);
 if(typeof input.quoteId!=='string'||input.quoteId.length>100||!['estimate','invoice'].includes(String(input.kind))||typeof input.documentId!=='string'||typeof input.customerId!=='string'||input.customerConfirmed!==true)throw new SignupError('Provide the Books references and confirm the customer belongs to this client.');
 const {q,receipt}=await currentQuote(db,input.quoteId,Date.now(),true);
 const accepted=await acceptedOrderQuote(db,q.order_id);
 if(!receipt||!accepted.receipt||accepted.receipt.hash!==receipt.receipt_hash)throw new SignupError('A current accepted quote is required before linking accounting documents.',409);
 const scope=JSON.parse(q.source_json),kind=input.kind as 'estimate'|'invoice';
 // Books reference_number stays the immutable QUOTE- id. INV- + public_number is display-only and is not written to Zoho.
 const comparison=await inspectBooksDocument(runtime,{kind,documentId:input.documentId,customerId:input.customerId,orderId:q.order_id,referenceNumber:q.id,totalMinor:scope.totalCents,taxMinor:scope.vatCents},transport);
 if(['void','voided','declined','expired','cancel','cancelled'].includes(comparison.status))throw new SignupError('This Books document is no longer current.',409);
 // Recheck after network I/O; the database trigger also protects the final insert.
 await currentQuote(db,q.id,Date.now(),true);
 const existing=await db.prepare('SELECT * FROM quote_books_links WHERE quote_id=? AND kind=?').bind(q.id,kind).first<{id:string;comparison_json:string;receipt_hash:string}>();
 const comparisonJson=JSON.stringify(comparison);
 if(existing){if(existing.comparison_json!==comparisonJson||existing.receipt_hash!==receipt.receipt_hash)throw new SignupError('The Books document or saved revision changed. Reconcile it before replacing this quote.',409);return {alreadyLinked:true,linkId:existing.id,financialRecordsChanged:false,funded:false};}
 const other=await db.prepare('SELECT customer_id,organization_id FROM quote_books_links WHERE quote_id=? LIMIT 1').bind(q.id).first<{customer_id:string;organization_id:string}>();
 if(other&&(other.customer_id!==comparison.customerId||other.organization_id!==comparison.organizationId))throw new SignupError('Use the same Books customer and organisation for this quote.',409);
 const id='BOOKS-LINK-'+crypto.randomUUID();
 await db.prepare('INSERT INTO quote_books_links VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,q.id,kind,comparison.organizationId,comparison.documentId,comparison.customerId,q.offer_hash,receipt.receipt_hash,comparisonJson,actor.userId,new Date().toISOString()).run();
 return {linkId:id,financialRecordsChanged:false,funded:false};
}
export async function readQuoteBooksLinks(db:D1Database){
 const rows=await db.prepare('SELECT l.*,q.source_json,q.order_id,q.offer_hash AS current_offer_hash,r.receipt_hash AS current_receipt_hash FROM quote_books_links l JOIN client_quote_offers q ON q.id=l.quote_id JOIN client_quote_receipts r ON r.quote_id=q.id ORDER BY l.linked_at DESC LIMIT 100').all<{id:string;quote_id:string;kind:string;organization_id:string;document_id:string;customer_id:string;comparison_json:string;linked_at:string;offer_hash:string;receipt_hash:string;current_offer_hash:string;current_receipt_hash:string;order_id:string}>();
 const links=[];
 for(const row of rows.results){const accepted=await acceptedOrderQuote(db,row.order_id);links.push({id:row.id,quoteId:row.quote_id,kind:row.kind,organizationId:row.organization_id,documentId:row.document_id,customerId:row.customer_id,comparison:JSON.parse(row.comparison_json),linkedAt:row.linked_at,currentAcceptance:accepted.receipt?.id==='QUOTE-ACCEPT-'+row.quote_id&&accepted.receipt.hash===row.receipt_hash&&row.offer_hash===row.current_offer_hash&&row.receipt_hash===row.current_receipt_hash,liveProviderRechecked:false});}
 return links;
}
