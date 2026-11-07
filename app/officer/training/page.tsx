import { requireLokdUser } from '../../lokd-auth';
import ZoneTraining from '../../components/zone-training';
export const dynamic = 'force-dynamic';
export default async function Page() { await requireLokdUser('/officer/training'); return <ZoneTraining />; }
