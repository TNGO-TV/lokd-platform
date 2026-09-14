import {requireLokdUser} from '../../lokd-auth';
import ReadinessWorkspace from '../../components/readiness-workspace';
export const dynamic='force-dynamic';
export const metadata={title:'My identity & readiness',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{applicantId?:string;officerId?:string;identityId?:string}>}){
 const input=await searchParams;
 const params={applicantId:typeof input.applicantId==='string'?input.applicantId:'',officerId:typeof input.officerId==='string'?input.officerId:'',identityId:typeof input.identityId==='string'?input.identityId:''};
 await requireLokdUser('/officer/readiness?'+new URLSearchParams(Object.entries(params).filter(([,value])=>typeof value==='string') as [string,string][]).toString());
 return <ReadinessWorkspace {...params}/>;
}
