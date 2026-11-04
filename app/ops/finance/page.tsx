import {requireOperationsPage} from '../../lib/operations-page-access';
import FinanceOperations from '../../components/finance-operations';
export const dynamic='force-dynamic';
export default async function Page(){await requireOperationsPage('/ops/finance');return <FinanceOperations/>;}
