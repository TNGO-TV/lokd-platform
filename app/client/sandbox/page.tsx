import { requireLokdUser } from '../../lokd-auth';
import SandboxCompletionWorkspace from '../../components/sandbox-completion-workspace';
import { testingToolsEnabled, TestingToolsUnavailable } from '../../lib/testing-tools';
export const dynamic = 'force-dynamic';
async function SandboxPage({ searchParams }: {
    searchParams: Promise<{
        workspace?: string;
        financeSection?: string;
    }>;
}) { const query = await searchParams, selected = new URLSearchParams(); if (query.workspace)
    selected.set('workspace', query.workspace); if (query.financeSection)
    selected.set('financeSection', query.financeSection); await requireLokdUser('/client/sandbox' + (selected.size ? '?' + selected : '')); if (!testingToolsEnabled()) return <TestingToolsUnavailable returnTo="/client"/>; return <SandboxCompletionWorkspace kind="client"/>; }
export default function Page(props: Parameters<typeof SandboxPage>[0]) { return <SandboxPage {...props}/>; }
