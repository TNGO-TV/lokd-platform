import {requirePilotPageRole,principalHasRole} from '../../lib/pilot-page-access';
import PilotAccessDenied from '../../components/pilot-access-denied';
import IdentityPanel from '../../components/identity-panel';
export const dynamic='force-dynamic';
export const metadata={title:'Applicant identity evidence',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{caseId?:string}>}){const {user,principal}=await requirePilotPageRole('operations','/ops/identity');if(!principalHasRole(principal,'operations'))return <PilotAccessDenied email={user.email} role="operations"/>;const {caseId}=await searchParams;return <IdentityPanel caseId={caseId??''} operations/>;}
