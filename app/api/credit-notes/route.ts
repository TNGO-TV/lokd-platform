import {env} from 'cloudflare:workers';
import {SignupError} from '../../lib/signup-server';
import {PilotAccessError,principalForEmail,principalHasRole,requirePilotApiRole,requireSameOriginJson} from '../../lib/pilot-runtime';
import {workspaceRoleForHost} from '../../lib/public-site';
import {operateCreditNote,readCreditNotes} from '../../lib/credit-notes';
export const dynamic='force-dynamic';
const headers={'cache-control':'private, no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
export async function POST(request:Request){try{
 if(request.method!=='GET')requireSameOriginJson(request);
 const userId=request.headers.get('x-lokd-verified-user-id'),email=request.headers.get('x-lokd-verified-email');if(!userId||!email)throw new SignupError('Sign in to your account.',401);
 const url=new URL(request.url),operations=url.searchParams.get('scope')==='operations',host=workspaceRoleForHost(url.hostname),principal=principalForEmail(email);
 if(operations){if(host&&host!=='operations'||!principalHasRole(principal,'operations'))throw new SignupError('Operations access required.',403);requirePilotApiRole(request,'operations');}
 else if(host==='operations'||host==='officer')throw new SignupError('Choose the client or Operations credit scope.',403);
 if(!env.DB)throw new SignupError('Storage unavailable.',503);
 const actor={userId,email,operations,owner:operations&&principal.owner};
 if(request.method==='GET')return Response.json(await readCreditNotes(env.DB,actor,request.headers,url.searchParams.get('invoiceId')??''),{headers});
 if(!operations)throw new SignupError('Operations access required.',403);
 const raw=await request.text();if(raw.length>8000)throw new SignupError('Request too large.',413);let input;try{input=JSON.parse(raw);}catch{throw new SignupError('Invalid JSON.');}if(!input||typeof input!=='object'||Array.isArray(input))throw new SignupError('Choose a credit action.');
 return Response.json(await operateCreditNote(env.DB,actor,input,request.headers),{headers});
}catch(e){return Response.json({error:e instanceof SignupError||e instanceof PilotAccessError?e.message:'Credit source or authority changed. Refresh and review.'},{status:e instanceof SignupError||e instanceof PilotAccessError?e.status:409,headers});}}
export const GET=POST;
