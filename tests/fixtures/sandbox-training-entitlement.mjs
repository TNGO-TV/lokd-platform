import {SignupError} from '../../app/lib/signup-server.ts';
import {requireSandboxCompletion} from '../../app/lib/sandbox-completion-policy.ts';
import {agreementHash} from '../../app/lib/agreement-acceptance.ts';
const text=v=>{if(typeof v!=='string'||!v.trim())throw Error('fixture reference');return v;};
// Deliberately unavailable to application routes: isolated qualification-policy fixture only.
export async function fixtureTrainingEntitlement(runtime,actor,input){const {db,policy}=await requireSandboxCompletion(runtime);

  if(!actor.owner)throw new SignupError('An owner records the isolated commercial boundary.',403);
  const officer=await db.prepare("SELECT l.owner_user_id,l.case_version FROM production_entity_links l JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.status='reviewed' WHERE l.kind='officer' AND l.entity_id=?").bind(text(input.officerId)).first();
  if(!officer||officer.owner_user_id===actor.userId)throw new SignupError('A current independently linked officer is required.',409);
  const source={contract:'lokd.training-entitlement.v1',mode:'simulator',officerId:input.officerId,ownerUserId:officer.owner_user_id,applicantVersion:officer.case_version,course:text(input.course),courseVersion:text(input.courseVersion),commercialReference:text(input.commercialReference),policyVersion:policy.version};
  const json=JSON.stringify(source),id=crypto.randomUUID(),expiry=new Date(Date.now()+policy.trainingQualificationDays*86400000).toISOString();
  await db.prepare('INSERT INTO sandbox_training_entitlements VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,input.officerId,officer.owner_user_id,officer.case_version,source.course,source.courseVersion,json,await agreementHash(json),actor.userId,expiry,policy.version).run();return {entitlementId:id,enrolled:true,qualified:false,workEligible:false,mode:'simulator'};

}
