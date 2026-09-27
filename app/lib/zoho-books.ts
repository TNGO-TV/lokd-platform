import {DeliveryError,type OperationalRuntime} from './operational-provider';
import {assertLokdCompany,lokdOdooCall,LOKD_ODOO_COMPANY_ID} from './odoo-lokd';

const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
/** Odoo record ids (and legacy Zoho-length ids). */
function providerId(v:unknown){if(typeof v!=='string'||!/^\d{1,30}$/.test(v))throw new DeliveryError('books_reference_invalid','failed');return v;}
export function booksAmountMinor(value:unknown){
 if(typeof value!=='string'&&typeof value!=='number')throw new DeliveryError('books_amount_invalid','failed');
 const raw=String(value);if(!/^\d+(\.\d{1,2})?$/.test(raw))throw new DeliveryError('books_amount_invalid','failed');
 const [whole,fraction='']=raw.split('.'),minor=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(minor))throw new DeliveryError('books_amount_invalid','failed');return minor;
}

function currencyCode(value:unknown){
 if(Array.isArray(value)&&typeof value[1]==='string')return value[1];
 if(typeof value==='string')return value;
 return '';
}
function partnerIdOf(value:unknown){
 if(Array.isArray(value)&&typeof value[0]==='number')return String(value[0]);
 if(typeof value==='number')return String(value);
 return '';
}
function companyIdOf(value:unknown){
 if(Array.isArray(value)&&typeof value[0]==='number')return value[0];
 if(typeof value==='number')return value;
 return null;
}
function textRef(value:unknown){
 if(typeof value==='string')return value;
 if(value===false||value==null)return '';
 return String(value);
}
function revisionOk(revision:string){
 if(!revision)return false;
 const normalized=revision.includes('T')?revision:revision.replace(' ','T')+'Z';
 return Number.isFinite(Date.parse(normalized));
}

export async function inspectBooksOrganization(runtime:OperationalRuntime,transport:typeof fetch=fetch){
 const org=await assertLokdCompany(runtime,transport);
 return {organizationId:org.organizationId,name:org.name,currency:'ZAR' as const,country:'South Africa',timezone:'',nativeCrmSyncVerified:false};
}

// Read-only comparison against Odoo company 4. No create, send, paid-state or funding API.
// estimate → sale.order · invoice → account.move (out_invoice)
export async function inspectBooksDocument(runtime:OperationalRuntime,expected:{kind:'estimate'|'invoice';documentId:string;customerId:string;orderId:string;totalMinor:number;taxMinor:number;referenceNumber?:string},transport:typeof fetch=fetch){
 const org=await inspectBooksOrganization(runtime,transport);
 const documentId=providerId(expected.documentId),customerId=providerId(expected.customerId);
 if(!['estimate','invoice'].includes(expected.kind)||!Number.isSafeInteger(expected.totalMinor)||!Number.isSafeInteger(expected.taxMinor)||expected.totalMinor<0||expected.taxMinor<0)throw new DeliveryError('books_expected_binding_invalid','failed');
 const referenceNumber=expected.referenceNumber??expected.orderId;
 const idNum=Number(documentId);
 if(!Number.isSafeInteger(idNum)||idNum<=0)throw new DeliveryError('books_reference_invalid','failed');

 if(expected.kind==='estimate'){
  const rows=await lokdOdooCall<Array<Record<string,unknown>>>(runtime,'sale.order','read',{
   ids:[idNum],
   fields:['id','name','state','partner_id','company_id','client_order_ref','amount_total','amount_tax','currency_id','write_date'],
  },transport);
  const doc=object(rows?.[0]);
  const currency=currencyCode(doc.currency_id);
  const revision=typeof doc.write_date==='string'?doc.write_date:'';
  if(
   Number(doc.id)!==idNum||
   companyIdOf(doc.company_id)!==LOKD_ODOO_COMPANY_ID||
   partnerIdOf(doc.partner_id)!==customerId||
   textRef(doc.client_order_ref)!==referenceNumber||
   currency!=='ZAR'||
   booksAmountMinor(doc.amount_total)!==expected.totalMinor||
   booksAmountMinor(doc.amount_tax)!==expected.taxMinor||
   !revisionOk(revision)
  )throw new DeliveryError('books_document_binding_mismatch','failed');
  return {organizationId:org.organizationId,kind:expected.kind,documentId,customerId,orderId:expected.orderId,referenceNumber,number:textRef(doc.name)||documentId,status:textRef(doc.state)||'draft',revision,totalMinor:expected.totalMinor,taxMinor:expected.taxMinor,currency:'ZAR' as const,providerRead:true,independentlyApproved:false,funded:false,issuedByLokd:false};
 }

 const rows=await lokdOdooCall<Array<Record<string,unknown>>>(runtime,'account.move','read',{
  ids:[idNum],
  fields:['id','name','state','move_type','partner_id','company_id','ref','amount_total','amount_tax','currency_id','write_date'],
 },transport);
 const doc=object(rows?.[0]);
 const currency=currencyCode(doc.currency_id);
 const revision=typeof doc.write_date==='string'?doc.write_date:'';
 if(
  Number(doc.id)!==idNum||
  doc.move_type!=='out_invoice'||
  companyIdOf(doc.company_id)!==LOKD_ODOO_COMPANY_ID||
  partnerIdOf(doc.partner_id)!==customerId||
  textRef(doc.ref)!==referenceNumber||
  currency!=='ZAR'||
  booksAmountMinor(doc.amount_total)!==expected.totalMinor||
  booksAmountMinor(doc.amount_tax)!==expected.taxMinor||
  !revisionOk(revision)
 )throw new DeliveryError('books_document_binding_mismatch','failed');
 return {organizationId:org.organizationId,kind:expected.kind,documentId,customerId,orderId:expected.orderId,referenceNumber,number:textRef(doc.name)||documentId,status:textRef(doc.state)||'draft',revision,totalMinor:expected.totalMinor,taxMinor:expected.taxMinor,currency:'ZAR' as const,providerRead:true,independentlyApproved:false,funded:false,issuedByLokd:false};
}
