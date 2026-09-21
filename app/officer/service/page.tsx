import {requireLokdUser} from '../../lokd-auth';
import ProductionOperationsPanel from '../../components/production-operations-panel';
export const dynamic='force-dynamic';
export default async function Page(){await requireLokdUser('/officer/service');return <ProductionOperationsPanel kind="officer"/>;}
