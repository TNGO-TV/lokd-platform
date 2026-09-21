import {SignupError,type SignupActor} from './signup-server';
import {agreementCase,readTestAgreements} from './test-agreements';
import {identityCase} from './applicant-identity';
import {applicationPsiraDeclaration} from './psira-pathway';
import {cycleTransitions,type Cycle} from './test-cycle-types';
export {cycleTransitions,type Cycle} from './test-cycle-types';
async function validBindings(db:D1Database,actor:SignupActor,c:Cycle){
 const operations={...actor,operations:true};
 const client=await readTestAgreements(db,operations,'client',c.client_case_id),officer=await readTestAgreements(db,operations,'officer',c.officer_case_id);
 const match=(d:typeof client,id:string,version:number)=>!d.withdrawn&&d.caseVersion===version&&d.documents.some(e=>e.id===id&&e.usable&&e.state==='reviewed_test');
 if(!match(client,c.client_envelope_id,c.client_version)||!match(officer,c.officer_envelope_id,c.officer_version))return false;
 const identity=await identityCase(db,c.officer_user_id,c.officer_case_id);
 return applicationPsiraDeclaration(identity.pathway,identity.psiraStatus)==='registered';
}
export async function readTestCycles(db:D1Database,actor:SignupActor){
 const rows=await db.prepare(`SELECT * FROM test_operating_cycles ${actor.operations?'':'WHERE client_user_id=? OR officer_user_id=?'} ORDER BY created_at DESC LIMIT 50`).bind(...(actor.operations?[]:[actor.userId,actor.userId])).all<Cycle>();
 const cycles=[];for(const c of rows.results){let bindingCurrent=false;try{bindingCurrent=await validBindings(db,actor,c);}catch{/* Unavailable evidence cannot authorise progress. */}
 const events=await db.prepare('SELECT snapshot,recorded_at FROM test_operating_events WHERE cycle_id=? ORDER BY rowid DESC LIMIT 50').bind(c.id).all();
 cycles.push({...c,bindingCurrent,role:actor.operations?'operations':actor.userId===c.client_user_id?'client':'officer',events:events.results});}
 return {cycles,mode:'test',financialEffect:false,workEligible:false};
}
const boundedNote=(v:unknown)=>{if(typeof v!=='string'||v.trim().length<12||v.length>1200)throw new SignupError('Record specific test evidence (12–1200 characters).');return v.trim();};
export async function writeTestCycle(db:D1Database,actor:SignupActor,input:Record<string,unknown>){
 if(input.testAcknowledged!==true)throw new SignupError('Acknowledge that this is a simulated operating cycle with no real funds or work.');
 const now=new Date().toISOString(),note=boundedNote(input.note);
 if(input.action==='create'){
  if(!actor.operations)throw new SignupError('Operations must prepare the test booking.',403);
  if(typeof input.id!=='string'||!/^test-cycle-[a-f0-9-]{36}$/.test(input.id))throw new SignupError('Use the saved creation reference.');
  const client=await agreementCase(db,actor,'client',input.clientCaseId),officer=await agreementCase(db,actor,'officer',input.officerCaseId);
  if(client.owner_user_id===officer.owner_user_id||[client.owner_user_id,officer.owner_user_id].includes(actor.userId))throw new SignupError('Use independent Client, Officer and Operations accounts.',403);
  if(client.status!=='reviewed'||officer.status!=='reviewed')throw new SignupError('Complete both intake reviews before preparing a test booking.',409);
  const docs=await Promise.all([readTestAgreements(db,actor,'client',client.source_id),readTestAgreements(db,actor,'officer',officer.source_id)]);
  const envelopes=docs.map(d=>d.documents.find(e=>e.usable&&e.state==='reviewed_test'));if(envelopes.some(e=>!e))throw new SignupError('Both parties need a current, independently reviewed test signature.',409);
  if(!Number.isSafeInteger(input.amountMinor)||Number(input.amountMinor)<=0||Number(input.amountMinor)>100000000||!Number.isSafeInteger(input.officerAmountMinor)||Number(input.officerAmountMinor)<=0||Number(input.officerAmountMinor)>Number(input.amountMinor))throw new SignupError('Enter positive test amounts in cents, with officer payment no greater than collection.');
  if(typeof input.siteBrief!=='string'||input.siteBrief.trim().length<20||input.siteBrief.length>1200)throw new SignupError('Provide the exact test site, service and timing brief (20–1200 characters).');
  const identity=await identityCase(db,officer.owner_user_id,officer.source_id);if(applicationPsiraDeclaration(identity.pathway,identity.psiraStatus)!=='registered')throw new SignupError('Training applicants do not enter the officer service cycle.',409);
  const existing=await db.prepare('SELECT * FROM test_operating_cycles WHERE id=?').bind(input.id).first<Cycle&{created_by:string}>();
  if(existing){if(existing.created_by!==actor.userId||existing.client_case_id!==client.source_id||existing.officer_case_id!==officer.source_id||existing.amount_minor!==input.amountMinor||existing.officer_amount_minor!==input.officerAmountMinor||existing.site_brief!==input.siteBrief.trim())throw new SignupError('Creation reference already belongs to different details.',409);return readTestCycles(db,actor);}
  await db.prepare(`INSERT OR IGNORE INTO test_operating_cycles(id,client_case_id,officer_case_id,client_user_id,officer_user_id,client_version,officer_version,client_envelope_id,officer_envelope_id,site_brief,amount_minor,officer_amount_minor,state,revision,created_by,last_actor,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'proposed',1,?,?,?,?,?)`).bind(input.id,client.source_id,officer.source_id,client.owner_user_id,officer.owner_user_id,client.version,officer.version,envelopes[0]!.id,envelopes[1]!.id,input.siteBrief.trim(),input.amountMinor,input.officerAmountMinor,actor.userId,actor.userId,note,now,now).run();
  return readTestCycles(db,actor);
 }
 const c=await db.prepare(`SELECT * FROM test_operating_cycles WHERE id=? ${actor.operations?'':'AND (client_user_id=? OR officer_user_id=?)'}`).bind(typeof input.id==='string'?input.id:'',...(actor.operations?[]:[actor.userId,actor.userId])).first<Cycle>();if(!c)throw new SignupError('Test cycle not found for this account.',404);
 if(c.revision!==input.expectedRevision)throw new SignupError('The cycle changed. Refresh; no action was repeated.',409);
 if(actor.operations&&[c.client_user_id,c.officer_user_id].includes(actor.userId))throw new SignupError('Independent Operations review required.',403);
 let target:string;
 if(input.action==='cancel'){
  if(!actor.operations&&actor.userId!==c.client_user_id)throw new SignupError('Client or Operations must cancel.',403);
  if(!['proposed','accepted','test_funded'].includes(c.state))throw new SignupError('This stage requires service/dispute recovery, not cancellation.',409);
  target=c.state==='test_funded'?'refund_pending':'cancelled';
 }else{
  const transition=cycleTransitions[String(input.action)];if(!transition||!transition.from.includes(c.state))throw new SignupError('That action is not available at this stage.',409);
  const role=actor.operations?'operations':actor.userId===c.client_user_id?'client':'officer';if(role!==transition.role)throw new SignupError('This action belongs to the other participant.',403);
  if(input.action!=='record_test_refund'&&!await validBindings(db,actor,c))throw new SignupError('The application or signed test agreement changed. Resolve the evidence before progressing.',409);
  target=transition.to;
 }
 const changed=await db.prepare('UPDATE test_operating_cycles SET state=?,revision=revision+1,last_actor=?,note=?,updated_at=? WHERE id=? AND revision=?').bind(target,actor.userId,note,now,c.id,c.revision).run();if(!changed.meta.changes)throw new SignupError('Another update completed. Refresh.',409);
 return readTestCycles(db,actor);
}
