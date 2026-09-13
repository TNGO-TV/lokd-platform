import { headers } from 'next/headers';
import { requireLokdUser } from '../lokd-auth';
import { workspaceRoleForHost,requestHostname } from '../lib/public-site';
import SignupPortal from '../components/signup-portal';
import WorkspaceShell from '../components/workspace-shell';
export const dynamic='force-dynamic';
export const metadata={title:'Your LOKD submission',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{kind?:string}>}) {
 await requireLokdUser('/signup');
 const role=workspaceRoleForHost(requestHostname((await headers()).get('host')));
 const kind=role==='client'?'client':role==='officer'?'officer':(await searchParams).kind==='client'?'client':'officer';
 return <WorkspaceShell role={kind}><SignupPortal kind={kind}/></WorkspaceShell>;
}
