import {workspaceCommandReceipt} from '../../lib/workspace-command-receipt';
import {readRequestText, RequestBodyError} from '../../lib/request-body';
import { env } from 'cloudflare:workers';
import { principalForEmail, principalHasRole, requirePilotApiRole, requireSameOriginJson, PilotAccessError } from '../../lib/pilot-runtime';
import { workspaceRoleForHost } from '../../lib/public-site';
import { readSignupRecords, writeSignup, SignupError, type SignupActor } from '../../lib/signup-server';
export const dynamic='force-dynamic';
function actor(request:Request):SignupActor {
  const userId=request.headers.get('x-lokd-verified-user-id'),email=request.headers.get('x-lokd-verified-email');
  if(!userId||!email)throw new SignupError('Sign in to view your submissions.',401);
  const url=new URL(request.url),scope=url.searchParams.get('scope'),hostRole=workspaceRoleForHost(url.hostname);
  if(!['client','officer','operations'].includes(scope??''))throw new SignupError('Choose a workspace.');
  if(hostRole && hostRole!==scope)throw new SignupError('Open the correct workspace for this request.',403);
  const operations=scope==='operations';
  if(operations) {
    if(!principalHasRole(principalForEmail(email),'operations'))throw new SignupError('Operations access is required.',403);
    requirePilotApiRole(request,'operations');
  }
  return {userId,email,operations};
}
function kind(request:Request,operations:boolean) {
  const url=new URL(request.url);const value=url.searchParams.get(operations?'kind':'scope');
  if(value!=='client'&&value!=='officer')throw new SignupError('Choose Client or Officer intake.');return value;
}
function reply(value:unknown,status=200){return Response.json(value,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});}
function failure(error:unknown){return error instanceof SignupError||error instanceof RequestBodyError || error instanceof PilotAccessError?reply({error:error.message},error.status):reply({error:'Your submissions could not be loaded or saved. Please try again.'},503);}
export async function GET(request:Request){try{
 const user=actor(request);if(!env.DB)throw new SignupError('Submission storage is unavailable.',503);
 const offset=Number(new URL(request.url).searchParams.get('offset')??0);
 if(!Number.isSafeInteger(offset)||offset<0||offset>100000)throw new SignupError('Choose a valid page.');
 return reply({...await readSignupRecords(env.DB,user,kind(request,user.operations),offset),email:user.email});
}catch(error){return failure(error);}}
export async function POST(request:Request){try{
 requireSameOriginJson(request);const user=actor(request);const selectedKind=kind(request,user.operations);
 if(!env.DB)throw new SignupError('Submission storage is unavailable.',503);
 const raw = await readRequestText(request, 12000);
 let body;try{body=JSON.parse(raw);}catch{throw new SignupError('Submit a valid update.');}
 if(!body||typeof body!=='object'||Array.isArray(body)||body.kind!==selectedKind)throw new SignupError('Choose the correct intake.');
 await writeSignup(env.DB,user,body);return reply({ok:true,commandReceipt:await workspaceCommandReceipt('signup',body)});
}catch(error){return failure(error);}}
