export const OPERATIONS_MFA_MAX_AGE_MINUTES = 5;

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
