import {requireOperationsPage} from '../../lib/operations-page-access';
import ClientQuotesPanel from '../../components/client-quotes-panel';
import OperationalDeliveryPanel from '../../components/operational-delivery-panel';
import ProductionSigningPanel from '../../components/production-signing-panel';
export const dynamic='force-dynamic';
export default async function Page(){await requireOperationsPage('/ops/agreements');return <><ClientQuotesPanel operations/><ProductionSigningPanel kind="officer" operations/><OperationalDeliveryPanel/></>;}
