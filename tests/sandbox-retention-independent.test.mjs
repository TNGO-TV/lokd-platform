import test from 'node:test';
import assert from 'node:assert/strict';
import {sandboxApplicant} from './fixtures/sandbox-completion.mjs';
import {checker} from './fixtures/production-identity-journey.mjs';
import {installFixtureClock} from './fixtures/fixture-clock.mjs';
import {createSandboxCapture,sandboxIdentityProvider} from '../app/lib/sandbox-identity.ts';
import {startProductionIdentity} from '../app/lib/production-identity.ts';
import {purgeSandboxEvidence} from '../app/lib/sandbox-retention.ts';
import {sandboxCompletionPolicy} from '../app/lib/sandbox-completion-policy.ts';
test('independent retention concurrent purge preserves one audit and denies alternate-key replacement or forged purge time',async context=>{
 const x=await sandboxApplicant();try{const clock=installFixtureClock(context,x.db.sql),now=Date.now();const capture=await createSandboxCapture(x.runtime,x.actor,{applicantId:x.caseId,applicantVersion:1,consentVersion:sandboxCompletionPolicy.consentVersion,consented:true,scenario:'verified'});await startProductionIdentity(x.db,x.actor,{applicantId:x.caseId,applicantVersion:1,captureReference:capture.captureReference,consentVersion:capture.consentVersion},await sandboxIdentityProvider(x.runtime));const o=x.db.sql.prepare('SELECT * FROM sandbox_identity_objects').get(),c=x.db.sql.prepare('SELECT captured_at FROM sandbox_identity_captures').get(),p=x.db.sql.prepare('SELECT * FROM sandbox_retention_policy').get();clock.set(now+31*86400000);
 const args=[o.case_id,o.reference,o.sha256,Buffer.byteLength(o.body),c.captured_at,o.expires_at,p.retention_days,p.policy_hash,checker.userId,new Date(Date.now()+120000).toISOString()];assert.throws(()=>x.db.sql.prepare('INSERT INTO sandbox_evidence_retention VALUES(?,?,?,?,?,?,?,?,?,?)').run(...args),/deadline/);assert.equal(x.db.sql.prepare('SELECT body FROM sandbox_identity_objects').get().body,o.body);
 const results=await Promise.allSettled([purgeSandboxEvidence(x.runtime,checker,1),purgeSandboxEvidence(x.runtime,checker,1)]);assert.ok(results.some(r=>r.status==='fulfilled'&&r.value.purged===1));assert.equal(x.db.sql.prepare('SELECT count(*) n FROM sandbox_evidence_retention').get().n,1);assert.equal(x.db.sql.prepare('SELECT body FROM sandbox_identity_objects').get().body,'');assert.equal((await purgeSandboxEvidence(x.runtime,checker)).purged,0);
 assert.throws(()=>x.db.sql.exec("INSERT OR REPLACE INTO sandbox_evidence_retention SELECT 'different-case',reference,sha256,payload_bytes,captured_at,expires_at,retention_days,policy_hash,actor_id,purged_at FROM sandbox_evidence_retention"),/invalid/);
 assert.throws(()=>x.db.sql.exec("INSERT OR REPLACE INTO sandbox_identity_objects SELECT 'different-case',reference,'restored',sha256,expires_at,policy_version FROM sandbox_identity_objects"),/immutable/);
 assert.throws(()=>x.db.sql.exec('INSERT OR REPLACE INTO sandbox_retention_policy SELECT * FROM sandbox_retention_policy'),/immutable/);assert.equal(x.db.sql.prepare('SELECT count(*) n FROM sandbox_evidence_retention').get().n,1);assert.equal(x.db.sql.prepare('SELECT body FROM sandbox_identity_objects').get().body,'');
 }finally{x.close();}
});
