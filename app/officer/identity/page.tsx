import Link from 'next/link';
import {requireLokdUser} from '../../lokd-auth';
import IdentityPanel from '../../components/identity-panel';
export const dynamic='force-dynamic';
export const metadata={title:'Identity checks',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{caseId?:string}>}){await requireLokdUser('/officer/identity');const {caseId}=await searchParams;return !caseId?<main><h1>Identity checks</h1><p>Choose a linked officer application from your account to open its sandbox checks. No identity check has been started.</p><Link href="/officer">Return to my submission</Link></main>:<IdentityPanel caseId={caseId}/>;}
