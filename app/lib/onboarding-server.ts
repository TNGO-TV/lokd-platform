import {readSignupRecords,SignupError,type SignupActor} from './signup-server';
import {applicationPsiraDeclaration} from './psira-pathway';
import {officerOnboardingChecklist,onboardingSummary} from './onboarding-core';
import type {OnboardingCase,OnboardingScope} from './onboarding-types';

export async function readOnboardingState(db:D1Database,scope:OnboardingScope,actor:SignupActor){
 if(scope==='operations')throw new SignupError('Open the intake queue to review applications.',400);
 const records=await readSignupRecords(db,{...actor,operations:false},scope);
 const cases:OnboardingCase[]=[];
 for(const record of records.records){
  if(record.status==='withdrawn')continue;
  const base={id:record.id,displayName:record.details.fullName??record.details.organisationName??record.id,status:record.status};
  if(scope==='client'){
   cases.push({...base,checklist:[{id:'account',label:'Link your application',status:record.accountLinked?'complete':'required',href:'/signup?kind=client'},{id:'intake',label:'Application review',status:record.status==='reviewed'?'complete':'required',href:'/signup?kind=client'}]});continue;
  }
  const identity=record.accountLinked?await db.prepare('SELECT id FROM current_production_identity_evidence WHERE applicant_id=? AND applicant_version=? AND owner_user_id=?').bind(record.id,record.version,actor.userId).first():null;
  const officer=record.accountLinked?await db.prepare(`SELECT o.id,o.approval_status AS approvalStatus,
   EXISTS(SELECT 1 FROM workforce_terms_acceptances t JOIN workforce_engagements w ON w.id=t.workforce_engagement_id
     WHERE t.officer_id=o.id AND t.active_key=w.id AND w.active_key=o.id AND w.status='active' AND w.environment='production'
     AND t.terms_version=w.terms_version AND julianday(w.review_due_at)>julianday('now')
     AND t.environment='production' AND t.integrity_state='verified' AND t.acceptance_mode='electronic_signature'
     AND julianday(t.expires_at)>julianday('now')) AS agreementSigned,
   EXISTS(SELECT 1 FROM usable_production_readiness_passports p WHERE p.officer_id=o.id) AS passportIssued,
   EXISTS(SELECT 1 FROM current_production_officer_approvals a WHERE a.officer_id=o.id) AS approvalCurrent
   FROM production_entity_links l JOIN officers o ON o.id=l.entity_id
   WHERE l.kind='officer' AND l.case_id=? AND l.case_version=? AND l.owner_user_id=?`).bind(record.id,record.version,actor.userId).first<{id:string;approvalStatus:string;agreementSigned:number;passportIssued:number;approvalCurrent:number}>():null;
  cases.push({...base,checklist:officerOnboardingChecklist({accountLinked:record.accountLinked,intakeReviewed:record.status==='reviewed',identityVerified:!!identity,psiraVerified:record.verification?.verified===true,psiraGradeMissing:applicationPsiraDeclaration(record.details.pathway,record.details.psiraStatus)==='registered'&&!record.details.psiraGrade,agreementSigned:officer?.agreementSigned===1,officerApproved:officer?.approvalStatus==='approved'&&officer?.approvalCurrent===1,passportIssued:officer?.passportIssued===1},record.id)});
 }
 return onboardingSummary(cases);
}
