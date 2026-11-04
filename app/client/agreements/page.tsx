import ClientQuotesPanel from '../../components/client-quotes-panel';
import {requireLokdUser} from '../../lokd-auth';
export const dynamic='force-dynamic';
export default async function Page(){await requireLokdUser('/client/agreements');return <ClientQuotesPanel/>;}
