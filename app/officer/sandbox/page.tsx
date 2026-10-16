import {requireTestSurfacePage} from '../../lib/test-surface-page';
import { requireLokdUser } from '../../lokd-auth';
import SandboxCompletionWorkspace from '../../components/sandbox-completion-workspace';
export const dynamic = 'force-dynamic';
async function SandboxPage({ searchParams }: {
    searchParams: Promise<{
        applicantId?: string;
        applicantVersion?: string;
        workspace?: string;
        financeSection?: string;
    }>;
}) { const query = await searchParams; const selected = new URLSearchParams(); if (query.applicantId)
    selected.set('applicantId', query.applicantId); if (query.applicantVersion)
    selected.set('applicantVersion', query.applicantVersion); if (query.workspace)
    selected.set('workspace', query.workspace); if (query.financeSection)
    selected.set('financeSection', query.financeSection); const user = await requireLokdUser('/officer/sandbox' + (selected.size ? '?' + selected : '')); void user; return <SandboxCompletionWorkspace applicantId={query.applicantId ?? ''} applicantVersion={Number(query.applicantVersion) || 1}/>; }
export default async function Page(props: Parameters<typeof SandboxPage>[0]) {
 await requireTestSurfacePage();
 return <SandboxPage {...props}/>; }
