import {redirect} from 'next/navigation';
import {requireOperationsPage} from '../../lib/operations-page-access';
export const dynamic='force-dynamic';
export default async function Page(){await requireOperationsPage('/ops/identity');redirect('/ops/readiness');}
