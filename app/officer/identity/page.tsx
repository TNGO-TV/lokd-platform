import Link from 'next/link';
import {requireLokdUser} from '../../lokd-auth';
import IdentityPanel from '../../components/identity-panel';
export const dynamic='force-dynamic';
export const metadata={title:'Identity check',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{caseId?:string}>}){
 const {caseId}=await searchParams;
 await requireLokdUser('/officer/identity');
 return caseId?<IdentityPanel caseId={caseId}/>:<main><h1>Identity check</h1><p>Choose your officer application from your account.</p><Link href="/officer">Back to account</Link></main>;
}
