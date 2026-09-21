import {SignupError} from './signup-server';
import {member,sandbox,type FinanceActor,type FinanceRuntime,type RecordRow} from './finance-workflow-store';
export async function readFinanceWorkspaces(db:D1Database,a:FinanceActor,r:FinanceRuntime){
 sandbox(r);const rows=(await db.prepare("SELECT w.id,m.role,m.version,m.limit_cents FROM finance_workspaces w JOIN finance_current_members m ON m.workspace_id=w.id WHERE m.user_id=? AND m.active=1 ORDER BY w.id").bind(a.userId).all<{id:string;role:string;version:number;limit_cents:number}>()).results;
 return {environment:'sandbox',workspaces:rows.filter(m=>!['preparer','reviewer'].includes(m.role)||a.operations)};
}
export async function readFinanceCapabilities(db:D1Database,a:FinanceActor,r:FinanceRuntime,workspace:string){
 sandbox(r);const m=await member(db,workspace,a);return {environment:'sandbox',workspace,member:{userId:m.user_id,role:m.role,version:m.version,limitCents:m.limit_cents},canPrepare:m.role==='preparer',canReview:m.role==='reviewer',canOrder:['officer','client'].includes(m.role),canBootstrap:a.operations&&a.owner===true};
}
export async function readFinanceReviewQueue(db:D1Database,a:FinanceActor,r:FinanceRuntime,workspace:string,after?:string){
 sandbox(r);const m=await member(db,workspace,a);if(!['preparer','reviewer'].includes(m.role))throw new SignupError('Finance review access required.',403);
 const cursor=after?await db.prepare('SELECT created_at,id FROM finance_workflow_commands WHERE workspace_id=? AND id=?').bind(workspace,after).first<{created_at:string;id:string}>():null;if(after&&!cursor)throw new SignupError('Invalid review cursor.',400);
 const rows=(await db.prepare(`SELECT c.* FROM finance_workflow_commands c LEFT JOIN finance_command_applications d ON d.command_id=c.id WHERE c.workspace_id=? AND d.command_id IS NULL ${cursor?'AND (c.created_at>? OR (c.created_at=? AND c.id>?))':''} ORDER BY c.created_at,c.id LIMIT 101`).bind(workspace,...(cursor?[cursor.created_at,cursor.created_at,cursor.id]:[])).all<{id:string}>()).results;
 return {environment:'sandbox',commands:rows.slice(0,100),nextCommandAfter:rows.length>100?rows[99].id:null};
}
export async function readFinanceOperationEvidence(db:D1Database,a:FinanceActor,r:FinanceRuntime,workspace:string,id:string,after=0){
 sandbox(r);const m=await member(db,workspace,a);if(!['preparer','reviewer'].includes(m.role))throw new SignupError('Finance evidence review access required.',403);if(!Number.isSafeInteger(after)||after<0)throw new SignupError('Invalid evidence cursor.',400);
 const operation=await db.prepare("SELECT * FROM finance_current_records WHERE workspace_id=? AND id=? AND kind='operation'").bind(workspace,id).first<RecordRow>();if(!operation)throw new SignupError('Payment operation not found.',404);
 const evidence=(await db.prepare('SELECT * FROM finance_provider_evidence WHERE workspace_id=? AND operation_id=? AND sequence>? ORDER BY sequence LIMIT 101').bind(workspace,id,after).all<{sequence:number}>()).results;
 const claims=(await db.prepare('SELECT attempt,reference,provider_mode,created_at FROM finance_provider_claims WHERE workspace_id=? AND operation_id=? ORDER BY attempt DESC LIMIT 100').bind(workspace,id).all()).results;
 return {environment:'sandbox',operation:{...operation,data:JSON.parse(operation.data_json)},claims,evidence:evidence.slice(0,100),nextEvidenceAfter:evidence.length>100?evidence[99].sequence:null};
}
