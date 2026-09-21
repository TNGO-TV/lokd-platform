export const OPERATIONS_MFA_MAX_AGE_MINUTES = 5;

// Only call at the authenticated Clerk boundary. Missing/negative second-factor
// age is not MFA, even when Clerk permits first-factor reverification fallback.
export function clerkSecondFactorVerifiedAt(age: unknown, issuedAt: unknown, enrolled: boolean, now = Date.now()): string | null {
  if (!enrolled || !Array.isArray(age) || age.length !== 2 || !Number.isInteger(age[1]) || age[1] < 0
    || typeof issuedAt !== 'number' || !Number.isFinite(issuedAt) || issuedAt * 1000 > now + 60_000) return null;
  // fva is in whole minutes. Use the earliest possible verification time.
  const timestamp = Math.min(issuedAt * 1000, now) - (age[1] + 1) * 60_000;
  return timestamp > 0 ? new Date(timestamp).toISOString() : null;
}

export function operationsMfaStatus(headers: Headers, now = Date.now()) {
  const verifiedAt = headers.get('x-lokd-verified-second-factor-at');
  const age = verifiedAt ? now - Date.parse(verifiedAt) : NaN;
  return {
    enrolled: headers.get('x-lokd-verified-mfa-enrolled') === 'true',
    fresh: headers.get('x-lokd-verified-mfa-enrolled') === 'true' && headers.has('x-lokd-verified-user-id') && Number.isFinite(age) && age >= 0
      && age < OPERATIONS_MFA_MAX_AGE_MINUTES * 60_000,
    verifiedAt,
    maxAgeMinutes: OPERATIONS_MFA_MAX_AGE_MINUTES,
  };
}
