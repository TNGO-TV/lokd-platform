import {env} from 'cloudflare:workers';
import {workspaceRoleForHost} from './public-site';
import {operationsMfaStatus} from './operations-mfa';

export class OfficerAccessError extends Error {
 status:number;
 constructor(message:string,status=400){super(message);this.status=status;}
}
export function requireOfficerJson(request:Request){
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new OfficerAccessError('Use application/json for this request.',415);
 const origin=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
 if(origin&&origin!==new URL(request.url).origin||site&&!['same-origin','none'].includes(site))throw new OfficerAccessError('Open this form in your LOKD workspace.',403);
}
function members(raw:unknown){try{const list=JSON.parse(typeof raw==='string'?raw:'[]');return Array.isArray(list)?list.filter((v):v is string=>typeof v==='string').map(v=>v.trim().toLowerCase()):[];}catch{return [];}}
export function officerApiActor(request:Request,operations=false){
 const userId=request.headers.get('x-lokd-verified-user-id'),email=request.headers.get('x-lokd-verified-email');
 if(!userId||!email)throw new OfficerAccessError('Sign in to your account.',401);
 const role=workspaceRoleForHost(new URL(request.url).hostname);
 if(role&&role!==(operations?'operations':'officer'))throw new OfficerAccessError('Open the correct workspace.',403);
 const runtime=env as unknown as Record<string,unknown>,normal=email.toLowerCase();
 const owner=members(runtime.LOKD_OWNER_ACCESS_JSON).includes(normal);
 if(operations){
  if(!owner&&!members(runtime.LOKD_OPERATIONS_ACCESS_JSON).includes(normal))throw new OfficerAccessError('Operations access required.',403);
  if(!['GET','HEAD','OPTIONS'].includes(request.method)&&runtime.LOKD_OPERATIONS_MFA_REQUIRED!=='false'&&!operationsMfaStatus(request.headers).fresh)throw new OfficerAccessError('Verify your Operations second factor at /ops/security.',403);
 }
 return {userId,email,operations,owner:operations&&owner};
}
