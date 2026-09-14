import {SignupError,type SignupActor} from './signup-server';
import {requireSandboxCompletion,type SandboxRuntime} from './sandbox-completion-policy';
// Maintenance-only invocation; no request-supplied clock or retention duration.
export async function purgeSandboxEvidence(runtime:SandboxRuntime,actor:SignupActor&{owner:boolean},limit=50){
 if(!actor.operations||!actor.owner||!actor.userId||actor.userId.length>300)throw new SignupError('Sandbox retention requires an authorized owner.',403);
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new SignupError('Retention batch size must be 1–100.');
 const {db,policy,policyHash}=await requireSandboxCompletion(runtime);
 const bound=await db.prepare('SELECT policy_hash,retention_days FROM sandbox_retention_policy WHERE singleton=1').first<{policy_hash:string;retention_days:number}>();
 if(!bound||bound.policy_hash!==policyHash||bound.retention_days!==policy.retentionDays)throw new SignupError('Installed retention policy does not match this sandbox.',423);
 const rows=(await db.prepare(`SELECT o.case_id,o.reference,o.sha256,length(CAST(o.body AS BLOB)) AS payload_bytes,c.captured_at,o.expires_at
 FROM sandbox_identity_objects o JOIN sandbox_identity_dispatches d ON d.case_id=o.case_id JOIN sandbox_identity_captures c ON c.id=d.capture_id
 WHERE o.body<>'' AND NOT EXISTS(SELECT 1 FROM sandbox_evidence_retention r WHERE r.case_id=o.case_id)
 AND julianday(o.expires_at)<=julianday('now') AND julianday(c.captured_at,'+'||?||' days')<=julianday('now')
 ORDER BY c.captured_at,o.case_id LIMIT ?`).bind(policy.retentionDays,limit).all<{case_id:string;reference:string;sha256:string;payload_bytes:number;captured_at:string;expires_at:string}>()).results;
 if(!rows.length)return {mode:'simulator',policyVersion:policy.version,policyHash,purged:0,bytesCleared:0,batchLimit:limit,possiblyMore:false};
 const at=new Date().toISOString();await db.batch(rows.map(r=>db.prepare('INSERT INTO sandbox_evidence_retention VALUES(?,?,?,?,?,?,?,?,?,?)').bind(r.case_id,r.reference,r.sha256,r.payload_bytes,r.captured_at,r.expires_at,policy.retentionDays,policyHash,actor.userId,at)));
 return {mode:'simulator',policyVersion:policy.version,policyHash,purged:rows.length,bytesCleared:rows.reduce((n,r)=>n+r.payload_bytes,0),batchLimit:limit,possiblyMore:rows.length===limit};
}
