import ClientQuotesPanel from '../../components/client-quotes-panel';
import {requireLokdUser} from '../../lokd-auth';
import ProductionSigningPanel from '../../components/production-signing-panel';
export const dynamic='force-dynamic';
export default async function Page(){await requireLokdUser('/client/agreements');return <><ClientQuotesPanel/><details><summary>Earlier client agreement records</summary><ProductionSigningPanel kind="client"/></details></>;}
