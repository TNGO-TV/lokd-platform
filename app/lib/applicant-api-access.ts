import {SignupError} from './signup-server';
import {officerApiActor} from './officer-api-access';
export function applicantApiActor(request:Request,operations=false){const actor=officerApiActor(request,operations);return {id:actor.userId,email:actor.email};}
export async function applicantSubject(db:D1Database,caseId:string){const r=await db.prepare("SELECT owner_user_id FROM signup_cases WHERE kind='officer' AND source_id=?").bind(caseId).first<{owner_user_id:string|null}>();if(!r?.owner_user_id)throw new SignupError('No linked applicant.',404);return r.owner_user_id;}
