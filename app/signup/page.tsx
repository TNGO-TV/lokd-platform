import {pageTestSurfacesEnabled} from '../lib/test-surface-page';
import { headers } from 'next/headers';
import { requireLokdUser } from '../lokd-auth';
import { workspaceRoleForHost,requestHostname } from '../lib/public-site';
import SignupPortal from '../components/signup-portal';
import WorkspaceShell from '../components/workspace-shell';
export const dynamic='force-dynamic';
export const metadata={title:'Your LOKD submission',robots:{index:false,follow:false}};
async function SignupPage({searchParams}:{searchParams:Promise<{kind?:string}>}) {
 const selection=await searchParams;
 await requireLokdUser('/signup?kind='+(selection.kind==='client'?'client':'officer'));
 const role=workspaceRoleForHost(requestHostname((await headers()).get('host')));
 const kind=role==='client'?'client':role==='officer'?'officer':selection.kind==='client'?'client':'officer';
 return <WorkspaceShell role={kind} testTools={await pageTestSurfacesEnabled()}><SignupPortal kind={kind}/></WorkspaceShell>;
}

// Keep query-dependent auth in the rendered tree; the framework route probe omits search selectors.
export default function Page(props:Parameters<typeof SignupPage>[0]){return <SignupPage {...props}/>;}
