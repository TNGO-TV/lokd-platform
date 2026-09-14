import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
export const sandboxCompletionPolicy=Object.freeze({version:'lokd-sandbox-completion-v1',environment:'sandbox',fictional:true,consentVersion:'lokd-sandbox-consent-v1',captureMinutes:1440,evidenceHours:24,retentionDays:30,weeklyHours:{direct_flex:24,managed:48,partner:48},minimumRestHours:8,trainingPassPercent:80,trainingQualificationDays:90,presenceSeconds:180,scanMaxAgeSeconds:120,scanRadiusMetres:150,incidentSlaMinutes:{low:240,medium:60,high:15,critical:5},scenarios:['verified','declined','no_record','manual_review','pending','lost_response','outage','wrong_person','stale'] as const});
export type SandboxRuntime={DB?:D1Database;SANDBOX_DB?:D1Database;LOKD_APP_STAGE?:string;LOKD_SANDBOX_COMPLETION_ENABLED?:string;LOKD_SANDBOX_POLICY_JSON?:string};
export async function requireSandboxCompletion(runtime:SandboxRuntime){
 if(runtime.LOKD_APP_STAGE!=='prelaunch'||runtime.LOKD_SANDBOX_COMPLETION_ENABLED!=='true'||!runtime.DB||!runtime.SANDBOX_DB||runtime.DB===runtime.SANDBOX_DB)throw new SignupError('Isolated sandbox completion is disabled.',423);
 // Reject aliases of a marked sandbox database as the primary binding too.
 const primaryMarked=await runtime.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sandbox_completion_instance'").first();
 if(primaryMarked)throw new SignupError('Sandbox database cannot be the primary application database.',423);
 const db=runtime.SANDBOX_DB,policy=resolveSandboxPolicy(runtime.LOKD_SANDBOX_POLICY_JSON),policyHash=await agreementHash(JSON.stringify(policy));
 const marker=await db.prepare('SELECT * FROM sandbox_completion_instance WHERE singleton=1').first<{mode:string;policy_version:string;policy_hash:string}>();
 if(marker?.mode!=='sandbox'||marker.policy_version!==sandboxCompletionPolicy.version||marker.policy_hash!==policyHash)throw new SignupError('Version-bound sandbox installation required.',423);
 return {db,policy,policyHash};
}

export function resolveSandboxPolicy(raw?:string){
 if(!raw)return sandboxCompletionPolicy;
 let overrides:Record<string,unknown>;try{overrides=JSON.parse(raw);}catch{throw new SignupError('Invalid sandbox policy JSON.',423);}
 if(!overrides||Array.isArray(overrides)||typeof overrides!=='object')throw new SignupError('Invalid sandbox policy.',423);
 const limits:Record<string,[number,number]>={captureMinutes:[1,1440],evidenceHours:[1,168],retentionDays:[1,90],trainingPassPercent:[50,100],trainingQualificationDays:[1,365],scanMaxAgeSeconds:[1,120],scanRadiusMetres:[10,500]};
 for(const [key,value] of Object.entries(overrides)){const bound=limits[key];if(!bound||!Number.isSafeInteger(value)||Number(value)<bound[0]||Number(value)>bound[1])throw new SignupError('Unsupported sandbox policy value.',423);}
 return Object.freeze({...sandboxCompletionPolicy,...overrides}) as typeof sandboxCompletionPolicy;
}
