import {requireOperationsPage} from '../../lib/operations-page-access';
import {SpecialistOperationsControl} from '../../components/specialist-operations-control';
export const dynamic='force-dynamic';
export default async function Page(){await requireOperationsPage('/ops/specialist');return <SpecialistOperationsControl/>;}
