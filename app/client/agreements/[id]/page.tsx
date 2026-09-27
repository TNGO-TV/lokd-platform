import ClientQuotesPanel from '../../../components/client-quotes-panel';
import {requireLokdUser} from '../../../lokd-auth';
import ProductionSigningPanel from '../../../components/production-signing-panel';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  await requireLokdUser('/client/agreements/'+id);
  return <><ClientQuotesPanel focusId={id}/><details><summary>Earlier client agreement records</summary><ProductionSigningPanel kind="client" focusId={id}/></details></>;
}
