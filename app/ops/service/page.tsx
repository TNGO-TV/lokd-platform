import {requirePilotPageRole,principalHasRole} from '../../lib/pilot-page-access';
import PilotAccessDenied from '../../components/pilot-access-denied';
import ProductionOperationsPanel from '../../components/production-operations-panel';
export const dynamic='force-dynamic';
export default async function Page(){const {user,principal}=await requirePilotPageRole('operations','/ops/service');if(!principalHasRole(principal,'operations'))return <PilotAccessDenied email={user.email} role="operations"/>;return <ProductionOperationsPanel kind="officer" operations/>;}
