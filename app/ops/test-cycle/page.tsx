import {requirePilotPageRole,principalHasRole} from '../../lib/pilot-page-access';
import PilotAccessDenied from '../../components/pilot-access-denied';
import TestCyclePanel from '../../components/test-cycle-panel';
export const dynamic='force-dynamic';
export default async function Page(){const {user,principal}=await requirePilotPageRole('operations','/ops/test-cycle');if(!principalHasRole(principal,'operations'))return <PilotAccessDenied email={user.email} role="operations"/>;return <TestCyclePanel kind="officer" operations/>;}
