import {env} from 'cloudflare:workers';
import {SignupError} from '../../lib/signup-server';
import {PilotAccessError,principalForEmail,principalHasRole,requirePilotApiRole,requireSameOriginJson} from '../../lib/pilot-runtime';
import {workspaceRoleForHost} from '../../lib/public-site';
import {operateBookingRefund,readBookingRefunds,type RefundRuntime} from '../../lib/booking-refunds';
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
  if(request.method==='GET')return reply(await readBookingRefunds(env.DB,{userId,email,operations:true,owner:principal.owner},request.headers,env as RefundRuntime));
  const raw=await request.text();if(raw.length>6000)throw new SignupError('Request too large.',413);
  let input;try{input=JSON.parse(raw);}catch{throw new SignupError('Invalid request.');}
  if(!input||typeof input!=='object'||Array.isArray(input))throw new SignupError('Choose a recovery action.');
  return reply(await operateBookingRefund(env.DB,{userId,email,operations:true,owner:principal.owner},input,request.headers,env as RefundRuntime));
 }catch(e){return e instanceof SignupError||e instanceof PilotAccessError?reply({error:e.message},e.status):reply({error:'Refund evidence or authority changed. Keep the original reference held and refresh.'},409);}
}

export const GET=POST;
