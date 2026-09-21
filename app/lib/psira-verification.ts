import type { PsiraDeclaration } from './psira-pathway';
export const PSIRA_SOURCE = 'https://digitalservices.psira.co.za/verify-user/4';
export const REGISTRATION_STATUSES = ['not_required', 'pending_review', 'registered', 'not_registered', 'unavailable', 'ambiguous'] as const;
export type RegistrationStatus = typeof REGISTRATION_STATUSES[number];
export type PsiraEvidence = {
  source: string; checkedAt: string; returnedNumber: string; returnedName: string;
  returnedStatus: string; grade: string; certificateExpiry: string;
  employmentStatus: string; excerpt: string; identityEvidence: string;
};
export type PsiraEvent = {
  id: string; version: number; psira_number: string; kind: string; declaration: PsiraDeclaration;
  registration_status: RegistrationStatus; identity_match: string;
  evidence_json: string; evidence_hash: string; recorded_by: string;
  recorded_at: string; recheck_at: string | null;
};
export type PsiraCase = {
  id: string; owner_user_id: string; owner_email: string; psira_number: string;
  version: number; latest_event_id: string; updated_at: string; declaration: PsiraDeclaration;
  events: PsiraEvent[]; verified: boolean; recheckDue: boolean;
};
export class PsiraError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function psiraNumber(value: unknown) {
  if (typeof value !== 'string' || !/^\d{1,12}$/.test(value.trim())) throw new PsiraError('Enter the numeric PSiRA registration number.');
  return value.trim();
}
export function verificationState(event: PsiraEvent | undefined, now = Date.now()) {
  const deadline = event?.recheck_at ? Date.parse(event.recheck_at) : NaN;
  const recheckDue = event?.registration_status !== 'not_required' && (!Number.isFinite(deadline) || deadline <= now);
  return { verified: !!event && event.registration_status === 'registered' && event.identity_match === 'confirmed' && !recheckDue, recheckDue };
}
export function reviewEvidence(body: Record<string, unknown>, number: string, now = Date.now()) {
  const registration = body.registrationStatus;
  if (!REGISTRATION_STATUSES.includes(registration as RegistrationStatus) || (registration === 'pending_review' || registration === 'not_required')) throw new PsiraError('Choose the observed registration outcome.');
  const identity = body.identityMatch;
  if (!['unchecked', 'confirmed', 'mismatch'].includes(String(identity))) throw new PsiraError('Choose the identity-match outcome.');
  const raw = body.evidence;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new PsiraError('Record the dated source evidence.');
  const input = raw as Record<string, unknown>;
  const evidence = Object.fromEntries(['source','checkedAt','returnedNumber','returnedName','returnedStatus','grade','certificateExpiry','employmentStatus','excerpt','identityEvidence'].map(key => {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > (key === 'excerpt' ? 6000 : 500)) throw new PsiraError('Evidence fields are too long or invalid.');
    return [key, value.trim()];
  })) as PsiraEvidence;
  // Evidence is recorded, never fetched from a reviewer-supplied URL.
  if (evidence.source !== PSIRA_SOURCE) throw new PsiraError('Use the official PSiRA individual verification service as the source.');
  const checked = Date.parse(evidence.checkedAt);
  if (!Number.isFinite(checked) || checked > now + 60000 || checked < now - 30 * 86400000) throw new PsiraError('Use a check time within the past 30 days.');
  evidence.checkedAt = new Date(checked).toISOString();
  if (!evidence.excerpt) throw new PsiraError('Record the result or the observed failure.');
  if (registration === 'registered' && (evidence.returnedNumber !== number || !evidence.returnedName || evidence.returnedStatus.toLowerCase() !== 'registered')) throw new PsiraError('A registered result must include the matching number, returned name and Registered source status.');
  if (registration === 'not_registered' && (evidence.returnedNumber !== number || !['not registered','unregistered','deregistered','de-registered','cancelled','suspended','registration cancelled','registration suspended'].includes(evidence.returnedStatus.toLowerCase()))) throw new PsiraError('Record the explicit source status. An empty search is ambiguous, not proof of non-registration.');
  if (identity === 'confirmed' && (registration !== 'registered' || !evidence.identityEvidence)) throw new PsiraError('Confirm identity only after a registered lookup and independent identity-match evidence.');
  let recheck = Date.parse(String(body.recheckAt ?? ''));
  if (!Number.isFinite(recheck) || recheck <= now || recheck > checked + 30 * 86400000) throw new PsiraError('Schedule a recheck in the future, no later than 30 days after the source check.');
  if (evidence.certificateExpiry) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(evidence.certificateExpiry) || !Number.isFinite(Date.parse(evidence.certificateExpiry)) || new Date(evidence.certificateExpiry).toISOString().slice(0,10) !== evidence.certificateExpiry) throw new PsiraError('Use YYYY-MM-DD for certificate expiry.');
    // Conservatively expire at the start of the stated date in South Africa.
    recheck = Math.min(recheck, Date.parse(`${evidence.certificateExpiry}T00:00:00+02:00`));
  }
  return { registration: registration as RegistrationStatus, identity: String(identity), evidence, recheckAt: new Date(recheck).toISOString() };
}
