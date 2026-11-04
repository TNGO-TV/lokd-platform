export type OnboardingScope='operations'|'client'|'officer';
export type OnboardingChecklistItem={id:string;label:string;status:'complete'|'required';href:string};
export type OnboardingCase={id:string;displayName:string;status:string;checklist:OnboardingChecklistItem[]};
export type OnboardingState={generatedAt:string;cases:OnboardingCase[];summary:{completedCases:number;totalCases:number;passedChecks:number;requiredChecks:number}};
export type OnboardingAction={action:'refresh_onboarding'};
