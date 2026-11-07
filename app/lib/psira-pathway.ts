export type PsiraDeclaration = 'registered' | 'not_registered' | 'training';
// Training intake is not an application for permission to perform security work.
export function applicationPsiraDeclaration(pathway: string, status: string): PsiraDeclaration {
  if (pathway === 'training' || status === 'in_training') return 'training';
  return status === 'active' || status === 'expired' ? 'registered' : 'not_registered';
}
export function psiraIntakeStatus(declaration: PsiraDeclaration) {
  return declaration === 'registered' ? 'psira_review_required' : declaration === 'training' ? 'training_requested' : 'registration_guidance';
}

export type OfficerEntryPath = 'registered' | 'new';
export function officerEntryPath(path: string | null): OfficerEntryPath {
  return path === 'new' || path === 'training' ? 'new' : 'registered';
}
export const officerAvailability = ['Weekdays', 'Weekends', 'Day shifts', 'Night shifts', 'On-demand shifts', 'Roster / contract work'] as const;
export const renewalStatuses = [
  ['not_started', 'I need help to start my renewal'],
  ['preparing_documents', 'I am preparing my renewal documents'],
  ['submitted', 'My renewal has been submitted to PSIRA'],
  ['refresher_requested', 'I would like renewal and refresher training support'],
] as const;
export const newOfficerSteps = [
  ['Apply', 'Share your contact details and entry-level training interests.'],
  ['ID check', 'Complete the identity check requested by LOKD.'],
  ['Training at LOKD', 'Build your foundation through Grade E and Grade D entry-level training.'],
  ['PSIRA registration', 'Complete the required training and apply for PSIRA registration with guidance from LOKD.'],
  ['LOKD Passport', 'Once your registration and role checks are complete, receive your LOKD Passport.'],
  ['First shifts', 'Receive suitable, grade-matched shift offers in the Officer Zone after approval for work.'],
] as const;
