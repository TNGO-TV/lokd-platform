import {requireOperationsPage} from '../../lib/operations-page-access';
import OperationsSecurity from '../../components/operations-security';
export const dynamic='force-dynamic';
export default async function Page(){await requireOperationsPage('/ops/security',true);return <OperationsSecurity/>;}
