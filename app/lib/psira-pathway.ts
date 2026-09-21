export type PsiraDeclaration = 'registered' | 'not_registered' | 'training';
// Training intake is not an application for permission to perform security work.
export function applicationPsiraDeclaration(pathway: string, status: string): PsiraDeclaration {
  if (pathway === 'training' || status === 'in_training') return 'training';
  return status === 'active' || status === 'expired' ? 'registered' : 'not_registered';
}
export function psiraIntakeStatus(declaration: PsiraDeclaration) {
  return declaration === 'registered' ? 'psira_review_required' : declaration === 'training' ? 'training_requested' : 'registration_guidance';
}
