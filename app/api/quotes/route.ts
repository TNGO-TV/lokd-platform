import {env} from 'cloudflare:workers';
import {SignupError} from '../../lib/signup-server';
import {PilotAccessError,principalForEmail,principalHasRole,requirePilotApiRole,requireSameOriginJson} from '../../lib/pilot-runtime';
import {workspaceRoleForHost} from '../../lib/public-site';
import {readRequestText,RequestBodyError} from '../../lib/request-body';
import {uploadTerms,manageTerms,issueQuote,acceptQuote,cancelQuote,readQuotes,quoteFile} from '../../lib/quote-acceptance';
export const dynamic='force-dynamic';
const headers={'cache-control':'private, no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers});
function actor(request:Request){
 const url=new URL(request.url),operations=url.searchParams.get('scope')==='operations',userId=request.headers.get('x-lokd-verified-user-id'),email=request.headers.get('x-lokd-verified-email');
 if(!userId||!email)throw new SignupError('Sign in to your account.',401);
 const host=workspaceRoleForHost(url.hostname);if(host&&host!==(operations?'operations':'client'))throw new SignupError('Open the correct workspace.',403);
 const principal=principalForEmail(email);if(operations){if(!principalHasRole(principal,'operations'))throw new SignupError('Operations access required.',403);requirePilotApiRole(request,'operations');}
 return {userId,email,operations,owner:operations&&principal.owner};
}
const fail=(e:unknown)=>e instanceof SignupError||e instanceof PilotAccessError||e instanceof RequestBodyError?reply({error:e.message},e.status):reply({error:'The quote action could not be completed. Refresh before retrying.'},409);
export async function GET(request:Request){try{
 const a=actor(request);if(!env.DB||!env.BUCKET)throw new SignupError('Quote storage unavailable.',503);
 const id=new URL(request.url).searchParams.get('file');
 if(id){const {bytes,t}=await quoteFile(env.DB,env.BUCKET,a,id);return new Response(bytes,{headers:{...headers,'content-type':'application/pdf','content-disposition':`attachment; filename="${t.id}.pdf"`,'content-security-policy':"default-src 'none'; sandbox",'x-content-sha256':t.file_hash}});}
 return reply(await readQuotes(env.DB,a));
 }catch(e){return fail(e);}}
export async function POST(request:Request){try{
 requireSameOriginJson(request);const a=actor(request);if(!env.DB||!env.BUCKET)throw new SignupError('Quote storage unavailable.',503);
 // Large uploads are accepted only from Operations, never anonymous or client requests.
 const raw=await readRequestText(request,a.operations?6_800_000:5000);let b;try{b=JSON.parse(raw);}catch{throw new SignupError('Invalid request.');}
 if(!b||typeof b!=='object'||Array.isArray(b))throw new SignupError('Invalid request.');
 let result;
 if(b.action==='upload_terms')result=await uploadTerms(env.DB,env.BUCKET,a,b);
 else if(['approve_terms','withdraw_terms'].includes(b.action))result=await manageTerms(env.DB,env.BUCKET,a,b);
 else if(b.action==='issue')result=await issueQuote(env.DB,env.BUCKET,a,b);
 else if(b.action==='accept')result=await acceptQuote(env.DB,env.BUCKET,a,b);
 else if(b.action==='cancel')result=await cancelQuote(env.DB,a,b);
 else throw new SignupError('Choose a supported quote action.');
 return reply({result,...await readQuotes(env.DB,a)});
 }catch(e){return fail(e);}}
