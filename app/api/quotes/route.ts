import {workspaceCommandReceipt} from '../../lib/workspace-command-receipt';
import {env} from 'cloudflare:workers';
import {SignupError} from '../../lib/signup-server';
import {quoteActor,requireClientJson} from '../../lib/quote-access';
import {deliverClientNotifications,type ClientNotificationRuntime} from '../../lib/quote-notifications';
import {readRequestText,RequestBodyError} from '../../lib/request-body';
import {uploadTerms,manageTerms,issueQuote,acceptQuote,declineQuote,cancelQuote,readQuotes,quoteFile,quoteAcceptanceCopy} from '../../lib/quote-acceptance';
import {quoteAcceptanceDocument} from '../../lib/quote-document';
export const dynamic='force-dynamic';
const headers={'cache-control':'private, no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers});
const runtime=env as unknown as ClientNotificationRuntime&{LOKD_OPERATIONS_ACCESS_JSON?:string;LOKD_OWNER_ACCESS_JSON?:string};
const actor=(request:Request)=>quoteActor(request,runtime);
const fail=(e:unknown)=>e instanceof SignupError||e instanceof RequestBodyError?reply({error:e.message},e.status):reply({error:'The quote action could not be completed. Refresh before retrying.'},409);
export async function GET(request:Request){try{
 const a=actor(request);if(!env.DB||!env.BUCKET)throw new SignupError('Quote storage unavailable.',503);
 const receipt=new URL(request.url).searchParams.get('receipt');
 if(receipt){const copy=await quoteAcceptanceCopy(env.DB,env.BUCKET,a,receipt);return new Response(quoteAcceptanceDocument(copy,a.operations),{headers:{...headers,'content-type':'text/html; charset=utf-8','content-disposition':'inline','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});}
 const id=new URL(request.url).searchParams.get('file');
 if(id){const {bytes,t}=await quoteFile(env.DB,env.BUCKET,a,id);return new Response(bytes,{headers:{...headers,'content-type':'application/pdf','content-disposition':`attachment; filename="${t.id}.pdf"`,'content-security-policy':"default-src 'none'; sandbox",'x-content-sha256':t.file_hash}});}
 return reply(await readQuotes(env.DB,a,new URL(request.url).searchParams.get('quote')??undefined));
 }catch(e){return fail(e);}}
export async function POST(request:Request){try{
 requireClientJson(request);const a=actor(request);if(!env.DB||!env.BUCKET)throw new SignupError('Quote storage unavailable.',503);
 // Large uploads are accepted only from Operations, never anonymous or client requests.
 const raw=await readRequestText(request,a.operations?6_800_000:5000);let b;try{b=JSON.parse(raw);}catch{throw new SignupError('Invalid request.');}
 if(!b||typeof b!=='object'||Array.isArray(b))throw new SignupError('Invalid request.');
 let result;
 if(b.action==='upload_terms')result=await uploadTerms(env.DB,env.BUCKET,a,b);
 else if(['approve_terms','withdraw_terms'].includes(b.action))result=await manageTerms(env.DB,env.BUCKET,a,b);
 else if(b.action==='issue')result=await issueQuote(env.DB,env.BUCKET,a,b);
 else if(b.action==='accept')result=await acceptQuote(env.DB,env.BUCKET,a,b);
 else if(b.action==='decline')result=await declineQuote(env.DB,a,b);
 else if(b.action==='cancel')result=await cancelQuote(env.DB,a,b);
 else if(b.action==='retry_email'){
  if(typeof b.quoteId!=='string')throw new SignupError('Choose a quote.');
  const q=await env.DB.prepare(`SELECT id FROM client_quote_offers WHERE id=?${a.operations?'':' AND owner_user_id=?'}`).bind(b.quoteId,...a.operations?[]:[a.userId]).first();
  if(!q)throw new SignupError('Quote not found for this account.',404);
  result={emailRetryRequested:true};
 }
 else throw new SignupError('Choose a supported quote action.');
 const quoteId='quoteId' in result?result.quoteId:b.quoteId;
 let emailDelivery;
 if(typeof quoteId==='string'){
  const jobs=await env.DB.prepare("SELECT id FROM client_notification_jobs WHERE source_id=? AND state IN ('queued','blocked','retry_wait') ORDER BY created_at,id LIMIT 5").bind(quoteId).all<{id:string}>();
  emailDelivery=await deliverClientNotifications(env.DB,runtime,{ids:jobs.results.map(job=>job.id)});
 }
 return reply({result,emailDelivery,...await readQuotes(env.DB,a,new URL(request.url).searchParams.get('quote')??undefined),commandReceipt:await workspaceCommandReceipt('quotes',b)});
 }catch(e){return fail(e);}}
