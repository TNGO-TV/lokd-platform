import { requireLokdUser } from '../../lokd-auth';
import { principalForEmail, principalHasRole } from '../../lib/pilot-runtime';
import PilotAccessDenied from '../../components/pilot-access-denied';
import PsiraVerificationPanel from '../../components/psira-verification-panel';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const user = await requireLokdUser('/officer/psira');
  const principal = principalForEmail(user.email, user.displayName);
  if (!principalHasRole(principal, 'officer')) return <PilotAccessDenied email={user.email} role="officer"/>;
  return <PsiraVerificationPanel scope="officer"/>;
}
