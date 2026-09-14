import {env} from 'cloudflare:workers';
import {SignupError} from '../../lib/signup-server';
import {PilotAccessError,principalForEmail,principalHasRole,requirePilotApiRole,requireSameOriginJson} from '../../lib/pilot-runtime';
import {workspaceRoleForHost} from '../../lib/public-site';
import {preparePayrollCorrectionReview,decidePayrollCorrectionReview,readPayrollCorrectionReviews} from '../../lib/payroll-correction-reviews';
export const dynamic='force-dynamic';
const headers={'cache-control':'private, no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
export async function POST(request:Request){try{
 if(request.method!=='GET')requireSameOriginJson(request);
 const userId=request.headers.get('x-lokd-verified-user-id'),email=request.headers.get('x-lokd-verified-email');if(!userId||!email)throw new SignupError('Sign in to your account.',401);
 const url=new URL(request.url),host=workspaceRoleForHost(url.hostname),principal=principalForEmail(email);
 if(host&&host!=='operations'||!principalHasRole(principal,'operations'))throw new SignupError('Operations access required.',403);requirePilotApiRole(request,'operations');
 if(!env.DB)throw new SignupError('Storage unavailable.',503);
 const actor={userId,email,operations:true,owner:principal.owner};
 if(request.method==='GET')return Response.json(await readPayrollCorrectionReviews(env.DB,actor,request.headers,url.searchParams.get('itemId'),Number(url.searchParams.get('after')??0),Number(url.searchParams.get('pageSize')??25)),{headers});
 const raw=await request.text();if(raw.length>6000)throw new SignupError('Request too large.',413);let input;try{input=JSON.parse(raw);}catch{throw new SignupError('Invalid JSON.');}if(!input||typeof input!=='object'||Array.isArray(input))throw new SignupError('Choose a correction review action.');
 if(input.action==='prepare')return Response.json(await preparePayrollCorrectionReview(env.DB,actor,input,request.headers),{headers});
 if(input.action==='decide')return Response.json(await decidePayrollCorrectionReview(env.DB,actor,input,request.headers),{headers});
 throw new SignupError('This endpoint only records and reviews correction requests.');
}catch(e){return Response.json({error:e instanceof SignupError||e instanceof PilotAccessError?e.message:'The payroll records or reviewer permissions changed. Refresh and review.'},{status:e instanceof SignupError||e instanceof PilotAccessError?e.status:409,headers});}}
export const GET=POST;
