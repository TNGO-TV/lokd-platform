import {requireLokdUser} from '../../lokd-auth';
import IdentityPanel from '../../components/identity-panel';
export const dynamic='force-dynamic';
export const metadata={title:'Identity checks',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{caseId?:string}>}){await requireLokdUser('/officer/identity');const {caseId}=await searchParams;return <IdentityPanel caseId={caseId??''}/>;}
