import {requireOperationsPage} from '../../lib/operations-page-access';
import OperationsApp from '../../components/operations-app';
export const dynamic='force-dynamic';
export default async function Page(){await requireOperationsPage('/ops/audit');return <OperationsApp view="audit"/>;}
