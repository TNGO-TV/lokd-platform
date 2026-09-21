import {requireLokdUser} from '../../lokd-auth';
import TestCyclePanel from '../../components/test-cycle-panel';
export const dynamic='force-dynamic';
export default async function Page(){await requireLokdUser('/officer/test-cycle');return <TestCyclePanel kind="officer"/>;}
