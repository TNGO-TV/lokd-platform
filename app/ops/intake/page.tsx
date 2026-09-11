import { requireLokdUser } from '../../lokd-auth';
import { principalForEmail,principalHasRole } from '../../lib/pilot-runtime';
import PilotAccessDenied from '../../components/pilot-access-denied';
import SignupPortal from '../../components/signup-portal';
export const dynamic='force-dynamic';
export default async function Page(){const user=await requireLokdUser('/ops/intake');if(!principalHasRole(principalForEmail(user.email),'operations'))return <PilotAccessDenied email={user.email} role="operations"/>;return <SignupPortal kind="officer" operations/>;}
