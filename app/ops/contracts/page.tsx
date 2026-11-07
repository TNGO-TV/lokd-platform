import { requireOperationsPage } from '../../lib/operations-page-access';
import ZoneOperations from '../../components/zone-operations';
export const dynamic = 'force-dynamic';
export default async function Page() { await requireOperationsPage('/ops/contracts'); return <ZoneOperations view="contracts"/>; }
