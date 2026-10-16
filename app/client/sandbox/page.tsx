import {requireTestSurfacePage} from '../../lib/test-surface-page';
import { requireLokdUser } from '../../lokd-auth';
import SandboxCompletionWorkspace from '../../components/sandbox-completion-workspace';
export const dynamic = 'force-dynamic';
async function SandboxPage({ searchParams }: {
    searchParams: Promise<{
        workspace?: string;
        financeSection?: string;
    }>;
}) { const query = await searchParams, selected = new URLSearchParams(); if (query.workspace)
    selected.set('workspace', query.workspace); if (query.financeSection)
    selected.set('financeSection', query.financeSection); await requireLokdUser('/client/sandbox' + (selected.size ? '?' + selected : '')); return <SandboxCompletionWorkspace kind="client"/>; }
export default async function Page(props: Parameters<typeof SandboxPage>[0]) {
 await requireTestSurfacePage();
 return <SandboxPage {...props}/>; }
