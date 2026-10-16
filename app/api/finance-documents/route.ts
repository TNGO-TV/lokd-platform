import {workspaceCommandReceipt} from '../../lib/workspace-command-receipt';
import {readFinanceText} from '../../lib/finance-body';
import {env} from 'cloudflare:workers';
import {SignupError} from '../../lib/signup-server';
import {PilotAccessError,principalForEmail,principalHasRole,requirePilotApiRole,requireSameOriginJson} from '../../lib/pilot-runtime';
import {workspaceRoleForHost} from '../../lib/public-site';
import {prepareFinanceDocument,decideFinanceDocument,readFinanceDocuments,renderFinanceDocument,financeDocumentReport,prepareDocumentInvoice} from '../../lib/finance-documents';
export const dynamic='force-dynamic';
const headers={'cache-control':'private, no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
function actor(request:Request){
 const userId=request.headers.get('x-lokd-verified-user-id'),email=request.headers.get('x-lokd-verified-email');if(!userId||!email)throw new SignupError('Sign in to your account.',401);
 const url=new URL(request.url),operations=url.searchParams.get('scope')==='operations',host=workspaceRoleForHost(url.hostname),principal=principalForEmail(email);
 if(operations){if(host&&host!=='operations'||!principalHasRole(principal,'operations'))throw new SignupError('Operations access required.',403);requirePilotApiRole(request,'operations');}
 else if(host==='operations')throw new SignupError('Choose the Operations document scope.',403);
 return {userId,email,operations,owner:operations&&principal.owner};
}
const fail=(e:unknown)=>Response.json({error:e instanceof SignupError||e instanceof PilotAccessError?e.message:'Document evidence or authority changed. Refresh and review.'},{status:e instanceof SignupError||e instanceof PilotAccessError?e.status:409,headers});
export async function GET(request:Request){try{const a=actor(request);if(!env.DB)throw new SignupError('Storage unavailable.',503);const url=new URL(request.url),id=url.searchParams.get('documentId')??undefined,data=await readFinanceDocuments(env.DB,a,request.headers,id);
 const host=workspaceRoleForHost(url.hostname);if(!a.operations&&host){data.documents=data.documents.filter(d=>host==='officer'?d.kind==='payslip':d.kind!=='payslip');if(id&&!data.documents.length)throw new SignupError('Private document not found in this workspace.',404);}
 if(url.searchParams.get('download')==='document'){if(!id)throw new SignupError('Choose an issued document.');return new Response(renderFinanceDocument(data.documents[0]),{headers:{...headers,'content-type':'text/html; charset=utf-8','content-disposition':'attachment; filename=lokd-finance-document.html','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"}});}
 if(url.searchParams.get('download')==='report')return new Response(financeDocumentReport(data),{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename=lokd-finance-report.csv'}});
 return Response.json(data,{headers});}catch(e){return fail(e);}}
export async function POST(request:Request){try{requireSameOriginJson(request);const a=actor(request);if(!a.operations)throw new SignupError('Operations access required.',403);if(!env.DB)throw new SignupError('Storage unavailable.',503);const raw=await readFinanceText(request,8000);let input;try{input=JSON.parse(raw);}catch{throw new SignupError('Invalid JSON.');}if(!input||typeof input!=='object'||Array.isArray(input))throw new SignupError('Choose a document action.');
 const result=input.action==='prepare_document'?await prepareFinanceDocument(env.DB,a,input,request.headers):input.action==='decide_document'?await decideFinanceDocument(env.DB,a,input,request.headers):input.action==='prepare_invoice_source'?await prepareDocumentInvoice(env.DB,a,input,request.headers):null;if(!result)throw new SignupError('Choose a supported document action.');return Response.json({...result,commandReceipt:await workspaceCommandReceipt('finance-documents',input)},{headers});}catch(e){return fail(e);}}
