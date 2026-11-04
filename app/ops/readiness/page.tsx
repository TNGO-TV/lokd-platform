import {requireOperationsPage} from '../../lib/operations-page-access';
import ReadinessWorkspace from '../../components/readiness-workspace';
export const dynamic='force-dynamic';
export const metadata={title:'Identity & readiness review',robots:{index:false,follow:false}};
async function ReadinessPage({searchParams}:{searchParams:Promise<{applicantId?:string;officerId?:string;identityId?:string}>}){
 const input=await searchParams;
 const params={applicantId:typeof input.applicantId==='string'?input.applicantId:'',officerId:typeof input.officerId==='string'?input.officerId:'',identityId:typeof input.identityId==='string'?input.identityId:''};
 const returnTo='/ops/readiness?'+new URLSearchParams(Object.entries(params).filter(([,value])=>typeof value==='string') as [string,string][]).toString();
 const principal=await requireOperationsPage(returnTo);

 return <ReadinessWorkspace {...params} operations owner={principal.owner}/>;
}

// Keep query-dependent auth in the rendered tree; the framework route probe omits search selectors.
export default function Page(props:Parameters<typeof ReadinessPage>[0]){return <ReadinessPage {...props}/>;}
