import {SignupError,type SignupActor} from './signup-server';
import {requireSandboxCompletion,type SandboxRuntime} from './sandbox-completion-policy';
import {sandboxIdentityProvider} from './sandbox-identity';
import type {IdentityEvidenceReader} from './production-identity-evidence-reader';
export async function grantSandboxEvidence(runtime:SandboxRuntime,actor:SignupActor&{owner?:boolean},input:{caseId:string;readerUserId:string}){
 const {db,policy}=await requireSandboxCompletion(runtime);
 const c=await db.prepare('SELECT owner_user_id FROM production_identity_cases WHERE id=?').bind(input.caseId).first<{owner_user_id:string}>();
 if(!actor.operations||!actor.owner||!c||[actor.userId,c.owner_user_id].includes(input.readerUserId)||actor.userId===c.owner_user_id)throw new SignupError('Independent owner grants a separate evidence reader.',403);
 if(!input.readerUserId||input.readerUserId.length>300)throw new SignupError('Choose a reader.');const id=crypto.randomUUID();
 await db.prepare('INSERT INTO sandbox_identity_access VALUES(?,?,?,?,?,?)').bind(id,input.caseId,input.readerUserId,actor.userId,policy.version,new Date(Date.now()+policy.captureMinutes*60000).toISOString()).run();return {grantId:id,policyVersion:policy.version,mode:'simulator'};
}
export async function revokeSandboxEvidence(runtime:SandboxRuntime,actor:SignupActor&{owner?:boolean},grantId:string){const {db}=await requireSandboxCompletion(runtime);if(!actor.operations||!actor.owner)throw new SignupError('Owner access required.',403);await db.prepare('INSERT INTO sandbox_identity_access_revocations VALUES(?,?,?,?)').bind(crypto.randomUUID(),grantId,actor.userId,new Date().toISOString()).run();return {revoked:true};}
export async function sandboxEvidenceReader(runtime:SandboxRuntime):Promise<IdentityEvidenceReader>{const {db,policy}=await requireSandboxCompletion(runtime),provider=await sandboxIdentityProvider(runtime);return {
 source:{provider:provider.key,read:binding=>provider.lookup(binding)},
 async authorize({actor,binding}){await requireSandboxCompletion(runtime);await provider.lookup(binding);const grant=await db.prepare('SELECT id FROM sandbox_identity_access a WHERE case_id=? AND reader_user_id=? AND policy_version=? AND expires_at>? AND NOT EXISTS(SELECT 1 FROM sandbox_identity_access_revocations r WHERE r.grant_id=a.id)').bind(binding.caseId,actor.userId,policy.version,new Date().toISOString()).first<{id:string}>();return {allowed:actor.operations&&!!grant,policyReference:policy.version,decisionReference:grant?.id??'denied'};},
 async open(reference,signal){await requireSandboxCompletion(runtime);if(signal.aborted)throw new SignupError('Read cancelled.',409);const row=await db.prepare("SELECT * FROM sandbox_identity_objects o WHERE reference=? AND policy_version=? AND expires_at>? AND body<>'' AND NOT EXISTS(SELECT 1 FROM sandbox_evidence_retention r WHERE r.case_id=o.case_id)").bind(reference,policy.version,new Date().toISOString()).first<{case_id:string;reference:string;body:string}>();return row?{caseId:row.case_id,reference:row.reference,body:new Response(row.body).body!}:null;},
 };}
