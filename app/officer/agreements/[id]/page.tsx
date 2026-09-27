import {requireLokdUser} from '../../../lokd-auth';
import ProductionSigningPanel from '../../../components/production-signing-panel';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  await requireLokdUser('/officer/agreements/'+id);
  return <ProductionSigningPanel kind="officer" focusId={id}/>;
}
