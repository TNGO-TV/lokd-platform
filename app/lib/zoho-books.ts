import {DeliveryError,providerJson,zohoSession,type OperationalRuntime} from './operational-provider';
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
function providerId(v:unknown){if(typeof v!=='string'||!/^\d{5,30}$/.test(v))throw new DeliveryError('books_reference_invalid','failed');return v;}
export function booksAmountMinor(value:unknown){
 if(typeof value!=='string'&&typeof value!=='number')throw new DeliveryError('books_amount_invalid','failed');
 const raw=String(value);if(!/^\d+(\.\d{1,2})?$/.test(raw))throw new DeliveryError('books_amount_invalid','failed');
 const [whole,fraction='']=raw.split('.'),minor=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(minor))throw new DeliveryError('books_amount_invalid','failed');return minor;
}
export async function inspectBooksOrganization(runtime:OperationalRuntime,transport:typeof fetch=fetch){
 const id=providerId(runtime.LOKD_ZOHO_BOOKS_ORG_ID),session=await zohoSession(runtime,transport);
 const response=await providerJson(session.origin+'/books/v3/organizations/'+id,{headers:session.headers},transport),org=object(response.organization);
 if(response.code!==0||org.organization_id!==id||org.currency_code!=='ZAR'||org.is_org_active!==true)throw new DeliveryError('books_organization_not_verified');
 return {organizationId:id,name:String(org.name??''),currency:'ZAR',country:String(org.country??object(org.address).country??''),timezone:String(org.time_zone??''),nativeCrmSyncVerified:false,session};
}

// Read-only comparison. No create, send, customer-sync, paid-state or funding API.
// A matching invoice is not an independent legal/financial approval.
export async function inspectBooksDocument(runtime:OperationalRuntime,expected:{kind:'estimate'|'invoice';documentId:string;customerId:string;orderId:string;totalMinor:number;taxMinor:number},transport:typeof fetch=fetch){
 const org=await inspectBooksOrganization(runtime,transport),documentId=providerId(expected.documentId),customerId=providerId(expected.customerId);
 if(!['estimate','invoice'].includes(expected.kind)||!Number.isSafeInteger(expected.totalMinor)||!Number.isSafeInteger(expected.taxMinor)||expected.totalMinor<0||expected.taxMinor<0)throw new DeliveryError('books_expected_binding_invalid','failed');
 const response=await providerJson(`${org.session.origin}/books/v3/${expected.kind}s/${documentId}?organization_id=${org.organizationId}`,{headers:org.session.headers},transport),doc=object(response[expected.kind]);
 if(response.code!==0||doc[expected.kind+'_id']!==documentId||doc.customer_id!==customerId||doc.reference_number!==expected.orderId||doc.currency_code!=='ZAR'||booksAmountMinor(doc.total)!==expected.totalMinor||booksAmountMinor(doc.tax_total)!==expected.taxMinor||typeof doc.last_modified_time!=='string'||!Number.isFinite(Date.parse(doc.last_modified_time)))throw new DeliveryError('books_document_binding_mismatch','failed');
 return {organizationId:org.organizationId,kind:expected.kind,documentId,customerId,orderId:expected.orderId,number:String(doc[expected.kind+'_number']??''),status:String(doc.status??''),revision:doc.last_modified_time,totalMinor:expected.totalMinor,taxMinor:expected.taxMinor,currency:'ZAR',providerRead:true,independentlyApproved:false,funded:false,issuedByLokd:false};
}
