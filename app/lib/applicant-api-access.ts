import {SignupError} from './signup-server';
import {principalForEmail,principalHasRole,requirePilotApiRole} from './pilot-runtime';
import {workspaceRoleForHost} from './public-site';
export function applicantApiActor(request:Request,operations=false){
 const id=request.headers.get('x-lokd-verified-user-id'),email=request.headers.get('x-lokd-verified-email');
 if(!id||!email)throw new SignupError('Sign in to your account.',401);
 const hostRole=workspaceRoleForHost(new URL(request.url).hostname);
 if(hostRole&&hostRole!==(operations?'operations':'officer'))throw new SignupError('Open the correct workspace.',403);
 if(operations){if(!principalHasRole(principalForEmail(email),'operations'))throw new SignupError('Operations access required.',403);requirePilotApiRole(request,'operations');}
 return {id,email};
}
export async function applicantSubject(db:D1Database,caseId:string){const r=await db.prepare("SELECT owner_user_id FROM signup_cases WHERE kind='officer' AND source_id=?").bind(caseId).first<{owner_user_id:string|null}>();if(!r?.owner_user_id)throw new SignupError('No linked applicant.',404);return r.owner_user_id;}
