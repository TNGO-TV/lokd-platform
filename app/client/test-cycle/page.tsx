import {requireTestSurfacePage} from '../../lib/test-surface-page';
import {requireLokdUser} from '../../lokd-auth';
import TestCyclePanel from '../../components/test-cycle-panel';
export const dynamic='force-dynamic';
export default async function Page(){
 await requireTestSurfacePage();
await requireLokdUser('/client/test-cycle');return <TestCyclePanel kind="client"/>;}
