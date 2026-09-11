import { env } from 'cloudflare:workers';
import { headers } from 'next/headers';
import { hasLinkedOfficerSignup } from '../../lib/signup-server';
import { requireLokdUser } from '../../lokd-auth';
import { principalForEmail, principalHasRole } from '../../lib/pilot-runtime';
import PilotAccessDenied from '../../components/pilot-access-denied';
import PsiraVerificationPanel from '../../components/psira-verification-panel';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const user = await requireLokdUser('/officer/psira');
  const principal = principalForEmail(user.email, user.displayName);
  const userId=(await headers()).get('x-lokd-verified-user-id');
  const applicant=userId&&env.DB&&await hasLinkedOfficerSignup(env.DB,userId);
  if (!principalHasRole(principal, 'officer')&&!applicant) return <PilotAccessDenied email={user.email} role="officer"/>;
  return <PsiraVerificationPanel scope="officer"/>;
}
