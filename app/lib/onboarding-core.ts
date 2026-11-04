import type {OnboardingCase,OnboardingChecklistItem,OnboardingState} from './onboarding-types';

// The specialist workspace also uses these requirements when describing intake.
export const PRODUCTION_ONBOARDING_BLOCKERS=[
 'Identity and registration must be current and approved.',
 'The officer must sign the current workforce agreement.',
 'Operations must approve the officer and assignment before work starts.',
] as const;
export type OfficerOnboardingFacts={accountLinked:boolean;intakeReviewed:boolean;identityVerified:boolean;psiraVerified:boolean;psiraGradeMissing?:boolean;agreementSigned:boolean;officerApproved:boolean;passportIssued:boolean};
export function officerOnboardingChecklist(facts:OfficerOnboardingFacts,applicationId:string):OnboardingChecklistItem[]{
 const identity='/officer/identity?caseId='+encodeURIComponent(applicationId);
 return ([
  ['account','Link your application',facts.accountLinked,'/signup?kind=officer'],
  ['intake','Application review',facts.intakeReviewed,'/signup?kind=officer'],
  ['identity','Identity check',facts.identityVerified,identity],
  ['psira',facts.psiraGradeMissing?'Add your PSiRA grade':'Your PSiRA status',facts.psiraVerified&&!facts.psiraGradeMissing,facts.psiraGradeMissing?'/signup?kind=officer':'/officer/psira'],
  ['agreement','Workforce agreement',facts.agreementSigned,'/officer/agreements'],
  ['approval','Officer approval',facts.officerApproved,'/officer/readiness?applicantId='+encodeURIComponent(applicationId)],
  ['passport','Your LOKD Passport',facts.passportIssued,'/officer/readiness?applicantId='+encodeURIComponent(applicationId)],
 ] as const).map(([id,label,complete,href])=>({id,label,status:complete?'complete':'required',href}));
}
export function onboardingSummary(cases:OnboardingCase[],generatedAt=new Date().toISOString()):OnboardingState{
 const checks=cases.flatMap(item=>item.checklist);
 return {generatedAt,cases,summary:{completedCases:cases.filter(item=>item.checklist.length>0&&item.checklist.every(check=>check.status==='complete')).length,totalCases:cases.length,passedChecks:checks.filter(item=>item.status==='complete').length,requiredChecks:checks.length}};
}
