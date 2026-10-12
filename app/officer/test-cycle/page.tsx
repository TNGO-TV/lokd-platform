import {requireLokdUser} from '../../lokd-auth';
import TestCyclePanel from '../../components/test-cycle-panel';
import {testingToolsEnabled,TestingToolsUnavailable} from '../../lib/testing-tools';
export const dynamic='force-dynamic';
export default async function Page(){await requireLokdUser('/officer/test-cycle');if(!testingToolsEnabled())return <TestingToolsUnavailable returnTo="/officer"/>;return <TestCyclePanel kind="officer"/>;}
