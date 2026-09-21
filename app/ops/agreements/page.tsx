import OperationalDeliveryPanel from '../../components/operational-delivery-panel';
import {requirePilotPageRole,principalHasRole} from '../../lib/pilot-page-access';
import PilotAccessDenied from '../../components/pilot-access-denied';
import ProductionSigningPanel from '../../components/production-signing-panel';
export const dynamic='force-dynamic';
export default async function Page(){const {user,principal}=await requirePilotPageRole('operations','/ops/agreements');if(!principalHasRole(principal,'operations'))return <PilotAccessDenied email={user.email} role="operations"/>;return <><ProductionSigningPanel kind="officer" operations/><OperationalDeliveryPanel/></>;}
