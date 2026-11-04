import {requireOperationsPage} from '../../../lib/operations-page-access';
import ClientQuotesPanel from '../../../components/client-quotes-panel';
import OperationalDeliveryPanel from '../../../components/operational-delivery-panel';
import ProductionSigningPanel from '../../../components/production-signing-panel';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  await requireOperationsPage('/ops/agreements/'+id);

  return <><ClientQuotesPanel operations focusId={id}/><ProductionSigningPanel kind="officer" operations focusId={id}/><OperationalDeliveryPanel/></>;
}
