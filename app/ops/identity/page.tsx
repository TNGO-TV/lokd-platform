import Link from 'next/link';
import {requirePilotPageRole,principalHasRole} from '../../lib/pilot-page-access';
import PilotAccessDenied from '../../components/pilot-access-denied';
import IdentityPanel from '../../components/identity-panel';
export const dynamic='force-dynamic';
export const metadata={title:'Applicant identity evidence',robots:{index:false,follow:false}};
async function IdentityPage({searchParams}:{searchParams:Promise<{caseId?:string}>}){const {caseId}=await searchParams;const {user,principal}=await requirePilotPageRole('operations','/ops/identity'+(caseId?'?caseId='+encodeURIComponent(caseId):''));if(!principalHasRole(principal,'operations'))return <PilotAccessDenied email={user.email} role="operations"/>;return !caseId?<main><h1>Identity checks</h1><p>Choose a linked officer application from your intake review to open its sandbox checks. No identity check has been started.</p><Link href="/ops">Return to intake review</Link></main>:<IdentityPanel caseId={caseId} operations/>;}

// Keep query-dependent auth in the rendered tree; the framework route probe omits search selectors.
export default function Page(props:Parameters<typeof IdentityPage>[0]){return <IdentityPage {...props}/>;}
