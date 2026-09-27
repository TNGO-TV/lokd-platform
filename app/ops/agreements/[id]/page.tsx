import ClientQuotesPanel from '../../../components/client-quotes-panel';
import OperationalDeliveryPanel from '../../../components/operational-delivery-panel';
import {requirePilotPageRole,principalHasRole} from '../../../lib/pilot-page-access';
import PilotAccessDenied from '../../../components/pilot-access-denied';
import ProductionSigningPanel from '../../../components/production-signing-panel';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const {user,principal}=await requirePilotPageRole('operations','/ops/agreements/'+id);
  if(!principalHasRole(principal,'operations'))return <PilotAccessDenied email={user.email} role="operations"/>;
  return <><ClientQuotesPanel operations focusId={id}/><ProductionSigningPanel kind="officer" operations focusId={id}/><OperationalDeliveryPanel/></>;
}
