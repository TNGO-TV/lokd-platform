import {requireOperationsPage} from '../../lib/operations-page-access';
import ProductionOperationsPanel from '../../components/production-operations-panel';
export const dynamic='force-dynamic';
export default async function Page(){await requireOperationsPage('/ops/service');return <ProductionOperationsPanel kind="officer" operations/>;}
