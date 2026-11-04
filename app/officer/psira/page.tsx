import {requireLokdUser} from '../../lokd-auth';
import PsiraVerificationPanel from '../../components/psira-verification-panel';
export const dynamic='force-dynamic';
export default async function Page(){await requireLokdUser('/officer/psira');return <PsiraVerificationPanel scope="officer"/>;}
