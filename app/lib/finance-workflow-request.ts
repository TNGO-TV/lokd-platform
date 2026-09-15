import {readFinanceText} from './finance-body';
import {agreementHash} from './agreement-acceptance';
import {FINANCE_SANDBOX_POLICY} from './finance-sandbox-policy';
import {sandbox,type FinanceRuntime} from './finance-workflow-store';
import {SignupError} from './signup-server';
export async function readFinanceBody(request:Request,maxBytes:number,timeoutMs=5000){
 if(!request.body)throw new SignupError('Missing request body.');
 return readFinanceText(request,maxBytes,timeoutMs);
}

export async function financeSandboxDatabase(runtime:FinanceRuntime & {DB?:D1Database;SANDBOX_DB?:D1Database;LOKD_APP_STAGE?:string;LOKD_SANDBOX_COMPLETION_ENABLED?:string}){
 sandbox(runtime);
 if(runtime.LOKD_APP_STAGE!=='prelaunch'||runtime.LOKD_SANDBOX_COMPLETION_ENABLED!=='true'||!runtime.DB||!runtime.SANDBOX_DB||runtime.DB===runtime.SANDBOX_DB)throw new SignupError('A separate sandbox database is required.',423);
 const marked=await runtime.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('sandbox_completion_instance','finance_workflow_policies')").all<{name:string}>();
 if(marked.results.some(r=>r.name==='sandbox_completion_instance')||marked.results.some(r=>r.name==='finance_workflow_policies')&&await runtime.DB.prepare('SELECT 1 FROM finance_workflow_policies LIMIT 1').first())throw new SignupError('The primary application database cannot contain sandbox policy data.',423);
 const installed=await runtime.SANDBOX_DB.prepare('SELECT rules_json,digest FROM finance_workflow_policies WHERE version=?').bind(FINANCE_SANDBOX_POLICY.version).first<{rules_json:string;digest:string}>(),expected=JSON.stringify(FINANCE_SANDBOX_POLICY);
 if(!installed||installed.rules_json!==expected||installed.digest!==await agreementHash(expected))throw new SignupError('Install the version-bound finance sandbox policy first.',423);
 return runtime.SANDBOX_DB;
}
