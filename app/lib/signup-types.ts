export type SignupKind = 'client' | 'officer';
export type SignupStatus = 'received' | 'awaiting_review' | 'needs_information' | 'reviewed' | 'withdrawn';
export type SignupRecord = {
  id: string; kind: SignupKind; email: string; createdAt: string; updatedAt: string;
  accountLinked: boolean; version: number; status: SignupStatus; note: string;
  verification?: { verified:boolean; registrationStatus:string; identityMatch:string; checkedAt:string|null; recheckAt:string|null };
  details: Record<string, string>; events: Array<{ action: string; note: string; recordedAt: string }>;
};
export const signupStatusLabels: Record<SignupStatus, string> = {
  received: 'Received · link your account', awaiting_review: 'Awaiting Operations review',
  needs_information: 'Information needed', reviewed: 'Intake reviewed · further checks pending', withdrawn: 'Withdrawn',
};
export function signupNextStep(record: SignupRecord) {
  if (record.status === 'withdrawn') return 'This application is withdrawn. Contact Operations through the existing review process before starting again.';
  if (!record.accountLinked) return 'Link this submission to your signed-in account to follow its progress and send corrections.';
  if (record.status === 'needs_information') return 'Read the Operations request, correct the details below and resubmit for review.';
  if (record.status === 'reviewed') return record.kind === 'client'
    ? 'Operations has reviewed your intake. Organisation authority, the service plan and approved agreements still need to be completed before service can start.'
    : 'Operations has reviewed your intake. This is not work approval. The requirements for your registration or training pathway still apply.';
  return 'Operations will review your submission. You can correct your details here while you wait.';
}
