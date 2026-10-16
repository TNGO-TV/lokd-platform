import {workspaceCommandReceipt} from '../../lib/workspace-command-receipt';
import {requireLiveRefundReference} from '../../lib/production-finance-boundary';
import {readFinanceText} from '../../lib/finance-body';
import {env} from 'cloudflare:workers';
import {SignupError} from '../../lib/signup-server';
import {PilotAccessError,principalForEmail,principalHasRole,requirePilotApiRole,requireSameOriginJson} from '../../lib/pilot-runtime';
import {workspaceRoleForHost} from '../../lib/public-site';
import {operateBookingRefund,readBookingRefunds,type RefundRuntime,refundPageDatasets,type RefundPageOptions} from '../../lib/booking-refunds';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'cache-control':'private, no-store','referrer-policy':'no-referrer'}});
export async function POST(request:Request){
 try{
  if(request.method!=='GET')requireSameOriginJson(request);
  const userId=request.headers.get('x-lokd-verified-user-id'),email=request.headers.get('x-lokd-verified-email');
  if(!userId||!email)throw new SignupError('Sign in to your account.',401);
  const host=workspaceRoleForHost(new URL(request.url).hostname),principal=principalForEmail(email);
  if(host&&host!=='operations'||!principalHasRole(principal,'operations'))throw new SignupError('Operations access required.',403);
  requirePilotApiRole(request,'operations');
  if(!env.DB)throw new SignupError('Storage unavailable.',503);
  if(request.method==='GET'){
   const query=new URL(request.url).searchParams,allowed=new Set(['pageSize','dataset','cursor','reference','caseId',...refundPageDatasets.map(name=>name+'Cursor')]);
   for(const key of query.keys())if(!allowed.has(key)||query.getAll(key).length!==1)throw new SignupError('Choose valid refund page parameters.',400);
   const page:RefundPageOptions={};
   if(query.has('pageSize')){const value=query.get('pageSize')!;if(!/^[1-9][0-9]{0,2}$/.test(value))throw new SignupError('Choose a refund page size from 1 to 100.',400);page.pageSize=Number(value);}
   if(query.has('dataset'))page.dataset=query.get('dataset') as RefundPageOptions['dataset'];
   if(query.has('reference'))page.reference=query.get('reference')!;
   if(query.has('caseId'))page.caseId=query.get('caseId')!;
   if(query.has('cursor'))page.cursor=query.get('cursor')!;
   page.cursors={};for(const name of refundPageDatasets)if(query.has(name+'Cursor'))page.cursors[name]=query.get(name+'Cursor')!;
   return reply(await readBookingRefunds(env.DB,{userId,email,operations:true,owner:principal.owner},request.headers,env as RefundRuntime,page,true));
  }
  const raw=await readFinanceText(request,6000);
  let input;try{input=JSON.parse(raw);}catch{throw new SignupError('Invalid request.');}
  if(!input||typeof input!=='object'||Array.isArray(input))throw new SignupError('Choose a recovery action.');
  await requireLiveRefundReference(env.DB,input.reference);
  return reply({...await operateBookingRefund(env.DB,{userId,email,operations:true,owner:principal.owner},input,request.headers,env as RefundRuntime),commandReceipt:await workspaceCommandReceipt('booking-refunds',input)});
 }catch(e){return e instanceof SignupError||e instanceof PilotAccessError?reply({error:e.message},e.status):reply({error:'Refund evidence or authority changed. Keep the original reference held and refresh.'},409);}
}

export const GET=POST;
