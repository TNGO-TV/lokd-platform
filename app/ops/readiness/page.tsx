import {requirePilotPageRole,principalHasRole} from '../../lib/pilot-page-access';
import PilotAccessDenied from '../../components/pilot-access-denied';
import ReadinessWorkspace from '../../components/readiness-workspace';
export const dynamic='force-dynamic';
export const metadata={title:'Identity & readiness review',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{applicantId?:string;officerId?:string;identityId?:string}>}){
 const input=await searchParams;
 const params={applicantId:typeof input.applicantId==='string'?input.applicantId:'',officerId:typeof input.officerId==='string'?input.officerId:'',identityId:typeof input.identityId==='string'?input.identityId:''};
 const returnTo='/ops/readiness?'+new URLSearchParams(Object.entries(params).filter(([,value])=>typeof value==='string') as [string,string][]).toString();
 const {user,principal}=await requirePilotPageRole('operations',returnTo);
 if(!principalHasRole(principal,'operations'))return <PilotAccessDenied email={user.email} role="operations"/>;
 return <ReadinessWorkspace {...params} operations owner={principal.owner}/>;
}
