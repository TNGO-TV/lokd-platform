// Stored identifiers written by earlier releases.
//
// These exact values exist in D1 rows and in drizzle/*.sql triggers, so they
// cannot be renamed. Production code uses them only to reject such records.
// This file is allowlisted in scripts/check-banned-copy.sh for that reason;
// add nothing here that is not a persisted value.

/** Funding provider value that D1 triggers refuse for production funding. */
export const MANUAL_FUNDING_PROVIDER = "demo_manual";

/** Prefix used by non-production document and evidence references. */
export const NONPRODUCTION_REFERENCE_PREFIX = "demo:";

/** Evidence references that cannot back a production record. */
export const NONPRODUCTION_REFERENCE_PATTERN = /demo:|synthetic|\.invalid\b|\.example\b/i;

/** Payroll policy versions that cannot be activated in production. */
export const NONPRODUCTION_POLICY_VERSION_PATTERN = /synthetic|test|demo/i;
