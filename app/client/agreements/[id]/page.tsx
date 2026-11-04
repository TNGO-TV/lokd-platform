import ClientQuotesPanel from '../../../components/client-quotes-panel';
import {requireLokdUser} from '../../../lokd-auth';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  await requireLokdUser('/client/agreements/'+id);
  return <ClientQuotesPanel focusId={id}/>;
}
