import {requireOperationsPage} from '../../lib/operations-page-access';
import PsiraVerificationPanel from '../../components/psira-verification-panel';
export const dynamic='force-dynamic';
export default async function Page(){await requireOperationsPage('/ops/psira');return <PsiraVerificationPanel scope="operations"/>;}
