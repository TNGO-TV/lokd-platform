import {env} from 'cloudflare:workers';
import {SignupError} from '../../lib/signup-server';
import {PilotAccessError,requirePilotApiRole,requireSameOriginJson} from '../../lib/pilot-runtime';
import {readRequestText} from '../../lib/request-body';
import {inspectBooksDocument,inspectBooksOrganization} from '../../lib/zoho-books';
import {linkQuoteBooks,readQuoteBooksLinks} from '../../lib/quote-books-links';
import {DeliveryError} from '../../lib/operational-provider';
export const dynamic='force-dynamic';
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{'cache-control':'private, no-store','referrer-policy':'no-referrer'}});
function owner(request:Request){if(!request.headers.get('x-lokd-verified-user-id')||!request.headers.get('x-lokd-verified-email'))throw new SignupError('Sign in to Operations.',401);const actor=requirePilotApiRole(request,'operations');if(!actor.owner)throw new SignupError('The Operations owner must inspect the accounting connection.',403);return {userId:request.headers.get('x-lokd-verified-user-id')!,email:request.headers.get('x-lokd-verified-email')!,operations:true,owner:true};}
const fail=(e:unknown)=>e instanceof SignupError||e instanceof PilotAccessError?reply({error:e.message},e.status):e instanceof DeliveryError?reply({error:e.code.replaceAll('_',' '),providerVerified:false},503):reply({error:'The Books verification could not be completed.',providerVerified:false},503);
export async function GET(request:Request){try{owner(request);if(new URL(request.url).searchParams.get('links')==='true'){if(!env.DB)throw new SignupError('Storage unavailable.',503);return reply({links:await readQuoteBooksLinks(env.DB)});}const {session:_,...organization}=await inspectBooksOrganization(env);void _;return reply({organization,providerVerified:true,financialRecordsChanged:false});}catch(e){return fail(e);}}
export async function POST(request:Request){try{
 requireSameOriginJson(request);const actor=owner(request);if(!env.DB)throw new SignupError('Storage unavailable.',503);
 const input=JSON.parse(await readRequestText(request,2000));
 if(input?.action==='link_quote')return reply({result:await linkQuoteBooks(env.DB,env,actor,input),links:await readQuoteBooksLinks(env.DB)});
 if(!input||!['estimate','invoice'].includes(input.kind)||typeof input.orderId!=='string'||input.orderId.length>100||typeof input.documentId!=='string'||typeof input.customerId!=='string')throw new SignupError('Provide the order and existing Books document references.');
 const order=await env.DB.prepare("SELECT b.client_price_cents,b.vat_cents FROM production_order_setups p JOIN bookings b ON b.id=p.id WHERE p.id=? AND b.environment='production' AND b.integrity_state='production_verified'").bind(input.orderId).first<{client_price_cents:number;vat_cents:number}>();
 if(!order)throw new SignupError('Production service order not found.',404);
 return reply({comparison:await inspectBooksDocument(env,{kind:input.kind,documentId:input.documentId,customerId:input.customerId,orderId:input.orderId,totalMinor:order.client_price_cents,taxMinor:order.vat_cents}),financialRecordsChanged:false});
 }catch(e){return fail(e);}}
