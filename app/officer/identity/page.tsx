import {requireTestSurfacePage} from '../../lib/test-surface-page';
import Link from 'next/link';
import {requireLokdUser} from '../../lokd-auth';
import IdentityPanel from '../../components/identity-panel';
export const dynamic='force-dynamic';
export const metadata={title:'Identity checks',robots:{index:false,follow:false}};
async function IdentityPage({searchParams}:{searchParams:Promise<{caseId?:string}>}){const {caseId}=await searchParams;await requireLokdUser('/officer/identity'+(caseId?'?caseId='+encodeURIComponent(caseId):''));return !caseId?<main><h1>Identity checks</h1><p>Choose a linked officer application from your account to open its sandbox checks. No identity check has been started.</p><Link href="/officer">Return to my submission</Link></main>:<IdentityPanel caseId={caseId}/>;}

// Keep query-dependent auth in the rendered tree; the framework route probe omits search selectors.
export default async function Page(props:Parameters<typeof IdentityPage>[0]){
 await requireTestSurfacePage();
return <IdentityPage {...props}/>;}
