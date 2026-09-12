import {SignupError,type SignupActor} from './signup-server';
import {agreementHash} from './agreement-acceptance';
export const TEST_DOCUMENT_VERSION='test-journey-20260912-v1';
export type AgreementKind='client'|'officer';
export type Envelope={id:string;kind:AgreementKind;case_id:string;owner_user_id:string;case_version:number;document_version:string;wording:string;content_hash:string;context_hash:string;state:string;revision:number;expires_at:string;signed_by:string|null;signer_name:string|null;signed_at:string|null;note:string};
export async function agreementCase(db:D1Database,actor:SignupActor,kind:unknown,id:unknown){
 if(!['client','officer'].includes(String(kind))||typeof id!=='string'||id.length>100)throw new SignupError('Choose your linked submission.');
 const table=kind==='client'?'client_enquiries':'officer_applications';
 const c=await db.prepare(`SELECT c.* FROM signup_cases c JOIN ${table} s ON s.id=c.source_id WHERE c.kind=? AND c.source_id=? AND s.environment='prelaunch' AND s.integrity_state='user_submitted'`).bind(kind,id).first<{owner_user_id:string;source_id:string;kind:AgreementKind;version:number;status:string}>();
 if(!c?.owner_user_id||!actor.operations&&c.owner_user_id!==actor.userId)throw new SignupError('Linked submission not found for this account.',404);return c;
}
export async function readTestAgreements(db:D1Database,actor:SignupActor,kind:unknown,id:unknown){
 const c=await agreementCase(db,actor,kind,id);
 const rows=await db.prepare('SELECT * FROM test_agreement_envelopes WHERE kind=? AND case_id=? AND owner_user_id=? ORDER BY issued_at DESC LIMIT 50').bind(c.kind,c.source_id,c.owner_user_id).all<Envelope>();
 const events=await db.prepare('SELECT e.envelope_id,e.snapshot,e.recorded_at FROM test_agreement_events e JOIN test_agreement_envelopes a ON a.id=e.envelope_id WHERE a.kind=? AND a.case_id=? AND a.owner_user_id=? ORDER BY e.rowid DESC LIMIT 100').bind(c.kind,c.source_id,c.owner_user_id).all();
 return {caseVersion:c.version,withdrawn:c.status==='withdrawn',documents:rows.results.map(r=>({...r,usable:c.status!=='withdrawn'&&r.case_version===c.version&&Date.parse(r.expires_at)>Date.now(),stale:r.case_version!==c.version})),events:events.results,mode:'test',liveAgreement:false,workEligible:false};
}
function note(value:unknown){if(typeof value!=='string'||value.trim().length<12||value.length>1200)throw new SignupError('Add a specific review note of 12–1200 characters.');return value.trim();}
export async function writeTestAgreement(db:D1Database,actor:SignupActor,input:Record<string,unknown>){
 const c=await agreementCase(db,actor,input.kind,input.caseId),now=new Date().toISOString();
 if(c.status==='withdrawn')throw new SignupError('This submission is withdrawn. Its document history is read-only.',409);
 if(input.caseVersion!==c.version)throw new SignupError('Submission changed. Refresh before continuing.',409);
 if(input.action==='issue'){
  if(!actor.operations||actor.userId===c.owner_user_id)throw new SignupError('Another Operations reviewer must issue this test agreement.',403);
  const previous=await db.prepare('SELECT * FROM test_agreement_envelopes WHERE kind=? AND case_id=? AND case_version=? ORDER BY issued_at DESC,rowid DESC LIMIT 1').bind(c.kind,c.source_id,c.version).first<Envelope>();
  if(previous&&previous.state!=='cancelled'&&Date.parse(previous.expires_at)>Date.now())return readTestAgreements(db,actor,c.kind,c.source_id);
  const count=await db.prepare('SELECT count(*) AS n FROM test_agreement_envelopes WHERE kind=? AND case_id=? AND case_version=?').bind(c.kind,c.source_id,c.version).first<{n:number}>();
  if((count?.n??0)>=20)throw new SignupError('Reissue limit reached. Operations review required.',409);
  const documentVersion=TEST_DOCUMENT_VERSION+'-issue-'+((count?.n??0)+1);
  const wording=`LOKD TEST AGREEMENT — NOT A LIVE CONTRACT\nVersion: ${documentVersion}\nPath: ${c.kind}\nSubmission: ${c.source_id}\nSubmission version: ${c.version}\n\nThis document tests account delivery, reading, affirmative signing, review and cancellation. It does not employ anyone, order a security service, approve training, authorise a charge or permit work. No real commercial or legal terms are supplied here.\n\nBy signing, I confirm that I am testing this document through my own LOKD account. Operations reviews the test evidence separately. Approved legal documents and the required identity and authority checks must replace this fixture before live use.`;
  const contentHash=await agreementHash(wording),contextHash=await agreementHash(JSON.stringify({kind:c.kind,caseId:c.source_id,owner:c.owner_user_id,version:c.version,documentVersion,mode:'test'}));
  const reason=note(input.note);
  await db.prepare(`INSERT OR IGNORE INTO test_agreement_envelopes(id,kind,case_id,owner_user_id,case_version,document_version,wording,content_hash,context_hash,state,revision,issued_by,issued_at,expires_at,note,updated_at)
   SELECT ?,?,?,?,?,?,?,?,?,'issued',1,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM signup_cases WHERE kind=? AND source_id=? AND version=? AND status!='withdrawn')`).bind(crypto.randomUUID(),c.kind,c.source_id,c.owner_user_id,c.version,documentVersion,wording,contentHash,contextHash,actor.userId,now,new Date(Date.now()+7*86400000).toISOString(),reason,now,c.kind,c.source_id,c.version).run();
  return readTestAgreements(db,actor,c.kind,c.source_id);
 }
 const e=await db.prepare('SELECT * FROM test_agreement_envelopes WHERE id=? AND kind=? AND case_id=? AND owner_user_id=?').bind(typeof input.envelopeId==='string'?input.envelopeId:'',c.kind,c.source_id,c.owner_user_id).first<Envelope>();
 if(!e)throw new SignupError('Test document not found.',404);
 if(e.case_version!==c.version||e.revision!==input.expectedRevision)throw new SignupError('Document or submission changed. Refresh.',409);
 let fields:string,values:unknown[];
 if(input.action==='sign'){
  if(actor.operations||actor.userId!==e.owner_user_id)throw new SignupError('Only the named account holder can sign.',403);
  if(e.state!=='issued'||Date.parse(e.expires_at)<=Date.now())throw new SignupError('This document is no longer open for signing.',409);
  if(input.affirmative!==true||input.testAcknowledged!==true||input.contentHash!==e.content_hash||input.contextHash!==e.context_hash||await agreementHash(e.wording)!==e.content_hash)throw new SignupError('Read and acknowledge the exact current test document.');
  if(typeof input.signerName!=='string'||input.signerName.trim().length<3||input.signerName.length>100)throw new SignupError('Enter your name for the test signing record.');
  fields="state='signed_test',signed_by=?,signer_name=?,signed_at=?,note=?";values=[actor.userId,input.signerName.trim(),now,'Account-bound test signature recorded; Operations review pending.'];
 }else if(input.action==='review'){
  if(!actor.operations||actor.userId===c.owner_user_id)throw new SignupError('An independent Operations reviewer is required.',403);
  if(e.state!=='signed_test'||Date.parse(e.expires_at)<=Date.now()||input.identityAndAuthorityReviewed!==true)throw new SignupError('Review the test signer and authority evidence before accepting the test.',409);
  fields="state='reviewed_test',reviewed_by=?,reviewed_at=?,note=?";values=[actor.userId,now,note(input.note)];
 }else if(input.action==='cancel'){
  if(!['issued','signed_test','reviewed_test'].includes(e.state))throw new SignupError('This document is already closed.',409);
  fields="state='cancelled',note=?";values=[`Cancelled by ${actor.userId}: ${note(input.note)}`];
 }else throw new SignupError('Choose a valid document action.');
 const changed=await db.prepare(`UPDATE test_agreement_envelopes SET ${fields},revision=revision+1,updated_at=? WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM signup_cases WHERE kind=? AND source_id=? AND version=? AND status!='withdrawn')`).bind(...values,now,e.id,e.revision,c.kind,c.source_id,c.version).run();
 if(!changed.meta.changes)throw new SignupError('Another update completed. Refresh; the action was not repeated.',409);
 return readTestAgreements(db,actor,c.kind,c.source_id);
}
